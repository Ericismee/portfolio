# Ảnh trong tài liệu từ GitHub

## Repo riêng tư

Token kết nối GitHub được giữ ở server để đọc thông tin repo cho admin. Ảnh trong README hiện được trình duyệt tải trực tiếp từ URL của ảnh, không kèm token của website. Vì vậy ảnh trong repo private có thể trả về 404 đối với người xem dù admin đã nhập được phần văn bản README.

Website không cung cấp proxy công khai để đọc file private và không tự động sao chép ảnh từ repo. Việc sao chép ảnh sang một nội dung công khai là một quyết định chia sẻ riêng, không giữ nguyên quyền truy cập của repo.

## Cách chia sẻ từng ảnh đã chọn

1. Tự chọn và tải xuống từ GitHub những ảnh bạn có quyền chia sẻ, kiểm tra nội dung và thông tin riêng tư trong ảnh.
2. Trong quản trị, mở dự án hoặc bài viết và giữ **Lưu nháp** trong lúc chỉnh sửa. Với dự án, chọn định dạng chi tiết **Markdown** nếu cần.
3. Trong trình soạn thảo, chọn **Đính kèm file** và tải từng ảnh đã chọn. Trình soạn thảo tự chèn cú pháp ảnh Markdown với địa chỉ file của website.
4. Thay hoặc xóa tham chiếu ảnh private cũ để tránh ảnh hỏng/trùng. Dùng **Xem trước**, lưu bản nháp và kiểm tra lại.
5. Chỉ chuyển sang **Xuất bản** nếu bạn đồng ý để người xem truy cập cả nội dung và các ảnh đính kèm.

Ảnh chưa được tham chiếu bởi nội dung công khai chỉ được phục vụ cho phiên admin hợp lệ. Khi nội dung chuyển sang công khai, ảnh được tham chiếu mới có thể truy cập ẩn danh. Ẩn hoặc đưa nội dung về nháp sẽ thu hồi quyền truy cập ẩn danh nếu không còn nội dung công khai nào khác dùng ảnh đó. Bản sao đã được người khác tải xuống trước đó không thể thu hồi bằng thao tác ẩn.

Không đặt token GitHub vào Markdown, URL ảnh, mã frontend hoặc dữ liệu công khai. Không cần chuyển cả repo sang public để chia sẻ một ảnh đã chọn.

## Markdown và HTML

Cú pháp ảnh Markdown `![Mô tả](đường-dẫn-ảnh)` được hỗ trợ. HTML thô, bao gồm thẻ `<img>`, hiện bị bỏ qua; không bật HTML tùy ý chỉ để sửa ảnh. Trình **Đính kèm file** chèn đúng cú pháp được hỗ trợ.

Ảnh ở repo public vẫn có thể lỗi vì đường dẫn, nhánh hoặc tên file không đúng. Xem [GitHub Contents API](https://docs.github.com/en/rest/repos/contents) để biết phạm vi quyền đọc nội dung repo.
