# PrintFlow — QR-Based Smart Xerox Ordering & Automated Printing System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-24-green.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg)](https://www.prisma.io/)
[![Python](https://img.shields.io/badge/Python-3.12-yellow.svg)](https://www.python.org/)
[![Windows 11](https://img.shields.io/badge/OS-Windows%2011-0078D6.svg)](https://www.microsoft.com/windows)

**PrintFlow** is a complete, production-grade web application and hardware automation bridge designed for Xerox shops, digital copy centers, and commercial print kiosks.

Customers scan a QR standee at the shop counter on their smartphone, upload documents (PDF, JPG, PNG), customize print settings (B&W/Color, A4/A3/Legal, single/double sided, copies, custom page ranges, spiral binding, lamination), inspect live dynamic pricing, pay instantly via UPI/Card, and track physical printing progress in real time with an atomic daily token (e.g. `PF-001`).

Shop owners manage orders, queue priority, pricing rules, and network multifunction photocopiers via a dedicated Admin Dashboard. The **Windows 11 Local Print Agent** continuously connects outbound via HTTPS/WebSocket, leases pending jobs atomically, and dispatches them to physical or virtual Windows printer queues.

---

## 🏗️ System Architecture

PrintFlow is organized into three decoupled, secure tiers:

```
+-------------------------------------------------------------------------+
|                         CUSTOMER SMARTPHONE                             |
|  - QR Code Landing (/)               - Multi-Document Upload (/upload)  |
|  - Custom Print Settings (/settings) - Real-Time Calculator             |
|  - Razorpay UPI Payment (/payment)   - Live Progress Tracker (/track)   |
+------------------------------------+------------------------------------+
                                     |
                                     | Outbound HTTPS / WebSocket
                                     v
+-------------------------------------------------------------------------+
|                      PRINTFLOW CORE BACKEND                             |
|  - Express.js + TypeScript REST APIs - Socket.IO Real-Time Dispatcher   |
|  - Dynamic Pricing Calculation Engine- Atomic Daily Token Generator     |
|  - Database-backed FIFO Queue        - Idempotent Payment Processor     |
|  - Prisma ORM (SQLite / MySQL)       - Expiring Storage Manager         |
+-------------------+--------------------------------+--------------------+
                    ^                                ^
                    | REST / WebSocket               | Admin Session (JWT)
                    v                                v
+------------------------------------+   +--------------------------------+
|    WINDOWS 11 LOCAL PRINT AGENT    |   |     SHOP ADMIN DASHBOARD       |
|  - Background daemon (agent.py)    |   |  - Route: /admin               |
|  - Spooler Bridge (PyWin32)        |   |  - Live Queue Management       |
|  - PyMuPDF Slicing & Pillow Layout |   |  - Photocopier Device Config   |
|  - Safe Simulation Mode            |   |  - Real-Time Price Rules       |
|  - Diagnostic Monitor GUI (gui.py) |   |  - Financial Reports & CSV     |
+------------------------------------+   +--------------------------------+
```

---

## 🖨️ Actual Shop Hardware Integration

The system comes pre-configured with the shop's two network photocopiers:

| Device Profile | Configured IP | Driver Queue Mapped | Assigned Capability | Supported Paper Sizes |
| :--- | :--- | :--- | :--- | :--- |
| **Konica 251** | `192.168.1.251` (shielded) | `EPSON L3250 Series` / Windows Queue | Both (Color & B&W) | A4, A3, Legal |
| **Canon 240** | `192.168.1.240` (shielded) | `Microsoft Print to PDF` / Driver Queue | Black & White Only | A4, Legal |

- **Security Note:** Private IP addresses are never exposed to customer-facing APIs.
- **Dynamic Adaptability:** Shop administrators can reassign machine capabilities (Color, B&W, Both) and Windows spooler queues from the admin UI without code modification.
- **Safe Simulation Mode:** Enabled by default (`SIMULATION_MODE=true`) to verify the full queue claiming and status tracking pipeline without wasting physical paper or toner.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 20+ (Node 24 tested)
- npm 10+
- Python 3.12+ with pip

### 1. Backend Service
```powershell
cd backend
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```
- Server URL: `http://localhost:5000`
- Health check: `http://localhost:5000/health`
- Default Admin Credentials:
  - **Email:** `admin@printflow.com`
  - **Password:** `AdminPassword123!`

### 2. Frontend Customer App & Admin Portal
```powershell
cd frontend
npm install
npm run dev
```
- Customer Storefront: `http://localhost:5173/`
- Customer Tracker: `http://localhost:5173/track`
- Shop Owner Dashboard: `http://localhost:5173/admin/login`

### 3. Windows Local Print Agent
```powershell
cd print-agent
pip install -r requirements.txt
python agent.py
```
Or launch the desktop diagnostic console:
```powershell
python gui.py
```

---

## 🧪 Testing & Verification

Run backend unit & integration tests:
```powershell
cd backend
npm test
```

Run Python agent processor & Windows spooler tests:
```powershell
cd print-agent
python test_agent.py
```

---

## 🔒 Security Architecture
- **JWT Authentication:** 12-hour signed access tokens + 7-day refresh tokens.
- **Payment Verification:** HMAC SHA256 server-side signature verification with Razorpay test/live sandbox.
- **Data Privacy:** Expiring file download links and configurable auto-deletion retention policy.
- **Hardware Isolation:** Zero open inbound router ports; print agents make outbound HTTPS/WSS connections only.
