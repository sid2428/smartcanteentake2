import type { Role } from "@/lib/domain";

/** Shared password for every demo account. This is a demo; never reuse it for real accounts. */
export const DEMO_PASSWORD = "demo123";

export type DemoAccount = { id: string; role: Role; name: string; email: string; blurb: string };

/** Fixed ids, so sessions keep working after a demo reset or server restart. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    role: "student",
    name: "Asha Sharma",
    email: "student@demo.com",
    blurb: "Order food, pay, and show QR tickets",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    role: "staff",
    name: "Ravi Kumar",
    email: "staff@demo.com",
    blurb: "Kitchen board and QR scanner",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    role: "owner",
    name: "Meera Iyer",
    email: "owner@demo.com",
    blurb: "Dishes, settings, sales and refunds",
  },
];
