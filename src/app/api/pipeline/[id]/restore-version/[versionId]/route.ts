import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// POST /api/pipeline/[id]/restore-version/[versionId] - Obnoví pipeline ze snapshotu
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
): Promise<NextResponse> {
  try {
    const { id: pipelineId, versionId } = await params;

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

    // Načti verzi
    const version = await prisma.pipelineVersion.findUnique({ 
      where: { id: versionId },
      include: { pipeline: true }
    });
    
    if (!version) {
      return NextResponse.json({
        success: false,
        error: "Version not found"
      }, { status: 404 });
    }

    // Ověř, že verze patří k této pipeline
    if (version.pipelineId !== pipelineId) {
      return NextResponse.json({
        success: false,
        error: "Version does not belong to this pipeline"
      }, { status: 400 });
    }

    // Rozbalení snapshotu
    const snapshot = version.snapshot as any;
    const steps = snapshot.steps || [];

    // Transakce: smazat současné kroky a nahradit ze snapshotu
    await prisma.$transaction(async (tx) => {
      // Smaž všechny současné kroky
      await tx.pipelineStep.deleteMany({ 
        where: { pipelineId } 
      });

      // Vytvoř kroky ze snapshotu
      if (steps.length > 0) {
        await tx.pipelineStep.createMany({
          data: steps.map((step: any) => ({
            pipelineId,
            stepName: step.stepName,
            order: step.order,
            status: step.status,
            outputJson: step.outputJson,
            assetUrls: step.assetUrls,
            errorLogs: step.errorLogs
          }))
        });
      }

      // Aktualizuj status pipeline
      const newStatus = steps.every((s: any) => s.status === 'completed') ? 'completed' :
                       steps.some((s: any) => s.status === 'error') ? 'error' :
                       steps.some((s: any) => s.status === 'running') ? 'running' : 'waiting';

      await tx.pipeline.update({
        where: { id: pipelineId },
        data: { status: newStatus }
      });
    });

    return NextResponse.json({
      success: true,
      restoredVersion: {
        id: version.id,
        versionName: version.versionName,
        description: version.description,
        createdAt: version.createdAt
      },
      restoredSteps: steps.length,
      completedSteps: version.completedSteps,
      totalSteps: version.totalSteps,
      message: `🔄 Pipeline obnovena ze snapshotu: ${version.versionName}`
    });

  } catch (error) {
    console.error('💥 Error restoring version:', error);
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se obnovit verzi',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 