import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { simulateRun, formatLogsAsText } from "@/lib/simulate"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  try {
    const pipeline = await db.pipeline.findUnique({ where: { id } })
    if (!pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 },
      )
    }
    let graph
    try {
      graph = JSON.parse(pipeline.graph)
    } catch {
      return NextResponse.json(
        { error: "Invalid stored graph" },
        { status: 500 },
      )
    }
    const result = simulateRun(graph)
    const text = formatLogsAsText(result)
    const sim = await db.simulation.create({
      data: {
        pipelineId: id,
        logs: text,
        success: result.success,
      },
    })
    return NextResponse.json({
      result,
      text,
      simulation: { id: sim.id, startedAt: sim.startedAt },
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
