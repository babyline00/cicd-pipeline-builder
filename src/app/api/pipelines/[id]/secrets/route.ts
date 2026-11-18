import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateSecretName } from "@/lib/secrets"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  try {
    const body = await req.json()
    const { name, description } = body ?? {}
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      )
    }
    if (!validateSecretName(name)) {
      return NextResponse.json(
        {
          error:
            "Invalid secret name — must be UPPER_SNAKE_CASE (letters, digits, underscores; cannot start with a digit).",
        },
        { status: 400 },
      )
    }
    const secret = await db.secret.create({
      data: {
        pipelineId: id,
        name,
        description:
          typeof description === "string" ? description : null,
      },
    })
    return NextResponse.json({ secret })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  try {
    const secrets = await db.secret.findMany({
      where: { pipelineId: id },
      orderBy: { name: "asc" },
    })
    return NextResponse.json({ secrets })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
