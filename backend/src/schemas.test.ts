import { describe, expect, it } from "vitest";
import { LoginSchema, PhotoMetaSchema } from "./schemas.js";

describe("schemas", () => {
  it("rejects invalid login", () => {
    expect(() => LoginSchema.parse({ email: "nope", password: "short" })).toThrow();
  });

  it("accepts photo meta and defaults people", () => {
    const v = PhotoMetaSchema.parse({ title: "Hello" });
    expect(v.people).toEqual([]);
  });
});

