import { NextRequest, NextResponse } from 'next/server';
import { PipelineDatabase } from '@/lib/database';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

// GET /api/pipeline/[id] - Získej detailní info o konkrétní pipeline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: pipelineId } = await params;
    
    if (!pipelineId) {
      return NextResponse.json({
        success: false,
        error: 'Pipeline ID je povinné'
      }, { status: 400 });
    }

    const pipeline = await PipelineDatabase.getPipelineById(pipelineId);
    
    if (!pipeline) {
      return NextResponse.json({
        success: false,
        error: 'Pipeline nebyla nalezena'
      }, { status: 404 });
    }

    // Transformuj data pro frontend
    const completedSteps = pipeline.steps.filter(step => step.status === 'completed').length;
    const totalSteps = pipeline.steps.length;
    
    const transformedSteps = pipeline.steps.map(step => ({
      id: step.id,
      stepName: step.stepName,
      order: step.order,
      status: step.status,
      outputJson: step.outputJson,
      assetUrls: step.assetUrls,
      errorLogs: step.errorLogs,
      createdAt: step.createdAt,
      updatedAt: step.updatedAt,
      canRestart: step.status === 'error' || step.status === 'completed'
    }));

    return NextResponse.json({
      success: true,
      pipeline: {
        id: pipeline.id,
        title: pipeline.title,
        status: pipeline.status,
        completedSteps,
        totalSteps,
        completionPercentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
        createdAt: pipeline.createdAt,
        updatedAt: pipeline.updatedAt,
        steps: transformedSteps
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`💥 Error fetching pipeline ${params}:`, error);
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se načíst detail pipeline',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// DELETE /api/pipeline/[id] - Smaž pipeline včetně všech kroků a verzí
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: pipelineId } = await params;
    
    if (!pipelineId) {
      return NextResponse.json({
        success: false,
        error: 'Pipeline ID je povinné'
      }, { status: 400 });
    }

    console.log(`🗑️ Mazání pipeline: ${pipelineId}`);

    // Ověř že pipeline existuje
    const existingPipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
      select: { title: true }
    });
    
    if (!existingPipeline) {
      return NextResponse.json({
        success: false,
        error: 'Pipeline nebyla nalezena'
      }, { status: 404 });
    }

    // Smaž pipeline (cascade automaticky smaže kroky i verze)
    await prisma.pipeline.delete({
      where: { id: pipelineId }
    });

    console.log(`✅ Pipeline "${existingPipeline.title}" byla úspěšně smazána`);

    return NextResponse.json({
      success: true,
      message: 'Pipeline byla úspěšně smazána',
      deletedPipeline: {
        id: pipelineId,
        title: existingPipeline.title
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`💥 Error deleting pipeline:`, error);
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se smazat pipeline',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 