"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Zap, GitBranch, Package, Download, Check, FlaskConical, Hammer,
  Rocket, Cloud, MessageSquare, Mail, Save, Play, FileCode, Sparkles,
  Trash2, Plus, FolderOpen, Workflow, Copy, Loader2, Settings, Key,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  NODE_TYPES, NODE_CATEGORIES, getNodeType, makeNode,
  type PipelineGraph, type PipelineNode, type PropertySchema,
} from "@/lib/node-types"
import { topologicalSort } from "@/lib/graph-validator"
import { shortId } from "@/lib/utils"
import type { SecretRef } from "@/lib/yaml-compiler"
import type { SimulationResult } from "@/lib/simulate"

const ICONS: Record<string, any> = {
  Zap, GitBranch, Package, Download, Check, FlaskConical, Hammer,
  Rocket, Cloud, MessageSquare, Mail,
}

const NODE_W = 170
const NODE_H = 64
const VIEWBOX_W = 1200
const VIEWBOX_H = 800

// ---------- Canvas ----------

function Canvas({
  graph, selectedNodeId, onSelectNode, onMoveNode, onDropNode, onDeleteEdge,
}: {
  graph: PipelineGraph
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
  onMoveNode: (id: string, x: number, y: number) => void
  onDropNode: (type: string, x: number, y: number) => void
  onDeleteEdge: (id: string) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{
    nodeId: string
    offsetX: number
    offsetY: number
  } | null>(null)

  const toSvgCoords = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return { x: 0, y: 0 }
      const t = pt.matrixTransform(ctm.inverse())
      return { x: t.x, y: t.y }
    },
    [],
  )

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData("text/plain")
    if (!type) return
    const { x, y } = toSvgCoords(e.clientX, e.clientY)
    onDropNode(type, x - NODE_W / 2, y - NODE_H / 2)
  }

  const handleMouseDown = (e: React.MouseEvent, node: PipelineNode) => {
    e.stopPropagation()
    onSelectNode(node.id)
    const { x, y } = toSvgCoords(e.clientX, e.clientY)
    setDrag({ nodeId: node.id, offsetX: x - node.x, offsetY: y - node.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag) return
    const { x, y } = toSvgCoords(e.clientX, e.clientY)
    onMoveNode(drag.nodeId, x - drag.offsetX, y - drag.offsetY)
  }

  return (
    <div className="flex-1 canvas-grid relative min-w-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        className="w-full h-full"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
        }}
        onDrop={handleDrop}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
        onMouseDown={() => onSelectNode(null)}
      >
        {/* edges */}
        {graph.edges.map((edge) => {
          const from = graph.nodes.find((n) => n.id === edge.from)
          const to = graph.nodes.find((n) => n.id === edge.to)
          if (!from || !to) return null
          const fx = from.x + NODE_W / 2
          const fy = from.y + NODE_H
          const tx = to.x + NODE_W / 2
          const ty = to.y
          const path = `M ${fx},${fy} C ${fx},${fy + 28} ${tx},${ty - 28} ${tx},${ty}`
          return (
            <g key={edge.id}>
              <path
                d={path}
                stroke="#94a3b8"
                strokeWidth={2}
                fill="none"
                markerEnd="url(#arrow)"
              />
              <path
                d={path}
                stroke="transparent"
                strokeWidth={14}
                fill="none"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteEdge(edge.id)
                }}
              >
                <title>Click to delete edge</title>
              </path>
            </g>
          )
        })}
        {/* arrow marker */}
        <defs>
          <marker
            id="arrow"
            markerWidth="10"
            markerHeight="10"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
          </marker>
        </defs>
        {/* nodes */}
        {graph.nodes.map((node) => {
          const def = getNodeType(node.type)
          const selected = node.id === selectedNodeId
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseDown={(e) => handleMouseDown(e, node)}
              style={{ cursor: "move" }}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={def?.color ?? "#888"}
                fillOpacity={0.14}
                stroke={def?.color ?? "#888"}
                strokeWidth={selected ? 3 : 1.5}
              />
              <circle
                cx={16}
                cy={NODE_H / 2}
                r={5}
                fill={def?.color ?? "#888"}
              />
              <text
                x={30}
                y={26}
                fontSize="13"
                fontWeight={600}
                style={{ fill: "hsl(var(--foreground))" }}
              >
                {def?.label ?? node.type}
              </text>
              <text
                x={30}
                y={42}
                fontSize="10"
                style={{ fill: "hsl(var(--muted-foreground))" }}
              >
                {node.id.slice(0, 14)}
              </text>
              <text
                x={30}
                y={56}
                fontSize="9"
                style={{ fill: "hsl(var(--muted-foreground))" }}
              >
                {node.type}
              </text>
            </g>
          )
        })}
        {/* empty state */}
        {graph.nodes.length === 0 && (
          <text
            x={VIEWBOX_W / 2}
            y={VIEWBOX_H / 2}
            textAnchor="middle"
            fontSize="16"
            style={{ fill: "hsl(var(--muted-foreground))" }}
          >
            Drag a node from the palette to start building your pipeline.
          </text>
        )}
      </svg>
    </div>
  )
}

