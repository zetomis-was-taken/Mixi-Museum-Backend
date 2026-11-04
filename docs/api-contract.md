# API Contract

## 1. Scope

This document is the HTTP contract for the museum storefront and admin dashboard. It is derived from [`database-design.md`](./database-design.md) and [`workloads.md`](./workloads.md).

- Route paths below are absolute from the deployed API origin; the current Express app mounts health routes at `/health` and `/health/ready` without a global prefix. If a deployment adds a prefix such as `/api`, apply it consistently to every route.
- Content type: `application/json`
- IDs: UUIDs
- Dates/times: ISO-8601 strings (`YYYY-MM-DD` for dates)
- Money: integer minor units; never floating point
- Images: request and response payloads contain Supabase Storage paths/keys, not binary files
- All responses use the standard envelopes in [`global-responses-and-errors.md`](./global-responses-and-errors.md)
- Pagination uses `page` (default `1`) and `page_size` (default `20`, maximum `100`)

The API does not implement signup, signin, password reset, email verification, JWT issuance, payment-provider webhooks, or QR redemption. Those responsibilities are owned by Supabase Auth or remain explicitly out of scope.

## 2. Authentication and authorization

Authenticated endpoints require:

```http
Authorization: Bearer <supabase-access-token>
```

The backend validates the Supabase JWT signature, issuer, audience, expiry, and required claims. A valid token does not grant admin access: museum management endpoints additionally require membership in `museum_admins` for the requested museum. Owner-only endpoints require `is_owner = true`.

The following route classes are public:

- Published museums
- Published collections, collection images, and collection tags
- Published products and product images when `shop_enabled = true`
- Active ticket types when `tickets_enabled = true`

The following route classes require an authenticated user:

- `/me`
- Carts
- Checkout and own invoices
- Own issued tickets

Admin routes are tenant-scoped by `museum_id`. Every lookup and mutation must enforce the authenticated user's membership in that same museum; an ID alone must never determine tenant access.

## 3. Response contract

### Success

```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

Typical status codes are `200 OK`, `201 Created`, `202 Accepted`, and `204 No Content`. A `204 No Content` response has an empty body and is the only successful response that does not contain the success envelope.

### Error

```json
{
  "success": false,
  "message": "Item not found",
  "error": {
    "code": "NOT_FOUND",
    "details": []
  }
}
```

Validation errors use `400 VALIDATION_ERROR`; authentication and authorization use `401 UNAUTHORIZED` and `403 FORBIDDEN`; missing resources use `404 NOT_FOUND`; conflicts such as duplicate slugs use `409 CONFLICT`; unexpected failures use `500 INTERNAL_SERVER_ERROR`.

## 4. Resource routes

### 4.1 Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Liveness check |
| `GET` | `/health/ready` | Public | Readiness and database connectivity check |

### 4.2 Profile

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/me` | User | Return or idempotently provision the application profile for the Supabase user |
| `PATCH` | `/me` | User | Update `display_name`, `phone`, or `avatar_url`; identity and email come from Supabase Auth |

`GET /me` and `PATCH /me` never accept a client-supplied user ID or use client-supplied identity fields for authorization.

### 4.3 Public museums

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/museums` | Public | List museums with `visibility_status=published` |
| `GET` | `/museums/:museumSlug` | Public | Get one published museum and its public settings |

Supported list query parameters: `page`, `page_size`, and optional `q` search text.

### 4.4 Public collections

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/museums/:museumSlug/collections` | Public | List published collections for a published museum |
| `GET` | `/museums/:museumSlug/collections/:collectionSlug` | Public | Get a published collection, images, and tags |

Supported list query parameters: `page`, `page_size`, and optional `tag`.

### 4.5 Public merchandise

These routes are available only when the museum has `shop_enabled=true`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/museums/:museumSlug/products` | Public | List products with `status=published` |
| `GET` | `/museums/:museumSlug/products/:productSlug` | Public | Get a published product and images |

Supported list query parameters: `page`, `page_size`, and optional `q`.

### 4.6 Public ticket types

These routes are available only when the museum has `tickets_enabled=true`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/museums/:museumSlug/ticket-types` | Public | List active ticket types currently available for sale |
| `GET` | `/museums/:museumSlug/ticket-types/:ticketTypeId` | Public | Get an active ticket type and its purchase rules |

The response includes date mode, time mode, capacity, sale window, and price in the museum currency. Availability and capacity are checked again transactionally during checkout.

## 5. Authenticated commerce routes

### 5.1 Cart

