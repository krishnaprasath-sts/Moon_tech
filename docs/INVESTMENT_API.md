# Investment Platform API

Base URL: `http://localhost:5000/api`. All bodies are JSON unless marked `multipart`.
Authenticated routes need `Authorization: Bearer <accessToken>` (from `POST /auth/login`).

Every response has the envelope:

```json
{ "success": true, "message": "...", "data": <payload>, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }
```

Errors: `{ "success": false, "message": "...", "errors": [{ "field": "amount", "message": "..." }] }`
with status 400 (bad request), 401 (not signed in), 403 (forbidden), 404, 409 (duplicate), 422 (validation).

Conventions
- Money is a JSON number in rupees with at most 2 decimals (`1500.5`).
- Dates are ISO-8601 UTC strings (`2026-09-28T10:15:00.000Z`) or `null`.
- List endpoints accept `page`, `limit` (max 100) and return `meta`.
- Date filters are `startDate` / `endDate` as `YYYY-MM-DD` (inclusive).

Roles: `CUSTOMER`, and staff `SUPER_ADMIN`, `ADMIN`, `EDITOR`.
"Staff" = all three staff roles (read-only for EDITOR). "Manager" = `SUPER_ADMIN` + `ADMIN`.

---

## 1. Customer

### Password
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | auth |
| POST | `/auth/forgot-password` | `{ identifier }` (email or mobile) | always 200; emails a 6-digit code valid 10 min. `data: { expiresInMinutes }` |
| POST | `/auth/reset-password` | `{ identifier, otp, newPassword }` | 401 on wrong/expired code |

New passwords: min 8 chars, at least one letter and one digit.

### Profile
| Method | Path | Body |
|---|---|---|
| GET | `/profile` | – |
| PUT | `/profile` | any of `{ fullName, dateOfBirth (YYYY-MM-DD), address, city, state, pincode (6 digits) }` |
| PUT | `/profile/payout-details` | `{ preferredMethod: "BANK"\|"UPI", upiId?, accountHolderName?, accountNumber? (8-25 digits), ifscCode?, bankName? }` |

`GET /profile` →
```json
{
  "id": 4, "email": "a@b.com", "phone": "+91...", "role": "CUSTOMER", "status": "ACTIVE",
  "fullName": "Rahul Sharma", "referralCode": "RAHU1001", "dateOfBirth": "1995-06-15",
  "address": "...", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001",
  "payoutDetails": {
    "preferredMethod": "BANK", "upiId": "rahul@upi", "accountHolderName": "Rahul Sharma",
    "accountNumberMasked": "XXXXXXXX8901", "ifscCode": "HDFC0001234", "bankName": "HDFC Bank",
    "hasBankDetails": true, "hasUpiDetails": true, "updatedAt": "..."
  },
  "createdAt": "..."
}
```
`payoutDetails` is `null` until saved. `PUT /profile` returns the same shape; `PUT /profile/payout-details` returns the `payoutDetails` object.
When updating payout details, omit `accountNumber` to keep the stored one. BANK requires holder name + account number + IFSC; UPI requires `upiId`.

### Wallet
| Method | Path | Notes |
|---|---|---|
| GET | `/wallet` | summary + top-up config |
| GET | `/wallet/transactions` | filters: `type`, `direction`, `startDate`, `endDate` |
| GET | `/wallet/deposits` | filters: `status`, `startDate`, `endDate` |
| POST | `/wallet/deposits` | **multipart**: `amount`, `upiTransactionId` (8-35 letters/digits), file field `receipt` (JPEG/PNG/WEBP/PDF ≤ 5 MB, required) |
| GET | `/wallet/deposits/:id/receipt` | streams the file (send the Bearer token; fetch as blob) |

`GET /wallet` →
```json
{
  "balance": 12000, "pendingDepositAmount": 5000, "pendingDepositCount": 1,
  "totalDeposited": 20000, "investedAmount": 8000, "expectedProfit": 800,
  "totalProfitEarned": 0, "totalWithdrawn": 0,
  "activeInvestments": 1, "maturedInvestments": 0, "pendingWithdrawals": 0,
  "config": {
    "minTopup": 500, "maxTopup": 200000, "upiId": "moontech@upi", "upiPayeeName": "Moon Tech Solutions",
    "depositInstructions": "...", "requireKycForInvestment": false
  }
}
```

