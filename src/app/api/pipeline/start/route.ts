// 🚀 AI Reels Pipeline Start API
import { NextRequest, NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    message: '🎬 AI Reels Pipeline API je ready!',
    status: 'FÁZE 2 - OpenAI Pipeline implementována',
    endpoints: {
      'POST /api/pipeline/start': 'Spustí kompletní AI pipeline',
      'body': {
        url: 'string (AI product URL)',
        targetDuration: 'number (5-60 seconds)', 
        selectedHookId: 'number (optional)'
      }
    },
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { url, targetDuration } = body;

    // Validace
    if (!url || !url.startsWith('http')) {
      return NextResponse.json({
        success: false,
        error: 'Nevalidní URL. URL musí začínat http:// nebo https://',
      }, { status: 400 });
    }

    if (!targetDuration || targetDuration < 5 || targetDuration > 60) {
      return NextResponse.json({
        success: false,
        error: 'Target duration musí být mezi 5-60 sekund',
      }, { status: 400 });
    }

    // MOCK response pro test FÁZE 2
    const pipelineId = `pipeline_${Date.now()}`;
    
    return NextResponse.json({
      success: true,
      message: `✅ FÁZE 2 TEST: Pipeline připravena pro URL: ${url}`,
      pipeline_id: pipelineId,
      mock_results: {
        url,
        targetDuration,
        note: 'Pro plný test potřebuji OpenAI API klíč v .env.local'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`,
    }, { status: 500 });
  }
}
