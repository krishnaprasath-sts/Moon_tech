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
| GET | `/wallet` | summary (two buckets: capital + profit) + config |
| GET | `/wallet/transactions` | filters: `type`, `direction`, `bucket` (`CAPITAL`\|`PROFIT`), `startDate`, `endDate` |
| POST | `/wallet/withdrawals` | `{ bucket?: "PROFIT"\|"CAPITAL" (default PROFIT), amount?, payoutMethod? }`. PROFIT: `amount` required, no fee. CAPITAL: whole available capital balance, `amount` ignored, fee deducted |
| GET | `/wallet/deposits` | filters: `status`, `startDate`, `endDate` |
| POST | `/wallet/deposits` | **multipart**: `amount`, `upiTransactionId` (8-35 letters/digits), file field `receipt` (JPEG/PNG/WEBP/PDF ≤ 5 MB, required) |
| GET | `/wallet/deposits/:id/receipt` | streams the file (send the Bearer token; fetch as blob) |

`GET /wallet` →
```json
{
  "balance": 103200, "capitalBalance": 100000, "profitBalance": 3200, "investedCapital": 100000,
  "pendingDepositAmount": 5000, "pendingDepositCount": 1,
  "totalDeposited": 200000, "investedAmount": 100000, "expectedProfit": 0,
  "totalProfitEarned": 3200, "dailyProfitCredited": 3200, "profitCreditedToday": 250, "profitCreditedThisMonth": 2000,
  "lastProfitCreditDay": "2026-10-14", "referralEarnings": 0, "referralEarningsPending": 0,
  "totalWithdrawn": 0, "totalFeesPaid": 0,
  "activeInvestments": 1, "maturedInvestments": 0, "pendingWithdrawals": 0,
  "pendingWithdrawalAmount": 0, "pendingCapitalWithdrawalAmount": 0, "pendingProfitWithdrawalAmount": 0,
  "config": {
    "minTopup": 500, "maxTopup": 200000, "upiId": "moontech@upi", "upiPayeeName": "Moon Tech Solutions",
    "depositInstructions": "...", "requireKycForInvestment": true, "requireKycForWithdrawal": true,
    "minWithdrawal": 500, "referralCommissionPercent": 0.5, "capitalWithdrawalFeePercent": 5,
    "payoutSchedule": "Every working day (Monday to Friday) at 6:00 AM IST"
  }
}
```
`balance` is always `capitalBalance + profitBalance`. **Capital wallet**: deposits and capital returned at maturity;
it is what gets invested and the only money that earns. **Profit wallet**: daily profit and referral commission;
withdrawable any time without fee, never earns by itself (no compounding) unless re-invested.

Transaction →
```json
{
  "id": 1, "reference": "TXN-20260928-9F3A1C7B2D",
  "type": "DEPOSIT|INVESTMENT|MATURITY_PRINCIPAL|PROFIT|REFERRAL_COMMISSION|WITHDRAWAL|REFUND|ADJUSTMENT",
  "direction": "CREDIT|DEBIT", "bucket": "CAPITAL|PROFIT", "amount": 5000, "balanceBefore": 0, "balanceAfter": 5000,
  "relatedEntity": "DEPOSIT", "relatedId": 3, "description": "...", "status": "COMPLETED", "createdAt": "..."
}
```
`balanceBefore` / `balanceAfter` are the balances of the `bucket` that moved.

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
| POST | `/investments/preview` | `{ planId, amount, source?: "CAPITAL"\|"PROFIT" }` – auth |
| POST | `/investments` | `{ planId, amount, source? }` – debits the chosen wallet (default CAPITAL; re-invested profit becomes capital) |
| GET | `/investments` | filters: `status`, `planId` |
| GET | `/investments/:id` | adds `profitCredits[]` and `withdrawals: [{ id, reference, principalAmount, profitAmount, totalAmount, feePercent, feeAmount, netAmount, status, isEarly, rejectionReason, createdAt, completedAt }]` |
| POST | `/investments/:id/withdraw` | closes the investment and withdraws its capital, less the fee. `{ payoutMethod?: "BANK"\|"UPI" }`. 403 while the lock-in runs (unless the admin allowed an early exit) |

