import { NextResponse } from "next/server"
import { NODE_TYPES, NODE_CATEGORIES } from "@/lib/node-types"

export async function GET() {
  return NextResponse.json({
    nodeTypes: NODE_TYPES,
    categories: NODE_CATEGORIES,
  })
}
