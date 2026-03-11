-- CreateEnum
CREATE TYPE "SearchEntityType" AS ENUM ('CANDIDATE', 'JOB', 'APPLICATION', 'ALL');

-- CreateEnum
CREATE TYPE "AlertFrequency" AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "query" TEXT NOT NULL,
    "entityType" "SearchEntityType" NOT NULL DEFAULT 'ALL',
    "filters" JSONB,
    "alertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "alertFrequency" "AlertFrequency",
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "lastExecutedAt" TIMESTAMP(3),
    "resultCount" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedSearch_createdBy_idx" ON "SavedSearch"("createdBy");

-- CreateIndex
CREATE INDEX "SavedSearch_entityType_idx" ON "SavedSearch"("entityType");

-- CreateIndex
CREATE INDEX "SavedSearch_isShared_idx" ON "SavedSearch"("isShared");

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
