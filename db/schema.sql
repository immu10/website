-- Run this once against your Neon database (Neon console -> SQL Editor ->
-- paste and run). Not applied automatically — there's no migration tool
-- here on purpose, this is a single small table.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(20) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  -- Reserved for a future email-based login option — unused today, but
  -- having the column from the start means adding that later is additive
  -- (add a value + a lookup path) rather than a schema change.
  email VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Updated on every successful login — lets you spot/clean up accounts
  -- that were made but never really used.
  last_login TIMESTAMPTZ
);
