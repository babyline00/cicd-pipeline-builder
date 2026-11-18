import { test, expect, describe } from "bun:test"
import {
  compileToYaml,
  compileNode,
  assertYamlLooksValid,
  type SecretRef,
} from "../yaml-compiler"
import type { PipelineGraph, PipelineNode } from "../node-types"

function linearGraph(nodes: PipelineNode[]): PipelineGraph {
  const edges = []
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ id: `e${i + 1}`, from: nodes[i].id, to: nodes[i + 1].id })
  }
  return { nodes, edges }
}

describe("compileToYaml — basic structure", () => {
  test("empty graph still produces a valid YAML skeleton", () => {
    const yaml = compileToYaml({ nodes: [], edges: [] })
    expect(yaml).toContain("name: CI")
    expect(yaml).toContain("on: [push]")
    expect(yaml).toContain("jobs:")
    expect(yaml).toContain("runs-on: ubuntu-latest")
    expect(yaml).toContain("steps:")
  })

  test("trigger -> on: section with push event", () => {
    const g = linearGraph([
      { id: "t", type: "trigger", x: 0, y: 0, props: { events: ["push"], branch: "main" } },
      { id: "c", type: "checkout", x: 0, y: 100, props: {} },
    ])
    const yaml = compileToYaml(g)
    expect(yaml).toMatch(/on:\s*\n\s+push:\s*\n\s+branches:\s*\[main\]/)
  })

  test("trigger with multiple events emits all", () => {
    const g = linearGraph([
      { id: "t", type: "trigger", x: 0, y: 0, props: { events: ["push", "pull_request"], branch: "main" } },
      { id: "c", type: "checkout", x: 0, y: 100, props: {} },
    ])
    const yaml = compileToYaml(g)
    expect(yaml).toContain("push:")
    expect(yaml).toContain("pull_request:")
  })

  test("trigger with schedule event emits cron", () => {
    const g = linearGraph([
      { id: "t", type: "trigger", x: 0, y: 0, props: { events: ["schedule"], branch: "main" } },
      { id: "c", type: "checkout", x: 0, y: 100, props: {} },
    ])
    const yaml = compileToYaml(g)
    expect(yaml).toContain("schedule:")
    expect(yaml).toContain("cron:")
  })

  test("trigger with workflow_dispatch event", () => {
    const g = linearGraph([
      { id: "t", type: "trigger", x: 0, y: 0, props: { events: ["workflow_dispatch"], branch: "main" } },
      { id: "c", type: "checkout", x: 0, y: 100, props: {} },
    ])
    const yaml = compileToYaml(g)
    expect(yaml).toContain("workflow_dispatch:")
  })
})

describe("compileToYaml — node steps", () => {
  test("checkout -> uses: actions/checkout@v4", () => {
    const yaml = compileNode({ id: "c", type: "checkout", x: 0, y: 0, props: {} })
    expect(yaml).toContain("uses: actions/checkout@v4")
  })

  test("setup-node -> version + smart cache", () => {
    const yaml = compileNode({
      id: "s", type: "setup-node", x: 0, y: 0,
      props: { nodeVersion: "20", cache: "npm", matrix: [] },
    })
    expect(yaml).toContain("uses: actions/setup-node@v4")
    expect(yaml).toContain("node-version: '20'")
    expect(yaml).toContain("cache: 'npm'") // smart caching
  })

  test("setup-python -> version + smart pip cache", () => {
    const yaml = compileNode({
      id: "s", type: "setup-python", x: 0, y: 0,
      props: { pythonVersion: "3.11", cache: "pip", matrix: [] },
    })
    expect(yaml).toContain("uses: actions/setup-python@v5")
    expect(yaml).toContain("python-version: '3.11'")
    expect(yaml).toContain("cache: 'pip'")
  })

  test("setup-go -> version + cache true", () => {
    const yaml = compileNode({
      id: "s", type: "setup-go", x: 0, y: 0,
      props: { goVersion: "1.21", cache: "go-modules", matrix: [] },
    })
    expect(yaml).toContain("uses: actions/setup-go@v5")
    expect(yaml).toContain("go-version: '1.21'")
    expect(yaml).toContain("cache: true")
  })

  test("install -> run: npm ci", () => {
    const yaml = compileNode({ id: "i", type: "install", x: 0, y: 0, props: { command: "npm ci" } })
    expect(yaml).toContain("run: npm ci")
  })

  test("lint -> run: npm run lint", () => {
    const yaml = compileNode({ id: "l", type: "lint", x: 0, y: 0, props: { command: "npm run lint" } })
    expect(yaml).toContain("run: npm run lint")
  })

  test("test -> run: npm test", () => {
    const yaml = compileNode({ id: "t", type: "test", x: 0, y: 0, props: { command: "npm test" } })
    expect(yaml).toContain("run: npm test")
  })

  test("build -> run: npm run build", () => {
    const yaml = compileNode({ id: "b", type: "build", x: 0, y: 0, props: { command: "npm run build" } })
    expect(yaml).toContain("run: npm run build")
  })

  test("deploy-vercel -> secrets reference ${{ secrets.VERCEL_TOKEN }}", () => {
    const yaml = compileNode({
      id: "d", type: "deploy-vercel", x: 0, y: 0,
      props: { token: "VERCEL_TOKEN", prod: true },
    })
    expect(yaml).toContain("${{ secrets.VERCEL_TOKEN }}")
    expect(yaml).toContain("--prod")
  })

  test("deploy-fly -> secrets reference", () => {
    const yaml = compileNode({
      id: "d", type: "deploy-fly", x: 0, y: 0,
      props: { app: "my-app", region: "iad", token: "FLY_API_TOKEN" },
    })
    expect(yaml).toContain("${{ secrets.FLY_API_TOKEN }}")
    expect(yaml).toContain("fly deploy")
  })

  test("deploy-aws -> secrets reference", () => {
    const yaml = compileNode({
      id: "d", type: "deploy-aws", x: 0, y: 0,
      props: {
        region: "us-east-1", service: "ecs",
        accessKeyId: "AWS_ACCESS_KEY_ID", secretAccessKey: "AWS_SECRET_ACCESS_KEY",
      },
    })
    expect(yaml).toContain("${{ secrets.AWS_ACCESS_KEY_ID }}")
    expect(yaml).toContain("${{ secrets.AWS_SECRET_ACCESS_KEY }}")
    expect(yaml).toContain("aws-region: us-east-1")
  })

  test("notify-slack -> uses: slackapi/slack-post@v1", () => {
    const yaml = compileNode({
      id: "n", type: "notify-slack", x: 0, y: 0,
      props: { channel: "#deploys", webhook: "SLACK_WEBHOOK_URL" },
    })
    expect(yaml).toContain("uses: slackapi/slack-post@v1")
    expect(yaml).toContain("${{ secrets.SLACK_WEBHOOK_URL }}")
  })

  test("notify-email -> run block", () => {
    const yaml = compileNode({
      id: "n", type: "notify-email", x: 0, y: 0,
      props: { to: "team@x.com", subject: "Done" },
    })
    expect(yaml).toContain("team@x.com")
    expect(yaml).toContain("Done")
  })
})

