# backend
# ServicePro — Service Provider Backend API

**Node.js + Express + MySQL**

---

## 📁 Folder Structure

```
service_provider_backend/
├── config/
│   └── db.js                  # MySQL connection pool
├── controllers/
│   ├── authController.js       # Register, login, profile
│   ├── serviceController.js    # CRUD for services
│   ├── appointmentController.js# Appointments management
│   ├── dashboardController.js  # Dashboard stats
│   └── analyticsController.js  # Charts & KPIs
├── middleware/
│   ├── authMiddleware.js       # JWT protect middleware
│   └── errorMiddleware.js      # Global error handler
├── routes/
│   ├── authRoutes.js
│   ├── serviceRoutes.js
│   ├── appointmentRoutes.js
│   ├── dashboardRoutes.js
│   └── analyticsRoutes.js
├── database/
│   └── schema.sql              # MySQL schema + seed data
├── uploads/                    # Service images (gitignored)
├── .env                        # Environment variables (fill in)
├── .env.example                # Template
└── server.js                   # Entry point
```

---

## ⚡ Quick Start

### 1. Set up MySQL database

```sql
-- In MySQL Workbench or CLI:
source C:/path/to/service_provider_backend/database/schema.sql
```

### 2. Configure environment variables

Edit `.env`:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=servicepro_db
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173

# Optional: Cloudinary (recommended for shared/stable image hosting)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

If Cloudinary variables are set, service images upload directly to Cloudinary and the API stores the Cloudinary URL.
If they are not set, the backend automatically falls back to local `uploads/` storage.

### 3. Install dependencies

```bash
npm install
```

### 4. Start the server

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

Server runs at: **http://localhost:8080**


---

## 🔑 Test Credentials (Seed Data)

| Role     | Email                | Password      |
|----------|----------------------|---------------|
| Provider | alex@servicepro.com  | Provider@123  |
| User     | sarah@example.com    | User@123      |

---

## 📡 API Endpoints

All protected routes require:
```
Authorization: Bearer <JWT_TOKEN>
```

---

### 🔐 Auth — `/api/auth`

| Method | Endpoint              | Auth     | Description            |
|--------|-----------------------|----------|------------------------|
| POST   | `/register`           | Public   | Register provider      |
| POST   | `/login`              | Public   | Login & get token      |
| GET    | `/me`                 | Private  | Get own profile        |
| PUT    | `/profile`            | Private  | Update profile         |
| PUT    | `/change-password`    | Private  | Change password        |

**POST /api/auth/login** — Request body:
```json
{ "email": "alex@servicepro.com", "password": "Provider@123" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "provider": { "id": 1, "name": "Alex Johnson", "email": "...", "rating": 4.8 },
    "token": "eyJhbGciOiJIUzI1..."
  }
}
```

---

### 🏠 Dashboard — `/api/dashboard` *(Private)*

| Method | Endpoint  | Description                                     |
|--------|-----------|-------------------------------------------------|
| GET    | `/stats`  | All dashboard stats (services, appts, revenue)  |

**Response includes:** `stats`, `statusBreakdown`, `recentAppointments`, `topServices`

---

### 🛠️ Services — `/api/services` *(Private)*

| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| GET    | `/`                         | List all services        |
| GET    | `/:id`                      | Get service by ID        |
| POST   | `/`                         | Create service (+ image) |
| PUT    | `/:id`                      | Update service (+ image) |
| PATCH  | `/:id/toggle-status`        | Toggle active/inactive   |
| DELETE | `/:id`                      | Delete service           |

**Query params for GET /:**
- `status` — `active` | `inactive`
- `category` — filter by category
- `search` — search by name/description
- `page`, `limit` — pagination

**POST/PUT** supports multipart/form-data with an `image` field (max 5MB, JPEG/PNG/WEBP).

---

### 📅 Appointments — `/api/appointments` *(Private)*

| Method | Endpoint          | Description               |
|--------|-------------------|---------------------------|
| GET    | `/`               | List all appointments     |
| GET    | `/today`          | Today's appointments only |
| GET    | `/:id`            | Get appointment by ID     |
| PATCH  | `/:id/status`     | Update status             |

**Query params for GET /:**
- `status` — `pending` | `confirmed` | `completed` | `cancelled`
- `service_id`, `date_from`, `date_to`, `page`, `limit`

**PATCH /api/appointments/:id/status** — Request body:
```json
{ "status": "confirmed" }
```

---

### 📊 Analytics — `/api/analytics` *(Private)*

| Method | Endpoint                | Query Params  | Description                |
|--------|-------------------------|---------------|----------------------------|
| GET    | `/kpi`                  | `months=6`    | KPI summary cards          |
| GET    | `/revenue`              | `months=6`    | Revenue by month           |
| GET    | `/appointments`         | `months=6`    | Appointment breakdown/month|
| GET    | `/service-popularity`   | —             | Bookings per service       |
| GET    | `/rating`               | `months=6`    | Avg rating trend           |

---

## 🗄️ Database Schema

| Table         | Description                          |
|---------------|--------------------------------------|
| `providers`   | Provider accounts                    |
| `users`       | Client/user accounts                 |
| `services`    | Services listed by providers         |
| `appointments`| Bookings made by users               |
| `reviews`     | Client reviews for completed appts   |

---

## 🔗 Frontend integration

The React frontend (`service_provider/`) auto-connects when:
1. Backend is running on `http://localhost:5000`
2. Frontend `.env` has `VITE_API_URL=http://localhost:5000/api`

**Both servers must be running simultaneously:**
```bash
# Terminal 1 — Frontend
cd service_provider && npm run dev          # → http://localhost:5173

# Terminal 2 — Backend
cd service_provider_backend && npm run dev  # → http://localhost:5000
```
