# Investment Plans and Two-Bucket Wallet: Architecture Plan

Status: implemented on 2026-10-14 (backend, customer website, admin panel). Verified by
`backend/node/scripts/verify-daily-payouts.mts` and `npm test` in `backend/node`.

Deviations from the original plan, all deliberate:
- `wallets.balance` is kept (always `capital_balance + profit_balance`) instead of being dropped, so existing reports keep working.
- The 20 working days per month is a code constant (`WORKING_DAYS_PER_MONTH`), not an admin setting: changing it would silently change the daily amount of running investments.
- The cap is enforced by a deterministic paying-day list (first 20 working days of each 30-day cycle) rather than by counting rows; `profit_credits.cycle_no` is stored for display.
- A fixed-term investment is settled straight to COMPLETED at maturity (capital to the capital wallet); the MATURED status remains only for legacy rows.

## 1. Business rules

| Rule | Decision |
|---|---|
| Plan rate basis | Percentage **per month** on invested capital |
| Regular Plan | 5% / month, open-ended (runs until the customer closes it) |
| Deposit Plan | 6% / month, 365-day term (pays exactly 12 months = 240 credits), principal returns to the capital wallet at maturity |
| Credit schedule | Every working day (Mon-Fri) at 06:00 IST, 20 credits per 30-day cycle; fixed terms pay whole months only (365 days = 240 credits, never a partial 13th cycle) |
| Daily credit | `capital x rate / 100 / 20` (1,00,000 at 5% = 250/day, 1,250/week, 5,000/month) |
| Compounding | None. Profit is never added to the invested capital |
| Wallet | Two buckets: **Capital** (earns) and **Profit** (withdrawable, earns nothing) |
| Profit withdrawal | Any time, no fee, min `wallet_min_withdrawal` (500), KYC per setting |
| Capital withdrawal | Any time, full amount only. **5% fee** only when a running investment is closed before it ends (open-ended plans: always); matured capital and the capital wallet are paid in full. No lock-ins (2026-10-22) |
| Reinvesting | Allowed from both buckets. Profit used to invest becomes capital and starts earning |
| Referral | 5% of each amount the referred customer invests, one-time per investment, credited to the referrer's **Profit** bucket instantly in the invest transaction (2026-10-23; was 0.5% after 24h). Reversed from the referrer's profit wallet if the admin cancels the investment and the wallet still holds it |

Worked examples on 1,00,000:

| Plan | Monthly | Weekly | Per working day | 12 months |
|---|---|---|---|---|
| Regular 5% | 5,000 | 1,250 | 250 | 60,000 |
| Deposit 6% | 6,000 | 1,500 | 300 | 72,000 |

Closing a 1,00,000 investment before it ends: fee 5,000, net paid 95,000. After maturity (or from the capital wallet): 1,00,000 paid in full.

### Why 20 credits per 30-day cycle
A 30-day window has 20 to 22 weekdays. Paying all of them would give 5.25% to 5.5% a month. The job pays the first 20 working days of each cycle (cycle N covers days `start + 30N` up to but not including `start + 30(N+1)`) and skips the rest, so the monthly total is exactly the plan rate and the daily amount stays the round 250 the customer was promised.

## 2. Data model

### investment_plans / investments (terms are snapshotted onto the investment)
| Column | Type | Notes |
|---|---|---|
| `rate_basis` | ENUM PER_MONTH, PER_YEAR, PER_DAY | New plans PER_MONTH. Existing DAILY rows backfilled PER_DAY so running investments are unchanged |
| `lock_in_days` | INT | 0 = Regular (close any time), 365 = Deposit |
| `duration_days` | INT, 0 allowed | 0 = open-ended |
| `maturity_date` | DATE, nullable | NULL for open-ended plans; maturity job skips NULL |
| `capital_withdrawal_fee_percent` | DECIMAL | Snapshot of the setting at invest time (5) |

### wallets
| Column | Notes |
|---|---|
| `capital_balance` | Deposited but not yet invested money + principal returned at maturity |
| `profit_balance` | Daily profit, referral commission, refunds of profit withdrawals |
| `balance` | Dropped after backfill (`profit_balance = balance`, `capital_balance = 0`) |

Invested capital is not a wallet column; it is `SUM(investments.amount)` where status in ACTIVE, MATURED, WITHDRAWAL_REQUESTED.

### wallet_transactions
Add `bucket` ENUM CAPITAL, PROFIT. Backfill by type: DEPOSIT, INVESTMENT, MATURITY_PRINCIPAL, REFUND to CAPITAL; PROFIT, REFERRAL_COMMISSION to PROFIT; WITHDRAWAL to CAPITAL when `source = INVESTMENT`, else PROFIT; ADJUSTMENT to PROFIT.

### withdrawals
Add `bucket`, `fee_percent`, `fee_amount`, `net_amount`. `total_amount` stays the gross. Admin pays `net_amount`.

### profit_credits
Add `cycle_no` INT so the 20-per-cycle cap is a simple count on `(investment_id, cycle_no)`.

### system_settings
`capital_withdrawal_fee_percent` = 5, `working_days_per_month` = 20, plus the existing `wallet_min_withdrawal` and `referral_commission_percent`.

## 3. Flows

