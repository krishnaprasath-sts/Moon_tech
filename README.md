# Moon Tech Solutions — Stock Market Investment Platform

A stock market investment platform: customers fund a wallet by UPI, invest in plans and withdraw at maturity; admins verify payments, manage plans and process payouts. Includes customer onboarding and KYC.

---

## 📁 Project Structure

```
/backend
  /node     # Node.js ESM + TypeScript 5.5 + Express 4.19 + Sequelize 6.37 + MySQL API
  /panel    # React 18.3 + TypeScript 5.5 + Vite 5.3 + Tailwind CSS 3.4 + TanStack Query Admin Panel
/frontend   # Next.js customer website (wallet, plans, investments, withdrawals)
/docs       # API reference
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 20+ (ESM support)
- MySQL 8.0+ (or local MySQL server on port 3306)

---

### 1. Backend Setup (`/backend/node`)

1. Open terminal in `/backend/node`:
   ```bash
   cd backend/node
   npm install
   ```

2. Configure environment variables in `.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=moon_tech_db
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_DIALECT=mysql
   JWT_SECRET=moon_tech_jwt_secret_key_super_secure_2026_phase1
   ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
   FRONTEND_URL=http://localhost:5173
   ADMIN_URL=http://localhost:5173
   UPLOAD_DIR=./storage/kyc_documents
   ```

3. Initialize database tables and seed initial users:
   ```bash
   npm run migrate
   npm run seed
   ```

4. Start backend in development mode:
   ```bash
   npm run dev
   ```
   *The API will be live at `http://localhost:5000/api`*

---

### 2. Admin Panel Setup (`/backend/panel`)

1. Open a new terminal in `/backend/panel`:
   ```bash
   cd backend/panel
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The Admin Panel will be live at `http://localhost:5173`*

---

## 🔐 Seeded Test Credentials

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `superadmin@moontech.com` | `Admin@123456` | Full system, customer & KYC approval access |
| **ADMIN** | `admin@moontech.com` | `Admin@123456` | Full customer management & KYC verification |
| **EDITOR** | `editor@moontech.com` | `Admin@123456` | View-only customer/KYC directory (Approval blocked) |
| **Sample Customer** | `rahul.sharma@example.com` | `Admin@123456` | Status: `PENDING` KYC |
| **Sample Customer** | `priya.patel@example.com` | `Admin@123456` | Status: `VERIFIED` KYC |
| **Sample Customer** | `amit.verma@example.com` | `Admin@123456` | Status: `REJECTED` KYC |
| **Sample Customer** | `sneha.reddy@example.com` | `Admin@123456` | Status: `RESUBMISSION_REQUIRED` |
| **Sample Customer** | `vikram.singh@example.com` | `Admin@123456` | Status: `DRAFT` (Unsubmitted) |

*(Quick-fill 1-click buttons are built into the login screen at `http://localhost:5173/login` for instant testing)*

---

## 🛡️ Key Architecture & Security Highlights

1. **Strict ESM & Layered Architecture**:
   `Route` ➔ `Controller` ➔ `Service` ➔ `Sequelize Model`.
2. **AES-256-GCM Field-Level Encryption**:
   Customer PAN and Bank Account Numbers are encrypted at rest using AES-256-GCM authenticated encryption.
3. **Sensitive Data Masking**:
   Full PAN, Aadhaar, and Bank Account numbers are never logged or returned in plain text. Non-reversible last-4 digits (`pan_last4`, `aadhaar_last4`, `bank_account_last4`) are stored for searchability.
4. **Zero Public Document Exposure**:
   KYC files (Passbook, PAN card, Aadhaar card) are processed with **Sharp** image optimization and stored outside the public directory. They are streamed exclusively through authenticated, role-checked endpoint `GET /api/admin/kyc/:id/document/:type`.
5. **Strict RBAC Enforcement**:
   `EDITOR` role can browse and inspect customer submissions, but is strictly prohibited from verifying or rejecting KYC.
6. **Regulatory Audit Logging**:
   Every admin action (Verify, Reject, Resubmit, Status change, Login) generates an immutable entry in the `activity_logs` table with timestamp, operator ID, IP address, and user agent.
7. **Optional KYC Gate**:
   Admins can require verified KYC before a customer is allowed to invest (off by default).

---

## 💰 Investment Platform (Phase 2)

Implements the Investment App SRS. The earlier crypto staking module has been removed; its files are kept in `_removed_crypto_module/` as a backup only.

**Flow:** Register → Profile → Add Money → UPI Payment → Receipt Upload → Admin Verification → Wallet Credit → Select Plan → Invest → Maturity → Withdrawal Request → Admin Processing → Paid.

