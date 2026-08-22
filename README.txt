TINHLAGI TV → STREMIO
=====================

Addon này đọc động trang:
https://tinhlagi.pro/tivi/

Nó KHÔNG lưu sẵn link kênh. Mỗi lần cache hết hạn (3 phút), addon tải lại trang Tinhlagi
và lấy các URL có tham số name=...&url=...

CÀI TRÊN ANDROID BẰNG TERMUX
----------------------------
1. Giải nén thư mục này.
2. Mở Termux.
3. Vào thư mục đã giải nén.
4. Chạy:
   chmod +x start.sh
   ./start.sh

Khi hiện:
Tinhlagi Stremio addon: http://127.0.0.1:7000/manifest.json

thì GIỮ Termux đang chạy.

5. Trên cùng điện thoại, mở Stremio → Add-ons → Add addon.
6. Dán:
   http://127.0.0.1:7000/manifest.json

Nếu Stremio của bạn không chấp nhận localhost HTTP, addon cần được đưa lên một máy chủ HTTPS
(Render/Railway/VPS/Cloudflare Worker dạng tương đương).

LƯU Ý
-----
- Tinhlagi có thể đổi cấu trúc hoặc đổi URL stream bất kỳ lúc nào.
- Một số stream có thể yêu cầu Referer/User-Agent hoặc bị giới hạn mạng/IP.
- Addon chỉ chuyển tiếp URL mà trang nguồn đang công khai; nó không giải mã DRM.
- Nếu trang nguồn chết thì addon cũng không có nguồn để trả về.
