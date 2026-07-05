import { describe, it, expect } from "vitest";
import {
  buildSystemBlocks,
  mapParseResponse,
  type ParseResponseLike,
} from "../src/anthropic-1p.js";

describe("buildSystemBlocks", () => {
  it("returns a plain text block when caching is off", () => {
    expect(buildSystemBlocks("sys")).toEqual([{ type: "text", text: "sys" }]);
  });

  it("adds ephemeral cache_control when caching is on", () => {
    expect(buildSystemBlocks("sys", true)).toEqual([
      { type: "text", text: "sys", cache_control: { type: "ephemeral" } },
    ]);
  });
});

describe("mapParseResponse", () => {
  it("maps a parsed response and coalesces null usage to 0", () => {
    const res: ParseResponseLike<{ answer: string }> = {
      parsed_output: { answer: "hi" },
      model: "claude-haiku-4-5",
      id: "msg_1",
      usage: {
        input_tokens: 12,
        output_tokens: 7,
        cache_read_input_tokens: null,
      },
    };
    const out = mapParseResponse(res, 42);
    expect(out.parsed).toEqual({ answer: "hi" });
    expect(out.model).toBe("claude-haiku-4-5");
    expect(out.requestId).toBe("msg_1");
    expect(out.usage).toEqual({
      inputTokens: 12,
      outputTokens: 7,
      cacheReadTokens: 0,
    });
    expect(out.latencyMs).toBe(42);
    expect(out.rawOutput).toBe(JSON.stringify({ answer: "hi" }));
  });

  it("returns parsed=null and empty rawOutput when the model did not parse", () => {
    const res: ParseResponseLike<{ answer: string }> = {
      parsed_output: null,
      model: "claude-haiku-4-5",
      id: "msg_2",
      usage: {
        input_tokens: null,
        output_tokens: 3,
        cache_read_input_tokens: 5,
      },
    };
    const out = mapParseResponse(res, 1);
    expect(out.parsed).toBeNull();
    expect(out.rawOutput).toBe("");
    expect(out.usage.inputTokens).toBe(0);
    expect(out.usage.cacheReadTokens).toBe(5);
  });
});
