/**
 * Graph validation utilities. Used by the API routes to reject invalid
 * pipeline graphs before persisting and by the simulator to short-circuit
 * on cyclic graphs. Also provides topological sort for ordered execution.
 */

import type {
  PipelineGraph,
  PipelineNode,
  PipelineEdge,
} from "./node-types"
import { isValidNodeType } from "./node-types"

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateGraph(graph: any): ValidationResult {
  const errors: string[] = []
  if (!graph || typeof graph !== "object") {
    return { valid: false, errors: ["Graph is not an object."] }
  }
  if (!Array.isArray(graph.nodes)) {
    return { valid: false, errors: ["Graph.nodes is not an array."] }
  }
  if (graph.nodes.length === 0) {
    errors.push("Graph has no nodes.")
  }
  // node-level checks
  const ids = new Set<string>()
  for (const n of graph.nodes) {
    if (!n || typeof n !== "object") {
      errors.push(`Invalid node: ${JSON.stringify(n)}`)
      continue
    }
    if (!n.id || typeof n.id !== "string") {
      errors.push(`Node missing id.`)
      continue
    }
    if (ids.has(n.id)) {
      errors.push(`Duplicate node id: ${n.id}`)
      continue
    }
    ids.add(n.id)
    if (!isValidNodeType(n.type)) {
      errors.push(`Unknown node type: ${n.type} (id=${n.id})`)
    }
    if (typeof n.x !== "number" || typeof n.y !== "number") {
      errors.push(`Node ${n.id} missing x/y coordinates.`)
    }
    if (!n.props || typeof n.props !== "object") {
      errors.push(`Node ${n.id} missing props.`)
    }
  }
  // must have exactly one trigger node
  const triggers = graph.nodes.filter(
    (n: any) => n && n.type === "trigger",
  )
  if (triggers.length === 0) errors.push("Graph must have a trigger node.")
  if (triggers.length > 1)
    errors.push("Graph must have exactly one trigger node.")
  // edge checks
  if (!Array.isArray(graph.edges)) {
    errors.push("Graph.edges is not an array.")
    return { valid: errors.length === 0, errors }
  }
  for (const e of graph.edges) {
    if (!e || typeof e !== "object") {
      errors.push(`Invalid edge: ${JSON.stringify(e)}`)
      continue
    }
    if (!e.id || !e.from || !e.to) {
      errors.push(`Edge missing id/from/to: ${JSON.stringify(e)}`)
      continue
    }
    if (!ids.has(e.from))
      errors.push(`Edge ${e.id} references missing from node: ${e.from}`)
    if (!ids.has(e.to))
      errors.push(`Edge ${e.id} references missing to node: ${e.to}`)
    if (e.from === e.to) errors.push(`Edge ${e.id} is a self-loop.`)
  }
  // cycle detection (DFS)
  const adj = new Map<string, string[]>()
  for (const n of graph.nodes) adj.set(n.id, [])
  for (const e of graph.edges) {
    if (adj.has(e.from) && adj.has(e.to)) adj.get(e.from)!.push(e.to)
  }
  if (detectCycle(adj)) errors.push("Graph contains a cycle.")
  return { valid: errors.length === 0, errors }
}

export function detectCycle(adj: Map<string, string[]>): boolean {
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2
  const color = new Map<string, number>()
  for (const k of adj.keys()) color.set(k, WHITE)
  let foundCycle = false
  const dfs = (u: string): boolean => {
    color.set(u, GRAY)
    for (const v of adj.get(u) ?? []) {
      const cv = color.get(v) ?? WHITE
      if (cv === GRAY) return true
      if (cv === WHITE && dfs(v)) return true
    }
    color.set(u, BLACK)
    return false
  }
  for (const k of adj.keys()) {
    if (color.get(k) === WHITE) {
      if (dfs(k)) {
        foundCycle = true
        break
      }
    }
  }
  return foundCycle
}

/**
 * Kahn's algorithm. Returns nodes in execution order. Ties (when multiple
 * nodes have in-degree 0) are broken by node id (stable, deterministic).
 */
export function topologicalSort(graph: PipelineGraph): PipelineNode[] {
  const adj = new Map<string, string[]>()
  for (const n of graph.nodes) adj.set(n.id, [])
  const indeg = new Map<string, number>()
  for (const n of graph.nodes) indeg.set(n.id, 0)
  for (const e of graph.edges) {
    if (adj.has(e.from) && adj.has(e.to)) {
      adj.get(e.from)!.push(e.to)
      indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
    }
  }
  const q: string[] = []
  for (const [k, d] of indeg.entries()) if (d === 0) q.push(k)
  q.sort()
  const order: PipelineNode[] = []
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  while (q.length) {
    const u = q.shift()!
    const node = byId.get(u)
    if (node) order.push(node)
    const next: string[] = []
    for (const v of adj.get(u) ?? []) {
      indeg.set(v, (indeg.get(v) ?? 1) - 1)
      if (indeg.get(v) === 0) next.push(v)
    }
    next.sort()
    q.push(...next)
  }
  return order
}

export function isAcyclic(graph: PipelineGraph): boolean {
  const adj = new Map<string, string[]>()
  for (const n of graph.nodes) adj.set(n.id, [])
  for (const e of graph.edges) {
    if (adj.has(e.from) && adj.has(e.to)) adj.get(e.from)!.push(e.to)
  }
  return !detectCycle(adj)
}

export function makeEdge(
  from: string,
  to: string,
  id?: string,
): PipelineEdge {
  return { id: id ?? `e_${from}_${to}`, from, to }
}