### Deposit and invest
```
UPI deposit -> admin approves
   Wallet.capital_balance += P                 [DEPOSIT, bucket CAPITAL]

Invest (plan, amount P, source = CAPITAL | PROFIT, default CAPITAL)
   Wallet.<source>_balance -= P                [INVESTMENT, bucket = source]
   Investment { amount P, rate_basis, lock_in_days, fee% snapshot,
                maturity_date = start + duration (NULL if open-ended) }
   ReferralCommission CREDITED (5%) + referrer PROFIT += 5% x P, instantly, if referred
```

### Daily profit job (06:00 IST, idempotent, catch-up safe)
```
for each investment with status ACTIVE (and MATURED/WITHDRAWAL_REQUESTED for missed days):
   due days  = working days from start day to min(today, maturity day)
   for each unpaid due day:
       cycle_no = floor((day - start) / 30)
       if count(profit_credits where investment_id, cycle_no) >= 20: skip
       daily    = amount x rate / 100 / 20            (PER_MONTH)
                = amount x rate / 100 / 240           (PER_YEAR)
                = amount x rate / 100                 (PER_DAY, legacy)
       insert ProfitCredit (unique investment_id + credit_day)
       Wallet.profit_balance += daily               [PROFIT, bucket PROFIT]
       Investment.profit_credited += daily          (amount is never touched)
one notification per customer per run
then: settle any legacy PENDING referral commissions (eligible_at <= now) -> referrer PROFIT bucket
```

### Deposit Plan maturity (365 days)
```
maturity job: investment ACTIVE -> COMPLETED
   Wallet.capital_balance += P                 [MATURITY_PRINCIPAL, bucket CAPITAL]
   notify: "principal returned to your capital wallet; reinvest or withdraw it in full, no fee"
```

### Profit withdrawal (no fee)
```
request X: X >= wallet_min_withdrawal, X <= profit_balance, KYC if required
   Wallet.profit_balance -= X (held)           [WITHDRAWAL, bucket PROFIT]
   Withdrawal { bucket PROFIT, total X, fee 0, net X, PENDING }
admin approve -> pay -> COMPLETED (payment reference + proof)
admin reject  -> Wallet.profit_balance += X   [REFUND, bucket PROFIT]
```

### Capital withdrawal (full only; 5% fee only on an early exit), two entry points, one function
```
A. Close an investment, any time (no lock-ins). is_early = not yet matured (open-ended plans are always early)
      investment -> WITHDRAWAL_REQUESTED, P = investment.amount
B. Withdraw available capital_balance (uninvested / returned principal)
      Wallet.capital_balance -= P (held)       [WITHDRAWAL, bucket CAPITAL]

createCapitalWithdrawal(P):
   fee = is_early ? P x fee% / 100 : 0   (A before maturity: 1,00,000 -> 5,000; B and matured A: 0)
   net = P - fee                         (95,000 early, 1,00,000 otherwise)
   Withdrawal { bucket CAPITAL, total P, fee, net, PENDING }
admin complete -> A: investment COMPLETED; B: nothing more
admin reject   -> A: investment back to ACTIVE; B: capital_balance += P [REFUND]
```
The fee is not a wallet transaction; it stays on the withdrawal row and reports sum `fee_amount` as commission income.

### Customer wallet page
```
+------------------------------+  +------------------------------+
| CAPITAL                      |  | PROFIT                       |
| Invested (earning)  1,00,000 |  | Available          12,750    |
| Available               0    |  | Today's credit        250    |
| [Invest] [Withdraw capital]  |  | This cycle   17/20 credits   |
|  5% fee shown before confirm |  | [Withdraw profit] [Reinvest] |
+------------------------------+  +------------------------------+
Transactions list with Capital / Profit filter
```

## 4. Implementation order

1. **Types and models**: `RateBasis`, `WalletBucket` enums; new columns above; schema patches with backfill (`backend/node/src/database/migrations/schemaPatches.ts`).
2. **Calculation**: `dailyProfitPaise` divides by 20 / 240 by rate basis; `calculateProfitPaise` handles open-ended plans (expected profit shown per month instead of a total). Preview endpoint returns monthly, weekly, daily figures.
3. **Payout job**: PROFIT bucket, `cycle_no`, 20-credit cap (`dailyPayoutService.ts`).
4. **Wallet service**: `applyEntry({ bucket })` updates the matching balance; summary returns `capitalBalance`, `investedCapital`, `profitBalance`, today's and cycle credits.
5. **Deposits / investing**: deposit approval credits CAPITAL; invest debits chosen bucket; admin cancel refunds CAPITAL; maturity returns principal to CAPITAL and completes the investment.
6. **Withdrawals**: profit withdrawal from PROFIT; `createCapitalWithdrawal` shared by investment close and capital-balance withdrawal; lock-in check for Deposit Plan; admin detail, list and reports show fee and net.
7. **Seed and settings**: Regular Plan (5%, PER_MONTH, lock 0, open-ended) and Deposit Plan (6%, PER_MONTH, lock 365); settings card gets the fee percent and working days.
8. **Frontend**: wallet page split into two cards; withdraw modal gains bucket and fee preview; invest form gains source bucket; plan cards show monthly / weekly / daily. **Panel**: plan modal gets rate basis and lock-in; withdrawal detail shows gross, fee, net.
9. **Verify**: extend `scripts/verify-daily-payouts.mts` for 250/day, the 20-per-cycle cap, 300/day on Deposit Plan, the 95,000 net payout and the lock-in block.
