import assert from "node:assert";
import { describe, it } from "node:test";

import {
  getTemplateById,
  INTERVIEW_TEMPLATES,
} from "../src/data/interviewTemplates.js";

describe("interviewTemplates", () => {
  it("has unique ids and five questions each", () => {
    const ids = new Set();
    for (const t of INTERVIEW_TEMPLATES) {
      assert.ok(t.id, "template id");
      assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
      ids.add(t.id);
      assert.strictEqual(t.questions.length, 5, t.id);
    }
  });

  it("getTemplateById resolves fe-junior-react", () => {
    const t = getTemplateById("fe-junior-react");
    assert.ok(t);
    assert.strictEqual(t.role, "Frontend Developer");
  });

  it("getTemplateById returns null for unknown", () => {
    assert.strictEqual(getTemplateById("nope"), null);
  });
});
