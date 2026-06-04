-- ShoeLab.de — Cloudflare D1 schema
-- Create the DB once:   npx wrangler d1 create shoelab
-- Apply this schema:    npx wrangler d1 execute shoelab --file=./schema.sql --remote

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  pw_salt    TEXT NOT NULL,
  pw_hash    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  first_name  TEXT,
  last_name   TEXT,
  email       TEXT,
  phone       TEXT,
  type        TEXT,           -- onetime | subscription
  service     TEXT,
  plan        TEXT,
  amount      TEXT,
  date        TEXT,
  time_slot   TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  body        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT,
  rating      INTEGER NOT NULL DEFAULT 5,
  body        TEXT,
  approved    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(approved);
