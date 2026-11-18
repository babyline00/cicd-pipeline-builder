/**
 * Deterministic mock simulator. Walks the graph in topological order and
 * produces a fake log line per node. The RNG seed is derived from the node id
 * so the same graph always produces the same logs (useful for snapshot tests
 * and for reproducible "Simulate run" results in the UI).
 *
 * Each log entry has: nodeId, nodeType, output, durationMs, success.
 *
 * Heuristics:
 *   - trigger   log mentions the event type (e.g. "received event: push")
 *   - checkout  mentions fetch-depth
 *   - setup-*   mentions the version + cache
 *   - install   mentions package count
 *   - lint/test mention pass/fail counts (some deterministically fail to
 *               exercise the failure-render path of the terminal UI)
 *   - deploy-*  mention "deployed"
 *   - notify-*  mention the channel/recipient
 */

import type { PipelineGraph, PipelineNode } from "./node-types"
import { topologicalSort } from "./graph-validator"

export interface SimulationLog {
  nodeId: string
  nodeType: string
  output: string
  durationMs: number
  success: boolean
}

export interface SimulationResult {
  logs: SimulationLog[]
  success: boolean
  totalDurationMs: number
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const BASE_DURATIONS: Record<string, number> = {
  trigger: 120,
  checkout: 850,
  "setup-node": 2400,
  "setup-python": 2100,
  "setup-go": 1900,
  install: 4200,
  lint: 1800,
  test: 6500,
  build: 5200,
  "deploy-vercel": 3800,
  "deploy-fly": 4100,
  "deploy-aws": 6200,
  "notify-slack": 320,
  "notify-email": 280,
}

function mockDuration(node: PipelineNode): number {
  const base = BASE_DURATIONS[node.type] ?? 1000
  const jitter = hashString(node.id) % 600
  return base + jitter
}

function mockOutput(node: PipelineNode): { output: string; success: boolean } {
  switch (node.type) {
    case "trigger": {
      const events = (node.props.events ?? ["push"]).join(", ")
      return {
        output: `[trigger] received event: ${events} on branch ${node.props.branch ?? "main"}`,
        success: true,
      }
    }
    case "checkout": {
      return {
        output: `[checkout] cloned repository @ HEAD into /workspace; fetch-depth=${node.props.fetchDepth ?? 1}`,
        success: true,
      }
    }
    case "setup-node": {
      return {
        output: `[setup-node] installed Node.js ${node.props.nodeVersion ?? "20"}; cache=${node.props.cache ?? "npm"}; npm cache restored from runner cache`,
        success: true,
      }
    }
    case "setup-python": {
      return {
        output: `[setup-python] installed Python ${node.props.pythonVersion ?? "3.11"}; cache=${node.props.cache ?? "pip"}; pip cache restored`,
        success: true,
      }
    }
    case "setup-go": {
      return {
        output: `[setup-go] installed Go ${node.props.goVersion ?? "1.21"}; module cache restored`,
        success: true,
      }
    }
    case "install": {
      return {
        output: `[install] ran \`${node.props.command ?? "npm ci"}\` — 412 packages installed`,
        success: true,
      }
    }
    case "lint": {
      const ok = hashString(node.id) % 5 !== 0
      return {
        output: ok
          ? `[lint] ran \`${node.props.command ?? "npm run lint"}\` — 0 errors, 0 warnings`
          : `[lint] ran \`${node.props.command ?? "npm run lint"}\` — 1 error: unused variable in src/foo.ts`,
        success: ok,
      }
    }
    case "test": {
      const ok = hashString(node.id) % 7 !== 0
      return {
        output: ok
          ? `[test] ran \`${node.props.command ?? "npm test"}\` — 42 passed, 0 failed`
          : `[test] ran \`${node.props.command ?? "npm test"}\` — 41 passed, 1 failed (timeout)`,
        success: ok,
      }
    }
    case "build": {
      return {
        output: `[build] ran \`${node.props.command ?? "npm run build"}\` — artifacts emitted to dist/`,
        success: true,
      }
    }
    case "deploy-vercel": {
      return {
        output: `[deploy-vercel] deployed to Vercel ${node.props.prod !== false ? "production" : "preview"} (token=${node.props.token ?? "VERCEL_TOKEN"}) — URL: https://my-app.vercel.app`,
        success: true,
      }
    }
    case "deploy-fly": {
      return {
        output: `[deploy-fly] deployed to Fly.io app=${node.props.app || "my-app"} region=${node.props.region ?? "iad"} — deployed`,
        success: true,
      }
    }
    case "deploy-aws": {
      return {
        output: `[deploy-aws] deployed to AWS ${node.props.service ?? "ecs"} in ${node.props.region ?? "us-east-1"} — deployed`,
        success: true,
      }
    }
    case "notify-slack": {
      return {
        output: `[notify-slack] posted message to ${node.props.channel ?? "#deployments"} — deployed`,
        success: true,
      }
    }
    case "notify-email": {
      return {
        output: `[notify-email] sent email to ${node.props.to ?? "(unset)"} subject="${node.props.subject ?? "Pipeline complete"}"`,
        success: true,
      }
    }
    default: {
      return { output: `[${node.type}] ran`, success: true }
    }
  }
}

export function simulateRun(graph: PipelineGraph): SimulationResult {
  const ordered = topologicalSort(graph)
  const logs: SimulationLog[] = []
  let totalDurationMs = 0
  let allSuccess = true
  for (const node of ordered) {
    const dur = mockDuration(node)
    const { output, success } = mockOutput(node)
    logs.push({
      nodeId: node.id,
      nodeType: node.type,
      output,
      durationMs: dur,
      success,
    })
    totalDurationMs += dur
    if (!success) allSuccess = false
  }
  return { logs, success: allSuccess, totalDurationMs }
}

export function formatLogsAsText(result: SimulationResult): string {
  const lines: string[] = []
  lines.push(`# Simulation started — ${result.logs.length} node(s)`)
  lines.push(`# Total duration: ${result.totalDurationMs}ms`)
  lines.push(`# Result: ${result.success ? "SUCCESS" : "FAILURE"}`)
  lines.push(``)
  for (const log of result.logs) {
    const status = log.success ? "OK" : "FAIL"
    lines.push(`[${status}] ${log.nodeType} (${log.nodeId}) — ${log.durationMs}ms`)
    for (const line of log.output.split("\n")) {
      lines.push(`  ${line}`)
    }
    lines.push(``)
  }
  return lines.join("\n")
}
