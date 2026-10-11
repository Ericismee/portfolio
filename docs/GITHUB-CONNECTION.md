# Kết nối GitHub cho admin

Vào **Admin → GitHub → Kết nối tài khoản GitHub**, hoặc mở mục kết nối ngay trong biểu mẫu dự án/bài viết.

1. Chọn **Tạo token trên GitHub** và đăng nhập tài khoản cần kết nối.
2. Chọn resource owner, những kho mã cần đọc (hoặc **All repositories**) và quyền **Contents: Read-only**. Metadata read access được GitHub cấp kèm. Tổ chức có thể cần chấp thuận token; token chỉ đọc được tài nguyên mà GitHub cấp quyền.
3. Dán token vào ô mật khẩu rồi chọn **Kết nối GitHub**. Không gửi token qua chat. Tài khoản được kiểm tra trước khi lưu; token mới không hợp lệ không thay thế kết nối hiện tại.
4. Trong biểu mẫu dự án/bài viết, chọn **Tải kho mã**, tìm theo `owner/repo`, đọc thông tin, xem trước rồi đưa vào biểu mẫu. Kho riêng tư có nhãn rõ ràng; nhập liệu không tự lưu hoặc đăng công khai.

Đây là kết nối bằng personal access token, chưa phải OAuth. Một kết nối được dùng chung bởi các admin của hồ sơ. Có thể thay token hoặc ngắt kết nối tại cùng vị trí. Khi hết hạn, tạo token mới và kết nối lại. Nếu máy chủ đã cấu hình `GITHUB_TOKEN`, ngắt kết nối trong giao diện sẽ trở về token môi trường; muốn tắt token này, người vận hành cần bỏ biến môi trường.

Token được ghi nhớ trên máy chủ, kể cả sau khi mở lại trang hoặc khởi động lại. Giao diện báo **Đã lưu an toàn** và chỉ mở ô nhập khi chọn **Thay token**. Trình duyệt không lưu token vào localStorage hay cookie và xóa ô nhập sau khi kết nối thành công.

Token được mã hóa AES-256-GCM trong bảng `github_connection`, với IV ngẫu nhiên riêng mỗi lần ghi và xác thực cả tên tài khoản. Trên Windows, khóa riêng `DATA_DIR/github-credential.key` được bọc bằng Windows DPAPI ở phạm vi **CurrentUser**: muốn mở khóa phải chạy dưới cùng tài khoản Windows có hồ sơ người dùng tương ứng. Khóa không được lưu dạng thô trên đĩa. Dữ liệu cũ tự chuyển sang cách bảo vệ mới khi được đọc, giữ nguyên kết nối và không yêu cầu nhập lại token. Nếu bảo vệ hoặc giải mã thất bại, hệ thống báo lỗi; không hạ xuống khóa thô hoặc tự tạo khóa mới thay cho khóa đã mất.

Trên hệ điều hành khác, khóa là tệp riêng với quyền `0600`, trong thư mục dữ liệu `0700`; nên dùng kho bí mật của môi trường triển khai nếu cần bảo vệ tương đương DPAPI. Cả thư mục dữ liệu và khóa phải được bảo vệ bằng quyền truy cập hệ điều hành; không đưa chúng vào kho mã hoặc phục vụ qua HTTP. Bản xuất nội dung JSON và lịch sử chỉnh sửa không chứa token. Sao lưu toàn bộ máy chủ Windows cần kế hoạch khôi phục cả hồ sơ DPAPI, database và khóa; chỉ chép hai tệp sang tài khoản hoặc máy khác không đủ. Nếu mất khóa/hồ sơ Windows, người vận hành phải khôi phục chúng hoặc thiết lập lại kết nối với khóa mới và token mới. Các bản sao lưu cũ có thể vẫn chứa khóa thô từ phiên bản trước.

DPAPI bảo vệ khóa khi tệp bị sao chép, nhưng ứng dụng chạy dưới cùng tài khoản Windows vẫn có thể giải mã; không bảo vệ được máy/tài khoản đã bị chiếm quyền. Token cần quyền đọc tối thiểu và vẫn phải thay khi hết hạn hoặc bị thu hồi. Tham khảo [Microsoft: bảo vệ dữ liệu với DPAPI](https://learn.microsoft.com/en-us/dotnet/standard/security/how-to-use-data-protection) và [phạm vi CurrentUser](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.dataprotectionscope).

Danh sách tài khoản được lưu bộ nhớ đệm trong 5 phút, chi tiết kho mã trong 10 phút, tách theo thông tin xác thực. Kết nối mới không tái sử dụng bộ nhớ đệm lỗi của truy cập ẩn danh. Trang công khai chỉ lấy dữ liệu công khai, ngay cả khi kết nối được phép đọc kho riêng tư. Hạn mức GitHub vẫn áp dụng cho tài khoản; đây không phải truy cập không giới hạn.

Tài liệu: [Xác thực REST API](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api), [quản lý personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [hạn mức truy cập](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
