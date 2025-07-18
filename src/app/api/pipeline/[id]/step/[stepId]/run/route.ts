import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// POST /api/pipeline/[id]/step/[stepId]/run - Spustí konkrétní krok
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
): Promise<NextResponse> {
  try {
    const { id: pipelineId, stepId } = await params;

    // Ověř, že pipeline existuje
    const pipeline = await prisma.pipeline.findUnique({ 
      where: { id: pipelineId } 
    });
    
    if (!pipeline) {
      return NextResponse.json({
        success: false,
        error: "Pipeline not found"
      }, { status: 404 });
    }

    // Ověř, že krok existuje a patří k této pipeline
    const step = await prisma.pipelineStep.findFirst({
      where: { 
        id: stepId,
        pipelineId: pipelineId
      }
    });
    
    if (!step) {
      return NextResponse.json({
        success: false,
        error: "Krok nebyl nalezen"
      }, { status: 404 });
    }

    // Ověř, že krok lze spustit (pending nebo error)
    if (step.status !== 'pending' && step.status !== 'error') {
      return NextResponse.json({
        success: false,
        error: `Krok je ve stavu "${step.status}" - lze spustit jen čekající nebo chybné kroky`
      }, { status: 400 });
    }

    // Aktualizuj status kroku na 'running'
    await prisma.pipelineStep.update({
      where: { id: stepId },
      data: { 
        status: 'running',
        errorLogs: null, // Vymaž předchozí chyby
        updatedAt: new Date()
      }
    });

    // Aktualizuj status pipeline na 'running' (pokud není)
    if (pipeline.status !== 'running') {
      await prisma.pipeline.update({
        where: { id: pipelineId },
        data: { status: 'running' }
      });
    }

    // TODO: Spustit konkrétní krok asynchronně
    // V reálné implementaci by se volala funkce pro spuštění konkrétního kroku
    // runSpecificStep(pipelineId, step.stepName, step.order)
    
    console.log(`🔄 Spouštím krok "${step.stepName}" (${step.order}) v pipeline ${pipelineId}`);

    return NextResponse.json({
      success: true,
      message: `🔄 Krok "${step.stepName}" byl spuštěn`,
      step: {
        id: step.id,
        stepName: step.stepName,
        order: step.order,
        status: 'running',
        previousStatus: step.status
      },
      polling_endpoint: `/api/pipeline/status/${pipelineId}`,
      pipeline: {
        id: pipeline.id,
        title: pipeline.title,
        status: 'running'
      }
    });

  } catch (error) {
    console.error('💥 Error running step:', error);
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se spustit krok',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 