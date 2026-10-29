import "server-only";

/**
 * Demo defaults keep the app zero-config. Set real values in .env.local / Vercel to
 * stop anyone who knows the defaults from forging sessions or QR codes.
 */
const DEMO_SESSION_SECRET = "smart-canteen-demo-session-secret-change-me";
const DEMO_TICKET_SECRET = "smart-canteen-demo-ticket-secret-change-me";

export const env = {
  get sessionSecret() {
    return process.env.SESSION_SECRET || DEMO_SESSION_SECRET;
  },
  get ticketSecret() {
    return process.env.TICKET_SIGNING_SECRET || DEMO_TICKET_SECRET;
  },
};
