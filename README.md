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
