"""Compare Godot verbose exit diagnostics, not memory use or reachability.

Matching line counts/classes/paths do not prove absence of leaks, especially
with dynamic sessions or resources not printed by Godot. IDs are normalized
only for grouping diagnostic text, never for source-image parity.
"""
from collections import Counter
import json
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
report = {}
for path in sorted(root.glob('*/baseline.log')):
    directory = path.parent
    variants = {}
    for name in ('baseline', 'fx', 'overlap'):
        text = (directory / f'{name}.log').read_text(errors='replace')
        lines = []
        for line in text.splitlines():
            if 'Leaked instance:' in line or 'Resource still in use:' in line:
                line = line.strip()
                # Godot instance ids differ across fresh processes.
                line = re.sub(r':-?\d+', ':<id>', line)
                line = re.sub(r'#-?\d+', '#<id>', line)
                lines.append(line)
        variants[name] = Counter(lines)
    result = {'baseline_count': sum(variants['baseline'].values())}
    for name in ('fx', 'overlap'):
        result[name] = {
            'count': sum(variants[name].values()),
            'only_in_variant': list((variants[name] - variants['baseline']).elements()),
            'only_in_baseline': list((variants['baseline'] - variants[name]).elements()),
        }
    result['baseline_lines'] = list(variants['baseline'].elements())
    report[directory.name] = result
    print(f'::notice title=LEAK_DIFF::{directory.name}: ' + json.dumps(result, ensure_ascii=True))
if not report:
    raise SystemExit('No baseline/fx/overlap logs found')
(root / 'shutdown-comparison.json').write_text(json.dumps(report, indent=2))