Plan →
```json
{
  "id": 1, "name": "Regular Plan", "description": "...", "minAmount": 1000, "maxAmount": 500000,
  "durationDays": 0, "isOpenEnded": true, "lockInDays": 0,
  "profitType": "PERCENTAGE", "profitValue": 5, "payoutMode": "DAILY", "rateBasis": "PER_MONTH",
  "creditsPerMonth": 20, "creditsPerWeek": 5,
  "isActive": true, "isFeatured": true, "featuredTagline": "5% monthly profit, credited every working day. No lock-in.", "sortOrder": 0,
  "createdAt": "...", "updatedAt": "..."
}
```
`isFeatured` / `featuredTagline` control the website's Featured Plans page.
`payoutMode: "DAILY"` + `rateBasis: "PER_MONTH"`: `profitValue` is the % of the invested capital **per month**, paid as
20 equal working-day credits (4 weeks × 5 days). `PER_YEAR`: per year, 240 credits. `PER_DAY`: legacy, the % every working day.
`durationDays: 0` = open-ended (runs until the customer withdraws the capital). `lockInDays`: the capital cannot be withdrawn
before this many days (Deposit Plan: 365). Maturity-paid plans: `PERCENTAGE` is the % of principal over the whole period, `FIXED` a rupee amount.

Default plans: **Regular Plan** 5% / month, open-ended, no lock-in. **Deposit Plan** 6% / month, 365 days, capital locked for 365 days.
On 1,00,000: Regular pays 250 a working day, 1,250 a week, 5,000 a month; Deposit pays 300 / 1,500 / 6,000.

Preview →
```json
{
  "planId": 1, "planName": "Regular Plan", "amount": 100000, "source": "CAPITAL",
  "durationDays": 0, "isOpenEnded": true, "lockInDays": 0, "lockInEndsAt": null,
  "profitType": "PERCENTAGE", "profitValue": 5, "payoutMode": "DAILY", "rateBasis": "PER_MONTH",
  "dailyProfit": 250, "weeklyProfit": 1250, "monthlyProfit": 5000, "creditsPerCycle": 20, "profitDays": 0, "payoutHourIst": 6,
  "expectedProfit": 0, "maturityAmount": 100000,
  "feePercent": 5, "capitalWithdrawalFee": 5000, "netCapitalOnWithdrawal": 95000,
  "startDate": "...", "maturityDate": null
}
```
`expectedProfit` / `profitDays` are 0 for open-ended plans (no fixed total); fixed-term plans give the capped total over the term.

Investment →
```json
{
  "id": 7, "reference": "INV-20261014-1A2B3C4D5E", "userId": 4, "planId": 1, "planName": "Regular Plan",
  "profitType": "PERCENTAGE", "profitValue": 5, "payoutMode": "DAILY", "rateBasis": "PER_MONTH",
  "durationDays": 0, "isOpenEnded": true, "lockInDays": 0, "lockInEndsAt": null, "isLocked": false,
  "amount": 100000, "expectedProfit": 0,
  "dailyProfit": 250, "weeklyProfit": 1250, "monthlyProfit": 5000, "profitDays": 0,
  "profitCredited": 2000, "profitRemaining": 0, "creditedDays": 8,
  "creditsPerCycle": 20, "currentCycle": 0, "creditsThisCycle": 8, "nextCreditAt": "...", "nextCreditDue": false,
  "feePercent": 5, "capitalWithdrawalFee": 5000, "netCapitalOnWithdrawal": 95000,
  "maturityAmount": 100000, "startDate": "...", "maturityDate": null,
  "status": "ACTIVE|MATURED|WITHDRAWAL_REQUESTED|COMPLETED|CANCELLED",
  "earlyWithdrawalAllowed": false, "canRequestWithdrawal": true,
  "daysRemaining": 0, "progressPercent": 0,
  "maturedAt": null, "completedAt": null, "cancelledAt": null, "cancelReason": null, "createdAt": "..."
}
```
Show the "Withdraw capital" action only when `canRequestWithdrawal` is true (status ACTIVE/MATURED and not `isLocked`).
`profitCredits[]` entries carry `cycleNo` (30-day cycle of the investment, 0-based).

