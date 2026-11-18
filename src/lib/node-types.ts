/**
 * Node type registry for the CI/CD pipeline builder.
 *
 * Each node type has:
 *   - id            stable identifier (used in graph JSON + YAML compiler switch)
 *   - label         human-readable name shown in the palette + canvas
 *   - color         hex color used to render the SVG node on the canvas
 *   - category      group in the palette (trigger/source/setup/build/deploy/notify)
 *   - icon          lucide icon name
 *   - description   short tooltip text
 *   - defaultProps  props applied when a new node is dropped on the canvas
 *   - propertySchema  editable fields shown in the properties panel
 *
 * The registry is a single source of truth: the SVG canvas, properties panel,
 * YAML compiler, simulator and LLM prompt builder all read from this list.
 */

export type NodeCategory =
  | "trigger"
  | "source"
  | "setup"
  | "build"
  | "deploy"
  | "notify"

export type PropertyType =
  | "string"
  | "number"
  | "boolean"
  | "select"
  | "list"

export interface PropertySchema {
  key: string
  label: string
  type: PropertyType
  required?: boolean
  options?: string[]
  default?: any
  description?: string
}

export interface NodeTypeDefinition {
  id: string
  label: string
  color: string
  category: NodeCategory
  icon: string
  description: string
  defaultProps: Record<string, any>
  propertySchema: PropertySchema[]
}

export interface PipelineNode {
  id: string
  type: string
  x: number
  y: number
  props: Record<string, any>
}

export interface PipelineEdge {
  id: string
  from: string
  to: string
}

export interface PipelineGraph {
  nodes: PipelineNode[]
  edges: PipelineEdge[]
}

