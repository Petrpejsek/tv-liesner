import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";

// GET: načtení všech uložených párů
export async function GET() {
  const pairs = await prisma.voiceAvatarPair.findMany({
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(pairs);
}

// POST: uložení nového páru
export async function POST(req: Request) {
  const body = await req.json();
  const { name, voiceId, avatarId } = body;

  if (!name || !voiceId) {
    return NextResponse.json(
      { error: "NAME_AND_VOICEID_REQUIRED" },
      { status: 400 }
    );
  }

  const newPair = await prisma.voiceAvatarPair.create({
    data: { name, voiceId, avatarId }
  });

  return NextResponse.json(newPair);
}

// DELETE: smazání páru
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "ID_REQUIRED" },
      { status: 400 }
    );
  }

  await prisma.voiceAvatarPair.delete({ where: { id } });
  return NextResponse.json({ success: true });
} 