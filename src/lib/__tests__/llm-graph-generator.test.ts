import { test, expect, describe } from "bun:test"
import {
  buildSystemPrompt,
  buildGenerateGraphPrompt,
  parseGraphResponse,
  normalizeGraph,
  generateGraphFromDescription,
  fallbackGraph,
  NODE_TYPE_NAMES,
} from "../llm-graph-generator"
import { __setLlmProviderForTest, type LlmProvider } from "../ai"
import { NODE_TYPES } from "../node-types"

const sampleDescription = "Build a Node.js CI that runs on push to main: install, lint, test, build, deploy to Vercel."

describe("buildGenerateGraphPrompt", () => {
  test("includes the user description", () => {
    const p = buildGenerateGraphPrompt(sampleDescription)
    expect(p).toContain(sampleDescription)
  })

  test("includes all node type ids", () => {
    const p = buildGenerateGraphPrompt(sampleDescription)
    for (const t of NODE_TYPES) {
      expect(p).toContain(t.id)
    }
  })

  test("includes JSON instructions", () => {
    const p = buildGenerateGraphPrompt(sampleDescription)
    expect(p.toLowerCase()).toContain("json")
    expect(p).toContain("```json")
  })

  test("includes the JSON schema shape", () => {
    const p = buildGenerateGraphPrompt(sampleDescription)
    expect(p).toContain('"nodes"')
    expect(p).toContain('"edges"')
    expect(p).toContain('"id"')
    expect(p).toContain('"type"')
    expect(p).toContain('"x"')
    expect(p).toContain('"y"')
    expect(p).toContain('"props"')
  })
})

describe("buildSystemPrompt", () => {
  test("mentions JSON-only output", () => {
    const s = buildSystemPrompt()
    expect(s.toLowerCase()).toContain("json")
    expect(s.toLowerCase()).toContain("only")
  })

  test("mentions trigger requirement", () => {
    const s = buildSystemPrompt()
    expect(s.toLowerCase()).toContain("trigger")
  })
})

describe("NODE_TYPE_NAMES", () => {
  test("matches NODE_TYPES ids", () => {
    expect(NODE_TYPE_NAMES).toEqual(NODE_TYPES.map((t) => t.id))
  })
})

describe("parseGraphResponse", () => {
  const validGraph = {
    nodes: [
      { id: "n1", type: "trigger", x: 80, y: 80, props: { events: ["push"], branch: "main" } },
      { id: "n2", type: "checkout", x: 80, y: 180, props: {} },
    ],
    edges: [{ id: "e1", from: "n1", to: "n2" }],
  }

  test("extracts JSON from a fenced ```json code block", () => {
    const text = "Here is the graph:\n```json\n" + JSON.stringify(validGraph, null, 2) + "\n```"
    const g = parseGraphResponse(text)
    expect(g).not.toBeNull()
    expect(g!.nodes).toHaveLength(2)
    expect(g!.edges).toHaveLength(1)
  })

  test("extracts JSON from a plain ``` code block", () => {
    const text = "```\n" + JSON.stringify(validGraph) + "\n```"
    const g = parseGraphResponse(text)
    expect(g).not.toBeNull()
    expect(g!.nodes).toHaveLength(2)
  })

  test("extracts bare JSON", () => {
    const text = JSON.stringify(validGraph)
    const g = parseGraphResponse(text)
    expect(g).not.toBeNull()
    expect(g!.nodes).toHaveLength(2)
  })

  test("returns null for invalid JSON in code block", () => {
    const text = "```json\nnot valid json\n```"
    expect(parseGraphResponse(text)).toBeNull()
  })

  test("returns null for no JSON at all", () => {
    expect(parseGraphResponse("just plain text")).toBeNull()
  })

  test("returns null for empty input", () => {
    expect(parseGraphResponse("")).toBeNull()
  })

  test("returns null when graph has zero valid nodes", () => {
    const text = "```json\n" + JSON.stringify({ nodes: [], edges: [] }) + "\n```"
    expect(parseGraphResponse(text)).toBeNull()
  })

  test("filters out nodes with unknown types", () => {
    const text = "```json\n" + JSON.stringify({
      nodes: [
        { id: "n1", type: "trigger", x: 0, y: 0, props: {} },
        { id: "n2", type: "bogus-type", x: 0, y: 100, props: {} },
      ],
      edges: [],
    }) + "\n```"
    const g = parseGraphResponse(text)
    expect(g).not.toBeNull()
    expect(g!.nodes).toHaveLength(1)
    expect(g!.nodes[0].id).toBe("n1")
  })

  test("drops edges that reference filtered-out nodes", () => {
    const text = "```json\n" + JSON.stringify({
      nodes: [
        { id: "n1", type: "trigger", x: 0, y: 0, props: {} },
        { id: "n2", type: "bogus", x: 0, y: 100, props: {} },
      ],
      edges: [{ id: "e1", from: "n1", to: "n2" }],
    }) + "\n```"
    const g = parseGraphResponse(text)
    expect(g).not.toBeNull()
    expect(g!.edges).toHaveLength(0)
  })

  test("non-string input returns null", () => {
    expect(parseGraphResponse(null as any)).toBeNull()
    expect(parseGraphResponse(undefined as any)).toBeNull()
  })
})

