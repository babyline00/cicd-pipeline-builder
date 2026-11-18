import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  try {
    const pipeline = await db.pipeline.findUnique({
      where: { id },
      include: {
        secrets: true,
        simulations: { orderBy: { startedAt: "desc" }, take: 1 },
      },
    })
    if (!pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 },
      )
    }
    let graph = { nodes: [], edges: [] }
    try {
      graph = JSON.parse(pipeline.graph)
    } catch {
      // keep empty graph
    }
    const lastSim = pipeline.simulations[0]
    return NextResponse.json({
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description,
      graph,
      yamlCache: pipeline.yamlCache,
      secrets: pipeline.secrets,
      lastSimulation: lastSim
        ? { ...lastSim, text: lastSim.logs }
        : null,
      createdAt: pipeline.createdAt,
      updatedAt: pipeline.updatedAt,
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  try {
    const body = await req.json()
    const data: any = {}
    if (typeof body.name === "string") data.name = body.name
    if (body.description !== undefined) {
      data.description =
        typeof body.description === "string" ? body.description : null
    }
    if (body.graph !== undefined) {
      data.graph =
        typeof body.graph === "string"
          ? body.graph
          : JSON.stringify(body.graph)
    }
    const updated = await db.pipeline.update({ where: { id }, data })
    return NextResponse.json({
      id: updated.id,
      updatedAt: updated.updatedAt,
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  try {
    await db.pipeline.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
