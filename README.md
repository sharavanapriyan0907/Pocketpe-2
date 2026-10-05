# PocketPe — «Every Rupee Has a Purpose»

> **Intent-Based Virtual Money Architecture Prototype**  
> Divide your money into clear, purpose-based virtual wallets (Food, Fuel, Rent, Savings, Friends) on top of your single existing bank account.

---

## 🌟 What is PocketPe?

In conventional UPI and digital wallet apps, you see one aggregate balance (e.g. ₹10,000). When you spend or transfer money, it's difficult to keep track of how much you have left for rent, food, or upcoming bills without tedious manual budgeting.

**PocketPe solves this by creating a virtual purpose layer:**
1. **Single Real Bank Account**: No extra bank accounts or multiple cards required.
2. **Virtual Purpose Wallets**: Allocate your single bank balance into distinct visual buckets: *Food & Dining*, *Transport & Fuel*, *Savings*, *College*, *Friends & Social*, and an unallocated *Free Money* cushion.
3. **Smart Merchant Auto-Classification**: Scanning a QR code or paying a merchant automatically recommends the right purpose wallet.
4. **Learning Engine**: If you re-categorize a merchant, PocketPe learns and remembers your preference for next time.
5. **Payment Protection Shield**: If a wallet has insufficient balance, PocketPe shields you from accidental deficit and offers a calm, 1-tap cushion from Free Money instead of frightening errors.
6. **Automatic Money Cascade**: When you receive money, PocketPe automatically cascades and splits it into all your target wallets based on your personalized split percentages.
7. **Instant Virtual Rebalancing**: Move money between purposes anytime without altering your real bank balance.

---

## 🚀 How to Run Locally

### Quick Start (Windows)
Double-click `run_app.bat` or run:

```bash
python serve.py
```

The server will start on `http://localhost:8000` (or the next available port) and automatically open the application in your default web browser.

---

## 📱 Architecture & Tech Stack

- **Pure Native Modern Web Stack**: Built with semantic HTML5, modern vanilla CSS tokens, and modular ES6 JavaScript (`type="module"`).
- **Zero Heavy Dependencies / Bundlers**: Fast instant loading, no node_modules required.
- **Web Audio API**: Custom built-in sound engine for tactile, harmonious micro-interaction feedback (success chord, cascade melody, protection alert, soft tap).
- **Design System**: Fully responsive mobile-first phone chassis simulator with desktop presentation bar, dark/light theme switching, and live brand accent palette customization (Indigo, Emerald, Violet, Orange, Cyan).
- **LocalStorage State Persistence**: Saves wallets, transaction history, split rules, and learned merchant memories.

---

## 🛡️ Feature 1: Fraud Detection (Community Spam Reporting)

*A Truecaller-like safety layer for UPI payments and collect requests.*

- **Ratio-Based Spam Score**: Computes $\frac{\sum (\text{Reporter Trust} \times \text{Time Decay})}{\text{Unique Users Interacted}}$ instead of raw counts, protecting popular merchants from false spikes.
- **30-Day Half-Life Decay**: Older reports naturally lose weight over time ($0.5^{\text{days}/30}$).
- **Trust Weighting & Anti-Abuse**: Differentiates reporter credibility, enforces a 5-report/hour rate limit, and blocks duplicate reports.
- **Heuristic Extra Signals**: Auto-flags accounts $<14$ days old, collect request velocity $>10$/hr, and beneficiary bank name mismatches.
- **Graduated Warnings**:
  - *Low Risk*: Subtle badge, normal payment flow.
  - *Caution*: Warning banner requiring 1 extra tap.
  - *High Risk*: Full blocking warning modal with scam category breakdown (e.g. *"84% reported Fake Bill Scam"*), 1-tap **"Decline & Report"**, and explicit confirmation to proceed.
- **Appeals & Under Review**: Merchants can contest flags, applying an **"Under Review"** status that lowers warning severity during review.

---

## 👥 Feature 2: Split-Bill Wallet (Smart Student Ledger)

*Shared expense tracking and debt settlement integrated into PocketPe's virtual wallets.*

- **Phase 1 Ledger + Phase 2 Shared Pool Schema**: Tracks who owes whom with schema readiness for pooled balances.
- **Exact Paisa Rounding**: ₹100 split 3 ways yields ₹33.34, ₹33.33, and ₹33.33—sums strictly to ₹100.00 with zero float discrepancies.
- **Min-Cash-Flow Debt Simplification**: Reduces circular multi-party debts into the fewest direct 1:1 settlement transactions.
- **Virtual Wallet Integration**: 1-tap **"Settle Up"** pays directly out of the user's **"Friends & Social"** purpose wallet.
- **Polite Nudges**: Student-friendly reminder templates (e.g. *"Hey! Quick nudge from Ravi — your share for Goa Trip is ₹350. Settle up on PocketPe whenever you can!"*).

---

## 🔐 Feature 3: Supabase Email/Password Authentication

*Real user authentication and state isolation backed by Supabase Auth.*

- **Non-Anonymous Security**: Full email/password registration and login with input validation (RFC email format, min 6-char password, matching password confirmation).
- **User.ID Exposure**: Exposes the authenticated Supabase `user.id` (UUID) across the application state via `stateManager.getUserId()`.
- **User-Scoped Data Isolation**: Automatically isolates and partitions virtual wallets, transactions, and learned merchant category preferences per authenticated Supabase user (`pocketpe_user_{userId}_data`).
- **Profile Management**: Displays user credentials, initials avatar, copyable Supabase user.id, and supports updating display names with Supabase metadata sync.
- **Runtime Supabase Settings**: Interactive in-app modal to view, test, and update your Supabase Project URL and Anon Key on the fly.

---

## 🧪 Automated Unit Test Suite

PocketPe includes an automated unit test suite with **18 passing assertions** verifying features on boot and interactively in the app:
- Click **"🧪 Run Tests"** on the desktop bar to run live assertions for:
  - Spam score ratio math, 30-day time decay half-life, trust weighting, 5-report threshold gating, extra signals, appeals, duplicate report prevention.
  - Equal split exact integer paisa rounding, custom split validation, multi-payer net balances, min-cash-flow debt simplification, reminder copy generation.
  - Supabase client configuration, non-anonymous credential validation, global `user.id` exposure, user-scoped wallet and merchant preference isolation, sign out/clear auth flow, and profile metadata updating.

