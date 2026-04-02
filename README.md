# 💎 Ergo HODL Meter

**Diamond Hands Detector for the Ergo blockchain.**

Enter any Ergo wallet address and find out: are you a diamond-handed believer or a paper-handed panic-seller? The HODL Meter scores your wallet on four axes and renders the oracle's judgment.

## Scoring

| Component | Weight | What it measures |
|---|---|---|
| **Wallet Age** | 25 pts | How long has this address existed on-chain? |
| **HODL Patience** | 25 pts | Days since your last transaction — true HODLers don't move coins |
| **TX Discipline** | 25 pts | Transaction frequency per year — fewer is better |
| **Balance Commitment** | 25 pts | ERG held — skin in the game |

## Tiers

| Score | Tier |
|---|---|
| 85–100 | 💎 Diamond Hands |
| 65–84 | 🥇 Gold Hands |
| 45–64 | 🥈 Silver Hands |
| 25–44 | 🥉 Bronze Hands |
| 0–24 | 📄 Paper Hands |

Every analysis ends with a personalized oracle prophecy.

## Tech

- Pure HTML/CSS/JS — no build step
- Data from [Ergo Explorer API](https://api.ergoplatform.com/api/v1)
- No wallet keys required — read-only address lookup

## Run locally

```
open index.html
```

Or deploy to any static host (Netlify, GitHub Pages, Vercel).
