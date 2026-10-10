# Eric Profile — UI prototype

Mock UI hồ sơ nghề nghiệp theo bố cục LinkedIn. Ngôn ngữ mặc định: tiếng Việt.

## Chạy

Yêu cầu Node.js 20 trở lên. Không cần cài dependency.

```sh
npm start
```

Mở http://localhost:3001. Kiểm tra cú pháp: `npm run check`.

## Thử giao diện

- Hồ sơ: sửa tên, headline, địa điểm, giới thiệu, avatar và cover.
- Mỗi mục kinh nghiệm, học vấn, chứng chỉ hoặc mục tùy chỉnh có thêm/sửa/xóa nội dung.
- Dự án: thêm/sửa/xóa, ghim, bản nháp, công nghệ, vai trò, mô tả chi tiết, GitHub/demo URL và thumbnail.
- Danh sách dự án: tìm kiếm, lọc công nghệ/trạng thái, sắp xếp và grid/list. Các bộ lọc được lưu trong hash URL.
- Bảng tin: tạo/sửa/xóa bài viết hoặc cập nhật, gắn liên kết và chọn lưu nháp/xuất bản trong demo.
- Tìm kiếm trên navbar: tìm dự án, bài viết và kỹ năng. Bản nháp chỉ hiện ở chế độ chủ sở hữu.
- Menu tài khoản → Cài đặt giao diện: light/dark, màu nhấn, mật độ, hiện/ẩn, thứ tự và xóa các mục; tải CV PDF và xuất JSON.
- Chỉnh sửa liên kết: website, LinkedIn và email công khai.
- Chế độ khách: ẩn nút chỉnh sửa và nội dung nháp. Đây là preview UI, không phải cơ chế xác thực.
- GitHub: lưu username cục bộ và thử loading/lỗi mô phỏng; chưa có API thật.
- Liên hệ: kiểm tra trường bắt buộc và email, loading, thành công, lỗi và thử lại mô phỏng; chế độ chủ sở hữu cho phép chọn kịch bản. Không gửi hay lưu tin nhắn.

## Lưu dữ liệu

Hồ sơ, nội dung, ảnh và cấu hình được lưu vào localStorage với key `eric-profile-mock`; chế độ xem dùng key `eric-owner`. Dữ liệu chỉ thuộc trình duyệt và origin hiện tại. Xóa dữ liệu website sẽ đặt lại prototype. File ảnh tối đa 3 MB, CV PDF tối đa 2 MB; tổng dung lượng vẫn phụ thuộc trình duyệt.

Tên Eric và Software Engineer là thông tin được cung cấp. NotebookE, LingoraAI và Horune được biên tập từ README công khai theo liên kết chủ sở hữu cung cấp. GitHub Ericismee và LinkedIn được cấu hình sẵn; ảnh để chủ sở hữu tải lên. Các bài viết mẫu giữ nhãn mẫu. Nguồn và giới hạn được ghi trong `CONTENT-SOURCES.md`; không tạo thành tích, kinh nghiệm hay vai trò cá nhân.

## Cấu trúc

- `src/data.js`: dữ liệu khởi tạo, tách khỏi giao diện.
- `src/app.js`: các component render, state và thao tác prototype.
- `src/tokens.css`: hệ màu, font, khoảng cách và bóng dùng chung.
- `src/app.css`: component và bố cục responsive; thay sáu lớp CSS cũ.
- `src/ui.js`: icon, nút, avatar và các thành phần dùng chung.
- `src/profile-ui.js`: gợi ý hoàn thiện hồ sơ và card dự án dùng chung.
- `src/store.js`: nạp/lưu dữ liệu demo và chế độ xem.
- `src/public-content.js`: nội dung từ README công khai và chuyển dữ liệu mẫu cũ có kiểm soát.
- `src/dialog.js`: chỉnh sửa, cảnh báo chưa lưu và quản lý focus.
- `src/design.js`: cài đặt, sidebar, mục lục và bộ lọc mobile.
- `src/theme.js`: tương phản màu chữ theo màu nhấn.
- `src/fonts`: Plus Jakarta Sans, JetBrains Mono và giấy phép OFL; phục vụ cục bộ.
- `DESIGN.md`: các quyết định thiết kế đang được áp dụng.
- `server.mjs`: phục vụ file preview cục bộ; không phải API sản phẩm.

## Phạm vi

Chưa triển khai backend, database, xác thực, email, GitHub API, PWA/offline hoặc native app. Liên hệ/GitHub có nhãn mô phỏng. Màu chữ liên kết và màu chữ nút chính được điều chỉnh theo màu nhấn để dễ đọc; phạm vi kiểm tra được ghi trong `QA.md`.

