import "server-only";

/**
 * Demo defaults keep the app zero-config. Set real values in .env.local / Vercel to
 * stop anyone who knows the defaults from forging sessions or QR codes.
 */
const DEMO_SESSION_SECRET = "smart-canteen-demo-session-secret-change-me";
const DEMO_TICKET_SECRET = "smart-canteen-demo-ticket-secret-change-me";
const MIN_SECRET_LENGTH = 32;

function configuredSecret(name: "SESSION_SECRET" | "TICKET_SIGNING_SECRET", fallback: string): string {
  const value = process.env[name] || fallback;
  if (process.env.NODE_ENV === "production" && (!process.env[name] || value.length < MIN_SECRET_LENGTH)) {
    throw new Error(`${name} must be configured with at least ${MIN_SECRET_LENGTH} characters in production`);
  }
  return value;
}

export const env = {
  get sessionSecret() {
    return configuredSecret("SESSION_SECRET", DEMO_SESSION_SECRET);
  },
  get ticketSecret() {
    return configuredSecret("TICKET_SIGNING_SECRET", DEMO_TICKET_SECRET);
  },
};
