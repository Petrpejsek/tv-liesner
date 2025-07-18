import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// PATCH /api/pipeline/[id]/step/[stepId] - Editace JSON výstupu kroku
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
): Promise<NextResponse> {
  try {
    const { id: pipelineId, stepId } = await params;
    const body = await request.json();
    const { outputJson } = body;

    if (!outputJson) {
      return NextResponse.json({
        success: false,
        error: "outputJson je povinné"
      }, { status: 400 });
    }

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

    // Ověř, že krok je dokončený (lze editovat jen dokončené kroky)
    if (step.status !== 'completed') {
      return NextResponse.json({
        success: false,
        error: "Lze editovat jen dokončené kroky"
      }, { status: 400 });
    }

    // Aktualizuj JSON výstup kroku
    const updatedStep = await prisma.pipelineStep.update({
      where: { id: stepId },
      data: { 
        outputJson: outputJson,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      step: {
        id: updatedStep.id,
        stepName: updatedStep.stepName,
        status: updatedStep.status,
        outputJson: updatedStep.outputJson,
        updatedAt: updatedStep.updatedAt
      },
      message: `✅ JSON výstup kroku "${step.stepName}" byl aktualizován`
    });

  } catch (error) {
    console.error('💥 Error updating step JSON:', error);
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se aktualizovat JSON výstup',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET /api/pipeline/[id]/step/[stepId] - Získej detail konkrétního kroku
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
): Promise<NextResponse> {
  try {
    const { id: pipelineId, stepId } = await params;

    // Najdi krok
    const step = await prisma.pipelineStep.findFirst({
      where: { 
        id: stepId,
        pipelineId: pipelineId
      },
      include: {
        pipeline: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      }
    });
    
    if (!step) {
      return NextResponse.json({
        success: false,
        error: "Krok nebyl nalezen"
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      step: {
        id: step.id,
        stepName: step.stepName,
        order: step.order,
        status: step.status,
        outputJson: step.outputJson,
        assetUrls: step.assetUrls,
        errorLogs: step.errorLogs,
        createdAt: step.createdAt,
        updatedAt: step.updatedAt,
        pipeline: step.pipeline
      }
    });

  } catch (error) {
    console.error('💥 Error fetching step detail:', error);
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se načíst detail kroku'
    }, { status: 500 });
  }
} 