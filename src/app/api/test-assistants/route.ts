import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: "Test endpoint pro kontrolu AI asistentů v localStorage",
    note: "Zkontroluj localStorage v browser dev tools: localStorage.getItem('ai-reels-assistants')",
    timestamp: new Date().toISOString()
  });
} 