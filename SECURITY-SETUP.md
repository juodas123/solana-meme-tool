# 🔒 Secure Private Key Setup

## ✅ What Changed (Security Improvements)

**BEFORE (INSECURE):**
- ❌ Private key entered in browser UI
- ❌ Transmitted over HTTP to server
- ❌ Could be logged/intercepted
- ❌ Stored in browser memory

**NOW (SECURE):**
- ✅ Private key stored in `.env` file only
- ✅ Never leaves the server
- ✅ Never transmitted over network
- ✅ `.env` is in `.gitignore` (won't be committed to git)

---

## 📋 Setup Instructions

### Step 1: Get Your Private Key

**Option A: Export from Phantom/Solflare**
1. Open your wallet
2. Settings → Export Private Key
3. Copy the base58 string

**Option B: Generate New Wallet**
```bash
# Install Solana CLI
npm install -g @solana/cli

# Generate new keypair
solana-keygen new --outfile ~/trading-keypair.json

# Convert to base58 (for .env)
cat ~/trading-keypair.json | python3 -c "import sys, json, base58; print(base58.b58encode(bytes(json.load(sys.stdin))).decode())"
```

### Step 2: Add to .env File

1. Open `/workspaces/solana-meme-tool/.env`
2. Find the line: `TRADING_PRIVATE_KEY = YOUR_PRIVATE_KEY_HERE`
3. Replace `YOUR_PRIVATE_KEY_HERE` with your actual private key

Example:
```env
TRADING_PRIVATE_KEY = 5J7z8mKvP2n3Q4R6x9T1...your-actual-key-here
```

### Step 3: Restart Server

```bash
yarn build
yarn start
```

### Step 4: Verify

Navigate to http://localhost:3001/pumpfun-sniper

You should see a green "Secure Configuration" notice. No private key input field!

---

## ⚠️ IMPORTANT SECURITY NOTES

### ✅ DO:
- Keep `.env` file local only (already in `.gitignore`)
- Use a dedicated trading wallet with limited funds
- Start with small amounts (0.1-0.5 SOL)
- Regularly check wallet balance
- Backup `.env` file securely offline

### ❌ DON'T:
- Commit `.env` to git (it's already ignored, but double-check!)
- Share `.env` file with anyone
- Use your main wallet (create a new one for trading)
- Store large amounts in trading wallet
- Share screenshots showing `.env` contents

---

## 🔍 How to Verify It's Secure

1. **Check .gitignore:**
   ```bash
   cat .gitignore | grep .env
   ```
   Should show: `.env`

2. **Verify git status:**
   ```bash
   git status
   ```
   `.env` should NOT appear in changes

3. **Check server logs:**
   Private key should never appear in terminal output

---

## 💡 Limitations

**This is secure for a LOCAL/PERSONAL tool, but:**

- Not suitable for multi-user web app (each user needs their own instance)
- Server must be trusted (you're running it locally, so you trust yourself)
- Anyone with access to your server can read `.env`

**For production web app with multiple users:**
- Need to implement wallet adapter (Phantom/Solflare browser extension)
- Users sign transactions in their wallet
- Private keys never leave user's device

---

## 🆘 If Your Private Key Was Already Compromised

If you already entered your private key in the UI before this update:

1. **Create new wallet immediately**
2. **Transfer all funds to new wallet**
3. **Never use old private key again**
4. Consider that wallet address burned

---

## ✅ Final Checklist

- [ ] Added `TRADING_PRIVATE_KEY` to `.env`
- [ ] Verified `.env` is in `.gitignore`
- [ ] Tested sniper starts without errors
- [ ] Using dedicated trading wallet (not main wallet)
- [ ] Starting with small amounts (0.1 SOL)
- [ ] Backed up `.env` securely offline