// ---------- Property field ----------

function PropertyField({
  schema,
  value,
  onChange,
}: {
  schema: PropertySchema
  value: any
  onChange: (v: any) => void
}) {
  const [text, setText] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (schema.type === "list") {
      try {
        setText(JSON.stringify(value ?? [], null, 2))
      } catch {
        setText("")
      }
    } else if (schema.type !== "boolean") {
      setText(value === undefined || value === null ? "" : String(value))
    }
    setError("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, schema.type, schema.key])

  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {schema.label}
        {schema.required && (
          <span className="text-destructive ml-1">*</span>
        )}
      </Label>
      {schema.description && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
      {schema.type === "boolean" ? (
        <Switch checked={!!value} onCheckedChange={onChange} />
      ) : schema.type === "select" ? (
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger className="w-full h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(schema.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : schema.type === "number" ? (
        <Input
          type="number"
          className="h-8"
          value={typeof value === "number" ? value : Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      ) : schema.type === "list" ? (
        <div className="space-y-1">
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              try {
                const parsed = JSON.parse(e.target.value)
                onChange(parsed)
                setError("")
              } catch {
                setError("Invalid JSON — kept previous value")
              }
            }}
            className="font-mono text-xs"
            rows={3}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <Input
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className="h-8"
        />
      )}
    </div>
  )
}

// ---------- Properties panel ----------

function PropertiesPanel({
  node,
  allNodes,
  onChangeProp,
  onDeleteNode,
  onAddEdge,
}: {
  node: PipelineNode | null
  allNodes: PipelineNode[]
  onChangeProp: (id: string, key: string, value: any) => void
  onDeleteNode: (id: string) => void
  onAddEdge: (from: string, to: string) => void
}) {
  const [edgeTarget, setEdgeTarget] = useState("")

  if (!node) {
    return (
      <div className="text-sm text-muted-foreground space-y-2">
        <Settings className="size-5" />
        <p>
          No node selected. Click a node on the canvas to edit its
          properties.
        </p>
      </div>
    )
  }
  const def = getNodeType(node.type)
  if (!def) return <div>Unknown node type: {node.type}</div>
  const Icon = ICONS[def.icon] ?? Package
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className="size-3 rounded-sm"
          style={{ background: def.color }}
        />
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="font-semibold">{def.label}</h3>
        <Badge variant="outline" className="ml-auto">
          {def.category}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{def.description}</p>
      <div className="text-xs text-muted-foreground">
        Node id: <code className="font-mono">{node.id}</code>
      </div>
      <Separator />
      <div className="space-y-3">
        {def.propertySchema.map((p) => (
          <PropertyField
            key={p.key}
            schema={p}
            value={node.props[p.key]}
            onChange={(v) => onChangeProp(node.id, p.key, v)}
          />
        ))}
      </div>
      <Separator />
      <div className="space-y-2">
        <Label className="text-xs">Add edge from this node to:</Label>
        <div className="flex gap-2">
          <Select value={edgeTarget} onValueChange={setEdgeTarget}>
            <SelectTrigger className="flex-1 h-8">
              <SelectValue placeholder="Target node" />
            </SelectTrigger>
            <SelectContent>
              {allNodes
                .filter((n) => n.id !== node.id)
                .map((n) => {
                  const d = getNodeType(n.type)
                  return (
                    <SelectItem key={n.id} value={n.id}>
                      {d?.label ?? n.type} ({n.id.slice(0, 8)})
                    </SelectItem>
                  )
                })}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => {
              if (edgeTarget) {
                onAddEdge(node.id, edgeTarget)
                setEdgeTarget("")
              }
            }}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>
      <Separator />
      <Button
        variant="destructive"
        size="sm"
        onClick={() => onDeleteNode(node.id)}
        className="w-full"
      >
        <Trash2 className="size-4" /> Delete node
      </Button>
    </div>
  )
}

