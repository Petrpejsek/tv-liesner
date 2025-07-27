// Pipeline State Manager - In-memory storage + Database persistence pro pipeline progress
import { PipelineDatabase } from './database';

export interface PipelineStep {
  id: string;
  name: string;
  emoji: string;
  description: string;
  service: string;
  status: 'waiting' | 'running' | 'completed' | 'error' | 'not_implemented';
  output?: any;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  isAIStep?: boolean; // Added isAIStep flag
}

export interface PipelineState {
  pipeline_id: string;
  status: 'waiting' | 'running' | 'completed' | 'error';
  current_step: number;
  completed_steps: number;
  total_steps: number;
  steps: PipelineStep[];
  created_at: Date;
  updated_at: Date;
  final_outputs?: any;
}

// In-memory storage pro pipeline states (přežije Next.js restarts)
const pipelineStates = (globalThis as any).__pipelineStates || new Map<string, PipelineState>();
if (!(globalThis as any).__pipelineStates) {
  (globalThis as any).__pipelineStates = pipelineStates;
}

// Export pro debug účely
export { pipelineStates };

// Cleanup starých pipeline po 1 hodině
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hora
setInterval(() => {
  const now = Date.now();
  for (const [id, state] of pipelineStates.entries()) {
    if (now - state.created_at.getTime() > CLEANUP_INTERVAL) {
      pipelineStates.delete(id);
      console.log(`🧹 Cleaned up old pipeline: ${id}`);
    }
  }
}, CLEANUP_INTERVAL);

export class PipelineStateManager {
  // Vytvoř novou pipeline (in-memory + database)
  static async create(pipelineId: string, steps: PipelineStep[], title?: string, targetTime?: number): Promise<PipelineState> {
    const state: PipelineState = {
      pipeline_id: pipelineId,
      status: 'waiting',
      current_step: 0,
      completed_steps: 0,
      total_steps: steps.length,
      steps: steps,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Uložit do in-memory
    pipelineStates.set(pipelineId, state);
    
    // Uložit do databáze
    try {
      const finalTitle = title || `Pipeline ${new Date().toLocaleDateString('cs-CZ')}`;
      await PipelineDatabase.createPipeline(finalTitle, pipelineId, targetTime);
      
      // Vytvoř všechny kroky v databázi jako 'pending'
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await PipelineDatabase.savePipelineStep(
          pipelineId,
          step.id,
          i + 1,
          'pending'
        );
      }
      
      console.log(`📝 Created pipeline state: ${pipelineId} (in-memory + database)`);
    } catch (error) {
      console.error('💥 Database error while creating pipeline:', error);
      // Pokračujeme s in-memory storage i když DB selhala
    }
    
    return state;
  }

  // Získej pipeline state
  static get(pipelineId: string): PipelineState | null {
    return pipelineStates.get(pipelineId) || null;
  }

  // Update pipeline status (in-memory + database)
  static async updateStatus(pipelineId: string, status: PipelineState['status']): Promise<void> {
    const state = pipelineStates.get(pipelineId);
    if (state) {
      state.status = status;
      state.updated_at = new Date();
      console.log(`📊 Pipeline ${pipelineId} status: ${status}`);
      
      // Uložit do databáze
      try {
        await PipelineDatabase.updatePipelineStatus(pipelineId, status);
      } catch (error) {
        console.error('💥 Database error while updating pipeline status:', error);
      }
    }
  }

  // Update konkrétní krok (in-memory + database)
  static async updateStep(
    pipelineId: string, 
    stepId: string, 
    status: PipelineStep['status'], 
    output?: any, 
    error?: string
  ): Promise<void> {
    const state = pipelineStates.get(pipelineId);
    if (!state) return;

    const stepIndex = state.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;

    const step = state.steps[stepIndex];
    
    // Update step
    step.status = status;
    step.output = output;
    step.error = error;
    step.updated_at = new Date();

    if (status === 'running' && !step.startTime) {
      step.startTime = new Date();
    }
    
    if ((status === 'completed' || status === 'error') && !step.endTime) {
      step.endTime = new Date();
    }

    // Update pipeline metrics
    state.completed_steps = state.steps.filter(s => s.status === 'completed').length;
    state.current_step = stepIndex;
    state.updated_at = new Date();

    // Update pipeline status
    if (status === 'error') {
      state.status = 'error';
    } else if (state.completed_steps === state.total_steps) {
      state.status = 'completed';
    } else if (status === 'running') {
      state.status = 'running';
    }

    console.log(`🔄 Updated step ${stepId} (${stepIndex + 1}/${state.total_steps}): ${status}`);

    // Uložit do databáze
    try {
      // Extrakce asset URLs z output (pro soubory)
      const assetUrls: string[] = [];
      if (output && typeof output === 'object') {
        // Najdi všechny URL které začínají s /uploads/
        const findUrls = (obj: any) => {
          if (typeof obj === 'string' && obj.startsWith('/uploads/')) {
            assetUrls.push(obj);
          } else if (Array.isArray(obj)) {
            obj.forEach(findUrls);
          } else if (typeof obj === 'object' && obj !== null) {
            Object.values(obj).forEach(findUrls);
          }
        };
        findUrls(output);
      }

      await PipelineDatabase.savePipelineStep(
        pipelineId,
        stepId,
        stepIndex + 1,
        status,
        output,
        assetUrls.length > 0 ? assetUrls : undefined,
        error
      );

      // Update pipeline status v databázi
      await PipelineDatabase.updatePipelineStatus(pipelineId, state.status);
      
         } catch (dbError) {
       console.error('💥 Database error while updating step:', dbError);
     }
  }

