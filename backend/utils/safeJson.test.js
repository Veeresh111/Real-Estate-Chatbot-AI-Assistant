const { safeJsonParse } = require("./safeJson")

describe("safeJsonParse", () => {
  test("parses valid JSON", () => {
    const input = JSON.stringify({ ok: true })
    expect(safeJsonParse(input, null)).toEqual({ ok: true })
  })

  test("parses JSON embedded in text", () => {
    const input = "prefix {\"value\": 42} suffix"
    expect(safeJsonParse(input, null)).toEqual({ value: 42 })
  })

  test("returns fallback for invalid input", () => {
    const fallback = { ok: false }
    expect(safeJsonParse("not json", fallback)).toBe(fallback)
  })
})
