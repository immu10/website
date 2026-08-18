// Shared Upstash Redis client for the Tetris leaderboard (and any future
// game). Server-side only — UPSTASH_REDIS_REST_* env vars are never exposed
// to the client, so there's no way to reach Redis except through our own
// API routes.

import { Redis } from "@upstash/redis";

export function redisConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

let client = null;

export function getRedis() {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return client;
}
