import { NextResponse } from "next/server";
import { join } from "path";
import { statSync, createReadStream } from "fs";

export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const filePath = join(process.cwd(), "public", "uploads", filename);

  try {
    const stats = statSync(filePath);
    const stream = createReadStream(filePath);

    const headers = new Headers();
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Content-Length", stats.size.toString());
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);

    return new Response(stream as any, { headers });
  } catch (err) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
} 