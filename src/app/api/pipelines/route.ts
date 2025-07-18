import { NextRequest, NextResponse } from 'next/server';
import { PipelineDatabase } from '@/lib/database';

// GET /api/pipelines - Získej seznam všech pipeline (historie)
export async function GET(): Promise<NextResponse> {
  try {
    const pipelines = await PipelineDatabase.getAllPipelines();
    
    // Transformuj data pro frontend
    const pipelinesWithStats = pipelines.map(pipeline => {
      const completedSteps = pipeline.steps.filter(step => step.status === 'completed').length;
      const totalSteps = pipeline.steps.length;
      const hasError = pipeline.status === 'error' || pipeline.steps.some(step => step.status === 'error');
      
      return {
        id: pipeline.id,
        title: pipeline.title,
        status: pipeline.status,
        completedSteps,
        totalSteps,
        hasError,
        createdAt: pipeline.createdAt,
        updatedAt: pipeline.updatedAt,
        completionPercentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
      };
    });

    return NextResponse.json({
      success: true,
      pipelines: pipelinesWithStats,
      total: pipelinesWithStats.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Error fetching pipelines:', error);
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se načíst seznam pipeline',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 