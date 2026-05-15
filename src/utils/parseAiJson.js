/**
 * Parse JSON returned by LLMs, including optional ```json ... ``` fences.
 */
export function parseAiJson(text) {
  if (text == null || typeof text !== "string") {
    throw new Error("Empty AI response");
  }
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) {
    t = fence[1].trim();
  }
  return JSON.parse(t);
}
