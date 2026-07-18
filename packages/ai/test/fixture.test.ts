import { describe, it, expect } from "vitest";
import * as z from "zod/v4";
import { createFixtureProvider, fixtureKey } from "../src/fixture.js";
import type { StructuredRequest } from "../src/provider.js";

const schema = z.object({ answer: z.string() });

function req(): StructuredRequest<{ answer: string }> {
  return {
    model: "haiku",
    system: "sys",
    user: "u",
    schema,
    schemaName: "t",
    maxTokens: 100,
  };
}

describe("FixtureProvider (CI never calls the live API)", () => {
  it("replays a recorded structured output with its usage", async () => {
    const r = req();
    const key = fixtureKey(r);
    const provider = createFixtureProvider({
      [key]: {
        output: { answer: "hi" },
        usage: { inputTokens: 3, outputTokens: 2 },
        requestId: "r1",
      },
    });
    const res = await provider.client.parseStructured(r);
    expect(res.parsed).toEqual({ answer: "hi" });
    expect(res.usage.inputTokens).toBe(3);
    expect(res.requestId).toBe("r1");
  });

  it("throws for a missing fixture rather than silently passing", async () => {
    const provider = createFixtureProvider({});
    await expect(provider.client.parseStructured(req())).rejects.toThrow(
      /No AI fixture/,
    );
  });

  it("returns parsed=null when the recorded output fails the schema", async () => {
    const r = req();
    const key = fixtureKey(r);
    // answer must be a string; record a number to force a validation failure.
    const provider = createFixtureProvider({
      [key]: { output: { answer: 123 } },
    });
    const res = await provider.client.parseStructured(r);
    expect(res.parsed).toBeNull();
    expect(res.rawOutput).toBe("");
  });
});