// ---------- YAML panel ----------

function YamlPanel({
  yaml,
  onGenerate,
  isGenerating,
}: {
  yaml: string
  onGenerate: () => void
  isGenerating: boolean
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!yaml) return
    try {
      await navigator.clipboard.writeText(yaml)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success("YAML copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileCode className="size-4" />
          )}
          {isGenerating ? "Generating..." : "Generate YAML"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={copy}
          disabled={!yaml}
        >
          <Copy className="size-4" /> {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      {yaml ? (
        <pre className="yaml-code bg-muted/40 border rounded-md p-3 max-h-[60vh] overflow-auto thin-scroll">
          {yaml}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">
          Click &quot;Generate YAML&quot; to compile the current graph into
          GitHub Actions YAML. Smart caching and matrix expansion are applied
          automatically.
        </p>
      )}
    </div>
  )
}

// ---------- Secrets panel ----------

function SecretsPanel({
  secrets,
  onAdd,
  onDelete,
}: {
  secrets: any[]
  onAdd: (name: string, description: string) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const submit = () => {
    if (!name.trim()) return
    onAdd(name.trim().toUpperCase(), desc.trim())
    setName("")
    setDesc("")
  }
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
          <Key className="size-4" /> Declare secrets
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Referenced in YAML as{" "}
          <code className="font-mono bg-muted px-1 rounded">
            {"${{ secrets.NAME }}"}
          </code>
          . Names must be UPPER_SNAKE_CASE.
        </p>
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="SECRET_NAME"
            className="h-8"
          />
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="h-8"
          />
          <Button
            size="sm"
            onClick={submit}
            disabled={!name.trim()}
            className="w-full"
          >
            <Plus className="size-4" /> Add secret
          </Button>
        </div>
      </div>
      <Separator />
      <div>
        <h3 className="text-sm font-semibold mb-2">
          Secrets ({secrets.length})
        </h3>
        {secrets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No secrets declared.
          </p>
        ) : (
          <div className="space-y-2">
            {secrets.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-2 p-2 border rounded-md"
              >
                <div className="flex-1 min-w-0">
                  <code className="font-mono text-xs">{s.name}</code>
                  {s.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {s.description}
                    </p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => onDelete(s.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Describe to AI dialog ----------

function DescribeDialog({
  open,
  onClose,
  onSubmit,
  isGenerating,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (desc: string) => void
  isGenerating: boolean
}) {
  const [text, setText] = useState("")
  const examples = [
    "Build a Node.js CI that runs on push to main: install deps, lint, test, build, deploy to Vercel.",
    "Python pipeline: install, lint, test on Python 3.11, build, deploy to AWS ECS, notify Slack.",
    "Go service: setup Go 1.21 matrix on [1.20, 1.21], install, test, build, deploy to Fly.io, notify email.",
  ]
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Describe your pipeline to AI</DialogTitle>
          <DialogDescription>
            The AI will generate a node graph from your description. The
            graph replaces the current canvas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={examples[0]}
            rows={4}
            className="resize-none"
          />
          <div className="text-xs text-muted-foreground">Examples:</div>
          <div className="space-y-1">
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => setText(ex)}
                className="block w-full text-left text-xs text-muted-foreground p-2 border rounded-md hover:bg-accent"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={() => text.trim() && onSubmit(text.trim())}
            disabled={!text.trim() || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isGenerating ? "Generating..." : "Generate graph"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Load pipeline dialog ----------

function LoadDialog({
  open,
  onClose,
  onLoad,
  pipelines,
}: {
  open: boolean
  onClose: () => void
  onLoad: (id: string) => void
  pipelines: any[]
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Load a saved pipeline</DialogTitle>
          <DialogDescription>
            Select a pipeline to load into the canvas.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto thin-scroll space-y-2">
          {pipelines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved pipelines yet. Click &quot;Save&quot; in the header to
              persist the current pipeline.
            </p>
          ) : (
            pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => onLoad(p.id)}
                className="block w-full text-left p-3 border rounded-md hover:bg-accent"
              >
                <div className="font-medium">{p.name}</div>
                {p.description && (
                  <div className="text-xs text-muted-foreground">
                    {p.description}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  Updated{" "}
                  {new Date(p.updatedAt || p.createdAt).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Main page ----------

export default function Page() {
  const [name, setName] = useState("Untitled Pipeline")
  const [description, setDescription] = useState("")
  const [graph, setGraph] = useState<PipelineGraph>({
    nodes: [],
    edges: [],
  })
  const [pipelineId, setPipelineId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [yaml, setYaml] = useState("")
  const [simulation, setSimulation] = useState<SimulationResult | null>(null)
  const [simText, setSimText] = useState("")
  const [secrets, setSecrets] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [describeOpen, setDescribeOpen] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)
  const [tab, setTab] = useState("properties")
  const [pipelines, setPipelines] = useState<any[]>([])
  const [stats, setStats] = useState<{
    pipelines: number
    simulations: number
  } | null>(null)

  const selectedNode =
    graph.nodes.find((n) => n.id === selectedNodeId) ?? null

  // ---- graph mutations ----

  const addNodeAt = useCallback((type: string, x: number, y: number) => {
    const id = shortId("n")
    const node = makeNode(type, id, Math.max(0, x), Math.max(0, y))
    setGraph((prev) => {
      const newEdges = [...prev.edges]
      if (prev.nodes.length > 0) {
        const ordered = topologicalSort({
          nodes: prev.nodes,
          edges: prev.edges,
        })
        const tail = ordered[ordered.length - 1]
        if (tail && tail.id !== id) {
          newEdges.push({ id: shortId("e"), from: tail.id, to: id })
        }
      }
      return { nodes: [...prev.nodes, node], edges: newEdges }
    })
    setSelectedNodeId(id)
  }, [])

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              x: Math.max(0, Math.min(VIEWBOX_W - NODE_W, x)),
              y: Math.max(0, Math.min(VIEWBOX_H - NODE_H, y)),
            }
          : n,
      ),
    }))
  }, [])

  const deleteNode = useCallback((id: string) => {
    setGraph((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== id),
      edges: prev.edges.filter((e) => e.from !== id && e.to !== id),
    }))
    setSelectedNodeId((prev) => (prev === id ? null : prev))
  }, [])

  const updateNodeProps = useCallback(
    (id: string, key: string, value: any) => {
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === id
            ? { ...n, props: { ...n.props, [key]: value } }
            : n,
        ),
      }))
    },
    [],
  )

  const addEdge = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) {
      toast.error("Cannot connect a node to itself")
      return
    }
    setGraph((prev) => {
      if (prev.edges.some((e) => e.from === fromId && e.to === toId)) {
        toast.error("Edge already exists")
        return prev
      }
      return {
        ...prev,
        edges: [
          ...prev.edges,
          { id: shortId("e"), from: fromId, to: toId },
        ],
      }
    })
  }, [])

  const deleteEdge = useCallback((id: string) => {
    setGraph((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== id),
    }))
  }, [])

  // ---- save / ensure id ----

  const ensurePipelineId = useCallback(async (): Promise<string | null> => {
    if (pipelineId) return pipelineId
    const safeName = name.trim() || "Untitled Pipeline"
    setIsSaving(true)
    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: safeName,
          description,
          graph,
        }),
      })
      if (!res.ok) throw new Error("Failed to create pipeline")
      const data = await res.json()
      setPipelineId(data.id)
      return data.id
    } catch (e) {
      toast.error((e as Error).message)
      return null
    } finally {
      setIsSaving(false)
    }
  }, [pipelineId, name, description, graph])

  const savePipeline = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Pipeline name is required")
      return
    }
    setIsSaving(true)
    try {
      if (pipelineId) {
        const res = await fetch(`/api/pipelines/${pipelineId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, graph }),
        })
        if (!res.ok) throw new Error("Failed to save pipeline")
        toast.success("Pipeline saved")
      } else {
        const res = await fetch("/api/pipelines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, graph }),
        })
        if (!res.ok) throw new Error("Failed to save pipeline")
        const data = await res.json()
        setPipelineId(data.id)
        toast.success("Pipeline created")
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setIsSaving(false)
    }
  }, [name, description, graph, pipelineId])

  // ---- generate yaml ----

  const generateYaml = useCallback(async () => {
    setIsGenerating(true)
    try {
      const id = await ensurePipelineId()
      if (!id) throw new Error("Could not save pipeline")
      await fetch(`/api/pipelines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, graph }),
      })
      const res = await fetch(`/api/pipelines/${id}/generate-yaml`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to generate YAML")
      const data = await res.json()
      setYaml(data.yaml)
      setTab("yaml")
      toast.success("YAML generated")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setIsGenerating(false)
    }
  }, [name, description, graph, ensurePipelineId])

  // ---- simulate ----

  const simulate = useCallback(async () => {
    setIsSimulating(true)
    try {
      const id = await ensurePipelineId()
      if (!id) throw new Error("Could not save pipeline")
      await fetch(`/api/pipelines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, graph }),
      })
      const res = await fetch(`/api/pipelines/${id}/simulate`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to simulate")
      const data = await res.json()
      setSimulation(data.result)
      setSimText(data.text)
      toast.success("Simulation complete")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setIsSimulating(false)
    }
  }, [name, description, graph, ensurePipelineId])

  // ---- describe to AI ----

  const describeToAi = useCallback(
    async (desc: string) => {
      setIsGenerating(true)
      try {
        const id = await ensurePipelineId()
        if (!id) throw new Error("Could not save pipeline")
        const res = await fetch(
          `/api/pipelines/${id}/generate-from-description`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: desc }),
          },
        )
        if (!res.ok) throw new Error("Failed to generate graph")
        const data = await res.json()
        setGraph(data.graph)
        setSelectedNodeId(null)
        setYaml("")
        setSimulation(null)
        setSimText("")
        setDescription(desc)
        setDescribeOpen(false)
        toast.success("Graph generated from description")
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setIsGenerating(false)
      }
    },
    [ensurePipelineId],
  )

  // ---- load pipeline ----

  const loadPipeline = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/pipelines/${id}`)
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setPipelineId(data.id)
      setName(data.name)
      setDescription(data.description ?? "")
      setGraph(data.graph ?? { nodes: [], edges: [] })
      setSecrets(data.secrets ?? [])
      setYaml(data.yamlCache ?? "")
      setSimulation(null)
      setSimText("")
      setSelectedNodeId(null)
      setLoadOpen(false)
      toast.success("Pipeline loaded")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }, [])

  const openLoadDialog = useCallback(async () => {
    try {
      const res = await fetch("/api/pipelines")
      if (!res.ok) throw new Error("Failed to list pipelines")
      const data = await res.json()
      setPipelines(data.pipelines ?? [])
      setLoadOpen(true)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }, [])

  // ---- secrets ----

  const addSecret = useCallback(
    async (sname: string, sdesc: string) => {
      try {
        const id = await ensurePipelineId()
        if (!id) throw new Error("Could not save pipeline")
        const res = await fetch(`/api/pipelines/${id}/secrets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: sname, description: sdesc }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Failed to add secret")
        }
        const data = await res.json()
        setSecrets((prev) => [...prev, data.secret])
        toast.success("Secret added")
      } catch (e) {
        toast.error((e as Error).message)
      }
    },
    [ensurePipelineId],
  )

  const deleteSecret = useCallback(async (secretId: string) => {
    try {
      const res = await fetch(`/api/secrets/${secretId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete secret")
      setSecrets((prev) => prev.filter((s) => s.id !== secretId))
      toast.success("Secret deleted")
    } catch (e) {
      toast.error((e as Error).message)
    }
  }, [])

  // ---- stats ----

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStats(d))
      .catch(() => {})
  }, [pipelineId, simText])

  const newPipeline = useCallback(() => {
    setPipelineId(null)
    setName("Untitled Pipeline")
    setDescription("")
    setGraph({ nodes: [], edges: [] })
    setSelectedNodeId(null)
    setYaml("")
    setSimulation(null)
    setSimText("")
    setSecrets([])
    toast.success("New pipeline started")
  }, [])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Workflow className="size-6 text-primary" />
          <h1 className="text-lg font-semibold">
            AI-Powered CI/CD Pipeline Builder
          </h1>
        </div>
        <Separator orientation="vertical" className="h-8" />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pipeline name"
          className="max-w-xs h-9"
        />
        {pipelineId && (
          <Badge variant="secondary" className="font-mono text-xs">
            {pipelineId.slice(0, 12)}
          </Badge>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={newPipeline}
            title="New pipeline"
          >
            <Plus className="size-4" /> New
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openLoadDialog}
            title="Load pipeline"
          >
            <FolderOpen className="size-4" /> Load
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={savePipeline}
            disabled={isSaving}
            title="Save pipeline"
          >
            <Save className="size-4" /> {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDescribeOpen(true)}
            title="Describe pipeline to AI"
          >
            <Sparkles className="size-4" /> Describe to AI
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={generateYaml}
            disabled={isGenerating}
            title="Generate GitHub Actions YAML"
          >
            <FileCode className="size-4" />{" "}
            {isGenerating ? "Generating..." : "Generate YAML"}
          </Button>
          <Button
            size="sm"
            onClick={simulate}
            disabled={isSimulating}
            title="Simulate a run"
          >
            {isSimulating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}{" "}
            {isSimulating ? "Running..." : "Simulate run"}
          </Button>
        </div>
      </header>

      {/* Main: palette + canvas + right panel */}
      <main className="flex-1 flex min-h-0">
        {/* Palette */}
        <aside className="w-56 border-r bg-card overflow-y-auto thin-scroll shrink-0">
          <div className="p-3">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
              Node palette
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Drag a node onto the canvas.
            </p>
            {NODE_CATEGORIES.map((cat) => {
              const types = NODE_TYPES.filter(
                (t) => t.category === cat.id,
              )
              if (types.length === 0) return null
              return (
                <div key={cat.id} className="mb-4">
                  <h3 className="text-xs font-medium mb-1.5 text-foreground/80">
                    {cat.label}
                  </h3>
                  <div className="space-y-1">
                    {types.map((t) => {
                      const Icon = ICONS[t.icon] ?? Package
                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", t.id)
                            e.dataTransfer.effectAllowed = "copy"
                          }}
                          className="flex items-center gap-2 p-2 rounded-md border border-transparent hover:border-border hover:bg-accent cursor-grab active:cursor-grabbing transition-colors"
                          title={t.description}
                        >
                          <span
                            className="size-3 rounded-sm shrink-0"
                            style={{ background: t.color }}
                          />
                          <Icon className="size-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{t.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* Canvas */}
        <Canvas
          graph={graph}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onMoveNode={moveNode}
          onDropNode={addNodeAt}
          onDeleteEdge={deleteEdge}
        />

        {/* Right panel */}
        <aside className="w-96 border-l bg-card flex flex-col min-h-0 shrink-0">
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-3 pt-3">
              <TabsList className="w-full">
                <TabsTrigger value="properties" className="flex-1">
                  Properties
                </TabsTrigger>
                <TabsTrigger value="yaml" className="flex-1">
                  YAML
                </TabsTrigger>
                <TabsTrigger value="secrets" className="flex-1">
                  Secrets
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value="properties"
              className="flex-1 overflow-y-auto thin-scroll px-4 py-3 mt-2"
            >
              <PropertiesPanel
                node={selectedNode}
                allNodes={graph.nodes}
                onChangeProp={updateNodeProps}
                onDeleteNode={deleteNode}
                onAddEdge={addEdge}
              />
            </TabsContent>
            <TabsContent
              value="yaml"
              className="flex-1 overflow-y-auto thin-scroll px-4 py-3 mt-2"
            >
              <YamlPanel
                yaml={yaml}
                onGenerate={generateYaml}
                isGenerating={isGenerating}
              />
            </TabsContent>
            <TabsContent
              value="secrets"
              className="flex-1 overflow-y-auto thin-scroll px-4 py-3 mt-2"
            >
              <SecretsPanel
                secrets={secrets}
                onAdd={addSecret}
                onDelete={deleteSecret}
              />
            </TabsContent>
          </Tabs>
        </aside>
      </main>

      {/* Simulation terminal */}
      <footer className="h-56 border-t bg-card flex flex-col shrink-0">
        <div className="px-4 py-2 border-b flex items-center gap-2 flex-wrap">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Simulation terminal
          </h2>
          {simulation && (
            <>
              <Badge
                variant={simulation.success ? "default" : "destructive"}
              >
                {simulation.success ? "SUCCESS" : "FAILURE"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {simulation.logs.length} node(s) ·{" "}
                {simulation.totalDurationMs}ms
              </span>
            </>
          )}
          <div className="flex-1" />
          {stats && (
            <span className="text-xs text-muted-foreground">
              {stats.pipelines} pipeline(s) · {stats.simulations}{" "}
              simulation(s) saved
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll terminal p-3">
          {simText ? (
            <pre className="whitespace-pre-wrap">{simText}</pre>
          ) : (
            <p className="terminal-line-meta">
              No simulation yet. Click &quot;Simulate run&quot; to generate
              deterministic mock logs for each node in the graph.
            </p>
          )}
        </div>
      </footer>

      <DescribeDialog
        open={describeOpen}
        onClose={() => setDescribeOpen(false)}
        onSubmit={describeToAi}
        isGenerating={isGenerating}
      />
      <LoadDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        onLoad={loadPipeline}
        pipelines={pipelines}
      />
    </div>
  )
}
