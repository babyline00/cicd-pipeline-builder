import { test, expect, describe } from "bun:test"
import {
  validateGraph,
  topologicalSort,
  isAcyclic,
  detectCycle,
  makeEdge,
} from "../graph-validator"
import type { PipelineGraph, PipelineNode } from "../node-types"

function n(id: string, type: string, x = 0, y = 0, props: Record<string, any> = {}): PipelineNode {
  return { id, type, x, y, props }
}

describe("validateGraph — invalid cases", () => {
  test("empty graph is invalid (no trigger, no nodes)", () => {
    const r = validateGraph({ nodes: [], edges: [] })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes("no nodes"))).toBe(true)
  })

  test("graph with no trigger is invalid", () => {
    const g: PipelineGraph = {
      nodes: [n("c", "checkout")],
      edges: [],
    }
    const r = validateGraph(g)
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes("trigger"))).toBe(true)
  })

  test("graph with two triggers is invalid", () => {
    const g: PipelineGraph = {
      nodes: [n("t1", "trigger"), n("t2", "trigger")],
      edges: [],
    }
    const r = validateGraph(g)
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes("exactly one"))).toBe(true)
  })

  test("graph with unknown node type is invalid", () => {
    const g: PipelineGraph = {
      nodes: [n("t", "trigger"), n("x", "unknown-type")],
      edges: [],
    }
    const r = validateGraph(g)
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes("Unknown node type"))).toBe(true)
  })

  test("graph with duplicate node ids is invalid", () => {
    const g: PipelineGraph = {
      nodes: [n("dup", "trigger"), n("dup", "checkout")],
      edges: [],
    }
    const r = validateGraph(g)
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes("Duplicate"))).toBe(true)
  })

  test("graph with a cycle is invalid", () => {
    const g: PipelineGraph = {
      nodes: [n("t", "trigger"), n("a", "checkout"), n("b", "install")],
      edges: [
        makeEdge("t", "a"),
        makeEdge("a", "b"),
        makeEdge("b", "a"), // cycle: a -> b -> a
      ],
    }
    const r = validateGraph(g)
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes("cycle"))).toBe(true)
  })

  test("graph with self-loop edge is invalid", () => {
    const g: PipelineGraph = {
      nodes: [n("t", "trigger"), n("a", "checkout")],
      edges: [makeEdge("t", "a"), makeEdge("a", "a")],
    }
    const r = validateGraph(g)
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes("self-loop"))).toBe(true)
  })

  test("graph with edge referencing missing node is invalid", () => {
    const g: PipelineGraph = {
      nodes: [n("t", "trigger")],
      edges: [{ id: "e1", from: "t", to: "missing" }],
    }
    const r = validateGraph(g)
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes("missing to node"))).toBe(true)
  })

  test("non-object graph is invalid", () => {
    const r = validateGraph(null)
    expect(r.valid).toBe(false)
  })

  test("graph with non-array nodes is invalid", () => {
    const r = validateGraph({ nodes: "not an array", edges: [] })
    expect(r.valid).toBe(false)
  })
})

describe("validateGraph — valid cases", () => {
  test("a simple linear pipeline is valid", () => {
    const g: PipelineGraph = {
      nodes: [
        n("t", "trigger", 0, 0, { events: ["push"], branch: "main" }),
        n("c", "checkout", 0, 100),
        n("i", "install", 0, 200, { command: "npm ci" }),
      ],
      edges: [
        makeEdge("t", "c"),
        makeEdge("c", "i"),
      ],
    }
    const r = validateGraph(g)
    expect(r.valid).toBe(true)
    expect(r.errors).toEqual([])
  })

  test("a graph with no edges but valid nodes is valid", () => {
    const g: PipelineGraph = {
      nodes: [n("t", "trigger"), n("c", "checkout")],
      edges: [],
    }
    const r = validateGraph(g)
    expect(r.valid).toBe(true)
  })
})

describe("topologicalSort", () => {
  test("returns nodes in execution order", () => {
    const g: PipelineGraph = {
      nodes: [
        n("t", "trigger"),
        n("c", "checkout"),
        n("i", "install"),
        n("b", "build"),
      ],
      edges: [
        makeEdge("t", "c"),
        makeEdge("c", "i"),
        makeEdge("i", "b"),
      ],
    }
    const order = topologicalSort(g)
    expect(order).toHaveLength(4)
    const ids = order.map((n) => n.id)
    expect(ids.indexOf("t")).toBeLessThan(ids.indexOf("c"))
    expect(ids.indexOf("c")).toBeLessThan(ids.indexOf("i"))
    expect(ids.indexOf("i")).toBeLessThan(ids.indexOf("b"))
  })

  test("handles disconnected nodes", () => {
    const g: PipelineGraph = {
      nodes: [n("t", "trigger"), n("c", "checkout"), n("i", "install")],
      edges: [makeEdge("t", "c")], // i is disconnected
    }
    const order = topologicalSort(g)
    expect(order).toHaveLength(3)
  })
})

describe("isAcyclic / detectCycle", () => {
  test("isAcyclic returns true for a DAG", () => {
    const g: PipelineGraph = {
      nodes: [n("t", "trigger"), n("a", "checkout")],
      edges: [makeEdge("t", "a")],
    }
    expect(isAcyclic(g)).toBe(true)
  })

  test("isAcyclic returns false for a cyclic graph", () => {
    const g: PipelineGraph = {
      nodes: [n("t", "trigger"), n("a", "checkout"), n("b", "install")],
      edges: [makeEdge("t", "a"), makeEdge("a", "b"), makeEdge("b", "a")],
    }
    expect(isAcyclic(g)).toBe(false)
  })

  test("detectCycle on empty adjacency map returns false", () => {
    const adj = new Map<string, string[]>()
    expect(detectCycle(adj)).toBe(false)
  })
})

describe("makeEdge", () => {
  test("creates an edge with auto id", () => {
    const e = makeEdge("a", "b")
    expect(e.from).toBe("a")
    expect(e.to).toBe("b")
    expect(e.id).toContain("a")
    expect(e.id).toContain("b")
  })

  test("creates an edge with explicit id", () => {
    const e = makeEdge("a", "b", "my-edge")
    expect(e.id).toBe("my-edge")
  })
})
