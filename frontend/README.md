# Skillstamp MVP — Frontend

**EdTech × Web3 Skill Passport Platform on Solana**

> Verify · Earn · Grow

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page (public) |
| `/dashboard` | Student dashboard — feed, stamps, challenges, activity |
| `/employer` | Employer dashboard — candidates, tasks, post task |

---

## Design System

| Token | Value |
|---|---|
| Background | `#F5F2EC` (warm beige) |
| Black | `#1A1A18` |
| Gray | `#5A5A55` |
| Border | `#C8C4BA` |
| Display font | DM Serif Display |
| Body font | DM Sans |
| Mono font | DM Mono |

**Signature pattern:** dashed borders (`border: 1px dashed`) used throughout as primary decorative element — matches logo stamp motif.

---

## Architecture (Full Stack — to be implemented)

```
Frontend (this repo)
  Next.js 14 · TypeScript · Tailwind
  Solana Wallet Adapter · Privy (embedded wallet)

Backend
  NestJS · PostgreSQL (Supabase)
  Redis (feature store)
  FastAPI (LightFM recommendation service)

Blockchain
  Solana (Devnet → Mainnet)
  Metaplex Bubblegum (cNFT / SBT minting)
  Anchor framework (smart contracts)
  Helius (RPC + webhooks)

Storage
  Arweave (SBT metadata — permanent)
  IPFS (task submission hashes)

Auth
  Privy (embedded wallet, email/social login)
  Progressive Web3 disclosure
```

---

## Smart Contracts (Anchor / Solana)

Three core programs to implement:

1. **Challenge Registry** — stores challenge IDs, metadata, verification type
2. **SBT Issuance** — mints cNFT via Bubblegum, non-transferable, issuer-bound
3. **Task Escrow** — USDC deposit, eligibility gating, auto-release, dispute flag

---

## Recommendation Engine (LightFM)

**Phase 1 (MVP, <500 users):** Rules-based fallback
```python
# target_role → preset learning path
ROLE_PATHS = {
  'web3_analyst':   ['defi_basics', 'tokenomics_101', 'onchain_intro'],
  'solana_dev':     ['solana_intro', 'anchor_basics', 'spl_tokens'],
  'dao_researcher': ['dao_basics', 'governance_101', 'defi_basics'],
}
```

**Phase 2 (V1, 500+ users):** LightFM hybrid model
```python
from lightfm import LightFM
model = LightFM(no_components=64, loss='warp')
model.fit(interactions, user_features=student_features,
          item_features=challenge_features, epochs=30)
```

---

## Escrow Contract Flow

```
Employer creates task → deposits USDC
  ↓
Contract gates access by SBT eligibility check
  ↓
Student applies → accepted → IN_PROGRESS
  ↓
Student submits hash on-chain → SUBMITTED
  ↓
Employer confirms (7 days) or auto-release
  ↓
USDC released → 5% fee → employer SBT issued
```

---

## SBT Metadata Schema (Arweave)

```json
{
  "name": "Tokenomics Analyst · L1",
  "symbol": "SSTAMP",
  "description": "Verified by Skillstamp Protocol",
  "attributes": [
    { "trait_type": "skill",       "value": "Tokenomics Analyst" },
    { "trait_type": "level",       "value": "L1" },
    { "trait_type": "difficulty",  "value": 2 },
    { "trait_type": "issuer",      "value": "Skillstamp × Grinchenko University" },
    { "trait_type": "issuer_type", "value": "academic" },
    { "trait_type": "score",       "value": 91 },
    { "trait_type": "tags",        "value": ["defi", "tokenomics"] },
    { "trait_type": "timestamp",   "value": "2025-03-12T10:24:00Z" }
  ],
  "transferable": false
}
```

---

## MVP Scope Checklist

### Frontend ✅
- [x] Landing page
- [x] Student dashboard (feed, stamps, challenges, activity)
- [x] Employer dashboard (candidates, tasks, post task)
- [ ] Challenge page (submit, verify flow)
- [ ] Onboarding flow (5-step)
- [ ] SBT detail page
- [ ] Profile public page

### Backend
- [ ] Auth (Privy integration)
- [ ] Student profile API
- [ ] Challenge CRUD
- [ ] Verification pipeline (LLM + peer + employer)
- [ ] SBT minting service
- [ ] Task/escrow API
- [ ] LightFM recommendation service
- [ ] Notification service

### Blockchain
- [ ] Challenge Registry contract
- [ ] SBT Issuance contract (Bubblegum)
- [ ] Task Escrow contract
- [ ] Devnet deployment
- [ ] Security audit

---

## Partnership

**Co-issuer:** Borys Grinchenko Kyiv Metropolitan University
**Anchor employer & L3 verifier:** DeFiLab (Department of Finance)

---

*Skillstamp Protocol · Version 0.1.0 · 2025*
*Built on Solana · verify · earn · grow*
