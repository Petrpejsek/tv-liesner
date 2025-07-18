import { PrismaClient } from '../generated/prisma';

// Singleton pattern pro Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Pipeline database operations
export class PipelineDatabase {
  
  // 📝 Vytvoření nové pipeline
  static async createPipeline(title: string, pipelineId: string, targetTime?: number) {
    return await prisma.pipeline.create({
      data: {
        id: pipelineId,
        title,
        targetTime: targetTime || 30,  // default 30s
        status: 'running',
      },
    });
  }

  // 📝 Aktualizace statusu pipeline
  static async updatePipelineStatus(pipelineId: string, status: 'waiting' | 'running' | 'completed' | 'error') {
    return await prisma.pipeline.update({
      where: { id: pipelineId },
      data: { 
        status,
        updatedAt: new Date(),
      },
    });
  }

  // 💾 Uložení/aktualizace kroku pipeline
  static async savePipelineStep(
    pipelineId: string,
    stepName: string,
    order: number,
    status: 'pending' | 'running' | 'completed' | 'error',
    outputJson?: any,
    assetUrls?: string[],
    errorLogs?: string
  ) {
    const assetUrlsJson = assetUrls ? assetUrls : undefined;
    
    return await prisma.pipelineStep.upsert({
      where: {
        pipelineId_stepName: {
          pipelineId,
          stepName,
        },
      },
      update: {
        status,
        outputJson,
        assetUrls: assetUrlsJson,
        errorLogs,
        updatedAt: new Date(),
      },
      create: {
        pipelineId,
        stepName,
        order,
        status,
        outputJson,
        assetUrls: assetUrlsJson,
        errorLogs,
      },
    });
  }

  // 📋 Získání všech pipeline (pro historie)
  static async getAllPipelines() {
    return await prisma.pipeline.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  // 🔍 Získání konkrétní pipeline s kroky
  static async getPipelineById(pipelineId: string) {
    return await prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  // 🔄 Získání kroků pro restart (od určitého kroku dál)
  static async getStepsFromOrder(pipelineId: string, fromOrder: number) {
    return await prisma.pipelineStep.findMany({
      where: {
        pipelineId,
        order: { gte: fromOrder },
      },
      orderBy: { order: 'asc' },
    });
  }

  // 📊 Statistiky pipeline (kolik dokončených kroků)
  static async getPipelineStats(pipelineId: string) {
    const completedSteps = await prisma.pipelineStep.count({
      where: {
        pipelineId,
        status: 'completed',
      },
    });

    const totalSteps = await prisma.pipelineStep.count({
      where: { pipelineId },
    });

    return { completedSteps, totalSteps };
  }
} 