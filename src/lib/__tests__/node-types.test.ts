import { test, expect, describe } from "bun:test"
import {
  NODE_TYPES,
  NODE_CATEGORIES,
  getNodeTypes,
  getNodeType,
  isValidNodeType,
  validateNode,
  makeNode,
} from "../node-types"

describe("getNodeTypes", () => {
  test("returns the expected list of node types", () => {
    const types = getNodeTypes()
    expect(types.length).toBeGreaterThanOrEqual(14)
    const ids = types.map((t) => t.id)
    const expected = [
      "trigger", "checkout", "setup-node", "setup-python", "setup-go",
      "install", "lint", "test", "build",
      "deploy-vercel", "deploy-fly", "deploy-aws",
      "notify-slack", "notify-email",
    ]
    for (const e of expected) {
      expect(ids).toContain(e)
    }
  })

  test("NODE_TYPES matches getNodeTypes", () => {
    expect(NODE_TYPES).toBe(getNodeTypes())
  })
})

describe("node type definitions", () => {
  test("every node type has id, label, color, default props, and valid schema", () => {
    for (const t of getNodeTypes()) {
      expect(typeof t.id).toBe("string")
      expect(t.id.length).toBeGreaterThan(0)
      expect(typeof t.label).toBe("string")
      expect(t.label.length).toBeGreaterThan(0)
      expect(typeof t.color).toBe("string")
      expect(t.color).toMatch(/^#/)
      expect(t.defaultProps).toBeDefined()
      expect(typeof t.defaultProps).toBe("object")
      expect(Array.isArray(t.propertySchema)).toBe(true)
      expect(t.propertySchema.length).toBeGreaterThan(0)
    }
  })

  test("every property schema is valid", () => {
    for (const t of getNodeTypes()) {
      for (const p of t.propertySchema) {
        expect(typeof p.key).toBe("string")
        expect(p.key.length).toBeGreaterThan(0)
        expect(typeof p.label).toBe("string")
        expect(["string", "number", "boolean", "select", "list"]).toContain(p.type)
        if (p.type === "select") {
          expect(Array.isArray(p.options)).toBe(true)
          expect((p.options ?? []).length).toBeGreaterThan(0)
        }
      }
    }
  })

  test("every node type has a valid category", () => {
    const validCats = NODE_CATEGORIES.map((c) => c.id)
    for (const t of getNodeTypes()) {
      expect(validCats).toContain(t.category)
    }
  })

  test("trigger node has events + branch default props", () => {
    const t = getNodeType("trigger")
    expect(t?.defaultProps.events).toEqual(["push"])
    expect(t?.defaultProps.branch).toBe("main")
  })

  test("setup-node has nodeVersion + cache default props", () => {
    const t = getNodeType("setup-node")
    expect(t?.defaultProps.nodeVersion).toBe("20")
    expect(t?.defaultProps.cache).toBe("npm")
  })
})

describe("getNodeType", () => {
  test("returns the specific type", () => {
    const t = getNodeType("trigger")
    expect(t).toBeDefined()
    expect(t?.id).toBe("trigger")
  })

  test("returns undefined for unknown", () => {
    expect(getNodeType("unknown-type")).toBeUndefined()
  })
})

describe("isValidNodeType", () => {
  test("returns true for known types", () => {
    expect(isValidNodeType("trigger")).toBe(true)
    expect(isValidNodeType("checkout")).toBe(true)
    expect(isValidNodeType("deploy-vercel")).toBe(true)
  })

  test("returns false for unknown types", () => {
    expect(isValidNodeType("unknown")).toBe(false)
    expect(isValidNodeType("")).toBe(false)
  })
})

describe("validateNode", () => {
  test("returns true for a valid node", () => {
    const node = { id: "n1", type: "trigger", x: 0, y: 0, props: {} }
    expect(validateNode(node)).toBe(true)
  })

  test("returns false for an unknown type", () => {
    const node = { id: "n1", type: "unknown", x: 0, y: 0, props: {} }
    expect(validateNode(node)).toBe(false)
  })

  test("returns false for missing id", () => {
    const node = { type: "trigger", x: 0, y: 0, props: {} }
    expect(validateNode(node as any)).toBe(false)
  })

  test("returns false for empty id", () => {
    const node = { id: "", type: "trigger", x: 0, y: 0, props: {} }
    expect(validateNode(node as any)).toBe(false)
  })

  test("returns false for missing x/y", () => {
    const node = { id: "n1", type: "trigger", props: {} }
    expect(validateNode(node as any)).toBe(false)
  })

  test("returns false for missing props", () => {
    const node = { id: "n1", type: "trigger", x: 0, y: 0 }
    expect(validateNode(node as any)).toBe(false)
  })

  test("returns false for non-object input", () => {
    expect(validateNode(null as any)).toBe(false)
    expect(validateNode(undefined as any)).toBe(false)
    expect(validateNode("not a node" as any)).toBe(false)
  })
})

describe("makeNode", () => {
  test("creates a node with default props for trigger", () => {
    const node = makeNode("trigger", "n1", 100, 200)
    expect(node.id).toBe("n1")
    expect(node.type).toBe("trigger")
    expect(node.x).toBe(100)
    expect(node.y).toBe(200)
    expect(node.props).toBeDefined()
    expect(node.props.events).toEqual(["push"])
    expect(node.props.branch).toBe("main")
  })

  test("creates a node with default props for setup-node", () => {
    const node = makeNode("setup-node", "n2")
    expect(node.type).toBe("setup-node")
    expect(node.props.nodeVersion).toBe("20")
    expect(node.props.cache).toBe("npm")
  })

  test("returns empty props for unknown type", () => {
    const node = makeNode("unknown", "n3")
    expect(node.props).toEqual({})
  })

  test("default coordinates are 100,100", () => {
    const node = makeNode("trigger", "n4")
    expect(node.x).toBe(100)
    expect(node.y).toBe(100)
  })
})

describe("NODE_CATEGORIES", () => {
  test("has 6 categories", () => {
    expect(NODE_CATEGORIES).toHaveLength(6)
  })

  test("categories are in expected order", () => {
    const ids = NODE_CATEGORIES.map((c) => c.id)
    expect(ids).toEqual(["trigger", "source", "setup", "build", "deploy", "notify"])
  })

  test("every category has a label", () => {
    for (const c of NODE_CATEGORIES) {
      expect(typeof c.label).toBe("string")
      expect(c.label.length).toBeGreaterThan(0)
    }
  })
})
