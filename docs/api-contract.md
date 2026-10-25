# Phân công công việc

## Duy Cáp

1. **Schemas**: toàn bộ bảng + enum + barrel `src/db/schemas/`, generate migration, chạy `db:migrate`, cập nhật migration test.
2. **Nền tảng**: đăng ký/đăng nhập/me/đổi mật khẩu, JWT + middleware `requireAuth`, RBAC/tenancy (`requireAdminRole`, `requireMuseumMember`, `requireOwner`, `requireFeature`), helper slug/pagination, env JWT.
3. **Museums & identity**: public museums, cập nhật museum/settings (owner-only toggle), CRUD `admin_tiers`, CRUD `museum_admins`.
4. **Collections**: CRUD, publish/archive, images, tags, public listing/detail.
5. **Invoices & checkout**: invoice service dùng chung, checkout từ cart, my invoices, admin invoices.
6. **File dùng chung**: `src/routes/index.ts`, `src/app.ts`, `src/db/schemas/index.ts`, `package.json`, `src/config/env.ts`.

## Dét Tô Mi

1. **Products**: CRUD, images, publish/archive, public listing/detail.
2. **Cart**: xem, thêm, sửa, xoá, clear (không viết checkout).
3. **Ticket types**: CRUD, active toggle, public listing.
4. **Tickets**: mua vé (gọi invoice service của Duy Cáp), my tickets.
5. **Phụ**: Postman/Bruno collection, E2E smoke test.

## Thứ tự & merge

- Duy Cáp: schemas → auth/RBAC → museums → collections → invoices.
- Dét Tô Mi: products → cart → ticket_types → tickets.
- Merge schemas trước, auth sau; các mảng còn lại làm song song.
- Duy Cáp mount toàn bộ router vào `src/routes/index.ts`.