A user has at most one cart per museum. Carts are merchandise-only and require `shop_enabled=true`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/museums/:museumId/cart` | User | Get or return the user's cart and current product references |
| `POST` | `/museums/:museumId/cart/items` | User | Add a product or increase its quantity |
| `PATCH` | `/museums/:museumId/cart/items/:itemId` | User | Replace an item's quantity; quantity must be at least `1` |
| `DELETE` | `/museums/:museumId/cart/items/:itemId` | User | Remove one cart item |
| `DELETE` | `/museums/:museumId/cart` | User | Clear all cart items |

Example add-item body:

```json
{ "product_id": "uuid", "quantity": 1 }
```

The cart stores no price snapshot. At checkout, current product prices and status are revalidated, and stock is decremented transactionally at payment/confirmation time with a database no-negative-stock check. If stock is stale or insufficient, the operation fails with a conflict and no invoice or stock decrement is committed.

### 5.2 Checkout and invoices

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/museums/:museumId/checkout` | User | Create a pending merchandise invoice from the user's cart |
| `POST` | `/museums/:museumId/ticket-orders` | User | Create a pending ticket invoice and issue one ticket per purchased admission after payment |
| `GET` | `/me/invoices` | User | List the authenticated user's invoices |
| `GET` | `/me/invoices/:invoiceId` | User | Get one of the authenticated user's invoices, lines, and payment status |

Merchandise checkout body:

```json
{
  "billing_name": "Museum Visitor",
  "billing_email": "visitor@example.com",
  "shipping_name": "Museum Visitor",
  "shipping_phone": "+123456789",
  "shipping_address": {
    "line1": "1 Museum Road",
    "city": "City",
    "postal_code": "10000",
    "country": "US"
  }
}
```

Ticket order body:

```json
{
  "items": [
    {
      "ticket_type_id": "uuid",
      "quantity": 2,
      "valid_date": "2026-12-01"
    }
  ],
  "billing_name": "Museum Visitor",
  "billing_email": "visitor@example.com"
}
```

For open-date ticket types, `valid_date` is required. Fixed-date types must match their configured `valid_date`. The service validates sale windows, active state, feature flags, currency, and capacity in the purchase transaction. Payment integration is not defined by this contract; an invoice remains `pending` until a separately agreed payment flow marks it `paid`.

### 5.3 Issued tickets

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/me/tickets` | User | List tickets owned by the authenticated user |
| `GET` | `/me/tickets/:ticketId` | User | Get one owned ticket, including its QR code and immutable purchase snapshot |

Supported list query parameters: `page`, `page_size`, `museum_id`, `status`, and `valid_date`.

## 6. Admin routes

All routes in this section require an authenticated museum member. They are scoped by `museumId` and must enforce the permission represented by the member's `admin_tiers.permissions` JSON object; membership alone is not sufficient. The permission keys are feature-specific (for example, museum, collection, product, ticket-type, invoice, or ticket management) and must be defined by the authorization implementation before these routes are exposed. Owner-only routes are marked **Owner**.

### 6.1 Museum settings and administration

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/admin/museums/:museumId` | Member | Get the museum management view |
| `PATCH` | `/admin/museums/:museumId` | Owner | Update museum details, visibility, currency, and feature flags |
| `GET` | `/admin/museums/:museumId/admin-tiers` | Member | List museum-defined admin tiers |
| `POST` | `/admin/museums/:museumId/admin-tiers` | Owner | Create an admin tier |
| `PATCH` | `/admin/museums/:museumId/admin-tiers/:tierId` | Owner | Update a tier name or permissions |
| `DELETE` | `/admin/museums/:museumId/admin-tiers/:tierId` | Owner | Delete a tier; memberships assigned to it become unassigned |
| `GET` | `/admin/museums/:museumId/admins` | Member | List museum memberships |
| `POST` | `/admin/museums/:museumId/admins` | Owner | Add an existing user as a museum admin |
| `PATCH` | `/admin/museums/:museumId/admins/:adminId` | Owner | Change tier or ownership |
| `DELETE` | `/admin/museums/:museumId/admins/:adminId` | Owner | Remove a membership while preserving at least one owner |

Updating `shop_enabled` or `tickets_enabled` is owner-only. A museum with retained invoices or tickets must be archived rather than hard-deleted; no admin delete-museum route is exposed.