Transaction →
```json
{
  "id": 1, "reference": "TXN-20260928-9F3A1C7B2D",
  "type": "DEPOSIT|INVESTMENT|MATURITY_PRINCIPAL|PROFIT|WITHDRAWAL|REFUND|ADJUSTMENT",
  "direction": "CREDIT|DEBIT", "amount": 5000, "balanceBefore": 0, "balanceAfter": 5000,
  "relatedEntity": "DEPOSIT", "relatedId": 3, "description": "...", "status": "COMPLETED", "createdAt": "..."
}
```

Deposit →
```json
{
  "id": 3, "reference": "DEP-20260928-AB12CD34EF", "userId": 4, "amount": 5000,
  "upiTransactionId": "412345678901", "hasReceipt": true, "status": "PENDING|APPROVED|REJECTED",
  "rejectionReason": null, "adminRemarks": null, "reviewedAt": null, "createdAt": "..."
}
```

### Investment plans & investments
| Method | Path | Body / Notes |
|---|---|---|
| GET | `/investment-plans` | public; active plans only |
| GET | `/investment-plans/featured` | public; active plans the admin marked as featured, in `sortOrder` |
| POST | `/investments/preview` | `{ planId, amount }` – auth |
| POST | `/investments` | `{ planId, amount }` – debits the wallet |
| GET | `/investments` | filters: `status`, `planId` |
| GET | `/investments/:id` | adds `withdrawals: [{ id, reference, totalAmount, status, rejectionReason, createdAt, completedAt }]` |
| POST | `/investments/:id/withdraw` | `{ payoutMethod?: "BANK"\|"UPI" }` (defaults to preferred) |

Plan →
```json
{
  "id": 1, "name": "Growth 90", "description": "...", "minAmount": 5000, "maxAmount": 200000,
  "durationDays": 90, "profitType": "PERCENTAGE|FIXED", "profitValue": 10,
  "isActive": true, "isFeatured": true, "featuredTagline": "Our most popular plan", "sortOrder": 2,
  "createdAt": "...", "updatedAt": "..."
}
```
`isFeatured` / `featuredTagline` control the website's Featured Plans page.
`PERCENTAGE`: `profitValue` is the % of principal earned over the whole period.
`FIXED`: `profitValue` is a rupee amount.

Preview →
```json
{
  "planId": 1, "planName": "Growth 90", "amount": 10000, "durationDays": 90,
  "profitType": "PERCENTAGE", "profitValue": 10, "expectedProfit": 1000, "maturityAmount": 11000,
  "startDate": "...", "maturityDate": "..."
}
```

Investment →
```json
{
  "id": 7, "reference": "INV-20260928-1A2B3C4D5E", "userId": 4, "planId": 1, "planName": "Growth 90",
  "profitType": "PERCENTAGE", "profitValue": 10, "durationDays": 90,
  "amount": 10000, "expectedProfit": 1000, "maturityAmount": 11000,
  "startDate": "...", "maturityDate": "...",
  "status": "ACTIVE|MATURED|WITHDRAWAL_REQUESTED|COMPLETED|CANCELLED",
  "earlyWithdrawalAllowed": false, "canRequestWithdrawal": false,
  "daysRemaining": 90, "progressPercent": 0,
  "maturedAt": null, "completedAt": null, "cancelledAt": null, "cancelReason": null, "createdAt": "..."
}
```
Show the "Request withdrawal" action only when `canRequestWithdrawal` is true.

### Withdrawals
| Method | Path | Notes |
|---|---|---|
| GET | `/withdrawals` | filters: `status` |
| GET | `/withdrawals/:id/proof` | streams the payout proof (404 if none) |

