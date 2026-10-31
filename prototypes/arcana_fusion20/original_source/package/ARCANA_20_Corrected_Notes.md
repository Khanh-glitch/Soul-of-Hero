# ARCANA 20 — corrected visual master (31/10/2026)

The previous output DID NOT faithfully implement fusion. It composed unrelated live full-spell canvases with a bright-pixel mask and `screen`, causing duplicated geometry, temporal drift, sparse/transparent regions and blurriness. Those overlays and fake proxy enemies have been removed.

The corrected preview displays the single voted lead visual using its own source renderer and exact source pixel resolution (no intermediate scaling); A/B/C originals remain in comparison. Source-ground is a quiet neutral testplate, NOT Soul of Heroes actual terrain. For the six multi-source skills (#01/#05/#09/#11/#16/#20), fusion is NOT complete and must be implemented inside one authored render timeline with shared anchors and correct layer semantics. Six NONE skills are still directed redesigns. #19 D requires WebGL2; any fallback is explicitly marked.

NOT Gold accepted, not native SOH, not authentic A body FX attached to real SOH enemies. Original source files and votes are preserved in ZIP.