export const NODE_TYPES: NodeTypeDefinition[] = [
  // ---- trigger ----
  {
    id: "trigger",
    label: "Trigger",
    color: "#f59e0b",
    category: "trigger",
    icon: "Zap",
    description: "Pipeline trigger event (push, pull_request, workflow_dispatch, schedule).",
    defaultProps: { events: ["push"], branch: "main" },
    propertySchema: [
      {
        key: "events",
        label: "Events",
        type: "list",
        default: ["push"],
        description: "GitHub event types that trigger this pipeline (comma-separated).",
      },
      {
        key: "branch",
        label: "Branch",
        type: "string",
        default: "main",
        description: "Branch filter for push/pull_request events.",
      },
    ],
  },
  // ---- source ----
  {
    id: "checkout",
    label: "Checkout",
    color: "#64748b",
    category: "source",
    icon: "GitBranch",
    description: "actions/checkout@v4 — clone the repo into the runner workspace.",
    defaultProps: { ref: "${{ github.ref }}", fetchDepth: 1 },
    propertySchema: [
      { key: "ref", label: "Ref", type: "string", default: "${{ github.ref }}" },
      { key: "fetchDepth", label: "Fetch depth", type: "number", default: 1 },
    ],
  },
  // ---- setup ----
  {
    id: "setup-node",
    label: "Setup Node.js",
    color: "#10b981",
    category: "setup",
    icon: "Package",
    description: "actions/setup-node@v4 — install Node.js with smart npm cache.",
    defaultProps: { nodeVersion: "20", cache: "npm", matrix: [] },
    propertySchema: [
      { key: "nodeVersion", label: "Node version", type: "string", default: "20", required: true },
      { key: "cache", label: "Cache manager", type: "select", options: ["npm", "yarn", "pnpm"], default: "npm" },
      { key: "matrix", label: "Matrix versions", type: "list", default: [], description: 'e.g. { "node-version": [18, 20, 22] }' },
    ],
  },
  {
    id: "setup-python",
    label: "Setup Python",
    color: "#10b981",
    category: "setup",
    icon: "Package",
    description: "actions/setup-python@v5 — install Python with smart pip cache.",
    defaultProps: { pythonVersion: "3.11", cache: "pip", matrix: [] },
    propertySchema: [
      { key: "pythonVersion", label: "Python version", type: "string", default: "3.11", required: true },
      { key: "cache", label: "Cache manager", type: "select", options: ["pip", "poetry", "pipenv"], default: "pip" },
      { key: "matrix", label: "Matrix versions", type: "list", default: [] },
    ],
  },
  {
    id: "setup-go",
    label: "Setup Go",
    color: "#10b981",
    category: "setup",
    icon: "Package",
    description: "actions/setup-go@v5 — install Go with smart module cache.",
    defaultProps: { goVersion: "1.21", cache: "go-modules", matrix: [] },
    propertySchema: [
      { key: "goVersion", label: "Go version", type: "string", default: "1.21", required: true },
      { key: "cache", label: "Cache manager", type: "select", options: ["go-modules", "none"], default: "go-modules" },
      { key: "matrix", label: "Matrix versions", type: "list", default: [] },
    ],
  },
  // ---- build ----
  {
    id: "install",
    label: "Install deps",
    color: "#14b8a6",
    category: "build",
    icon: "Download",
    description: "Install project dependencies (e.g. npm ci).",
    defaultProps: { command: "npm ci" },
    propertySchema: [
      { key: "command", label: "Install command", type: "string", default: "npm ci" },
    ],
  },
  {
    id: "lint",
    label: "Lint",
    color: "#14b8a6",
    category: "build",
    icon: "Check",
    description: "Run linter (e.g. npm run lint).",
    defaultProps: { command: "npm run lint" },
    propertySchema: [
      { key: "command", label: "Lint command", type: "string", default: "npm run lint" },
    ],
  },
  {
    id: "test",
    label: "Test",
    color: "#14b8a6",
    category: "build",
    icon: "FlaskConical",
    description: "Run test suite (e.g. npm test).",
    defaultProps: { command: "npm test", matrix: [] },
    propertySchema: [
      { key: "command", label: "Test command", type: "string", default: "npm test" },
      { key: "matrix", label: "Matrix versions", type: "list", default: [] },
    ],
  },
  {
    id: "build",
    label: "Build",
    color: "#14b8a6",
    category: "build",
    icon: "Hammer",
    description: "Build artifacts (e.g. npm run build).",
    defaultProps: { command: "npm run build" },
    propertySchema: [
      { key: "command", label: "Build command", type: "string", default: "npm run build" },
    ],
  },
  // ---- deploy ----
  {
    id: "deploy-vercel",
    label: "Deploy Vercel",
    color: "#f43f5e",
    category: "deploy",
    icon: "Rocket",
    description: "Deploy to Vercel using VERCEL_TOKEN secret.",
    defaultProps: { token: "VERCEL_TOKEN", prod: true },
    propertySchema: [
      { key: "token", label: "Token secret name", type: "string", default: "VERCEL_TOKEN", required: true },
      { key: "prod", label: "Production deploy", type: "boolean", default: true },
    ],
  },
  {
    id: "deploy-fly",
    label: "Deploy Fly.io",
    color: "#f43f5e",
    category: "deploy",
    icon: "Rocket",
    description: "Deploy to Fly.io using FLY_API_TOKEN secret.",
    defaultProps: { app: "", region: "iad", token: "FLY_API_TOKEN" },
    propertySchema: [
      { key: "app", label: "Fly app name", type: "string", default: "" },
      { key: "region", label: "Region", type: "string", default: "iad" },
      { key: "token", label: "Token secret name", type: "string", default: "FLY_API_TOKEN", required: true },
    ],
  },
  {
    id: "deploy-aws",
    label: "Deploy AWS",
    color: "#f43f5e",
    category: "deploy",
    icon: "Cloud",
    description: "Deploy to AWS (ECS/S3/Lambda) using AWS_* secrets.",
    defaultProps: {
      region: "us-east-1",
      service: "ecs",
      accessKeyId: "AWS_ACCESS_KEY_ID",
      secretAccessKey: "AWS_SECRET_ACCESS_KEY",
    },
    propertySchema: [
      { key: "region", label: "AWS region", type: "string", default: "us-east-1" },
      { key: "service", label: "Service", type: "select", options: ["ecs", "s3", "lambda", "elastic-beanstalk"], default: "ecs" },
      { key: "accessKeyId", label: "Access key id secret", type: "string", default: "AWS_ACCESS_KEY_ID" },
      { key: "secretAccessKey", label: "Secret access key secret", type: "string", default: "AWS_SECRET_ACCESS_KEY" },
    ],
  },
  // ---- notify ----
  {
    id: "notify-slack",
    label: "Notify Slack",
    color: "#8b5cf6",
    category: "notify",
    icon: "MessageSquare",
    description: "Post a message to Slack using SLACK_WEBHOOK_URL secret.",
    defaultProps: { channel: "#deployments", webhook: "SLACK_WEBHOOK_URL" },
    propertySchema: [
      { key: "channel", label: "Channel", type: "string", default: "#deployments" },
      { key: "webhook", label: "Webhook secret name", type: "string", default: "SLACK_WEBHOOK_URL", required: true },
    ],
  },
  {
    id: "notify-email",
    label: "Notify Email",
    color: "#8b5cf6",
    category: "notify",
    icon: "Mail",
    description: "Send an email notification (mock).",
    defaultProps: { to: "", subject: "Pipeline complete" },
    propertySchema: [
      { key: "to", label: "To", type: "string", default: "" },
      { key: "subject", label: "Subject", type: "string", default: "Pipeline complete" },
    ],
  },
]

export const NODE_CATEGORIES: { id: NodeCategory; label: string }[] = [
  { id: "trigger", label: "Trigger" },
  { id: "source", label: "Source" },
  { id: "setup", label: "Setup" },
  { id: "build", label: "Build" },
  { id: "deploy", label: "Deploy" },
  { id: "notify", label: "Notify" },
]

export function getNodeTypes(): NodeTypeDefinition[] {
  return NODE_TYPES
}

export function getNodeType(id: string): NodeTypeDefinition | undefined {
  return NODE_TYPES.find((t) => t.id === id)
}

export function isValidNodeType(id: string): boolean {
  return NODE_TYPES.some((t) => t.id === id)
}

export function validateNode(node: any): node is PipelineNode {
  if (!node || typeof node !== "object") return false
  if (typeof node.id !== "string" || node.id.length === 0) return false
  if (!isValidNodeType(node.type)) return false
  if (typeof node.x !== "number" || typeof node.y !== "number") return false
  if (!node.props || typeof node.props !== "object") return false
  return true
}

export function makeNode(
  type: string,
  id: string,
  x = 100,
  y = 100,
): PipelineNode {
  const def = getNodeType(type)
  const defaultProps = def ? structuredCloneSafe(def.defaultProps) : {}
  return { id, type, x, y, props: defaultProps }
}

function structuredCloneSafe(obj: Record<string, any>): Record<string, any> {
  return JSON.parse(JSON.stringify(obj))
}
