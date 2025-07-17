import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: '🎬 AI Reels Generator API is working!',
    timestamp: new Date().toISOString(),
    status: 'FÁZE 1 DOKONČENA ✅',
    nextjs: 'funguje perfectly!',
    environment: 'development'
  });
}
