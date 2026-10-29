# Smart Canteen

College canteen ordering with pickup slots and rotating, signed QR pickup tickets.
**Runs entirely on built-in demo data. There's no database or external service to set up.**

**Live demo: https://smart-canteen-henna.vercel.app**. Sign in with one of the demo accounts below.

```bash
git clone https://github.com/sid2428/smartcanteen.git
cd smartcanteen
npm install
npm run dev        # http://localhost:3000
```

## Demo accounts

The login page has one-click buttons for each. The password for all of them is `demo123`.

| Role | Email | Try |
| --- | --- | --- |
| 🎓 Student | `student@demo.com` | Menu, cart, pickup slot, pay, QR tickets |
| 👨‍🍳 Staff | `staff@demo.com` | Kitchen board, QR scanner |
| 📊 Owner | `owner@demo.com` | Dashboard, dishes & stock, settings, refunds (plus kitchen/scan) |

## Demo cases

The student starts with these orders:

| Code | State | How to demo it |
| --- | --- | --- |
| **DEMOA** | Paid, food **ready** (Masala Dosa + Filter Coffee) | Student → *Tickets* shows a rotating QR. Staff → *Scan QR* scans it (use a second device or the manual box). |
| **DEMOB** | Paid, **in the kitchen** (Veg Thali preparing, Samosa issued) | Staff → *Kitchen*: move tickets Issued → Preparing → Ready. |
| **DEMOC** | **Awaiting payment** (Paneer Butter Masala) | Student → *Orders* → open it → *Pay* (simulated UPI) or *Cancel*. |

There's also history for the owner dashboard: DEMOD (collected) and DEMOE (not collected, 50% refund).
Seeded live orders stay valid for 12 hours.

**Reset:** the *↺ Reset demo data* link on the login page restores everything above. Restarting the server does the same.

## How the demo data works

The app's SQL runs against [PGlite](https://pglite.dev), which is Postgres compiled to WASM and running inside the
Next.js server process (`src/lib/server/db.ts`). The schema and seed live in `src/lib/server/demo/`.
Changes are kept in memory only.

**On Vercel:** each server instance has its own copy of the data, and a fresh instance starts from the seed.
That's fine for a single presenter, but data may occasionally reset or differ between devices. For a demo
where the student and staff phones must see the same data, run it from one machine (`npm run build && npm start`)
and open it from other devices on the same Wi-Fi via that machine's IP.

## Deployment

| | |
| --- | --- |
| Production | https://smart-canteen-henna.vercel.app |
| Hosting | Vercel project `smart-canteen`, connected to [github.com/sid2428/smartcanteen](https://github.com/sid2428/smartcanteen) |
| Production deploys | Automatic on every push to `main` |
| Preview deploys | Automatic for other branches and pull requests (private: requires Vercel login) |
| Production env | `SESSION_SECRET`, `TICKET_SIGNING_SECRET` (set in Vercel → Settings → Environment Variables) |

To deploy manually from a local checkout instead: `npx vercel deploy --prod`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest unit tests (domain rules, QR signing, sessions, redirects) |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |

## Optional env

See `.env.example`. Set `SESSION_SECRET` and `TICKET_SIGNING_SECRET` when deploying publicly; otherwise built-in demo defaults are used.

## Not real (demo only)

- Payments are simulated (`UPI_MOCK`). Refunds are recorded for the owner, not paid out.
