const defaultDevOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

const envOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

const clientUrl = process.env.CLIENT_URL?.trim();
if (clientUrl) {
  envOrigins.push(clientUrl.replace(/\/+$/, ""));
}

export const allowedOrigins = new Set([...defaultDevOrigins, ...envOrigins]);

export const isProd = process.env.NODE_ENV === "production";

/** In development, allow any localhost / 127.0.0.1 port. */
export const devLoopbackOrigin =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/** Vercel-hosted frontends (production + preview deployments). */
export const vercelAppOrigin = /^https:\/\/[\w-]+[\w.-]*\.vercel\.app$/i;

export function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }
  if (allowedOrigins.has(origin)) {
    return true;
  }
  if (vercelAppOrigin.test(origin)) {
    return true;
  }
  if (!isProd && devLoopbackOrigin.test(origin)) {
    return true;
  }
  return false;
}