describe("compileToYaml — matrix expansion", () => {
  test("setup-node with matrix emits strategy.matrix + reference", () => {
    const g = linearGraph([
      { id: "t", type: "trigger", x: 0, y: 0, props: { events: ["push"], branch: "main" } },
      { id: "c", type: "checkout", x: 0, y: 100, props: {} },
      {
        id: "s", type: "setup-node", x: 0, y: 200,
        props: { nodeVersion: "20", cache: "npm", matrix: { "node-version": [18, 20, 22] } },
      },
      { id: "i", type: "install", x: 0, y: 300, props: { command: "npm ci" } },
    ])
    const yaml = compileToYaml(g)
    expect(yaml).toContain("strategy:")
    expect(yaml).toContain("matrix:")
    expect(yaml).toContain("node-version: [18, 20, 22]")
    expect(yaml).toContain("${{ matrix.node-version }}")
  })

  test("setup-python with matrix emits strategy.matrix", () => {
    const g = linearGraph([
      { id: "t", type: "trigger", x: 0, y: 0, props: { events: ["push"], branch: "main" } },
      {
        id: "s", type: "setup-python", x: 0, y: 100,
        props: { pythonVersion: "3.11", cache: "pip", matrix: { "python-version": ["3.10", "3.11", "3.12"] } },
      },
    ])
    const yaml = compileToYaml(g)
    expect(yaml).toContain("python-version: ['3.10', '3.11', '3.12']")
    expect(yaml).toContain("${{ matrix.python-version }}")
  })

  test("no matrix -> no strategy block", () => {
    const g = linearGraph([
      { id: "t", type: "trigger", x: 0, y: 0, props: { events: ["push"], branch: "main" } },
      {
        id: "s", type: "setup-node", x: 0, y: 100,
        props: { nodeVersion: "20", cache: "npm", matrix: [] },
      },
    ])
    const yaml = compileToYaml(g)
    expect(yaml).not.toContain("strategy:")
    expect(yaml).toContain("node-version: '20'") // literal, not matrix ref
  })
})

describe("compileToYaml — secrets block", () => {
  test("secrets list appended as comment", () => {
    const g = linearGraph([
      { id: "t", type: "trigger", x: 0, y: 0, props: { events: ["push"], branch: "main" } },
      { id: "d", type: "deploy-vercel", x: 0, y: 100, props: { token: "VERCEL_TOKEN", prod: true } },
    ])
    const secrets: SecretRef[] = [
      { name: "VERCEL_TOKEN", description: "Vercel deploy token" },
    ]
    const yaml = compileToYaml(g, secrets)
    expect(yaml).toContain("# Required secrets")
    expect(yaml).toContain("# - VERCEL_TOKEN: Vercel deploy token")
  })

  test("secrets extracted from yaml when not provided", () => {
    const g = linearGraph([
      { id: "t", type: "trigger", x: 0, y: 0, props: { events: ["push"], branch: "main" } },
      { id: "d", type: "deploy-vercel", x: 0, y: 100, props: { token: "VERCEL_TOKEN", prod: true } },
    ])
    const yaml = compileToYaml(g) // no secrets arg
    expect(yaml).toContain("# Required secrets")
    expect(yaml).toContain("VERCEL_TOKEN")
  })
})

describe("assertYamlLooksValid", () => {
  test("valid YAML returns ok", () => {
    const yaml = compileToYaml(linearGraph([
      { id: "t", type: "trigger", x: 0, y: 0, props: { events: ["push"], branch: "main" } },
      { id: "c", type: "checkout", x: 0, y: 100, props: {} },
    ]))
    const r = assertYamlLooksValid(yaml)
    expect(r.ok).toBe(true)
  })

  test("empty string fails", () => {
    expect(assertYamlLooksValid("").ok).toBe(false)
  })

  test("missing name fails", () => {
    expect(assertYamlLooksValid("on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:").ok).toBe(false)
  })

  test("missing on fails", () => {
    expect(assertYamlLooksValid("name: CI\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:").ok).toBe(false)
  })
})
