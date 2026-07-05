import { describe, it, expect } from "vitest";
import * as ai from "../src/index.js";

// The public surface: feature fns + gates + pure foundation. Deliberately does
// NOT export the raw provider client, the audited runner, or writeLlmCall — a
// call cannot skip the audit trail.
describe("@taweed/ai public surface", () => {
  it("exports the AI-1 feature and kill-switch gates", () => {
    expect(typeof ai.explainFlag).toBe("function");
    expect(typeof ai.isAiEnabled).toBe("function");
    expect(typeof ai.isFeatureEnabled).toBe("function");
    expect(typeof ai.AiDisabledError).toBe("function");
  });

  it("exports the pure de-identification + AR post-processing foundation", () => {
    expect(typeof ai.pseudonymize).toBe("function");
    expect(typeof ai.detokenize).toBe("function");
    expect(typeof ai.normalizeArabicOutput).toBe("function");
  });

  it("does not leak an LLM provider factory or the audited runner", () => {
    expect((ai as Record<string, unknown>).createAnthropicProvider).toBeUndefined();
    expect((ai as Record<string, unknown>).runStructured).toBeUndefined();
    expect((ai as Record<string, unknown>).writeLlmCall).toBeUndefined();
  });
});
