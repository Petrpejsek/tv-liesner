import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// POST /api/pipeline/[id]/resume - Spustí zbývající kroky od prvního čekajícího
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: pipelineId } = await params;

    // Ověř, že pipeline existuje
    const pipeline = await prisma.pipeline.findUnique({ 
      where: { id: pipelineId },
      include: {
        steps: {
          orderBy: { order: 'asc' }
        }
      }
    });
    
    if (!pipeline) {
      return NextResponse.json({
        success: false,
        error: "Pipeline not found"
      }, { status: 404 });
    }

    // Najdi první čekající krok
    const pendingSteps = pipeline.steps.filter(step => 
      step.status === 'pending' || step.status === 'error'
    );

    if (pendingSteps.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Všechny kroky jsou již dokončené nebo běží",
        message: "🎉 Pipeline je kompletní!"
      }, { status: 400 });
    }

    const firstPendingStep = pendingSteps[0];

    // Aktualizuj status pipeline na 'running'
    await prisma.pipeline.update({
      where: { id: pipelineId },
      data: { status: 'running' }
    });

    // TODO: Spustit pipeline asynchronně od kroku firstPendingStep.order
    // Pro teď jen simulujeme spuštění - v reálné implementaci by se volala
    // processPipelineFromStep(pipelineId, firstPendingStep.order)
    
    console.log(`🔄 Spouštím resume pipeline ${pipelineId} od kroku ${firstPendingStep.stepName} (order: ${firstPendingStep.order})`);
    
    // Simulace: označíme první pending krok jako running
    await prisma.pipelineStep.update({
      where: { id: firstPendingStep.id },
      data: { 
        status: 'running',
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: `🔄 Pipeline pokračuje od kroku "${firstPendingStep.stepName}"`,
      resumedFrom: {
        stepName: firstPendingStep.stepName,
        order: firstPendingStep.order,
        totalPendingSteps: pendingSteps.length
      },
      polling_endpoint: `/api/pipeline/status/${pipelineId}`,
      pipeline: {
        id: pipeline.id,
        title: pipeline.title,
        status: 'running'
      }
    });

  } catch (error) {
    console.error('💥 Error resuming pipeline:', error);
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se obnovit pipeline',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 