### Withdrawals
| Method | Path | Notes |
|---|---|---|
| GET | `/withdrawals` | filters: `status` |
| GET | `/withdrawals/:id/proof` | streams the payout proof (404 if none) |

Withdrawal →
```json
{
  "id": 2, "reference": "WDR-20261014-AA11BB22CC", "userId": 4, "source": "INVESTMENT|WALLET", "bucket": "CAPITAL|PROFIT",
  "investmentId": 7, "investmentReference": "INV-...", "planName": "Regular Plan",
  "principalAmount": 100000, "profitAmount": 0, "totalAmount": 100000,
  "feePercent": 5, "feeAmount": 5000, "netAmount": 95000, "isEarly": false,
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

`{ walletMinTopup, walletMaxTopup, upiId, upiPayeeName, depositInstructions, bank*, requireKycForInvestment, requireKycForWithdrawal, walletMinWithdrawal, referralCommissionPercent, capitalWithdrawalFeePercent }`

`capitalWithdrawalFeePercent` (default 5) is snapshotted onto each new investment (`feePercent`) and applied to every capital
withdrawal; profit withdrawals are always free.

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
`investment: { id, reference, planName, amount, expectedProfit, maturityAmount, durationDays, startDate, maturityDate (null when open-ended), status }`.

The admin pays **`netAmount`** (`totalAmount - feeAmount`). Flow: `PENDING → APPROVED → COMPLETED`, or `PENDING/APPROVED → REJECTED`.
Rejecting a WALLET withdrawal refunds the held amount to the same `bucket`; rejecting an INVESTMENT withdrawal returns the
investment to ACTIVE (it keeps earning).

### Wallet ledger
| Method | Path | Role | Body |
|---|---|---|---|
| GET | `/admin/wallets/transactions` | staff | filters: `type`, `direction`, `bucket`, `userId`, `search`, `startDate`, `endDate` |
| POST | `/admin/wallets/:userId/adjust` | manager | `{ direction: "CREDIT"\|"DEBIT", bucket?: "CAPITAL"\|"PROFIT" (default PROFIT), amount, reason }` |

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
4. **Capital withdrawal**: the capital of an investment is withdrawn in full by closing the investment (`POST /investments/:id/withdraw`); uninvested capital is withdrawn in full from the capital wallet (`POST /wallet/withdrawals` with `bucket: "CAPITAL"`). Both deduct the capital withdrawal fee (`feePercent`, default 5%): 1,00,000 → 5,000 fee → 95,000 paid. During a plan's lock-in (`lockInDays`) the capital cannot be withdrawn unless an admin enables an early exit for that investment. Maturity-paid plans closed early pay the principal only unless the admin sets a profit amount on approval.
5. The **capital wallet** is credited only when an admin approves the payment receipt. At maturity of a fixed-term plan the capital returns to the capital wallet automatically (`MATURITY_PRINCIPAL`, investment → COMPLETED); the customer re-invests it for free or withdraws it with the fee.
6. Every payment, investment, withdrawal and ledger entry has a unique reference (`DEP-`, `INV-`, `WDR-`, `TXN-`).
7. A UPI transaction ID can be credited only once.
8. Every balance change writes an immutable ledger row with the balance before and after; every admin action is written to the activity log.
9. **Daily-profit plans** (`payoutMode: "DAILY"`): with `rateBasis: "PER_MONTH"` the daily credit is `capital × profitValue% ÷ 20` (`PER_YEAR`: ÷ 240; legacy `PER_DAY`: the % itself). It is credited to the **profit wallet** on every working day (Monday–Friday, IST) **after** the start day, at **06:00 AM IST**; Saturdays and Sundays are skipped, and at most **20 credits are paid per 30-day cycle** so a month never pays more than the rate (a 30-day window has 20–22 weekdays). Profit is never added to the invested capital (no compounding). Open-ended plans earn until the capital is withdrawn; fixed-term plans earn up to the maturity day and `expectedProfit = dailyProfit × profitDays` (capped days). Credits are recorded in `profit_credits` (unique per investment per day, with `cycle_no`), so the job can run any number of times without paying twice. Days missed while the server was down are paid on the next run. Ledger type: `PROFIT`, bucket `PROFIT`.
10. **Referral commission**: when a referred customer invests, a `referral_commissions` row is created for `referralCommissionPercent` (default 0.5%) of the investment amount. It is credited to the referrer's **profit wallet** at the first 06:00 AM run once the investment is 24 hours old, unless the investment was cancelled in the meantime. Ledger type: `REFERRAL_COMMISSION`. Setting `referralCommissionPercent: 0` disables it.
11. **Wallet withdrawals** (`source: "WALLET"`): the amount is debited from the chosen bucket when the request is made (`WITHDRAWAL` debit), so it cannot be spent twice while an admin verifies it. Rejecting the request refunds it to the same bucket (`REFUND` credit); completing it only records the payment reference and proof. PROFIT withdrawals: any amount ≥ `walletMinWithdrawal`, no fee. CAPITAL withdrawals: the whole available capital balance, fee deducted. When `requireKycForWithdrawal` is on (default), only VERIFIED-KYC customers can request any payout.
12. Full bank account numbers (payout details, withdrawal destination, KYC) are returned only to `SUPER_ADMIN` and `ADMIN`; `EDITOR` receives the masked form.

## 4. Endpoints added for daily profit, referrals and wallet withdrawals

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/wallet/withdrawals` | customer | `{ amount, payoutMethod? }` → withdrawal with `source: "WALLET"` |
| GET | `/referrals/my` | customer | adds `commissionPercent`, `totalCommissionEarned`, `pendingCommission`, `commissions[]`, `referrals[].commissionEarned` |
| GET | `/admin/referrals` | staff | each row adds `commissionEarned`, `commissionPending`, `commissionCount` |
| GET | `/admin/referrals/commissions` | staff | `?status=PENDING\|CREDITED\|CANCELLED&page&limit`, `meta.counts` |
| GET | `/admin/payouts/status` | staff | `{ schedule, lastRunAt }` |
| POST | `/admin/payouts/run` | manager | runs the 06:00 job immediately; returns `{ payableDay, profitCredits, profitAmount, commissions, commissionAmount }` |
| PUT | `/admin/settings` | manager | new fields `requireKycForWithdrawal`, `walletMinWithdrawal`, `referralCommissionPercent` |
| POST/PUT | `/admin/investment-plans` | manager | new field `payoutMode: "AT_MATURITY" \| "DAILY"` (DAILY requires `profitType: "PERCENTAGE"`, max 100) |

