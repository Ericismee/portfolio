# Kiểm tra prototype

Đã chạy bằng Chrome headless và kiểm tra DOM thực tế:

- Hồ sơ, bảng tin, dự án, liên hệ, cài đặt và GitHub: không tràn ngang ở 360, 390, 768, 1024 và 1440 px.
- Mobile: bottom navigation cao 63 px, avatar 108 px; desktop avatar 136 px.
- Quan sát ảnh chụp 390 và 1440 px sau khi sửa bottom navigation che nội dung.
- Bảng tin desktop có ba cột (210 / 566 / 280 px tại 1440 px).
- Thêm dự án, ẩn dự án nháp khi xem như khách.
- Thêm/xóa item kinh nghiệm và thêm bài viết.
- Bộ lọc công nghệ phản ánh vào URL và giữ đúng sau reload.
- Theme dark được áp dụng.
- GitHub username hiển thị sau lưu, mô phỏng loading rồi lỗi.
- Form liên hệ hiển thị kết quả mô phỏng hợp lệ.
- `npm run check`: kiểm tra cú pháp thành công.
- Modal có tên truy cập duy nhất, cảnh báo thay đổi chưa lưu và bỏ thay đổi đóng modal mà không lưu.

Các kiểm tra trên dùng profile Chrome tạm, không thay dữ liệu trình duyệt người dùng. Chưa xác minh tích hợp bên ngoài, thiết bị di động thật hoặc tất cả tổ hợp màu tùy chỉnh.

## Hoàn thiện mock & tổ chức frontend — 10/10/2026

- Gom sáu lớp CSS thành `tokens.css` và `app.css`; tách storage, dialog và UI dùng chung. Rà ảnh hồ sơ 390/1440 px sau khi gom.
- Chạy `scripts/qa-final.mjs` với assertion trên Chrome riêng: 30 tổ hợp màn hình/viewport không tràn ngang; modal vừa trong viewport tại cả năm kích thước.
- Modal focus vào trường đầu tiên; Escape cảnh báo trước khi đóng; bỏ thay đổi giữ hồ sơ cũ và trả focus về nút mở.
- Khách không thấy mục hồ sơ trống, nút sửa hoặc composer bảng tin; dự án nháp tiếp tục được ẩn.
- Bộ lọc mobile mở có aria-expanded; tìm kiếm không có kết quả hiện nút xóa bộ lọc và khôi phục ba dự án mẫu.
- Liên hệ: validation bắt buộc, loading khóa submit, lỗi giữ nội dung, thử lại thành công có nhãn mô phỏng và xóa trường nhập.
- Menu tài khoản mở, chuyển đến cài đặt và đóng; Tab vào tìm kiếm có focus nhìn thấy; chỉnh sửa hồ sơ giữ sau reload.
- Không phát hiện exception JavaScript trong lượt kiểm thử trên. Toàn bộ module ứng dụng qua kiểm tra cú pháp.
- Rà thêm ảnh chế độ khách mobile. Avatar mobile hiện 100 px, bottom navigation 64 px; số đo mới thay cho số đo ở bản cũ phía dưới.

## Tinh chỉnh thứ bậc UI — 10/10/2026

- Chạy lại `qa.mjs`: thêm dự án, ẩn nháp khi xem khách, thêm/xóa kinh nghiệm, tạo bài viết, bộ lọc giữ sau reload, theme và GitHub loading/lỗi đều qua.
- Mở và rà ảnh hồ sơ owner 390/1440 px, hồ sơ guest mobile, dự án mobile/desktop và dự án dark.
- Mở dự án từ card đến trang chi tiết; kiểu list trên mobile vẫn là card dọc; palette card chuyển theo theme tối.
- Gợi ý viết giới thiệu mở đúng editor, lưu xong bỏ gợi ý đã hoàn thành và chuyển sang thông tin còn thiếu.
- Thử tên và headline dài không có khoảng trắng: sáu màn hình vẫn không tràn ngang tại 360/390/768/1024/1440 px; editor vẫn vừa viewport.
- Modal/Escape/focus, bộ lọc mobile, lỗi/thử lại liên hệ, menu tài khoản và lưu sau reload tiếp tục qua assertion; không ghi nhận exception JavaScript.
- Các kiểm tra vẫn dùng Chrome riêng. Chưa thử bàn phím điện thoại thật, screen reader hoặc thiết bị thật.

## Rà thiết kế tổng thể — 10/10/2026

- Rà ảnh chụp hồ sơ 390/1440 px, cài đặt mobile, dự án desktop và bảng tin desktop.
- Kiểm tra 14 tổ hợp: light/dark với xanh mặc định, trắng, đen, vàng, xám, đỏ và xanh lá. Chữ liên kết so với card và chữ nút chính so với màu nhấn đều đạt tỷ lệ tương phản tối thiểu 4.5:1.
- Mở bộ lọc mobile: select công nghệ hiển thị sau khi mở, có aria-expanded.
- Mục lục hồ sơ: cuộn và chuyển focus đúng mục, không đổi route.
- Tab từ logo vào tìm kiếm: input có outline 3 px.
- Sửa SVG icon “Thêm” thiếu thẻ đóng; nhãn “Thêm dự án” hiển thị đúng trong DOM.
- Chạy lại các luồng CRUD/bản nháp/theme/bộ lọc và kiểm tra không tràn ngang ở năm viewport sau thay đổi thiết kế.

## Phong cách template được biến tấu đa màu — 10/10/2026

- Áp dụng nền kem, viền navy, hành động chính xanh, các màu vàng/tím/mint/peach bổ trợ; bo góc vừa phải và bóng cứng nhẹ.
- Giữ bố cục hai cột hồ sơ, ba cột bảng tin, bottom navigation và các luồng mock.
- Xem ảnh hồ sơ tại 390 và 1440 px sau khi cập nhật phong cách.
- Chạy lại kiểm tra năm viewport: không tràn ngang trên hồ sơ, bảng tin, dự án, liên hệ, cài đặt và GitHub.
- Thêm dự án, ẩn nháp khi xem như khách, thêm/xóa kinh nghiệm, tạo bài viết, bộ lọc URL, theme, username GitHub, loading/lỗi mô phỏng và form liên hệ vẫn hoạt động.
- Cú pháp JavaScript đạt kiểm tra. Font được tải từ Google Fonts và phục vụ cục bộ; không cần Tailwind CDN hoặc FontAwesome từ template.
