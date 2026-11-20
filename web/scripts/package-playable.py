"""Package the actual HTTP production build, including every runtime asset.
Run after npm run build: python3 scripts/package-playable.py <output.zip>
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
index = DIST / 'index.html'
if not index.is_file() or '/assets/' not in index.read_text():
    sys.exit('Build the production game first: npm run build')
if len(sys.argv) != 2:
    sys.exit('Expected an output .zip path')
output = Path(sys.argv[1]).resolve()
if DIST in output.parents or output.suffix != '.zip':
    sys.exit('Choose a .zip path outside dist/')
output.parent.mkdir(parents=True, exist_ok=True)
launcher = '''from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

# Keep the origin (and therefore the save slot) stable between sessions.
url = 'http://127.0.0.1:4173/'
handler = partial(SimpleHTTPRequestHandler, directory=str(Path(__file__).resolve().parent / 'game'))
try:
    server = ThreadingHTTPServer(('127.0.0.1', 4173), handler)
except OSError:
    raise SystemExit('Port 4173 is already in use. Close the other server and try again.')
with server:
    print(url, flush=True)
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
'''
guide = '''SOUL OF HERO — VEYRA

Giải nén toàn bộ thư mục. Cần Python 3.7+ và trình duyệt hiện đại.
Windows: chạy Play.cmd (hoặc py -3 play.py).
macOS/Linux: mở Terminal trong thư mục đã giải nén rồi chạy python3 play.py.
Mở http://127.0.0.1:4173/ nếu trình duyệt không tự mở. Không mở index.html bằng file://.
Không cần npm, không cần mạng. Giữ cửa sổ máy chủ mở khi chơi.

New run → chọn nhân vật → Begin the 14 days. Di chuyển WASD hoặc phím mũi tên;
chuột trái để hành động, E tương tác, I túi đồ, M bản đồ. Esc → Save & quit to title.
Lần sau chạy lại cùng lệnh và chọn Continue. Dùng cùng trình duyệt, hồ sơ và địa chỉ;
chế độ ẩn danh hoặc xóa dữ liệu website có thể làm mất save. Save của preview online
không tự chuyển sang bản chạy trên máy. Ctrl+C trong cửa sổ máy chủ để đóng.
'''
with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=6) as z:
    for f in sorted(DIST.rglob('*')):
        if f.is_file():
            z.write(f, 'game/' + f.relative_to(DIST).as_posix())
    z.writestr('play.py', launcher)
    z.writestr('Play.cmd', '@echo off\r\ncd /d "%~dp0"\r\npy -3 play.py\r\nif errorlevel 1 pause\r\n')
    z.writestr('HUONG-DAN.txt', guide)
    z.write(ROOT / 'THIRD_PARTY.md', 'THIRD_PARTY.md')
print(output, output.stat().st_size, 'bytes')
