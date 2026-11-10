# Atlas Last Island v1–v11 — NGUỒN NGHIÊN CỨU (KHÔNG LÀ WORK ORDER)

**Nguồn duy nhất vận hành gameplay:** [../bible.md](../bible.md) và [../OPERATIONS.md](../OPERATIONS.md). Những tập này chỉ là nghiên cứu có niên đại / mode / độ tin cậy. Những phân công hay đề xuất nằm trong archive **không còn hiệu lực**.

## Tính toàn vẹn nguồn gốc
Bộ `atlas.zip` do Creator cung cấp có **26 top-level entries** gồm nghiên cứu v1–v9, các workbook và package ZIP v10/v11. Bản gốc có 1,489,422 bytes; SHA-256 **`8b4fdedaa9397baaa1bcb8ba58d5c95ca2e7cbdd679963c6d4177fc9ab861e98`**. Nội dung gốc được lưu dưới dạng 13 Base64 parts trong [source/](source/), có [SOURCE_MANIFEST.json](SOURCE_MANIFEST.json) và công cụ Python standard library [restore_atlas.py](restore_atlas.py).

**Khôi phục từ repo root:** `python3 web/ref/atlas/restore_atlas.py --extract`. Công cụ kiểm tra byte length, SHA-256, CRC trước khi giải nén vào `extracted_full/`. Không tự tuyên bố đã tái kiểm archive ở phiên này: các giá trị hash/kích thước ở đây do manifest nguồn ghi; cần chạy restore để xác thực trong checkout.

## Bản trực tiếp đọc được (trích chọn — không phải toàn bộ 26 nguồn)
| Phiên bản | Chuyên đề | Vị trí |
| --- | --- | --- |
| v1–v9 | Nguyên bản các đợt nghiên cứu, lịch sử so sánh, bản v5/v6 có hạn chế provenance | Nằm trong ZIP gốc ở `source/`, khôi phục bằng script |
| v2–v6 | Atlas JSON, báo cáo sâu/research, 405-row historical claim cần kiểm nguồn | `extracted/ATLAS_v2.json`, `extracted/atlas.json`, `extracted/LI_MASTER_RESEARCH_REPORT_v5.md` và những báo cáo liên quan |
| v8 | 21 action Core VFX semantic source | `extracted/v10/data/V8_21_ACTION_FULL_SEMANTIC_CONTRACT.json` |
| v10 | 21 Core engineering, protocol tuning, data JSON | `extracted/v10/` |
| v11 | 18 hệ, 214 khả năng, 20 journeys, 104 cross-edges, source/recovery ledger và conversation decisions | `extracted/v11/` |

**Đọc đúng mức chứng cứ:** `SOURCE` (LI version/mode verified) ≠ `SOH_CREATOR_LOCKED` ≠ `SOH_PROVISIONAL` ≠ `CODE_IMPLEMENTED` ≠ `PLAY_PROVEN`. Chưa tìm thấy bản gốc v5/v6 byte-exact thì không nhận là đã khôi phục đúng; những tệp hiện diện dưới tên v5/v6 có thể là báo cáo/trích dẫn của một bước khác. Kiểm tra ZIP thực trước khi xác nhận.

**Ngăn nhiễu:** Các tệp đề xuất phân công, prompt cũ, owner-work-order và câu “GO/HOLD” trong kho nguồn là tư liệu lịch sử, không được đọc như chỉ đạo active. Trong `extracted/` chúng tôi cố ý chỉ công bố **tệp về cơ chế, số liệu và mối nối**; nếu cần kiểm các đề xuất cũ, phải chủ động khôi phục từ ZIP và nhận diện chúng là historical.
