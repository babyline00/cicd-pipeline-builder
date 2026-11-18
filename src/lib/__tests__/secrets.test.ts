import { test, expect, describe } from "bun:test"
import {
  validateSecretName,
  formatSecretsRef,
  extractSecretRefs,
} from "../secrets"

describe("validateSecretName", () => {
  test("returns true for UPPER_SNAKE_CASE", () => {
    expect(validateSecretName("VERCEL_TOKEN")).toBe(true)
    expect(validateSecretName("AWS_ACCESS_KEY_ID")).toBe(true)
    expect(validateSecretName("SLACK_WEBHOOK_URL")).toBe(true)
    expect(validateSecretName("FLY_API_TOKEN")).toBe(true)
  })

  test("returns true for single uppercase letter", () => {
    expect(validateSecretName("A")).toBe(true)
  })

  test("returns true for underscore prefix", () => {
    expect(validateSecretName("_FOO")).toBe(true)
  })

  test("returns true for underscores and digits", () => {
    expect(validateSecretName("FOO_BAR_123")).toBe(true)
  })

  test("returns false for lowercase", () => {
    expect(validateSecretName("foo_bar")).toBe(false)
    expect(validateSecretName("Vercel_Token")).toBe(false)
  })

  test("returns false for digit-first", () => {
    expect(validateSecretName("1FOO")).toBe(false)
    expect(validateSecretName("9_NAME")).toBe(false)
  })

  test("returns false for hyphen", () => {
    expect(validateSecretName("FOO-BAR")).toBe(false)
  })

  test("returns false for space", () => {
    expect(validateSecretName("FOO BAR")).toBe(false)
  })

  test("returns false for empty string", () => {
    expect(validateSecretName("")).toBe(false)
  })

  test("returns false for non-string input", () => {
    expect(validateSecretName(null as any)).toBe(false)
    expect(validateSecretName(undefined as any)).toBe(false)
    expect(validateSecretName(42 as any)).toBe(false)
  })

  test("returns false for overly long names", () => {
    expect(validateSecretName("A".repeat(65))).toBe(false)
  })

  test("returns false for special chars", () => {
    expect(validateSecretName("FOO$BAR")).toBe(false)
    expect(validateSecretName("FOO.BAR")).toBe(false)
  })
})

describe("formatSecretsRef", () => {
  test("returns ${{ secrets.NAME }}", () => {
    expect(formatSecretsRef("VERCEL_TOKEN")).toBe("${{ secrets.VERCEL_TOKEN }}")
  })

  test("handles single-letter name", () => {
    expect(formatSecretsRef("A")).toBe("${{ secrets.A }}")
  })

  test("handles underscored name", () => {
    expect(formatSecretsRef("AWS_SECRET_ACCESS_KEY")).toBe("${{ secrets.AWS_SECRET_ACCESS_KEY }}")
  })

  test("does not validate (just formats)", () => {
    // formatSecretsRef is a pure formatter — it does not reject invalid names
    expect(formatSecretsRef("invalid name")).toBe("${{ secrets.invalid name }}")
  })
})

describe("extractSecretRefs", () => {
  test("extracts all referenced secret names from a YAML string", () => {
    const yaml = `
      run: vercel deploy --token \${{ secrets.VERCEL_TOKEN }}
      env:
        FLY_API_TOKEN: \${{ secrets.FLY_API_TOKEN }}
    `
    const refs = extractSecretRefs(yaml)
    expect(refs).toContain("VERCEL_TOKEN")
    expect(refs).toContain("FLY_API_TOKEN")
    expect(refs).toHaveLength(2)
  })

  test("deduplicates repeated references", () => {
    const yaml = `
      run: echo \${{ secrets.A }} && echo \${{ secrets.A }}
    `
    const refs = extractSecretRefs(yaml)
    expect(refs).toEqual(["A"])
  })

  test("returns empty array for no references", () => {
    expect(extractSecretRefs("no secrets here")).toEqual([])
  })

  test("returns empty array for empty input", () => {
    expect(extractSecretRefs("")).toEqual([])
  })

  test("returns empty array for non-string input", () => {
    expect(extractSecretRefs(null as any)).toEqual([])
    expect(extractSecretRefs(undefined as any)).toEqual([])
  })

  test("handles whitespace inside braces", () => {
    const yaml = "run: \${{   secrets.X   }}"
    expect(extractSecretRefs(yaml)).toContain("X")
  })
})
