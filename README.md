# Smart Canteen

**A smarter way to order food on campus.**

Smart Canteen is a college canteen ordering platform designed to reduce waiting time and simplify food pickup. Students can browse the menu, place orders in advance, select pickup slots, make simulated payments, and collect food using secure, rotating QR pickup tickets. Canteen staff can manage kitchen orders, while owners can oversee dishes, stock, refunds, and settings.

**Live Demo:** [smart-canteen-henna.vercel.app](https://smart-canteen-henna.vercel.app)

> **Demo project:** The application runs on built-in demo data. It does not require an external database or third-party service to get started. Payments are simulated, and data changes are stored in memory.

## Features

- **Student ordering:** Browse dishes, manage the cart, place orders, and select pickup slots.
- **Order tracking:** View order details and track preparation status.
- **Simulated UPI payments:** Test the payment flow without processing real transactions.
- **Secure QR pickup tickets:** Use rotating, signed QR tickets for order collection.
- **Kitchen management:** Manage incoming orders and update their preparation status.
- **QR scanning:** Verify pickup tickets using the scanner or manual entry.
- **Owner dashboard:** Manage dishes, stock, settings, and refund records.
- **Demo scenarios:** Explore preloaded orders covering different stages of the ordering process.

## Getting Started

### Prerequisites

- Node.js and npm installed.

### Installation

```bash
git clone https://github.com/sid2428/smartcanteen.git
cd smartcanteen
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To create and run a production build locally:

```bash
npm run build
npm start
```

## Demo Accounts

The login page provides one-click demo login options. All demo accounts use the password `demo123`.

| Role | Email | Available Features |
|---|---|---|
| Student | `student@demo.com` | Menu, cart, pickup slots, payments, orders, and QR tickets |
| Staff | `staff@demo.com` | Kitchen dashboard and QR scanner |
| Owner | `owner@demo.com` | Dashboard, dish and stock management, settings, refunds, kitchen, and scanning |

## Demo Scenarios

The student account comes with preloaded orders so you can explore the complete workflow.

| Order | Initial Status | How to Try It |
|---|---|---|
| **DEMOA** | Paid — Ready for pickup | Open Student → Tickets to view the rotating QR ticket. Use Staff → Scan QR to verify it, using a second device or manual entry if needed. |
| **DEMOB** | Paid — In progress | Open Staff → Kitchen and move the orders through Issued → Preparing → Ready. |
| **DEMOC** | Awaiting payment | Open Student → Orders, select the order, and try the simulated payment or cancellation flow. |

The owner dashboard also includes historical demo orders:

- **DEMOD:** Collected order.
- **DEMOE:** Uncollected order with a recorded 50% refund.

Seeded live orders remain valid for 12 hours.

### Reset Demo Data

Use the **↺ Reset demo data** link on the login page to restore the initial demo state. Restarting the server also resets the in-memory data.

## How Demo Data Works

Smart Canteen uses [PGlite](https://pglite.dev), a PostgreSQL-compatible database engine compiled to WebAssembly, running inside the Next.js server process.

- Database implementation: `src/lib/server/db.ts`
- Schema and seed data: `src/lib/server/demo/`
- Storage: In-memory only.

Changes are not persisted to a permanent database. When the server restarts, the demo data returns to its initial state.

### Running a Shared Demo Across Devices

On Vercel, each server instance maintains its own in-memory data. Data may reset or differ between instances, so the deployed demo is not guaranteed to provide synchronised state across devices.

For a presentation involving student and staff devices, run the production build on a single machine:

```bash
npm run build
npm start
```

Connect the other devices to the same Wi-Fi network and open the application using the host machine's local IP address and port `3000`. Configure the development environment's network binding and firewall as needed so other devices can reach the server.

## Technology Stack

- **Framework:** Next.js
- **UI:** React and TypeScript
- **Styling:** Tailwind CSS
- **Database engine:** PGlite running in memory
- **Testing:** Vitest
- **Deployment:** Vercel

Refer to `package.json` for the exact dependency versions and available scripts.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Start the production server |
| `npm test` | Run unit tests |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run ESLint |

## Deployment

The project is hosted on Vercel and connected to the GitHub repository.

| Setting | Details |
|---|---|
| Production URL | [smart-canteen-henna.vercel.app](https://smart-canteen-henna.vercel.app) |
| Hosting platform | Vercel |
| Repository | [sid2428/smartcanteen](https://github.com/sid2428/smartcanteen) |
| Production branch | `main` |
| Production deployments | Automatic on pushes to `main` |
| Preview deployments | Generated for other branches and pull requests, subject to project access settings |

### Environment Variables

The application supports the following optional environment variables:

- `SESSION_SECRET`
- `TICKET_SIGNING_SECRET`

Configure them in **Vercel → Project Settings → Environment Variables** when deploying.

See `.env.example` for the expected configuration.

If these variables are not configured, the application uses built-in demo defaults. Set strong, unique secrets for public deployments; never expose secrets in client-side code or commit them to the repository.

To deploy manually, use the Vercel CLI:

```bash
npx vercel deploy --prod
```

## Current Limitations

This project is intended for demonstration and academic purposes.

- **Payments:** UPI payments are simulated using `UPI_MOCK`. No real money is transferred.
- **Refunds:** Refunds are recorded in the application but are not paid out.
- **Data persistence:** Data is held in memory and resets when the server restarts.
- **Deployment consistency:** Separate Vercel instances may have different in-memory data.
- **Production readiness:** Real payment integration, persistent database storage, and production-grade operational safeguards would be required before commercial use.

## Future Scope

Potential improvements include persistent database integration, real payment-gateway support, live order notifications, improved demand forecasting, and support for multiple college canteens.

## License

Refer to the repository for licensing information. If no license is provided, the project's reuse and distribution permissions have not been explicitly defined.
