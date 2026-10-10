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

## Thu gọn đầu hồ sơ và giảm lặp — 10/10/2026

- Kiểm tra tối đa hai card nổi bật, tổng quan dự án không lặp tên dự án nổi bật và nút Xem tất cả mở đủ ba dự án mẫu.
- Khối gợi ý chỉ có một thao tác kế tiếp, không có viền xanh. Khi chưa có giới thiệu, không lặp lại card trống với cùng thao tác.
- Thu gọn cover/avatar và xem ảnh chụp hồ sơ 390 px.
- Chạy lại assertion trên sáu màn hình ở năm chiều rộng, với tên/headline dài: không tràn ngang; modal, focus, theme, bộ lọc, liên hệ và lưu sau reload đều qua.

## Ưu tiên trải nghiệm khách — 10/10/2026

- Gợi ý chủ sở hữu mặc định đóng, mở bằng summary, nút thao tác đạt chiều cao 44 px. Đã sửa quy tắc cũ còn đặt 40 px.
- Điều hướng khách ưu tiên hồ sơ/dự án; GitHub vẫn truy cập từ menu tài khoản.
- Lưu thử giới thiệu một câu; vai trò, vấn đề, đóng góp và kết quả dự án. Card/trang chi tiết hiển thị đúng nội dung đã nhập.
- Rà ảnh owner/guest mobile và sửa quy tắc cũ khiến icon sửa dự án nổi bật xuống dòng.
- Kiểm tra nội dung dài, sáu màn hình, năm chiều rộng; modal/focus/theme/menu/bộ lọc/liên hệ/lưu sau reload tiếp tục qua. Chưa kiểm tra trên điện thoại thật.

## Nghiệm thu và nội dung công khai — 10/10/2026

- Bỏ 49 khai báo CSS bị ghi đè. So sánh computed style của 24 tổ hợp: sáu màn hình, 390/1440 px, light/dark; không thay đổi sau bước dọn CSS.
- Đo 14 tổ hợp theme/màu nhấn: chữ nút chính, nút phụ và liên kết thông tin hồ sơ đều đạt tương phản tối thiểu 4.5:1 sau khi kết thúc chuyển màu.
- Kiểm tra tên truy cập của điều khiển đang hiển thị trên sáu màn hình. Phím Space mở gợi ý; summary có focus 3 px. Sửa vòng Tab để giữ focus trong editor, kiểm tra 18 lần Tab liên tiếp.
- Dữ liệu dự án đã chuyển sang NotebookE, LingoraAI và Horune theo nguồn công khai. Kiểm tra chuyển phiên bản giữ nội dung cá nhân, ảnh, liên kết và lựa chọn ghim; mô tả dự án tùy chỉnh không bị thay thế.
- Chưa kiểm thử screen reader, điện thoại thật hoặc phỏng vấn người xem. Chưa xác minh hoạt động backend của các dự án nguồn.

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