| Module | Customer | Admin |
| :--- | :--- | :--- |
| Wallet | Balance, add money via UPI, receipt upload, deposit history | Verify / reject payments, wallet ledger, manual adjustments |
| Investment plans | View plans, preview profit & maturity | Create / edit / activate / deactivate plans (percentage or fixed profit) |
| Investments | Invest from wallet, track status & maturity | View all, maturity monitor, cancel with refund, allow early withdrawal |
| Withdrawals | Request payout of matured investments | Approve, reject, record payment + proof, mark completed |
| Notifications | In-app + email for every lifecycle event | Broadcast announcements |
| Reports | – | User, wallet, investment, profit, maturity, withdrawal, payment, date-wise transactions (JSON + CSV) |
| Settings | – | Wallet min/max top-up, business UPI ID, optional KYC gate |
| Featured plans | Featured Plans page shows the plans the admin highlights | "Featured on website" switch + tagline per plan (Investment Plans screen) |

**Money rules**
- The wallet is credited only when an admin approves the payment; a UPI transaction ID can be credited once.
- Profit and maturity date are always calculated on the server from the plan. Plan terms are snapshotted into each investment, so editing a plan never changes a running investment.
- `PERCENTAGE` profit is the return on principal over the whole period (₹10,000 at 10% for 90 days pays ₹1,000). `FIXED` profit is a rupee amount.
- Active investments cannot be withdrawn unless an admin enables early withdrawal; early withdrawals pay the principal only unless the admin sets a profit amount on approval.
- Every balance change goes through one ledger function that locks the wallet row and records the balance before and after. Amounts are computed in integer paise.
- Investments mature automatically (checked every 5 minutes and whenever investments are listed).

Full endpoint reference: [docs/INVESTMENT_API.md](docs/INVESTMENT_API.md).

### Automated tests
Both scripts run against a throwaway database (see the header comments in each file):
- `backend/node/scripts/e2e-investment.mjs` — 174 end-to-end checks of the API (money rules, concurrency, permissions, reports).
- `backend/node/scripts/contract-frontend.mts` — runs the customer website's real API layer against the live API.

### Security notes
- Passwords must be at least 8 characters with a letter and a digit. Login, registration and password-reset endpoints are rate limited.
- Browsers are only allowed from `FRONTEND_URL`, `ADMIN_URL` and `CORS_ORIGINS` (localhost is added automatically in development).
- In production (`NODE_ENV=production`) the API refuses to start until `JWT_SECRET`, `JWT_REFRESH_SECRET` and `ENCRYPTION_KEY` are replaced with strong values (32+ characters).
- Uploaded receipts are re-encoded (images) or signature-checked (PDF) before being stored outside the public directory and are only served to their owner or staff.
- Bank account numbers are AES-256-GCM encrypted at rest; customers only ever see the last 4 digits.
- Set `TRUST_PROXY=1` when running behind nginx or a load balancer so rate limits and audit logs use the real client IP.

### Production checklist
1. Set strong secrets and SMTP credentials in `backend/node/.env`; set `NODE_ENV=production`.
2. Change the passwords of the seeded staff accounts (or delete the sample customers) before going live.
3. Set `FRONTEND_URL`, `ADMIN_URL` / `CORS_ORIGINS` to the real domains and serve everything over HTTPS.
4. Point `VITE_API_URL` (panel) and `NEXT_PUBLIC_API_URL` (website) at the API domain.
5. Back up the database and the `storage/` folder regularly.

Password reset codes are emailed. When `SMTP_USER` is empty the code is written to the API server log instead, so configure SMTP before going live.

### Customer Website Setup (`/frontend`)

```bash
cd frontend
npm install
npm run dev
```
*The customer website will be live at `http://localhost:3000`*

---

## 📡 API Endpoints Summary

### Authentication
- `POST /api/auth/register` — Register customer, create profile & draft KYC
- `POST /api/auth/login` — Sign in (Customer, Admin, Super Admin, Editor)
- `GET /api/auth/me` — Current authenticated session details
- `POST /api/auth/logout` — Invalidate session

### KYC Management
- `POST /api/kyc/submit` — Customer multipart file upload (Sharp optimized)
- `GET /api/kyc/status` — Customer's own KYC status
- `GET /api/admin/kyc` — Filterable & paginated KYC queue
- `GET /api/admin/kyc/:id` — Detailed KYC dossier with review history
- `POST /api/admin/kyc/:id/verify` — Approve KYC (Admin/Super Admin only)
- `POST /api/admin/kyc/:id/reject` — Reject KYC with mandatory reason
- `POST /api/admin/kyc/:id/resubmit` — Request document resubmission
- `GET /api/admin/kyc/:id/document/:type` — Authenticated document stream (`passbook` | `pan` | `aadhaar`)

### Customer Management
- `GET /api/admin/customers` — Search & filter customer directory
- `GET /api/admin/customers/:id` — 360 Customer view (profile, KYC, referrals, audit trail)
- `PATCH /api/admin/customers/:id/status` — Activate / Suspend account

### Referrals & Analytics
- `GET /api/referrals/my` — Customer referral network
- `GET /api/admin/referrals` — Admin referral list
- `GET /api/admin/dashboard/stats` — High-performance aggregation metrics & charts
- `GET /api/admin/activity-logs` — Immutable audit trail
