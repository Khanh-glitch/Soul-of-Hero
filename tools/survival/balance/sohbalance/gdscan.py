"""GDScript-aware scanning that refuses to be fooled by text.

The previous gate matched raw substrings, so a method name inside a comment, a
string literal, a test file or a function nobody calls was indistinguishable from
a real production call. Every acceptance claim built on that is worthless: the
gate itself could be spoofed by the very defect it is meant to catch.

This module gives the gate four honest questions about a call site:

1. is the token real code, or is it inside a comment / a string?  (:func:`strip_comments`,
   :func:`strip_comments_and_strings`, :func:`string_spans`)
2. is the calling file production surface, or is it a test/tool/doc path?
   (:func:`is_production_path`)
3. is that file reachable from a mounted scene or autoload?  (:class:`MountGraph`,
   three-valued: MOUNTED / NOT_MOUNTED / NOT_PINNED)
4. is the enclosing function actually referenced, or is it dead code?
   (:func:`enclosing_function`, :func:`function_is_referenced`)

Nothing here executes Godot. A ``MOUNTED`` call proves the call site exists on the
pinned production surface; it never proves the call compiles, runs or commits.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

NON_PRODUCTION_PREFIXES = (
    "tests/",
    "docs/",
    "tools/",
    "addons/",
    "artifacts/",
    ".artifacts/",
)

LIFECYCLE_FUNCTIONS = {
    "_ready",
    "_init",
    "_enter_tree",
    "_exit_tree",
    "_process",
    "_physics_process",
    "_input",
    "_unhandled_input",
    "_unhandled_key_input",
    "_notification",
    "_draw",
}

DOUBLE = '"'
SINGLE = "'"
TRIPLE_DOUBLE = '"""'
TRIPLE_SINGLE = "'''"


def is_production_path(path: str) -> bool:
    """Tests, docs, tools and editor addons are never production surface."""
    normalised = path.lstrip("/")
    return not normalised.startswith(NON_PRODUCTION_PREFIXES)


# --------------------------------------------------------------------------- lexing
def _triple_at(text: str, index: int) -> Optional[str]:
    for marker in (TRIPLE_DOUBLE, TRIPLE_SINGLE):
        if text.startswith(marker, index):
            return marker
    return None


def strip_comments(text: str) -> str:
    """Blank out ``#`` comments, keeping every newline and every string literal."""
    out: List[str] = []
    index = 0
    length = len(text)
    quote: Optional[str] = None
    while index < length:
        char = text[index]
        if quote:
            if char == "\\" and index + 1 < length:
                out.append(text[index : index + 2])
                index += 2
                continue
            if text.startswith(quote, index):
                out.append(quote)
                index += len(quote)
                quote = None
                continue
            out.append(char)
            index += 1
            continue
        if char == "#":
            while index < length and text[index] != "\n":
                out.append(" ")
                index += 1
            continue
        if char in (DOUBLE, SINGLE):
            quote = _triple_at(text, index) or char
            out.append(quote)
            index += len(quote)
            continue
        out.append(char)
        index += 1
    return "".join(out)


def strip_comments_and_strings(text: str) -> str:
    """Blank comments *and* string bodies, preserving offsets and newlines."""
    out: List[str] = []
    index = 0
    length = len(text)
    quote: Optional[str] = None
    while index < length:
        char = text[index]
        if quote:
            if char == "\\" and index + 1 < length:
                out.append("  ")
                index += 2
                continue
            if text.startswith(quote, index):
                out.append(" " * len(quote))
                index += len(quote)
                quote = None
                continue
            out.append("\n" if char == "\n" else " ")
            index += 1
            continue
        if char == "#":
            while index < length and text[index] != "\n":
                out.append(" ")
                index += 1
            continue
        if char in (DOUBLE, SINGLE):
            quote = _triple_at(text, index) or char
            out.append(" " * len(quote))
            index += len(quote)
            continue
        out.append(char)
        index += 1
    return "".join(out)


def string_spans(text: str) -> List[Tuple[int, int]]:
    """Half-open offsets of every string literal body, for span-aware matching."""
    spans: List[Tuple[int, int]] = []
    index = 0
    length = len(text)
    quote: Optional[str] = None
    start = 0
    while index < length:
        char = text[index]
        if quote:
            if char == "\\" and index + 1 < length:
                index += 2
                continue
            if text.startswith(quote, index):
                spans.append((start, index))
                index += len(quote)
                quote = None
                continue
            index += 1
            continue
        if char == "#":
            while index < length and text[index] != "\n":
                index += 1
            continue
        if char in (DOUBLE, SINGLE):
            quote = _triple_at(text, index) or char
            index += len(quote)
            start = index
            continue
        index += 1
    return spans


