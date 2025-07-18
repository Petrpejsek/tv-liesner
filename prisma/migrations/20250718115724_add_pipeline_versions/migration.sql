-- CreateTable
CREATE TABLE "PipelineVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "description" TEXT,
    "pipelineTitle" TEXT NOT NULL,
    "totalSteps" INTEGER NOT NULL,
    "completedSteps" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PipelineVersion_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PipelineVersion_pipelineId_createdAt_idx" ON "PipelineVersion"("pipelineId", "createdAt");
