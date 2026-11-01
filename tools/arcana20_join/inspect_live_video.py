"""Inspect saved live capture timing, and extract one *lossless* native frame.

The sample is a selected still from an actual gameplay video, not complete
visual review or a proof of native 60 Hz. Source ticks are last-observed.
"""
import json
import pathlib
import statistics
import subprocess
import sys

root = pathlib.Path(sys.argv[1])
fraction = float(sys.argv[2])
out = pathlib.Path(sys.argv[3])
metadata = list(root.rglob('timeline.json'))
videos = list(root.rglob('native-lossless.mkv'))
if len(metadata) != 1 or len(videos) != 1:
    raise SystemExit(f'expected exactly one timeline and lossless video: {metadata}, {videos}')
record = json.loads(metadata[0].read_text())
frames = record['frames']
if len(frames) < 2:
    raise SystemExit('not enough frames')
times = [float(f['wall_s']) for f in frames]
intervals = [b-a for a, b in zip(times, times[1:])]
if min(intervals) <= 0:
    raise SystemExit('presentation timestamps are not strictly increasing')
probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'csv=p=0', str(videos[0])],
    check=True, capture_output=True, text=True)
pts = [float(line.split(',')[0]) for line in probe.stdout.splitlines() if line.strip()]
if len(pts) < len(frames):
    raise SystemExit(f'encoded video has fewer frames ({len(pts)}) than timeline ({len(frames)})')
errors_ms = [abs((pts[i] - pts[0]) - (t - times[0])) * 1000 for i, t in enumerate(times)]
print('::notice title=LIVE_TIMESTAMP_CHECK::'
      f"skill={record['skill']} timeline_frames={len(frames)} encoded_frames={len(pts)} "
      f"last_observed_tick={record['last_tick']} duration_s={times[-1]-times[0]:.3f} "
      f"interval_p50_ms={statistics.median(intervals)*1000:.3f} "
      f"min_ms={min(intervals)*1000:.3f} max_ms={max(intervals)*1000:.3f} "
      f"max_lossless_pts_error_ms={max(errors_ms):.3f} "
      'timestamps include capture effects; tick is last observed, not a presented-tick guarantee')
target = float(record['last_tick']) * fraction
index = min(range(len(frames)), key=lambda i: abs(frames[i]['source_tick_last_observed'] - target))
print(f"SELECTED_FRAME index={index} file={frames[index]['file']} "
      f"last_observed_tick={frames[index]['source_tick_last_observed']} wall_s={times[index]:.6f}")
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(videos[0]),
    '-vf', f'select=eq(n\\,{index})', '-fps_mode', 'vfr', '-frames:v', '1', str(out)], check=True)
if not out.is_file():
    raise SystemExit('selected frame was not extracted')