def _inside(spans: Sequence[Tuple[int, int]], offset: int) -> bool:
    return any(start <= offset < end for start, end in spans)


# --------------------------------------------------------------------- functions
_FUNC_RE = re.compile(r"^func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", re.MULTILINE)


def functions(text: str) -> List[Tuple[str, int]]:
    return [(match.group(1), match.start()) for match in _FUNC_RE.finditer(strip_comments(text))]


_FUNC_START_RE = re.compile(r"^func\s+", re.MULTILINE)


def function_window(text: str, offset: int) -> str:
    """The whole enclosing function body: a key is often declared above the call."""
    live = strip_comments(text)
    starts = [match.start() for match in _FUNC_START_RE.finditer(live)]
    begin = max([start for start in starts if start <= offset], default=0)
    end = min([start for start in starts if start > offset], default=len(live))
    return text[begin:end]


def enclosing_function(text: str, offset: int) -> str:
    current = ""
    for name, start in functions(text):
        if start > offset:
            break
        current = name
    return current


def function_is_referenced(text: str, name: str, other_texts: Optional[Sequence[str]] = None) -> bool:
    """True if ``name`` is called, connected, or is a Godot lifecycle hook.

    A function that no one references is dead code, and dead code must never be
    counted as an integration seam.
    """
    if name in LIFECYCLE_FUNCTIONS:
        return True
    live = strip_comments_and_strings(text)
    definition = re.search(rf"^func\s+{re.escape(name)}\s*\(", live, re.MULTILINE)
    haystack = live
    if definition:
        blanked = " " * (definition.end() - definition.start())
        haystack = live[: definition.start()] + blanked + live[definition.end() :]
    if re.search(rf"(?<![\w.]){re.escape(name)}\s*\(", haystack):
        return True
    uncommented = strip_comments(text)
    # String-named references are how Godot connects and calls by name:
    # svc.call(&"harvest", ...) / x.connect(&"handler")
    named = rf"\.(?:call|connect|emit_signal)\(\s*&?[\"']{re.escape(name)}[\"']"
    if re.search(named, uncommented):
        return True
    for extra in other_texts or []:
        if extra is text or extra == text:
            continue
        candidate = strip_comments_and_strings(extra)
        definition = re.search(rf"^func\s+{re.escape(name)}\s*\(", candidate, re.MULTILINE)
        if definition:
            candidate = (
                candidate[: definition.start()]
                + " " * (definition.end() - definition.start())
                + candidate[definition.end() :]
            )
        if re.search(rf"(?<![\w.]){re.escape(name)}\s*\(", candidate):
            return True
        if re.search(named, strip_comments(extra)):
            return True
    return False


# ------------------------------------------------------------------------ calls
@dataclass
class CallSite:
    path: str
    line: int
    function: str
    kind: str  # direct | call_method | has_method
    offset: int = 0
    arguments: str = ""
    authorisation_refs: Tuple[str, ...] = ()
    context: Tuple[str, ...] = ()

    def as_dict(self) -> Dict[str, object]:
        return {
            "path": self.path,
            "line": self.line,
            "function": self.function,
            "kind": self.kind,
            "arguments": self.arguments[:160],
            "authorisation_refs": list(self.authorisation_refs),
            "context": list(self.context),
        }


def call_sites(text: str, path: str, method: str) -> List[CallSite]:
    """Find real call sites of ``method``; comments and strings never match."""
    live = strip_comments_and_strings(text)
    uncommented = strip_comments(text)
    spans = string_spans(text)
    sites: List[CallSite] = []
    patterns = (
        ("direct", rf"\.{re.escape(method)}\s*\(", live),
        # The string-named form is matched where comments are blanked but strings
        # are intact, then rejected if the match itself sits inside a literal.
        ("call_method", rf"\.call\(\s*&?[\"']{re.escape(method)}[\"']", uncommented),
        ("has_method", rf"has_method\(\s*&?[\"']{re.escape(method)}[\"']", uncommented),
    )
    for kind, pattern, haystack in patterns:
        for match in re.finditer(pattern, haystack):
            if kind != "direct" and _inside(spans, match.start()):
                continue
            offset = match.start()
            window = function_window(text, offset)
            sites.append(
                CallSite(
                    path=path,
                    line=live.count("\n", 0, offset) + 1,
                    function=enclosing_function(text, offset),
                    kind=kind,
                    offset=offset,
                    arguments=uncommented[offset : offset + 300].split("\n", 1)[0].strip(),
                    authorisation_refs=_authorisation_refs(window),
                    context=_context_labels(window),
                )
            )
    return sorted(sites, key=lambda site: (site.line, site.kind))