New response fields: plans and investments carry `payoutMode`; investments also `dailyProfit`, `profitDays`, `profitCredited`, `profitRemaining`; `/investments/preview` adds `dailyProfit`, `profitDays`, `payoutHourIst`; `/wallet` adds `dailyProfitCredited`, `lastProfitCreditDay`, `referralEarnings`, `referralEarningsPending`, `pendingWithdrawalAmount` and `config.{minWithdrawal, requireKycForWithdrawal, referralCommissionPercent, payoutSchedule}`; withdrawals carry `source` and a nullable `investmentId`; the finance dashboard adds `totalDailyProfitCredited`, `totalReferralCommissionPaid`, `pendingReferralCommission*`, `lastPayoutRunAt`, `payoutSchedule`, `walletWithdrawalsPending`.

## 5. Transparency and manual-verification fields

| Endpoint | Role | Added |
|---|---|---|
| `GET /investments`, `GET /investments/:id`, `GET /admin/investments*` | customer / staff | DAILY investments add `creditedDays`, `nextCreditAt` (ISO instant of the next 06:00 IST credit, null once fully paid) and `nextCreditDue` (true when that day has passed 06:00 and the job has not caught up yet) |
| `GET /investments/:id`, `GET /admin/investments/:id` | customer / staff | `profitCredits[]` — every daily credit: `{ id, creditDay, amount, creditedAt, walletTransactionId }`, newest first |
| `GET /kyc/status` | customer | `details` (masked PAN / Aadhaar / account number, holder name, IFSC), `history[]` (`{ id, action, remarks, createdAt }`, no reviewer identity), `nextStep` (plain-language guidance for the current status), `hasPan/hasAadhaar/hasPassbook`, `submittedAt`, `reviewedAt` |
| `GET /admin/deposits/:id` | staff | `verification`: `{ utrAlreadyCredited, utrMatches[] (other submissions quoting the same UPI transaction ID, any customer), customerKycStatus, kycAccountHolderName, previousDeposits: { approved, rejected, pending }, isFirstDeposit }` |