Withdrawal →
```json
{
  "id": 2, "reference": "WDR-20260928-AA11BB22CC", "userId": 4, "investmentId": 7,
  "investmentReference": "INV-...", "planName": "Growth 90",
  "principalAmount": 10000, "profitAmount": 1000, "totalAmount": 11000, "isEarly": false,
  "payoutMethod": "BANK|UPI", "payoutUpiId": null, "payoutAccountHolder": "Rahul Sharma",
  "payoutAccountMasked": "XXXXXXXX8901", "payoutIfsc": "HDFC0001234", "payoutBankName": "HDFC Bank",
  "status": "PENDING|APPROVED|REJECTED|COMPLETED", "rejectionReason": null,
  "paymentReference": null, "hasPaymentProof": false,
  "reviewedAt": null, "completedAt": null, "createdAt": "..."
}
```

### Notifications
| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | `unreadOnly=true` optional; `meta.unreadCount` included |
| GET | `/notifications/unread-count` | `data: { unreadCount }` |
| POST | `/notifications/:id/read` | |
| POST | `/notifications/read-all` | `data: { updated }` |

Notification → `{ id, type, title, message, relatedEntity, relatedId, isRead, readAt, createdAt }`

---

## 2. Admin (all under `/admin`)

### Dashboard
`GET /admin/finance/dashboard` (staff) →
```json
{
  "totalUsers": 5, "activeUsers": 5,
  "activeInvestments": 2, "activeInvestmentAmount": 15000,
  "totalInvestments": 3, "totalInvestmentAmount": 25000,
  "totalMaturedInvestments": 1, "maturedAwaitingWithdrawal": 0, "maturedAwaitingAmount": 0,
  "pendingPaymentVerifications": 1, "pendingPaymentAmount": 5000, "totalDeposited": 40000,
  "pendingWithdrawalRequests": 1, "pendingWithdrawalAmount": 11000,
  "totalProfitPaid": 0, "totalWithdrawn": 0, "totalWalletBalance": 15000, "walletTransactions": 6,
  "investmentStatusDistribution": [{ "name": "Active", "value": 2, "color": "#3b82f6" }],
  "recentTransactions": [ { ...Transaction, "userId": 4, "customerName": "...", "customerEmail": "..." } ],
  "upcomingMaturities": [ { "id": 7, "reference": "INV-...", "planName": "...", "amount": 10000,
      "maturityAmount": 11000, "maturityDate": "...", "customerName": "...", "customerEmail": "..." } ]
}
```

### Customer finance
`GET /admin/customers/:id/finance` (staff) →
```json
{
  "customerId": 4, "walletBalance": 12000,
  "summary": { "investedAmount": 8000, "expectedProfit": 800, "totalDeposited": 20000,
               "totalProfitPaid": 0, "totalWithdrawn": 0, "investmentsCount": 1, "recentCreditsCount": 2 },
  "payoutDetails": { ...same as profile payoutDetails } ,
  "investments": [Investment], "transactions": [Transaction],
  "deposits": [{ id, reference, amount, upiTransactionId, status, createdAt }],
  "withdrawals": [{ id, reference, totalAmount, profitAmount, status, createdAt, completedAt }]
}
```

### Settings
| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/admin/settings` | staff | – |
| PUT | `/admin/settings` | manager | any of the fields below |

`{ walletMinTopup, walletMaxTopup, upiId, upiPayeeName, depositInstructions, requireKycForInvestment }`

### Payment management
| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/admin/deposits` | staff | filters: `status`, `search`, `userId`, `startDate`, `endDate`. `meta.counts: { pending, approved, rejected }` |
| GET | `/admin/deposits/:id` | staff | adds `walletBalance` |
| GET | `/admin/deposits/:id/receipt` | staff | file stream |
| POST | `/admin/deposits/:id/approve` | manager | `{ remarks? }` – credits the wallet |
| POST | `/admin/deposits/:id/reject` | manager | `{ reason (min 5 chars), remarks? }` |

Admin deposit = Deposit + `{ customerName, customerEmail, customerPhone, customerStatus, reviewedBy }`.
Approve response adds `{ walletBalance, transactionReference }`.

