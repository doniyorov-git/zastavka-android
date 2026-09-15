# Zastavka API

Base URL: `/zastavka-api`

Interactive docs: **[/zastavka-api/docs](/zastavka-api/docs)**  
OpenAPI JSON: **[/zastavka-api/openapi.json](/zastavka-api/openapi.json)**

Admin default password: `ZastavkaAdmin!` (override with `ADMIN_PASSWORD`).

## Public

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/wallpapers?q=` | List wallpapers (optional search) |
| GET | `/wallpapers/:id` | One wallpaper |
| GET | `/uploads/:file` | Uploaded image file |

## User (Bearer token)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password }` → `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/me` | Current user |
| PATCH | `/me` | Update `{ saved: string[] }` |
| POST | `/purchases` | Buy `{ wallpaperId }` |
| POST | `/topup` | Add coins `{ coins, usd }` |

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

Auth header: `Authorization: Bearer <token>`
