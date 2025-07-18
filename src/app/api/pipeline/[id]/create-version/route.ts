import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// POST /api/pipeline/[id]/create-version - Vytvoří snapshot pipeline
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: pipelineId } = await params;
    const body = await request.json();
    const description = body?.description || null;

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

    // Načti všechny kroky pipeline
    const steps = await prisma.pipelineStep.findMany({ 
      where: { pipelineId },
      orderBy: { order: 'asc' }
    });

    // Vytvoř snapshot structure
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

    // Vytvoř version záznam
    const versionName = `Snapshot ${new Date().toLocaleString('cs-CZ')}`;
    const completedSteps = steps.filter(s => s.status === "completed").length;

    const version = await prisma.pipelineVersion.create({
      data: {
        pipelineId,
        versionName,
        description,
        pipelineTitle: pipeline.title,
        totalSteps: steps.length,
        completedSteps,
        snapshot
      }
    });

    return NextResponse.json({
      success: true,
      version: {
        id: version.id,
        versionName: version.versionName,
        description: version.description,
        completedSteps: version.completedSteps,
        totalSteps: version.totalSteps,
        createdAt: version.createdAt
      },
      message: `📦 Snapshot vytvořen: ${versionName}`
    });

  } catch (error) {
    console.error('💥 Error creating version:', error);
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se vytvořit snapshot',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 