### 6.2 Collections, images, and tags

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/admin/museums/:museumId/collections` | Member | List all collections, including drafts and archived rows |
| `POST` | `/admin/museums/:museumId/collections` | Member | Create a collection |
| `GET` | `/admin/museums/:museumId/collections/:collectionId` | Member | Get a collection management view |
| `PATCH` | `/admin/museums/:museumId/collections/:collectionId` | Member | Update collection fields |
| `DELETE` | `/admin/museums/:museumId/collections/:collectionId` | Member | Remove a collection and its images/tag memberships |
| `POST` | `/admin/museums/:museumId/collections/:collectionId/publish` | Member | Set status to `published` |
| `POST` | `/admin/museums/:museumId/collections/:collectionId/archive` | Member | Set status to `archived` |
| `POST` | `/admin/museums/:museumId/collections/:collectionId/images` | Member | Add an image storage path |
| `PATCH` | `/admin/museums/:museumId/collections/:collectionId/images/:imageId` | Member | Update image alt text or position |
| `DELETE` | `/admin/museums/:museumId/collections/:collectionId/images/:imageId` | Member | Remove an image reference |
| `GET` | `/admin/museums/:museumId/tags` | Member | List museum-scoped tags |
| `POST` | `/admin/museums/:museumId/tags` | Member | Create a tag |
| `PATCH` | `/admin/museums/:museumId/tags/:tagId` | Member | Update a tag |
| `DELETE` | `/admin/museums/:museumId/tags/:tagId` | Member | Delete a tag and memberships |
| `PUT` | `/admin/museums/:museumId/collections/:collectionId/tags` | Member | Replace the collection's tag associations |

### 6.3 Products and images

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/admin/museums/:museumId/products` | Member | List products in every status |
| `POST` | `/admin/museums/:museumId/products` | Member | Create a product |
| `GET` | `/admin/museums/:museumId/products/:productId` | Member | Get a product management view |
| `PATCH` | `/admin/museums/:museumId/products/:productId` | Member | Update product data, price, or stock |
| `DELETE` | `/admin/museums/:museumId/products/:productId` | Member | Delete a product only when financial references permit it |
| `POST` | `/admin/museums/:museumId/products/:productId/publish` | Member | Set status to `published` |
| `POST` | `/admin/museums/:museumId/products/:productId/archive` | Member | Set status to `archived` |
| `POST` | `/admin/museums/:museumId/products/:productId/images` | Member | Add an image storage path |
| `PATCH` | `/admin/museums/:museumId/products/:productId/images/:imageId` | Member | Update image alt text or position |
| `DELETE` | `/admin/museums/:museumId/products/:productId/images/:imageId` | Member | Remove an image reference |

Product prices are integer `price_minor` values in the museum's ISO-4217 currency. Product deletion must respect invoice-item `RESTRICT` history.

### 6.4 Ticket types

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/admin/museums/:museumId/ticket-types` | Member | List all ticket types |
| `POST` | `/admin/museums/:museumId/ticket-types` | Member | Create a ticket type |
| `GET` | `/admin/museums/:museumId/ticket-types/:ticketTypeId` | Member | Get a ticket type |
| `PATCH` | `/admin/museums/:museumId/ticket-types/:ticketTypeId` | Member | Update ticket configuration |
| `DELETE` | `/admin/museums/:museumId/ticket-types/:ticketTypeId` | Member | Delete only if no issued financial history references it |
| `POST` | `/admin/museums/:museumId/ticket-types/:ticketTypeId/activate` | Member | Set `is_active=true` |
| `POST` | `/admin/museums/:museumId/ticket-types/:ticketTypeId/deactivate` | Member | Set `is_active=false` |

Validation rules mirror the database design: fixed date requires `valid_date`; slot mode requires both slot times; end time must be after start time; price and capacity cannot be negative.

### 6.5 Admin invoices and tickets

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/admin/museums/:museumId/invoices` | Member | List invoices for the museum |
| `GET` | `/admin/museums/:museumId/invoices/:invoiceId` | Member | Get an invoice and line items |
| `GET` | `/admin/museums/:museumId/tickets` | Member | List issued tickets for admission operations |
| `GET` | `/admin/museums/:museumId/tickets/:ticketId` | Member | Get one issued ticket |

Admin invoice and ticket reads are tenant-scoped. Invoice and issued-ticket records are immutable financial history; this contract exposes no general delete or edit operation.

## 7. Common request fields

### Museum

`slug`, `name`, `description`, `address`, `latitude`, `longitude`, `cover_image_path`, `currency`, `visibility_status`, `shop_enabled`, and `tickets_enabled`.

### Collection

`title`, `slug`, `description`, `status`.

### Product

`name`, `slug`, `description`, `price_minor`, `stock_quantity`, and `status`.

### Ticket type

`name`, `description`, `price_minor`, `date_mode`, `valid_date`, `time_mode`, `slot_start_time`, `slot_end_time`, `capacity`, `sales_start_at`, `sales_end_at`, and `is_active`.

Create and update requests reject unknown fields and validate all enum values, UUIDs, slugs, dates, times, quantities, and money values.

## 8. Deliberately unspecified features

The following are not API routes until their policies are agreed:

- QR scanning and the `valid` → `used` redemption transition, including scanner authorization and time-window rules
- Guest checkout
- Payment provider, payment confirmation, refund, and webhook endpoints
- Product variants
- Auth password and email operations, which remain Supabase Auth responsibilities
