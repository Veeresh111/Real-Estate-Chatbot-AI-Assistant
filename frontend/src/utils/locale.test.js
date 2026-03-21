import { describe, expect, test } from "vitest"
import { resolveLocale } from "./locale"

describe("resolveLocale", () => {
  test("returns mapped locales", () => {
    expect(resolveLocale("en")).toBe("en-IN")
    expect(resolveLocale("kn")).toBe("kn-IN")
  })

  test("returns fallback for unknown language", () => {
    expect(resolveLocale("fr")).toBe("fr")
  })

  test("returns default for empty input", () => {
    expect(resolveLocale("")).toBe("en-IN")
    expect(resolveLocale(null)).toBe("en-IN")
  })
})
