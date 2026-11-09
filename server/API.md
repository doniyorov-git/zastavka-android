# Zastavka API

Base URL: `https://silkrood.uz/zastavka-api`

Interactive docs: **[/zastavka-api/docs](/zastavka-api/docs)**  
OpenAPI JSON: **[/zastavka-api/openapi.json](/zastavka-api/openapi.json)**

Admin default password: `ZastavkaAdmin!` (override with `ADMIN_PASSWORD`).

Coin top-up: Buy Me a Coffee extra `577212` ($1 = 100 coins). Checkout: `https://www.buymeacoffee.com/admin09wet/e/577212`. Webhook: `POST /webhooks/bmc` (also `POST /topup/callback`). Header `x-signature-sha256`. Credits **100 coins per $1** received.

## Public

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/wallpapers?q=` | List wallpapers (optional search) |
| GET | `/wallpapers/:id` | One wallpaper |
| GET | `/uploads/:file` | Uploaded image file |
| POST | `/webhooks/bmc` | Buy Me a Coffee webhook |

## User (Bearer token)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password }` → `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/me` | Current user |
| PATCH | `/me` | Update `{ saved: string[] }` |
| POST | `/purchases` | Buy `{ wallpaperId }` |
| POST | `/topup` | Open BMC checkout `{ coins, usd }` |
| GET | `/topup/status` | `{ orderId }` or `{ sessionId }` |
| GET | `/billing/status` | Billing configuration and supported products |
| POST | `/billing/verify` | Verify a Play purchase and credit the authenticated account once |
| POST | `/billing/rtdn` | Authenticated Pub/Sub RTDN; reverse a fully voided purchase |

## Admin (Bearer token from `/admin/login`)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/admin/login` | `{ password }` → `{ token }` |
| GET | `/admin/stats` | `{ users, wallpapers, purchases }` |
| GET | `/admin/users` | User list |
| GET | `/admin/purchases?q=` | Purchase history |
| GET | `/admin/wallpapers?q=` | Search wallpapers |
| POST | `/admin/wallpapers` | multipart: `file`, `title`, `price`, `tall` |
| PATCH | `/admin/wallpapers/:id` | Edit title/price/file |
| DELETE | `/admin/wallpapers/:id` | Delete wallpaper |
| GET | `/admin/bmc` | Buy Me a Coffee tokens and extras |
| GET | `/admin/bmc/earnings` | Incoming payments, payouts, running totals |
| GET | `/admin/bmc/banks` | Uzbekistan banks and branches |
| POST | `/admin/bmc/payouts` | Yechib olish: `{ amount, bankId, branchId }` (status pending / Jarayonda) |
| GET | `/admin/topups` | Coin top-up orders |

Auth header: `Authorization: Bearer <token>`
