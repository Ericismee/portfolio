# Thiết kế mock UI Eric

## Định hướng

Hồ sơ nghề nghiệp theo cách tổ chức LinkedIn: navbar cố định, cover/avatar chồng nhau, thông tin giới thiệu và các mục hồ sơ ở cột chính, thông tin bổ trợ ở sidebar. Lớp thị giác được biến tấu từ template người dùng cung cấp: viền rõ, bóng cứng, typography đậm, phối nhiều màu pastel thay vì đen trắng. Không nhập thông tin cá nhân hay thành tích từ template.

Skill dùng: hướng dẫn thiết kế và preview của `sites`. Không tìm thấy skill chuyên UI/UX như `ui-ux-pro-max` trong môi trường. Các trang LinkedIn chính thức chưa xác minh được qua công cụ đọc web; giao diện được xây dựng dựa trên brief đã cung cấp, không tuyên bố đã quan sát toàn bộ LinkedIn.

## Quy tắc giao diện

- Nền sáng xanh xám `#F0F4FA`, card trắng `#FFFFFF`, chữ navy `#19243B`, viền `#29354B`, hành động chính xanh `#4264DA`.
- Màu bổ trợ: xanh nhạt `#DCE8FF`, vàng `#FFF0B2`, tím `#ECE3FF`, mint `#DCF1E6`, peach `#FFE3D2`. Màu được dùng cho vai trò cụ thể, không tô ngẫu nhiên toàn bộ card.
- Plus Jakarta Sans cho nội dung và tiêu đề; JetBrains Mono cho nhãn kỹ thuật, công nghệ và thông tin phụ. Font được phục vụ cục bộ và có giấy phép OFL trong `src/fonts`.
- Khoảng cách theo thang 4/8/12/16/20/24/32 px. Card bo 7–9 px, viền 1.5–2 px, bóng cứng 3–4 px. Nút bo 4–5 px, có hover và pressed.
- Icon SVG nét thống nhất. Hover, active và focus có dấu hiệu riêng; điều hướng dùng `aria-current`.
- Chữ chính dùng navy trong light mode và màu sáng trong dark mode. Nút chính chọn chữ đen hoặc trắng theo màu nhấn. Dark mode đổi cả bảng màu pastel sang các tông xanh/tím/mint trầm.

## Màn hình

- Hồ sơ: hai cột desktop, mục lục đến từng section; một cột mobile và bottom navigation. Cover/avatar dùng ảnh do chủ sở hữu cung cấp hoặc monogram.
- Bảng tin: ba cột desktop; hai cột tablet; một cột mobile. Nội dung tác giả, loại bài và nhãn demo hiển thị rõ. Nút tạo nội dung chỉ có ở chế độ chủ sở hữu.
- Dự án: card grid/list, thumbnail, mô tả và công nghệ. Tìm kiếm luôn hiện; bộ lọc nâng cao thu gọn trên mobile. Thông tin bổ trợ ở sidebar desktop.
- GitHub: summary, vùng contribution chưa có dữ liệu, loading/lỗi mô phỏng và retry; không phát sinh số liệu giả.
- Liên hệ: summary chủ hồ sơ, thông tin công khai, form có label, validation và kết quả mô phỏng.
- Cài đặt: nhóm giao diện, các mục hồ sơ, CV/thông tin cá nhân và dữ liệu demo; sidebar đến từng nhóm trên desktop.
- Chỉnh sửa: modal desktop / bottom sheet mobile, label đầy đủ, focus được giữ trong dialog, cảnh báo thay đổi chưa lưu, Escape và trả focus.

## Responsive & accessibility

Kiểm tra tại 360, 390, 768, 1024 và 1440 px. Sidebar ẩn khi không đủ chỗ. Bottom navigation có chiều cao riêng và trang chừa khoảng cuộn dưới. Có skip link đến nội dung chính, focus nhìn thấy được và tôn trọng reduced motion.

Đây là prototype frontend. Đánh giá thiết bị thật, screen reader và tích hợp backend còn thuộc các bước tiếp theo.

## Thứ tự phát triển

1. Hoàn thiện và chốt mock: hồ sơ, nội dung, dự án, cài đặt và các trạng thái dùng thử.
2. Chuẩn bị frontend sản phẩm: chia component theo màn hình, xác định cấu trúc dữ liệu và tiêu chí nghiệm thu.
3. Sau khi duyệt mock: bổ sung đăng nhập, API và lưu trữ; kết nối GitHub và gửi liên hệ.
4. Trước phát hành: kiểm tra thiết bị thật, accessibility, hiệu năng và quyền riêng tư.

Giai đoạn hiện tại dừng ở bước 1; dữ liệu tiếp tục được lưu cục bộ.

## Tinh chỉnh hồ sơ, dự án và mobile

- Card giới thiệu giữ nét đậm và bóng cứng; card nội dung và sidebar dùng viền nhẹ, giảm bóng để thông tin chính nổi bật.
- Hồ sơ mới mặc định xếp giới thiệu, nổi bật, kinh nghiệm, dự án, kỹ năng, học vấn, chứng chỉ rồi hoạt động. Giữ thứ tự đã lưu của người dùng.
- Chủ sở hữu được gợi ý tối đa hai thao tác cho thông tin còn thiếu; khách không thấy khối gợi ý này. Không tạo avatar, cover hay tiểu sử giả.
- Card dự án dùng monogram hoặc ảnh tải lên, tên, trạng thái, mô tả tối đa ba dòng, công nghệ và liên kết chi tiết. Các vùng bấm và nút thao tác tối thiểu 44 px về chiều cao.
- Mobile: thanh chủ sở hữu một hàng, featured một cột, kiểu danh sách tự chuyển thành card dọc. Trường nhập dùng cỡ chữ 16 px.
- Nhãn dữ liệu mẫu giữ trên nội dung mẫu; bỏ các đoạn giải thích lặp dưới danh sách dự án.
