import assert from "node:assert";
import { describe, it } from "node:test";

import { parseAiJson } from "../src/utils/parseAiJson.js";

describe("parseAiJson", () => {
  it("parses raw JSON object", () => {
    const o = parseAiJson('{"a":1}');
    assert.strictEqual(o.a, 1);
  });

  it("parses fenced JSON", () => {
    const o = parseAiJson("```json\n{\"questions\":[\"q1\"]}\n```");
    assert.deepStrictEqual(o.questions, ["q1"]);
  });
});
