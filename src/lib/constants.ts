/** App-wide UI & config constants. */

export const APP_NAME = "Smart Canteen";
export const APP_DESCRIPTION = "College canteen ordering with QR pickup tickets";

/** Route paths grouped by audience. */
export const ROUTES = {
  login: "/login",
  signup: "/signup",
  menu: "/menu",
  orders: "/orders",
  tickets: "/tickets",
  kitchen: "/kitchen",
  scan: "/scan",
  owner: "/owner",
  ownerDishes: "/owner/dishes",
  ownerSettings: "/owner/settings",
  ownerRefunds: "/owner/refunds",
} as const;

/** Which routes each role can access after login. */
export const ROLE_HOME = {
  student: ROUTES.menu,
  staff: ROUTES.kitchen,
  owner: ROUTES.owner,
} as const;

/** Page routes that do NOT require authentication. API routes enforce auth themselves. */
export const PUBLIC_ROUTES = [ROUTES.login, ROUTES.signup] as const;

export const CATEGORY_EMOJI: Record<string, string> = {
  "South Indian": "🥘",
  "North Indian": "🍛",
  Chinese: "🥡",
  Snacks: "🍿",
  Beverages: "☕",
  Desserts: "🍰",
  Thali: "🍽️",
};
