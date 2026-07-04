import { describe, it, expect } from "vitest";
import { newId } from "@taweed/shared";

describe("newId", () => {
  it("returns a v4-shaped uuid string", () => {
    const id = newId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("returns a distinct value each call", () => {
    expect(newId()).not.toBe(newId());
  });
});
