import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateGraph } from "@/lib/graph-validator"
import type { PipelineGraph } from "@/lib/node-types"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, graph } = body ?? {}
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      )
    }
    let parsedGraph: PipelineGraph = { nodes: [], edges: [] }
    if (typeof graph === "string") {
      try {
        parsedGraph = JSON.parse(graph)
      } catch {
        return NextResponse.json(
          { error: "graph is not valid JSON" },
          { status: 400 },
        )
      }
    } else if (graph && typeof graph === "object") {
      parsedGraph = graph as PipelineGraph
    }
    const v = validateGraph(parsedGraph)
    if (!v.valid && parsedGraph.nodes.length > 0) {
      // surface validation issues but don't block creation (user is editing)
    }
    const created = await db.pipeline.create({
      data: {
        name,
        description: typeof description === "string" ? description : null,
        graph: JSON.stringify(parsedGraph),
      },
    })
    return NextResponse.json({
      id: created.id,
      name: created.name,
      description: created.description,
      graph: parsedGraph,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const pipelines = await db.pipeline.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ pipelines })
  } catch {
    return NextResponse.json({ pipelines: [] })
  }
}
