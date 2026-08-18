// Shared Neon Postgres client for account data (see app/lib/auth.js). Uses
// Neon's serverless driver (HTTP-based) rather than a normal TCP pool, since
// that's what actually works from short-lived Vercel functions. Server-side
// only — DATABASE_URL is never exposed to the client.

import { neon } from "@neondatabase/serverless";

export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

let sql = null;

export function getDb() {
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}