### Investment plan management
| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/admin/investment-plans` | staff | Plan + `{ totalInvestments, activeInvestments, totalInvested }` |
| POST | `/admin/investment-plans` | manager | `{ name, description?, minAmount, maxAmount, durationDays, profitType, profitValue, isActive?, isFeatured?, featuredTagline?, sortOrder? }` |
| PUT | `/admin/investment-plans/:id` | manager | any subset of the above |
| PATCH | `/admin/investment-plans/:id/status` | manager | `{ isActive }` |
| PATCH | `/admin/investment-plans/:id/featured` | manager | `{ isFeatured, featuredTagline? (max 160 chars) }` |
| DELETE | `/admin/investment-plans/:id` | manager | 400 if the plan has investments |

### Investment management
| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/admin/investments` | staff | filters: `status`, `search`, `planId`, `userId`, `maturingInDays`, `startDate`, `endDate`. `meta.counts` keyed by status |
| GET | `/admin/investments/:id` | staff | adds `withdrawals[]` |
| POST | `/admin/investments/:id/cancel` | manager | `{ reason }` – ACTIVE only; refunds principal to wallet |
| PATCH | `/admin/investments/:id/early-withdrawal` | manager | `{ allowed }` – ACTIVE only |

Admin investment = Investment + `{ customerName, customerEmail, customerPhone }`.

### Withdrawal management
| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/admin/withdrawals` | staff | filters: `status`, `search`, `userId`, `startDate`, `endDate`. `meta.counts` keyed by status |
| GET | `/admin/withdrawals/:id` | staff | detail (below) |
| GET | `/admin/withdrawals/:id/proof` | staff | file stream |
| POST | `/admin/withdrawals/:id/approve` | manager | `{ remarks?, profitAmount? }` (`profitAmount` only for early withdrawals) |
| POST | `/admin/withdrawals/:id/reject` | manager | `{ reason, remarks? }` – PENDING or APPROVED |
| POST | `/admin/withdrawals/:id/complete` | manager | **multipart**: `paymentReference` (6-50 chars), `remarks?`, file field `paymentProof` (optional) |

Admin withdrawal = Withdrawal + `{ adminRemarks, customerName, customerEmail, customerPhone }`.
Detail adds `payoutAccountNumber` (full number, managers only, else `null`) and
`investment: { id, reference, planName, amount, expectedProfit, maturityAmount, durationDays, startDate, maturityDate, status }`.

Flow: `PENDING → APPROVED → COMPLETED`, or `PENDING/APPROVED → REJECTED`.

### Wallet ledger
| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/admin/wallets/transactions` | staff | filters: `type`, `direction`, `userId`, `search`, `startDate`, `endDate` |
| POST | `/admin/wallets/:userId/adjust` | manager | `{ direction: "CREDIT"\|"DEBIT", amount, reason }` |

Admin transaction = Transaction + `{ userId, customerName, customerEmail, customerPhone }`.

### Announcements
| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/admin/announcements` | staff | `[{ id, title, message, recipientsCount, createdBy, createdAt }]` |
| POST | `/admin/announcements` | manager | `{ title, message }` |

### Reports
`GET /admin/reports/:type?startDate=&endDate=&format=json|csv` (staff)

`type`: `users`, `wallet`, `investments`, `profit`, `maturity`, `withdrawals`, `payments`, `transactions`.

JSON →
```json
{
  "type": "investments", "title": "Investment Report", "generatedAt": "...",
  "startDate": "2026-09-01", "endDate": "2026-09-30",
  "columns": [{ "key": "amount", "label": "Amount", "type": "money|date|number|text" }],
  "rows": [{ "amount": 10000, "...": "..." }],
  "summary": [{ "label": "Total Invested", "value": 25000, "type": "money|number|text" }],
  "truncated": false
}
```
`format=csv` returns a `text/csv` attachment (fetch as blob with the Bearer token).

---

## 3. Business rules enforced by the API

1. Wallet top-ups must be within the admin-defined minimum/maximum.
2. Investments must be within the plan's minimum/maximum.
3. Profit and maturity date are calculated server-side from the plan; the client never supplies them.
4. An active investment cannot be withdrawn unless an admin enables early withdrawal for it. Early withdrawals pay the principal only unless the admin sets a profit amount on approval.
5. A wallet is credited only when an admin approves the payment receipt.
6. Every payment, investment, withdrawal and ledger entry has a unique reference (`DEP-`, `INV-`, `WDR-`, `TXN-`).
7. A UPI transaction ID can be credited only once.
8. Every balance change writes an immutable ledger row with the balance before and after; every admin action is written to the activity log.