Bank transfer top-ups: `POST /wallet/deposits` accepts `paymentMethod: "UPI" | "BANK_TRANSFER"` (default UPI); `upiTransactionId` holds the UPI UTR or the bank transfer reference. Deposits carry `paymentMethod`. `GET /wallet` config adds `bankTransferEnabled`, `bankAccountName`, `bankAccountNumber`, `bankIfsc`, `bankName`, `bankTransferInstructions`; `PUT /admin/settings` accepts the same bank fields (all four account fields together, or all empty, to switch the option off).

Customer website pages built on these: `/referrals` (share link `/register?ref=CODE`, WhatsApp / native share, referred list, commission history), investment cards (next credit time, days credited, per-day profit history), profile KYC tracker (3-step progress, submitted details, review history, next action).

Admin panel: the Approve Payment dialog shows the verification checks above; the Verify KYC dialog requires a 4-point checklist (documents present, PAN matches profile, Aadhaar matches PAN, passbook matches holder / account / IFSC with automatic name and IFSC-format hints) before approval; investment details list every daily credit with its ledger entry; Settings → Permissions lists what each role can do.

Verification script: `cd backend/node && npx tsx scripts/verify-daily-payouts.mts` (applies the schema patches and seeds the plans, creates two throwaway customers, invests 1,00,000 in the Regular Plan back-dated by 10 days, runs the job and asserts 250 per working day into the profit wallet, the 20-credit cap, the referral commission, the Deposit Plan lock-in, the 5% capital withdrawal fee (95,000 net), profit withdrawals without fee, and idempotency).

## 6. Two-bucket wallet and monthly-rate plans (2026-10-14)

See `docs/INVESTMENT_PLANS_AND_WALLET_ARCHITECTURE.md` for the design. Schema additions (applied automatically by
`applySchemaPatches` on start, with one-time backfills): `investment_plans.rate_basis`, `lock_in_days`;
`investments.rate_basis`, `lock_in_days`, `fee_percent`, nullable `maturity_date`; `wallets.capital_balance`,
`profit_balance` (`balance` kept as their sum); `wallet_transactions.bucket`; `withdrawals.bucket`, `fee_percent`,
`fee_amount`, `net_amount`; `profit_credits.cycle_no`. Existing DAILY plans/investments are backfilled as `PER_DAY`
(their old per-working-day meaning) and the legacy plans are deactivated when the Regular / Deposit plans are seeded.
