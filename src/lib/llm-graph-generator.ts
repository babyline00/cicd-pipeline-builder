/**
 * Description-to-graph LLM generator.
 *
 * Flow:
 *   1. `buildSystemPrompt()` — fixed system prompt that constrains the LLM
 *      to output ONLY a ```json fenced code block.
 *   2. `buildGenerateGraphPrompt(description)` — describes the available
 *      node types, the JSON schema, and the user's description.
 *   3. `getLlmProvider().complete(...)` — non-streaming LLM call.
 *   4. `parseGraphResponse(text)` — extract JSON from fenced block (or bare
 *      JSON), normalize it, drop nodes with unknown types.
 *   5. `normalizeGraph(raw)` — coerce the raw object into a typed graph.
 *
 * Falls back to a minimal valid graph if the LLM response is unparseable.
 */

import {
  NODE_TYPES,
  getNodeType,
  type PipelineGraph,
  type PipelineNode,
  type PipelineEdge,
} from "./node-types"
import { getLlmProvider } from "./ai"

export const NODE_TYPE_NAMES = NODE_TYPES.map((t) => t.id)

export function buildSystemPrompt(): string {
  return [
    "You are a CI/CD expert assistant that converts natural-language pipeline descriptions into a JSON node graph.",
    "You output ONLY valid JSON inside a ```json fenced code block. No prose, no commentary.",
    "The graph must follow the schema described in the user prompt.",
    "Always include exactly one trigger node.",
    "Use only the node types listed by the user.",
  ].join("\n")
}

export function buildGenerateGraphPrompt(description: string): string {
  const typeList = NODE_TYPES.map(
    (t) => `  - ${t.id}: ${t.description}`,
  ).join("\n")
  const schemaLines = [
    "{",
    '  "nodes": [',
    '    { "id": "n1", "type": "trigger", "x": 80, "y": 80, "props": { "events": ["push"], "branch": "main" } },',
    '    { "id": "n2", "type": "checkout", "x": 80, "y": 180, "props": {} }',
    "    // ... one entry per node, in execution order",
    "  ],",
    '  "edges": [',
    '    { "id": "e1", "from": "n1", "to": "n2" }',
    "    // ... one entry per edge connecting nodes in execution order",
    "  ]",
    "}",
  ].join("\n")
  return [
    "You are a CI/CD expert. Given a natural-language description, return a JSON node graph that matches the schema below.",
    "",
    "Available node types:",
    typeList,
    "",
    "Each node has { id, type, x, y, props }. Edges connect nodes in execution order.",
    "Use ONLY the available node types. Include exactly one \"trigger\" node.",
    "Layout nodes vertically (x ~ 80, y increasing by 100 per node).",
    "Connect adjacent nodes with edges in execution order.",
    "",
    "JSON schema:",
    schemaLines,
    "",
    "User description:",
    description,
    "",
    "Respond with ONLY a JSON code block (```json ... ```). Do not include any other text.",
  ].join("\n")
}

/**
 * Extract the JSON graph from an LLM response that may include a fenced code
 * block (```json ... ```) or bare JSON. Returns null if no valid JSON with at
 * least one valid node is found.
 */
export function parseGraphResponse(text: string): PipelineGraph | null {
  if (typeof text !== "string") return null
  let candidate = ""
  // Try fenced code block first
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenceMatch) {
    candidate = fenceMatch[1].trim()
  } else {
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start === -1 || end === -1 || end <= start) return null
    candidate = text.slice(start, end + 1)
  }
  let parsed: any
  try {
    parsed = JSON.parse(candidate)
  } catch {
    return null
  }
  return normalizeGraph(parsed)
}

/**
 * Coerce a raw object into a typed graph. Drops nodes with unknown types or
 * missing ids. Returns null if the result has zero valid nodes.
 */
export function normalizeGraph(raw: any): PipelineGraph | null {
  if (!raw || typeof raw !== "object") return null
  const nodes: PipelineNode[] = []
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : []
  for (const n of rawNodes) {
    if (!n || typeof n !== "object") continue
    if (typeof n.type !== "string") continue
    if (!getNodeType(n.type)) continue
    const id = typeof n.id === "string" && n.id.length > 0 ? n.id : `n${nodes.length + 1}`
    nodes.push({
      id,
      type: n.type,
      x: typeof n.x === "number" ? n.x : 80,
      y: typeof n.y === "number" ? n.y : 80 + nodes.length * 100,
      props: n.props && typeof n.props === "object" ? { ...n.props } : {},
    })
  }
  if (nodes.length === 0) return null
  const ids = new Set(nodes.map((n) => n.id))
  const edges: PipelineEdge[] = []
  const rawEdges = Array.isArray(raw.edges) ? raw.edges : []
  for (const e of rawEdges) {
    if (!e || typeof e !== "object") continue
    if (typeof e.from !== "string" || typeof e.to !== "string") continue
    if (!ids.has(e.from) || !ids.has(e.to)) continue
    edges.push({
      id: typeof e.id === "string" && e.id.length > 0 ? e.id : `e${edges.length + 1}`,
      from: e.from,
      to: e.to,
    })
  }
  return { nodes, edges }
}

export async function generateGraphFromDescription(
  description: string,
): Promise<PipelineGraph> {
  const provider = getLlmProvider()
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildGenerateGraphPrompt(description)
  const raw = await provider.complete({ systemPrompt, userPrompt })
  const graph = parseGraphResponse(raw)
  if (!graph) return fallbackGraph(description)
  return graph
}

/**
 * Minimal valid graph used when the LLM response is unparseable. Keeps the
 * UI demoable offline.
 */
export function fallbackGraph(description: string): PipelineGraph {
  return {
    nodes: [
      {
        id: "n1",
        type: "trigger",
        x: 80,
        y: 80,
        props: { events: ["push"], branch: "main" },
      },
      { id: "n2", type: "checkout", x: 80, y: 180, props: {} },
      { id: "n3", type: "install", x: 80, y: 280, props: { command: "npm ci" } },
      { id: "n4", type: "test", x: 80, y: 380, props: { command: "npm test" } },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2" },
      { id: "e2", from: "n2", to: "n3" },
      { id: "e3", from: "n3", to: "n4" },
    ],
  }
}
