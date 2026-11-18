import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { compileToYaml } from "@/lib/yaml-compiler"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  try {
    const pipeline = await db.pipeline.findUnique({
      where: { id },
      include: { secrets: true },
    })
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
    const secrets = pipeline.secrets.map((s) => ({
      name: s.name,
      description: s.description ?? undefined,
    }))
    const yaml = compileToYaml(graph, secrets)
    await db.pipeline.update({
      where: { id },
      data: { yamlCache: yaml },
    })
    return NextResponse.json({ yaml })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
