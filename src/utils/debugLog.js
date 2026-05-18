import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SESSION_ID = "5eb5b1";
const DEBUG_ENDPOINT =
  "http://127.0.0.1:7376/ingest/7ae1152e-12b1-4b97-8ad4-0d9fbb9e4490";
const LOG_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../debug-5eb5b1.log",
);

export function debugLog(
  location,
  message,
  data,
  hypothesisId,
  runId = "pre-fix",
) {
  const payload = {
    sessionId: SESSION_ID,
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  // #region agent log
  try {
    appendFileSync(LOG_FILE, `${JSON.stringify(payload)}\n`, "utf8");
  } catch {
    /* ignore */
  }
  fetch(DEBUG_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION_ID,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}