  // Nastav final outputs
  static setFinalOutputs(pipelineId: string, outputs: any): void {
    const state = pipelineStates.get(pipelineId);
    if (state) {
      state.final_outputs = outputs;
      state.updated_at = new Date();
    }
  }

  // Získej všechny aktivní pipelines
  static getAll(): PipelineState[] {
    return Array.from(pipelineStates.values());
  }

  // Smaž pipeline
  static delete(pipelineId: string): boolean {
    return pipelineStates.delete(pipelineId);
  }
}

// Helper funkce pro vytvoření default kroků
export function getDefaultPipelineSteps(): PipelineStep[] {
  return [
    {
      id: 'web-scraping',
      name: 'Web Scraping',
      emoji: '🕷️',
      description: 'Extrakce obsahu ze stránky',
      service: 'Custom Script',
      status: 'waiting',
      isAIStep: false
    },
    {
      id: 'ai-text-cleaner',
      name: 'AI Text Cleaner',
      emoji: '🧹',
      description: 'AI čištění features a benefits',
      service: 'OpenAI GPT-4o',
      status: 'waiting',
      isAIStep: true
    },
    {
      id: 'ai-summary',
      name: 'AI Summary Expert',
      emoji: '📝',
      description: 'OpenAI GPT-4o analýza',
      service: 'OpenAI GPT-4o',
      status: 'waiting',
      isAIStep: true
    },
    {
      id: 'viral-hooks',
      name: 'Viral Hooks Creator',
      emoji: '🎯',
      description: 'Generování přitažlivých začátků',
      service: 'OpenAI GPT-4o',
      status: 'waiting',
      isAIStep: true
    },
    {
      id: 'script-generation',
      name: 'Video Script Writer',
      emoji: '📖',
      description: 'Kompletní video script',
      service: 'OpenAI GPT-4o',
      status: 'waiting',
      isAIStep: true
    },
    {
      id: 'timeline-creation',
      name: 'Timeline Creator',
      emoji: '⏱️',
      description: 'AI timeline segmentace',
      service: 'OpenAI GPT-4o',
      status: 'waiting',
      isAIStep: true
    },
    {
      id: 'background-selection',
      name: 'Background Selector',
      emoji: '🎨',
      description: 'Výběr pozadí a stylů',
      service: 'OpenAI GPT-4o',
      status: 'waiting',
      isAIStep: true
    },
    {
      id: 'music-sound',
      name: 'Music & Sound Expert',
      emoji: '🎵',
      description: 'Hudba a zvukové efekty',
      service: 'OpenAI GPT-4o',
      status: 'waiting',
      isAIStep: true
    },
    {
      id: 'avatar-behavior',
      name: 'Avatar Behavior Expert',
      emoji: '👤',
      description: 'Gesta a chování avatara',
      service: 'OpenAI GPT-4o',
      status: 'waiting',
      isAIStep: true
    },
    {
      id: 'thumbnail-concept',
      name: 'Thumbnail Creator',
      emoji: '🖼️',
      description: 'Návrh náhledového obrázku',
      service: 'OpenAI GPT-4o',
      status: 'waiting',
      isAIStep: true
    },
    {
      id: 'voice-generation',
      name: 'Voice Generation',
      emoji: '🗣️',
      description: 'ElevenLabs TTS',
      service: 'ElevenLabs',
      status: 'waiting',
      isAIStep: false
    },
    {
      id: 'avatar-generation',
      name: 'Avatar Generation',
      emoji: '👥',
      description: 'HeyGen AI avatar',
      service: 'HeyGen',
      status: 'not_implemented',
      isAIStep: false
    },
    {
      id: 'background-video',
      name: 'Background Video',
      emoji: '🎬',
      description: 'JSON2Video generování',
      service: 'JSON2Video',
      status: 'not_implemented',
      isAIStep: false
    },
    {
      id: 'final-merge',
      name: 'Final Merge',
      emoji: '🎞️',
      description: 'FFmpeg slučování',
      service: 'FFmpeg',
      status: 'not_implemented',
      isAIStep: false
    }
  ];
} 