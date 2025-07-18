import { NextRequest, NextResponse } from 'next/server';
import { PipelineStateManager, pipelineStates } from '@/lib/pipeline-state';

// GET /api/pipeline/status/[id] - Získej aktuální stav pipeline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params;
    const pipelineId = resolvedParams.id;
    
    console.log(`🔍 Status API: hledám pipeline ${pipelineId}`);
    
    if (!pipelineId) {
      return NextResponse.json({
        success: false,
        error: 'Pipeline ID je povinné'
      }, { status: 400 });
    }

    // Získej pipeline state
    const pipelineState = PipelineStateManager.get(pipelineId);
    
    console.log(`🔍 Status API: pipeline state pro ${pipelineId}:`, pipelineState ? 'NALEZENA' : 'NENALEZENA');
    
    if (!pipelineState) {
      // Debug: vypíši všechny dostupné pipeline IDs
      const allPipelines = Array.from(pipelineStates.keys());
      console.log(`🔍 Status API: dostupné pipelines:`, allPipelines);
      
      return NextResponse.json({
        success: false,
        error: 'Pipeline nebyla nalezena',
        pipeline_id: pipelineId,
        available_pipelines: allPipelines
      }, { status: 404 });
    }

    // Spočítej progress metrics
    const completedSteps = pipelineState.steps.filter(s => s.status === 'completed').length;
    const runningSteps = pipelineState.steps.filter(s => s.status === 'running').length;
    const errorSteps = pipelineState.steps.filter(s => s.status === 'error').length;
    const progressPercentage = Math.round((completedSteps / pipelineState.total_steps) * 100);

    // Najdi aktuální krok
    const currentStep = pipelineState.steps.find(s => s.status === 'running') || 
                      pipelineState.steps[pipelineState.current_step];

    return NextResponse.json({
      success: true,
      pipeline_id: pipelineId,
      status: pipelineState.status,
      progress: {
        current_step: pipelineState.current_step + 1, // 1-indexed pro UI
        total_steps: pipelineState.total_steps,
        completed_steps: completedSteps,
        running_steps: runningSteps,
        error_steps: errorSteps,
        percentage: progressPercentage
      },
      current_step_info: currentStep ? {
        id: currentStep.id,
        name: currentStep.name,
        emoji: currentStep.emoji,
        status: currentStep.status,
        service: currentStep.service
      } : null,
      steps: pipelineState.steps.map(step => ({
        id: step.id,
        name: step.name,
        emoji: step.emoji,
        description: step.description,
        service: step.service,
        status: step.status,
        output: step.output,
        error: step.error,
        startTime: step.startTime?.toISOString(),
        endTime: step.endTime?.toISOString(),
        // Přidej flag pro AI kroky (pro JSON viewer)
        isAIStep: ['ai-summary', 'viral-hooks', 'script-generation', 'voice-direction', 
                   'background-selection', 'music-sound', 'avatar-behavior', 'thumbnail-concept',
                   'ai-text-cleaner', 'timeline-creation', 'voice-generation'].includes(step.id)
      })),
      final_outputs: pipelineState.final_outputs,
      timestamps: {
        created_at: pipelineState.created_at.toISOString(),
        updated_at: pipelineState.updated_at.toISOString(),
        duration_seconds: Math.round((Date.now() - pipelineState.created_at.getTime()) / 1000)
      }
    });

  } catch (error) {
    console.error('💥 Pipeline Status API Error:', error);
    
    return NextResponse.json({
      success: false,
      error: `Status API selhalo: ${error instanceof Error ? error.message : 'Neočekávaná chyba'}`
    }, { status: 500 });
  }
}

// DELETE /api/pipeline/status/[id] - Smaž pipeline (cleanup)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params;
    const pipelineId = resolvedParams.id;
    
    if (!pipelineId) {
      return NextResponse.json({
        success: false,
        error: 'Pipeline ID je povinné'
      }, { status: 400 });
    }

    const deleted = PipelineStateManager.delete(pipelineId);
    
    return NextResponse.json({
      success: true,
      deleted: deleted,
      pipeline_id: pipelineId,
      message: deleted ? 'Pipeline smazána' : 'Pipeline nebyla nalezena'
    });

  } catch (error) {
    console.error('💥 Pipeline Delete API Error:', error);
    
    return NextResponse.json({
      success: false,
      error: `Delete API selhalo: ${error instanceof Error ? error.message : 'Neočekávaná chyba'}`
    }, { status: 500 });
  }
} 