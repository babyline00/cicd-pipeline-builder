/**
 * Matrix expansion helpers.
 *
 * A node's `matrix` prop is either:
 *   - an empty array `[]` (no matrix — the node runs once), or
 *   - an object `{ axisName: [v1, v2, ...] }` (run the node once per value).
 *
 * Multi-axis matrices expand as a cartesian product. The YAML compiler
 * collects all axes across all nodes and emits them under `strategy.matrix`
 * at the job level. Each step references `${{ matrix.axisName }}`.
 */

import type { PipelineNode } from "./node-types"

export interface MatrixVariant {
  [key: string]: string | number
}

export interface MatrixAxis {
  key: string
  values: (string | number)[]
}

/** Return the matrix axes declared on a node (or [] if none). */
export function getMatrixAxes(node: PipelineNode): MatrixAxis[] {
  const matrix = node?.props?.matrix
  if (!matrix || typeof matrix !== "object" || Array.isArray(matrix)) return []
  const axes: MatrixAxis[] = []
  for (const [k, v] of Object.entries(matrix)) {
    if (Array.isArray(v) && v.length > 0) {
      axes.push({ key: k, values: v as any[] })
    }
  }
  return axes
}

export function hasMatrix(node: PipelineNode): boolean {
  return getMatrixAxes(node).length > 0
}

/**
 * Expand a node's matrix into an array of step variants.
 * Empty/missing matrix -> a single empty variant `[{}]` (node runs once).
 * `{ 'node-version': [18, 20, 22] }` -> 3 variants.
 * `{ a: [1, 2], b: ['x', 'y'] }` -> 4 variants (cartesian product).
 */
export function expandMatrix(node: PipelineNode): MatrixVariant[] {
  const axes = getMatrixAxes(node)
  if (axes.length === 0) return [{}]
  let variants: MatrixVariant[] = [{}]
  for (const axis of axes) {
    const next: MatrixVariant[] = []
    for (const base of variants) {
      for (const v of axis.values) {
        next.push({ ...base, [axis.key]: v })
      }
    }
    variants = next
  }
  return variants
}

/**
 * Emit a YAML `matrix:` block string for a node's axes.
 * Empty/missing matrix -> ''.
 *
 * Example output (indent='    '):
 *     matrix:
 *       node-version: [18, 20, 22]
 */
export function matrixYamlBlock(node: PipelineNode, indent = "    "): string {
  const axes = getMatrixAxes(node)
  if (axes.length === 0) return ""
  const lines = [`${indent}matrix:`]
  for (const a of axes) {
    const arr = a.values
      .map((x) => (typeof x === "string" ? `'${x}'` : String(x)))
      .join(", ")
    lines.push(`${indent}  ${a.key}: [${arr}]`)
  }
  return lines.join("\n")
}

/**
 * Collect all matrix axes declared across a list of nodes. Returns an object
 * keyed by axis name; later declarations of the same axis override earlier
 * ones (MVP single-job behavior — multi-job matrix is a stretch goal).
 */
export function collectMatrixAxes(
  nodes: PipelineNode[],
): Record<string, (string | number)[]> {
  const out: Record<string, (string | number)[]> = {}
  for (const n of nodes) {
    for (const axis of getMatrixAxes(n)) {
      out[axis.key] = axis.values
    }
  }
  return out
}
