import { NextRequest, NextResponse } from "next/server"
import { generateGraphFromDescription } from "@/lib/llm-graph-generator"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: _id } = await params
  void _id
  try {
    const body = await req.json()
    const { description } = body ?? {}
    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 },
      )
    }
    const graph = await generateGraphFromDescription(description)
    return NextResponse.json({ graph })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
