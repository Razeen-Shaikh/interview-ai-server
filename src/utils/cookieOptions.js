/**
 * Auth cookie options. Cross-site requests (e.g. localhost → Vercel API)
 * require SameSite=None and Secure so the browser sends the cookie.
 */
function resolveRequestOrigin(req) {
  if (req.headers.origin) {
    return req.headers.origin;
  }
  const forwardedHost = req.headers["x-forwarded-host"];
  if (forwardedHost) {
    const proto = req.headers["x-forwarded-proto"] || "https";
    return `${proto}://${String(forwardedHost).split(",")[0].trim()}`;
  }
  return null;
}

export function getAuthCookieOptions(req, { maxAge } = {}) {
  const origin = resolveRequestOrigin(req);
  const crossSite =
    Boolean(origin) &&
    !isSameOriginAsHost(origin, req.get("host"));

  const base = {
    httpOnly: true,
    path: "/",
    secure: crossSite || process.env.NODE_ENV === "production",
    sameSite: crossSite ? "none" : "lax",
  };

  if (maxAge !== undefined) {
    base.maxAge = maxAge;
  }

  return base;
}

function isSameOriginAsHost(origin, host) {
  if (!host) {
    return false;
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
