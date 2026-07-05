import { describe, it, expect } from "vitest";
import { LLM_MODEL_IDS, mapTaweedModel } from "../src/models.js";

describe("model ids", () => {
  it("maps each tier to the exact Anthropic id", () => {
    expect(mapTaweedModel("opus")).toBe("claude-opus-4-8");
    expect(mapTaweedModel("sonnet")).toBe("claude-sonnet-5");
    expect(mapTaweedModel("haiku")).toBe("claude-haiku-4-5");
  });

  it("uses no date suffix on any id (date-suffixed variants 404)", () => {
    for (const id of Object.values(LLM_MODEL_IDS)) {
      expect(id).not.toMatch(/\d{8}$/);
      expect(id).toMatch(/^claude-[a-z0-9-]+$/);
    }
  });
});
