/**
 * Schema for the in-memory demo database (PGlite). Created fresh on every server start.
 * Money is stored in paise (integer) to avoid floating point errors.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  college_id    text,
  role          text NOT NULL CHECK (role IN ('student', 'staff', 'owner')),
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Single-row settings table (id is always 1).
CREATE TABLE IF NOT EXISTS settings (
  id                     int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  open_time              time NOT NULL DEFAULT '08:00',   -- IST
  close_time             time NOT NULL DEFAULT '22:00',   -- IST
  slot_minutes           int  NOT NULL DEFAULT 15 CHECK (slot_minutes BETWEEN 5 AND 120),
  slot_capacity          int  NOT NULL DEFAULT 25 CHECK (slot_capacity > 0),
  min_lead_minutes       int  NOT NULL DEFAULT 10 CHECK (min_lead_minutes >= 0),
  grace_minutes          int  NOT NULL DEFAULT 30 CHECK (grace_minutes >= 0),
  -- Refund % when the canteen marked the dish READY but the student never collected it.
  no_show_refund_percent int  NOT NULL DEFAULT 50 CHECK (no_show_refund_percent BETWEEN 0 AND 100),
  payment_hold_minutes   int  NOT NULL DEFAULT 10 CHECK (payment_hold_minutes > 0)
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS dishes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  category     text NOT NULL,
  counter      text NOT NULL,              -- pickup counter the QR is bound to
  price_paise  int  NOT NULL CHECK (price_paise > 0),
  stock        int  NOT NULL DEFAULT 0 CHECK (stock >= 0),
  prep_minutes int  NOT NULL DEFAULT 5,
  is_veg       boolean NOT NULL DEFAULT true,
  emoji        text NOT NULL DEFAULT '🍽️',
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pickup_slots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at  timestamptz NOT NULL UNIQUE,
  ends_at    timestamptz NOT NULL,
  capacity   int NOT NULL CHECK (capacity >= 0),
  -- booked <= capacity is enforced by the reserving UPDATE, not a CHECK,
  -- so the owner can lower capacity below current bookings to close a slot.
  booked     int NOT NULL DEFAULT 0 CHECK (booked >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,               -- short human-readable reference, e.g. "K7Q2M"
  user_id        uuid NOT NULL REFERENCES users(id),
  slot_id        uuid NOT NULL REFERENCES pickup_slots(id),
  total_paise    int  NOT NULL,
  status         text NOT NULL CHECK (status IN ('PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'COMPLETED', 'CLOSED')),
  payment_method text,
  payment_ref    text,
  hold_expires_at timestamptz NOT NULL,
  paid_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dish_id     uuid NOT NULL REFERENCES dishes(id),
  qty         int  NOT NULL CHECK (qty > 0),
  unit_paise  int  NOT NULL
);

-- One ticket per dish line. The QR shown to the student encodes the ticket id
-- plus a rotating HMAC; nothing else about the ticket lives in the QR.
CREATE TABLE IF NOT EXISTS tickets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id),
  dish_id      uuid NOT NULL REFERENCES dishes(id),
  dish_name    text NOT NULL,
  counter      text NOT NULL,
  qty          int  NOT NULL,
  amount_paise int  NOT NULL,
  status       text NOT NULL CHECK (status IN ('ISSUED', 'PREPARING', 'READY', 'REDEEMED', 'EXPIRED', 'CANCELLED')),
  expires_at   timestamptz NOT NULL,
  preparing_at timestamptz,
  ready_at     timestamptz,
  redeemed_at  timestamptz,
  redeemed_by  uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets (status, expires_at);
CREATE INDEX IF NOT EXISTS tickets_user_idx ON tickets (user_id, created_at DESC);

-- Audit trail: every state change and every scan attempt (including rejected ones).
CREATE TABLE IF NOT EXISTS ticket_events (
  id         bigserial PRIMARY KEY,
  ticket_id  uuid REFERENCES tickets(id) ON DELETE CASCADE,
  event      text NOT NULL,
  actor_id   uuid REFERENCES users(id),
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_events_created_idx ON ticket_events (created_at DESC);

CREATE TABLE IF NOT EXISTS refunds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid NOT NULL UNIQUE REFERENCES tickets(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  amount_paise int  NOT NULL CHECK (amount_paise >= 0),
  percent      int  NOT NULL,
  reason       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
