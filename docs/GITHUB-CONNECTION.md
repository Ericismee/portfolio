# Kết nối GitHub cho admin

Vào **Admin → GitHub → Kết nối tài khoản GitHub**, hoặc mở mục kết nối ngay trong biểu mẫu dự án/bài viết.

1. Chọn **Tạo token trên GitHub** và đăng nhập tài khoản cần kết nối.
2. Chọn resource owner, những kho mã cần đọc (hoặc **All repositories**) và quyền **Contents: Read-only**. Metadata read access được GitHub cấp kèm. Tổ chức có thể cần chấp thuận token; token chỉ đọc được tài nguyên mà GitHub cấp quyền.
3. Dán token vào ô mật khẩu rồi chọn **Kết nối GitHub**. Không gửi token qua chat. Tài khoản được kiểm tra trước khi lưu; token mới không hợp lệ không thay thế kết nối hiện tại.
4. Trong biểu mẫu dự án/bài viết, chọn **Tải kho mã**, tìm theo `owner/repo`, đọc thông tin, xem trước rồi đưa vào biểu mẫu. Kho riêng tư có nhãn rõ ràng; nhập liệu không tự lưu hoặc đăng công khai.

Đây là kết nối bằng personal access token, chưa phải OAuth. Một kết nối được dùng chung bởi các admin của hồ sơ. Có thể thay token hoặc ngắt kết nối tại cùng vị trí. Khi hết hạn, tạo token mới và kết nối lại. Nếu máy chủ đã cấu hình `GITHUB_TOKEN`, ngắt kết nối trong giao diện sẽ trở về token môi trường; muốn tắt token này, người vận hành cần bỏ biến môi trường.

Token được mã hóa AES-256-GCM trong bảng `github_connection`, với khóa riêng `DATA_DIR/github-credential.key`. Cả thư mục dữ liệu và khóa phải được bảo vệ bằng quyền truy cập hệ điều hành; không đưa chúng vào kho mã hoặc phục vụ qua HTTP. Bản xuất nội dung JSON và lịch sử chỉnh sửa không chứa token. Sao lưu toàn bộ máy chủ cần giữ cả database và khóa; bản sao lưu nội dung không khôi phục kết nối GitHub. Mất khóa cần kết nối lại.

Danh sách tài khoản được lưu bộ nhớ đệm trong 5 phút, chi tiết kho mã trong 10 phút, tách theo thông tin xác thực. Kết nối mới không tái sử dụng bộ nhớ đệm lỗi của truy cập ẩn danh. Trang công khai chỉ lấy dữ liệu công khai, ngay cả khi kết nối được phép đọc kho riêng tư. Hạn mức GitHub vẫn áp dụng cho tài khoản; đây không phải truy cập không giới hạn.

Tài liệu: [Xác thực REST API](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api), [quản lý personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [hạn mức truy cập](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
