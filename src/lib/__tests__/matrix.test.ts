import { test, expect, describe } from "bun:test"
import {
  expandMatrix,
  hasMatrix,
  getMatrixAxes,
  matrixYamlBlock,
  collectMatrixAxes,
  type MatrixVariant,
} from "../matrix"
import type { PipelineNode } from "../node-types"

function node(props: Record<string, any> = {}): PipelineNode {
  return { id: "n1", type: "setup-node", x: 0, y: 0, props }
}

describe("expandMatrix", () => {
  test("returns single empty variant for empty matrix", () => {
    const variants = expandMatrix(node({ matrix: [] }))
    expect(variants).toEqual([{}])
  })

  test("returns single empty variant for missing matrix", () => {
    const variants = expandMatrix(node({}))
    expect(variants).toEqual([{}])
  })

  test("returns single empty variant for null matrix", () => {
    const variants = expandMatrix(node({ matrix: null }))
    expect(variants).toEqual([{}])
  })

  test("expands single axis { 'node-version': [18, 20, 22] } to 3 variants", () => {
    const variants = expandMatrix(
      node({ matrix: { "node-version": [18, 20, 22] } }),
    )
    expect(variants).toHaveLength(3)
    expect(variants[0]).toEqual({ "node-version": 18 })
    expect(variants[1]).toEqual({ "node-version": 20 })
    expect(variants[2]).toEqual({ "node-version": 22 })
  })

  test("expands multi-axis cartesian product", () => {
    const variants = expandMatrix(
      node({ matrix: { a: [1, 2], b: ["x", "y"] } }),
    )
    expect(variants).toHaveLength(4)
    expect(variants).toContainEqual({ a: 1, b: "x" })
    expect(variants).toContainEqual({ a: 1, b: "y" })
    expect(variants).toContainEqual({ a: 2, b: "x" })
    expect(variants).toContainEqual({ a: 2, b: "y" })
  })

  test("ignores empty axes", () => {
    const variants = expandMatrix(
      node({ matrix: { "node-version": [18], empty: [] } }),
    )
    expect(variants).toEqual([{ "node-version": 18 }])
  })

  test("handles string values", () => {
    const variants = expandMatrix(
      node({ matrix: { "python-version": ["3.10", "3.11", "3.12"] } }),
    )
    expect(variants).toHaveLength(3)
    expect(variants[0]).toEqual({ "python-version": "3.10" })
  })
})

describe("hasMatrix", () => {
  test("returns true when matrix has at least one non-empty axis", () => {
    expect(hasMatrix(node({ matrix: { "node-version": [18, 20] } }))).toBe(true)
  })

  test("returns false for empty matrix array", () => {
    expect(hasMatrix(node({ matrix: [] }))).toBe(false)
  })

  test("returns false for missing matrix", () => {
    expect(hasMatrix(node({}))).toBe(false)
  })

  test("returns false for matrix with only empty axes", () => {
    expect(hasMatrix(node({ matrix: { empty: [] } }))).toBe(false)
  })
})

describe("getMatrixAxes", () => {
  test("returns the axes of a node's matrix", () => {
    const axes = getMatrixAxes(node({ matrix: { "node-version": [18, 20, 22] } }))
    expect(axes).toHaveLength(1)
    expect(axes[0].key).toBe("node-version")
    expect(axes[0].values).toEqual([18, 20, 22])
  })

  test("returns empty array for missing matrix", () => {
    expect(getMatrixAxes(node({}))).toEqual([])
  })

  test("ignores empty axes", () => {
    const axes = getMatrixAxes(node({ matrix: { a: [1], b: [] } }))
    expect(axes).toHaveLength(1)
    expect(axes[0].key).toBe("a")
  })
})

describe("matrixYamlBlock", () => {
  test("emits a YAML matrix block for a node's axes", () => {
    const block = matrixYamlBlock(
      node({ matrix: { "node-version": [18, 20, 22] } }),
      "    ",
    )
    expect(block).toContain("matrix:")
    expect(block).toContain("node-version: [18, 20, 22]")
  })

  test("quotes string values", () => {
    const block = matrixYamlBlock(
      node({ matrix: { "python-version": ["3.10", "3.11"] } }),
      "    ",
    )
    expect(block).toContain("python-version: ['3.10', '3.11']")
  })

  test("returns empty string for missing matrix", () => {
    expect(matrixYamlBlock(node({}))).toBe("")
  })

  test("returns empty string for empty matrix array", () => {
    expect(matrixYamlBlock(node({ matrix: [] }))).toBe("")
  })
})

describe("collectMatrixAxes", () => {
  test("collects axes across multiple nodes", () => {
    const nodes: PipelineNode[] = [
      { id: "a", type: "setup-node", x: 0, y: 0, props: { matrix: { "node-version": [18, 20] } } },
      { id: "b", type: "setup-python", x: 0, y: 100, props: { matrix: { "python-version": ["3.11"] } } },
    ]
    const axes = collectMatrixAxes(nodes)
    expect(axes["node-version"]).toEqual([18, 20])
    expect(axes["python-version"]).toEqual(["3.11"])
  })

  test("later declarations override earlier ones for the same key", () => {
    const nodes: PipelineNode[] = [
      { id: "a", type: "setup-node", x: 0, y: 0, props: { matrix: { "node-version": [18, 20] } } },
      { id: "b", type: "setup-node", x: 0, y: 100, props: { matrix: { "node-version": [22, 24] } } },
    ]
    const axes = collectMatrixAxes(nodes)
    expect(axes["node-version"]).toEqual([22, 24])
  })

  test("returns empty object for nodes without matrix", () => {
    const nodes: PipelineNode[] = [
      { id: "a", type: "trigger", x: 0, y: 0, props: {} },
    ]
    expect(collectMatrixAxes(nodes)).toEqual({})
  })
})