describe("normalizeGraph", () => {
  test("coerces missing x/y to defaults", () => {
    const g = normalizeGraph({
      nodes: [{ id: "n1", type: "trigger", props: {} }],
      edges: [],
    })
    expect(g).not.toBeNull()
    expect(g!.nodes[0].x).toBe(80)
    expect(g!.nodes[0].y).toBe(80)
  })

  test("auto-generates missing ids", () => {
    const g = normalizeGraph({
      nodes: [
        { type: "trigger", x: 0, y: 0, props: {} },
        { type: "checkout", x: 0, y: 100, props: {} },
      ],
      edges: [],
    })
    expect(g).not.toBeNull()
    expect(g!.nodes[0].id).toBe("n1")
    expect(g!.nodes[1].id).toBe("n2")
  })

  test("returns null for non-object input", () => {
    expect(normalizeGraph(null)).toBeNull()
    expect(normalizeGraph("string")).toBeNull()
    expect(normalizeGraph(42)).toBeNull()
  })

  test("returns null when no valid nodes", () => {
    expect(normalizeGraph({ nodes: [], edges: [] })).toBeNull()
  })

  test("preserves props", () => {
    const g = normalizeGraph({
      nodes: [{ id: "n1", type: "trigger", x: 0, y: 0, props: { events: ["push"], branch: "main" } }],
      edges: [],
    })
    expect(g!.nodes[0].props.events).toEqual(["push"])
    expect(g!.nodes[0].props.branch).toBe("main")
  })
})

describe("generateGraphFromDescription (mock LLM)", () => {
  class MockLlm implements LlmProvider {
    response = ""
    constructor(response: string) { this.response = response }
    async complete(): Promise<string> { return this.response }
  }

  test("parses the LLM response into a graph", async () => {
    const graph = {
      nodes: [
        { id: "n1", type: "trigger", x: 80, y: 80, props: { events: ["push"], branch: "main" } },
        { id: "n2", type: "checkout", x: 80, y: 180, props: {} },
        { id: "n3", type: "install", x: 80, y: 280, props: { command: "npm ci" } },
      ],
      edges: [{ id: "e1", from: "n1", to: "n2" }, { id: "e2", from: "n2", to: "n3" }],
    }
    __setLlmProviderForTest(new MockLlm("```json\n" + JSON.stringify(graph) + "\n```"))
    const result = await generateGraphFromDescription("test")
    expect(result.nodes).toHaveLength(3)
    expect(result.edges).toHaveLength(2)
    __setLlmProviderForTest(null)
  })

  test("falls back when LLM returns garbage", async () => {
    __setLlmProviderForTest(new MockLlm("totally not json at all"))
    const result = await generateGraphFromDescription("test")
    expect(result.nodes.length).toBeGreaterThan(0)
    expect(result.nodes.some((n) => n.type === "trigger")).toBe(true)
    __setLlmProviderForTest(null)
  })
})

describe("fallbackGraph", () => {
  test("returns a valid graph with a trigger", () => {
    const g = fallbackGraph("anything")
    expect(g.nodes.length).toBeGreaterThan(0)
    expect(g.nodes.some((n) => n.type === "trigger")).toBe(true)
    expect(g.edges.length).toBeGreaterThan(0)
  })
})
