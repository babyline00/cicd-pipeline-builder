import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const [pipelines, simulations] = await Promise.all([
      db.pipeline.count(),
      db.simulation.count(),
    ])
    return NextResponse.json({ pipelines, simulations })
  } catch {
    return NextResponse.json({ pipelines: 0, simulations: 0 })
  }
}
