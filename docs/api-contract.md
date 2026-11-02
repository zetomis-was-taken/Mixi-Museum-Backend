# Phân công công việc

## Duy
1. **Schemas**: toàn bộ bảng + enum + barrel `src/db/schemas/`, generate migration, chạy `db:migrate`, cập nhật migration test.
2. **Nền tảng**: Supabase Auth là nguồn xác thực duy nhất; backend không triển khai đăng ký/đăng nhập/đổi mật khẩu, không lưu password hash và không phát hành JWT. Xây middleware `requireAuth` để xác minh Supabase access JWT từ `Authorization: Bearer <token>`, profile `/me`, RBAC/tenancy (`requireAdminRole`, `requireMuseumMember`, `requireOwner`, `requireFeature`), helper slug/pagination. Không giả định header `apikey` có mặt ở client backend trừ khi tích hợp Supabase yêu cầu.
3. **Museums & identity**: public museums, cập nhật museum/settings (owner-only toggle), CRUD `admin_tiers`, CRUD `museum_admins`; đồng bộ/provision profile idempotently từ Supabase Auth signup event hoặc lần truy cập được xác thực đầu tiên.
4. **Collections**: CRUD, publish/archive, images, tags, public listing/detail.
5. **Invoices & checkout**: invoice service dùng chung, checkout từ cart, my invoices, admin invoices.
6. **File dùng chung**: `src/routes/index.ts`, `src/app.ts`, `src/db/schemas/index.ts`, `package.json`, `src/config/env.ts`.

## Tân

1. **Products**: CRUD, images, publish/archive, public listing/detail.
2. **Cart**: xem, thêm, sửa, xoá, clear (không viết checkout).
3. **Ticket types**: CRUD, active toggle, public listing.
4. **Tickets**: mua vé (gọi invoice service của Duy Cáp), my tickets.
5. **Phụ**: Postman/Bruno collection, E2E smoke test.

## Thứ tự & merge

### Hợp đồng xác thực

- Frontend thực hiện signup/signin, xác minh email và reset/đổi password qua Supabase Auth; backend không cung cấp endpoint hoặc env cho password/JWT riêng.
- API nhận Supabase access token qua `Authorization: Bearer <token>` và phải xác minh chữ ký, issuer/audience, thời hạn cùng các claim cần thiết bằng cấu hình tin cậy của project. CORS `apikey` không thay thế xác thực Bearer. Hiện tại `src/` chưa có middleware auth; đây là yêu cầu triển khai, không phải hành vi đã có.
- `/me` trả về profile ứng dụng tương ứng với UUID của Auth user. Provision profile idempotently qua Auth signup event đáng tin cậy hoặc lần gọi API đã xác thực; xử lý retry/reconciliation khi đồng bộ lỗi. Không tin email/profile fields do client tùy ý gửi làm danh tính.
- Supabase Auth quản lý xác minh email và password reset; chính sách bắt buộc xác minh email trước khi mua hoặc quản trị phải được cấu hình ở Supabase và kiểm tra claim tương ứng ở backend trước launch.
- Khi xóa Auth account, giữ hoặc ẩn danh profile nếu invoice/ticket được lưu giữ; không cascade xóa hồ sơ làm hỏng lịch sử tài chính. Mọi endpoint quản trị vẫn phải kiểm tra membership theo đúng museum, không chỉ dựa vào JWT hợp lệ.

- Duy: schemas → auth/RBAC → museums → collections → invoices.
- Tân: products → cart → ticket_types → tickets.
- Merge schemas trước, auth sau; các mảng còn lại làm song song.
- Duy mount toàn bộ router vào `src/routes/index.ts`.
