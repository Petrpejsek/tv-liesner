import { NextRequest, NextResponse } from 'next/server';
import { PipelineDatabase, prisma } from '@/lib/database';
import { PipelineStateManager, getDefaultPipelineSteps } from '@/lib/pipeline-state';

// POST /api/pipeline/restart - Restartuj pipeline od konkrétního kroku
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { pipelineId, fromOrder, url, target_duration, api_keys, ai_assistants, voice_avatars } = body;

    // Validace
    if (!pipelineId || !fromOrder) {
      return NextResponse.json({
        success: false,
        error: 'Pipeline ID a fromOrder jsou povinné'
      }, { status: 400 });
    }

    // Načti původní pipeline z databáze
    const originalPipeline = await PipelineDatabase.getPipelineById(pipelineId);
    if (!originalPipeline) {
      return NextResponse.json({
        success: false,
        error: 'Původní pipeline nebyla nalezena'
      }, { status: 404 });
    }

    // 📦 AUTO-SNAPSHOT: Uložit stav před restartem
    try {
      console.log(`📦 Vytvářím auto-snapshot před restartem pipeline ${pipelineId}`);
      
      const steps = originalPipeline.steps;
      const snapshot = {
        pipelineId,
        steps: steps.map(step => ({
          id: step.id,
          stepName: step.stepName,
          order: step.order,
          status: step.status,
          outputJson: step.outputJson,
          assetUrls: step.assetUrls,
          errorLogs: step.errorLogs
        }))
      };

      const versionName = `Auto-snapshot před restart ${new Date().toLocaleString('cs-CZ')}`;
      const completedStepsCount = steps.filter(s => s.status === "completed").length;

      await prisma.pipelineVersion.create({
        data: {
          pipelineId,
          versionName,
          description: `Automatický snapshot před restartem od kroku ${fromOrder}`,
          pipelineTitle: originalPipeline.title,
          totalSteps: steps.length,
          completedSteps: completedStepsCount,
          snapshot
        }
      });

      console.log(`✅ Auto-snapshot vytvořen: ${versionName}`);
    } catch (snapshotError) {
      console.error('⚠️ Chyba při vytváření auto-snapshot:', snapshotError);
      // Pokračujeme i přes chybu snapshotu - nechceme blokovat restart
    }

    // Vytvoř nový pipeline ID pro restart
    const newPipelineId = `pipeline_${Date.now()}_restart`;
    
    // Získej výchozí kroky
    const steps = getDefaultPipelineSteps();
    
    // Vytvoř nový pipeline state s novým ID
    const newTitle = `${originalPipeline.title} (Restart od kroku ${fromOrder})`;
    await PipelineStateManager.create(newPipelineId, steps, newTitle);

    // Zkopíruj dokončené kroky z původní pipeline (do fromOrder-1)
    const completedSteps = originalPipeline.steps.filter(step => step.order < fromOrder && step.status === 'completed');
    
    for (const step of completedSteps) {
      await PipelineStateManager.updateStep(
        newPipelineId,
        step.stepName,
        'completed',
        step.outputJson,
        step.errorLogs || undefined
      );
    }

    // Připrav data pro restart (buď z request body nebo z původní pipeline)
    const restartData = {
      url: url || extractUrlFromPipeline(originalPipeline),
      target_duration: target_duration || 15,
      api_keys: api_keys || getStoredApiKeys(),
      ai_assistants: ai_assistants || [],
      voice_avatars: voice_avatars || []
    };

    // TODO: Spustit pipeline asynchronně od kroku `fromOrder`
    // processPipelineFromStep(newPipelineId, fromOrder, restartData);

    return NextResponse.json({
      success: true,
      message: `🔄 Pipeline restart spuštěna od kroku ${fromOrder}`,
      new_pipeline_id: newPipelineId,
      original_pipeline_id: pipelineId,
      restart_from_order: fromOrder,
      copied_completed_steps: completedSteps.length,
      polling_endpoint: `/api/pipeline/status/${newPipelineId}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Error restarting pipeline:', error);
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se restartovat pipeline',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Helper funkce pro extrakci URL z původní pipeline
function extractUrlFromPipeline(pipeline: any): string {
  // Zkus najít URL ve web-scraping kroku
  const webScrapingStep = pipeline.steps.find((step: any) => step.stepName === 'web-scraping');
  if (webScrapingStep?.outputJson?.url) {
    return webScrapingStep.outputJson.url;
  }
  
  // Fallback - použij placeholder URL
  return 'https://example.com';
}

// Helper funkce pro získání API klíčů
function getStoredApiKeys(): { [key: string]: string } {
  return {
    openai: process.env.OPENAI_API_KEY || '',
    elevenlabs: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || '',
    heygen: process.env.HEYGEN_API_KEY || '',
    json2video: process.env.JSON2VIDEO_API_KEY || ''
  };
} 