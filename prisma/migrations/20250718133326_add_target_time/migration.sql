-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pipeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "targetTime" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Pipeline" ("createdAt", "id", "status", "title", "updatedAt") SELECT "createdAt", "id", "status", "title", "updatedAt" FROM "Pipeline";
DROP TABLE "Pipeline";
ALTER TABLE "new_Pipeline" RENAME TO "Pipeline";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
