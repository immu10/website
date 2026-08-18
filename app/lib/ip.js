// Client IP extraction, shared by every route that rate-limits or logs by
// IP. The domain sits behind Cloudflare (proxied DNS in front of Vercel),
// so the connection Vercel actually sees is from Cloudflare's edge, not the
// visitor — `cf-connecting-ip` is Cloudflare's dedicated header carrying the
// real visitor IP and takes priority; `x-forwarded-for`'s first entry is
// the fallback for local dev / any request that isn't Cloudflare-proxied.
export function getClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