def _authorisation_refs(window: str) -> Tuple[str, ...]:
    refs: List[str] = []
    for pattern, label in (
        (r"a1slice:[a-z0-9_:]+", "A1_CONTRACT_KEY"),
        (r"rr_[a-z0-9_]+", "A1_REWARD_RIGHT"),
        (r"completion_transaction_id", "CAMPAIGN_REGISTRY"),
        (r"campaign:%s:complete", "CAMPAIGN_FALLBACK_KEY"),
        (r"poi_[a-z0-9_]+", "A1_POI_INSTANCE"),
        (r"knowledge_spares|iron_scrap|stone_chunk|oak_wood", "A3_ITEM_ID"),
    ):
        for match in re.finditer(pattern, window):
            ref = f"{label}:{match.group(0)}"
            if ref not in refs:
                refs.append(ref)
    return tuple(refs)


def _context_labels(window: str) -> Tuple[str, ...]:
    """What kind of document does this commit mutate?"""
    labels: List[str] = []
    checks = (
        (r'candidate\["survival"\]|\["survival"\]\s*=\s*document_candidate', "SURVIVAL_DOCUMENT_MUTATION"),
        (r"add_items_to_candidate", "SURVIVAL_ITEM_GRANT"),
        (r"applied_transactions|completion_transaction_id|campaign", "CAMPAIGN_PROGRESSION_MUTATION"),
    )
    for pattern, label in checks:
        if re.search(pattern, window):
            labels.append(label)
    return tuple(labels)


# ------------------------------------------------------------------ mount graph
MOUNTED = "MOUNTED"
NOT_MOUNTED = "NOT_MOUNTED"
NOT_PINNED = "NOT_PINNED"

_LOAD_RE = re.compile(r"(?:preload|load)\(\s*[\"']res://([^\"']+)[\"']")
_TSCN_PATH_RE = re.compile(r"path=\"res://([^\"]+)\"")
_AUTOLOAD_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=\"\*?res://([^\"]+)\"", re.MULTILINE)


@dataclass
class MountGraph:
    """Reachability from the shipped entry surface, over the pinned files only."""

    edges: Dict[str, set] = field(default_factory=dict)
    reachable: set = field(default_factory=set)
    pinned: set = field(default_factory=set)

    @classmethod
    def build(cls, texts: Dict[str, str], paths: Dict[str, str]) -> "MountGraph":
        """``texts`` is key -> content, ``paths`` is key -> upstream repository path."""
        graph = cls()
        graph.pinned = {path for path in paths.values()}
        by_path = {paths[key]: texts[key] for key in texts if key in paths}
        project = by_path.get("project.godot", "")
        roots = {"game/app/app_root.tscn", "game/main.tscn"}
        for match in _AUTOLOAD_RE.finditer(project):
            roots.add(match.group(2))
        for path, text in by_path.items():
            refs = set()
            if path.endswith(".tscn"):
                refs.update(_TSCN_PATH_RE.findall(text))
            refs.update(_LOAD_RE.findall(text))
            graph.edges[path] = refs
        queue = [root for root in roots if root in by_path]
        graph.reachable = set(queue)
        while queue:
            current = queue.pop()
            for ref in graph.edges.get(current, set()):
                if ref in by_path and ref not in graph.reachable:
                    graph.reachable.add(ref)
                    queue.append(ref)
        return graph

    def state(self, path: str) -> Tuple[str, str]:
        if path in self.reachable:
            return MOUNTED, path
        if path in self.pinned:
            return NOT_MOUNTED, path
        return NOT_PINNED, path

    def explain(self, path: str) -> Dict[str, object]:
        state, normalised = self.state(path)
        return {
            "path": normalised,
            "mount_state": state,
            "note": {
                MOUNTED: "reachable from project.godot autoloads or the shipped app scene",
                NOT_MOUNTED: "pinned but not reachable from any shipped scene or autoload",
                NOT_PINNED: "not in the pinned surface; mounting cannot be judged from this snapshot",
            }[state],
        }
