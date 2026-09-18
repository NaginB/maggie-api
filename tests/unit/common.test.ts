import { describe, expect, it } from "vitest";
import { escapeRegex, singularToPlural } from "../../src/utils/common";
import { parsePositiveInteger } from "../../src/services";

describe("common utilities", () => {
  it.each([
    ["category", "categories"],
    ["box", "boxes"],
    ["person", "people"],
    ["mouse", "mice"],
  ])("pluralizes %s", (input, output) =>
    expect(singularToPlural(input)).toBe(output),
  );
  it("escapes regular-expression syntax", () =>
    expect(escapeRegex("a.*(b)")).toBe("a\\.\\*\\(b\\)"));
  it.each([
    ["1", 1],
    ["20", 20],
    ["10abc", undefined],
    ["0", undefined],
    [-1, undefined],
  ])("parses positive integer %s", (input, output) =>
    expect(parsePositiveInteger(input)).toBe(output),
  );
});
