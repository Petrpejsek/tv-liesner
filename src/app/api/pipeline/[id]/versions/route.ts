import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// GET /api/pipeline/[id]/versions - Vrátí seznam všech verzí pipeline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: pipelineId } = await params;

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

    // Načti všechny verze seřazené od nejnovější
    const versions = await prisma.pipelineVersion.findMany({
      where: { pipelineId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        versionName: true,
        description: true,
        pipelineTitle: true,
        totalSteps: true,
        completedSteps: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      pipeline: {
        id: pipeline.id,
        title: pipeline.title,
        status: pipeline.status
      },
      versions,
      count: versions.length,
      message: `📋 Nalezeno ${versions.length} verzí`
    });

  } catch (error) {
    console.error('💥 Error fetching versions:', error);
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se načíst verze',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 