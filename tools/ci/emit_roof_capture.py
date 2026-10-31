#!/usr/bin/env python3
"""Publish chunks of a native roof crop in CI annotations for visual review.

The full-resolution original remains in the workflow artifact. Annotation chunks
are capped below GitHub's message and per-step limits; no image is synthesized.
"""
import base64
import glob
import sys

name, batch_text = sys.argv[1:]
batch = int(batch_text)
matches = glob.glob('artifacts/**/roof_' + name + '_crop.png', recursive=True)
if not matches:
    print('::warning::missing native roof capture ' + name)
    sys.exit(0)
with open(matches[0], 'rb') as handle:
    encoded = base64.b64encode(handle.read()).decode('ascii')
chunks = [encoded[i:i + 3600] for i in range(0, len(encoded), 3600)]
if len(chunks) > 24:
    print('::warning::native roof crop exceeds annotation capacity: ' + name)
    sys.exit(0)
for i in range(batch * 8, min((batch + 1) * 8, len(chunks))):
    print('::notice::ROOF_CAPTURE_%s_%d_OF_%d:%s' % (name.upper(), i + 1, len(chunks), chunks[i]))
