export const openApi = {
  openapi: "3.0.3",
  info: {
    title: "Zastavka API",
    version: "1.0.0",
    description:
      "Wallpaper store API: public catalog, user auth, purchases, top-up, and admin image management.",
  },
  servers: [{ url: "/zastavka-api", description: "Production" }],
  tags: [
    { name: "Public" },
    { name: "User" },
    { name: "Admin" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
    schemas: {
      Wallpaper: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          price: { type: "integer" },
          tall: { type: "boolean" },
          image: { type: "string" },
          createdAt: { type: "string" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          initials: { type: "string" },
          coins: { type: "integer" },
          purchased: { type: "array", items: { type: "string" } },
          saved: { type: "array", items: { type: "string" } },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Public"],
        summary: "Health check",
        responses: { 200: { description: "OK" } },
      },
    },
    "/wallpapers": {
      get: {
        tags: ["Public"],
        summary: "List wallpapers",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Search by title" },
        ],
        responses: { 200: { description: "Wallpaper list" } },
      },
    },
    "/wallpapers/{id}": {
      get: {
        tags: ["Public"],
        summary: "Get one wallpaper",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Wallpaper" }, 404: { description: "Not found" } },
      },
    },
    "/auth/register": {
      post: {
        tags: ["User"],
        summary: "Register with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  password: { type: "string", minLength: 6 },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Token and user" }, 409: { description: "Email already used" } },
      },
    },
    "/auth/login": {
      post: {
        tags: ["User"],
        summary: "Sign in with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: { email: { type: "string" }, password: { type: "string" } },
              },
            },
          },
        },
        responses: { 200: { description: "Token and user" }, 401: { description: "Invalid credentials" } },
      },
    },
    "/me": {
      get: {
        tags: ["User"],
        security: [{ bearerAuth: [] }],
        summary: "Current user",
        responses: { 200: { description: "User" } },
      },
      patch: {
        tags: ["User"],
        security: [{ bearerAuth: [] }],
        summary: "Update saved favorites",
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { saved: { type: "array", items: { type: "string" } } } },
            },
          },
        },
        responses: { 200: { description: "User" } },
      },
    },
    "/purchases": {
      post: {
        tags: ["User"],
        security: [{ bearerAuth: [] }],
        summary: "Buy a wallpaper with coins",
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { wallpaperId: { type: "string" } }, required: ["wallpaperId"] },
            },
          },
        },
        responses: { 200: { description: "Purchase result" }, 400: { description: "Not enough coins" } },
      },
    },
    "/topup": {
      post: {
        tags: ["User"],
        security: [{ bearerAuth: [] }],
        summary: "Create a Buy Me a Coffee checkout for coins",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { coins: { type: "integer" }, usd: { type: "number" } },
                required: ["coins"],
              },
            },
          },
        },
        responses: { 200: { description: "Updated user" } },
      },
    },
    "/admin/login": {
      post: {
        tags: ["Admin"],
        summary: "Admin login",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { password: { type: "string" } },
                required: ["password"],
              },
            },
          },
        },
        responses: { 200: { description: "Admin token" }, 401: { description: "Wrong password" } },
      },
    },
    "/admin/stats": {
      get: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "Dashboard stats: users, wallpapers, purchases",
        responses: { 200: { description: "Counts" } },
      },
    },
    "/admin/users": {
      get: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "List users",
        responses: { 200: { description: "Users" } },
      },
    },
    "/admin/bmc": {
      get: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "BMC settings (masked secrets)",
        responses: { 200: { description: "Settings" } },
      },
      put: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "Save BMC settings",
        responses: { 200: { description: "Settings" } },
      },
    },
    "/admin/bmc/earnings": {
      get: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "BMC incoming payments, payouts, running totals",
        responses: { 200: { description: "Earnings ledger" } },
      },
    },
    "/admin/bmc/sync": {
      post: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "Sync supporters, extras, and memberships from BMC API into SQLite",
        responses: { 200: { description: "Imported" } },
      },
    },
    "/admin/bmc/banks": {
      get: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "Uzbekistan banks and branches for Yechib olish",
        responses: { 200: { description: "Banks" } },
      },
    },
    "/admin/bmc/payouts": {
      post: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "Record a Yechib olish payout request with bank, filial, and amount",
        responses: { 201: { description: "Created" } },
      },
    },
    "/admin/purchases": {
      get: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "List purchases",
        parameters: [{ name: "q", in: "query", schema: { type: "string" } }],
        responses: { 200: { description: "Purchases" } },
      },
    },
    "/admin/topups": {
      get: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "List coin top-ups",
        responses: { 200: { description: "Top-ups" } },
      },
    },
    "/admin/wallpapers": {
      get: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "List wallpapers (search)",
        parameters: [{ name: "q", in: "query", schema: { type: "string" } }],
        responses: { 200: { description: "Wallpapers" } },
      },
      post: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "Upload wallpaper (file + title + price)",
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                  title: { type: "string" },
                  price: { type: "integer" },
                  tall: { type: "boolean" },
                },
                required: ["file", "title", "price"],
              },
            },
          },
        },
        responses: { 201: { description: "Created" } },
      },
    },
    "/admin/wallpapers/{id}": {
      patch: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "Edit wallpaper (title, price, optional new file)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                  title: { type: "string" },
                  price: { type: "integer" },
                  tall: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Updated" } },
      },
      delete: {
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        summary: "Delete wallpaper",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Deleted" } },
      },
    },
  },
};
