import { test, expect, describe } from "bun:test"
import { simulateRun, formatLogsAsText } from "../simulate"
import type { PipelineGraph, PipelineNode } from "../node-types"

function n(id: string, type: string, props: Record<string, any> = {}): PipelineNode {
  return { id, type, x: 0, y: 0, props }
}

function linear(nodes: PipelineNode[]): PipelineGraph {
  const edges = []
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ id: `e${i + 1}`, from: nodes[i].id, to: nodes[i + 1].id })
  }
  return { nodes, edges }
}

describe("simulateRun", () => {
  test("returns a log entry per node in topological order", () => {
    const g = linear([
      n("t", "trigger", { events: ["push"], branch: "main" }),
      n("c", "checkout"),
      n("i", "install", { command: "npm ci" }),
    ])
    const r = simulateRun(g)
    expect(r.logs).toHaveLength(3)
    const types = r.logs.map((l) => l.nodeType)
    expect(types).toEqual(["trigger", "checkout", "install"])
  })

  test("every log has nodeId, output, durationMs, success", () => {
    const g = linear([
      n("t", "trigger", { events: ["push"], branch: "main" }),
      n("c", "checkout"),
    ])
    const r = simulateRun(g)
    for (const log of r.logs) {
      expect(typeof log.nodeId).toBe("string")
      expect(log.nodeId.length).toBeGreaterThan(0)
      expect(typeof log.output).toBe("string")
      expect(log.output.length).toBeGreaterThan(0)
      expect(typeof log.durationMs).toBe("number")
      expect(log.durationMs).toBeGreaterThan(0)
      expect(typeof log.success).toBe("boolean")
    }
  })

  test("every node appears in the logs", () => {
    const g = linear([
      n("t", "trigger", { events: ["push"], branch: "main" }),
      n("c", "checkout"),
      n("i", "install"),
      n("l", "lint"),
      n("t2", "test"),
      n("b", "build"),
      n("d", "deploy-vercel", { token: "VERCEL_TOKEN", prod: true }),
      n("ns", "notify-slack", { channel: "#x", webhook: "SLACK_WEBHOOK_URL" }),
    ])
    const r = simulateRun(g)
    const ids = r.logs.map((l) => l.nodeId)
    for (const node of g.nodes) {
      expect(ids).toContain(node.id)
    }
  })

  test("trigger log mentions the event type", () => {
    const g = linear([
      n("t", "trigger", { events: ["push", "pull_request"], branch: "main" }),
      n("c", "checkout"),
    ])
    const r = simulateRun(g)
    const triggerLog = r.logs.find((l) => l.nodeType === "trigger")
    expect(triggerLog).toBeDefined()
    expect(triggerLog!.output).toContain("push")
    expect(triggerLog!.output).toContain("pull_request")
  })

  test("deploy-vercel log mentions 'deployed'", () => {
    const g = linear([
      n("t", "trigger", { events: ["push"], branch: "main" }),
      n("c", "checkout"),
      n("d", "deploy-vercel", { token: "VERCEL_TOKEN", prod: true }),
    ])
    const r = simulateRun(g)
    const deployLog = r.logs.find((l) => l.nodeType === "deploy-vercel")
    expect(deployLog).toBeDefined()
    expect(deployLog!.output.toLowerCase()).toContain("deployed")
  })

  test("deploy-fly log mentions 'deployed'", () => {
    const g = linear([
      n("t", "trigger", { events: ["push"], branch: "main" }),
      n("d", "deploy-fly", { app: "my-app", region: "iad", token: "FLY_API_TOKEN" }),
    ])
    const r = simulateRun(g)
    const deployLog = r.logs.find((l) => l.nodeType === "deploy-fly")
    expect(deployLog!.output.toLowerCase()).toContain("deployed")
  })

  test("deploy-aws log mentions 'deployed'", () => {
    const g = linear([
      n("t", "trigger", { events: ["push"], branch: "main" }),
      n("d", "deploy-aws", { region: "us-east-1", service: "ecs", accessKeyId: "AK", secretAccessKey: "SK" }),
    ])
    const r = simulateRun(g)
    const deployLog = r.logs.find((l) => l.nodeType === "deploy-aws")
    expect(deployLog!.output.toLowerCase()).toContain("deployed")
  })

  test("deterministic — same graph produces same logs", () => {
    const g = linear([
      n("t", "trigger", { events: ["push"], branch: "main" }),
      n("c", "checkout"),
      n("i", "install"),
    ])
    const r1 = simulateRun(g)
    const r2 = simulateRun(g)
    expect(r1).toEqual(r2)
  })

  test("totalDurationMs is the sum of per-node durations", () => {
    const g = linear([
      n("t", "trigger", { events: ["push"], branch: "main" }),
      n("c", "checkout"),
    ])
    const r = simulateRun(g)
    const sum = r.logs.reduce((s, l) => s + l.durationMs, 0)
    expect(r.totalDurationMs).toBe(sum)
  })

  test("empty graph returns empty logs and success=true", () => {
    const r = simulateRun({ nodes: [], edges: [] })
    expect(r.logs).toEqual([])
    expect(r.success).toBe(true)
    expect(r.totalDurationMs).toBe(0)
  })
})

describe("formatLogsAsText", () => {
  test("returns a non-empty string for a non-empty graph", () => {
    const g = linear([
      n("t", "trigger", { events: ["push"], branch: "main" }),
      n("c", "checkout"),
    ])
    const r = simulateRun(g)
    const text = formatLogsAsText(r)
    expect(typeof text).toBe("string")
    expect(text.length).toBeGreaterThan(0)
    expect(text).toContain("Simulation started")
    expect(text).toContain("trigger")
    expect(text).toContain("checkout")
  })

  test("includes the SUCCESS or FAILURE marker", () => {
    const g = linear([
      n("t", "trigger", { events: ["push"], branch: "main" }),
      n("c", "checkout"),
    ])
    const r = simulateRun(g)
    const text = formatLogsAsText(r)
    expect(text).toMatch(/(SUCCESS|FAILURE)/)
  })

  test("handles empty graph", () => {
    const r = simulateRun({ nodes: [], edges: [] })
    const text = formatLogsAsText(r)
    expect(text).toContain("0 node")
  })
})
