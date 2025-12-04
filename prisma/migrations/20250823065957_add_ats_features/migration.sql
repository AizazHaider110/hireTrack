/*
  Warnings:

  - You are about to drop the column `resume` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Candidate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Candidate` will be added. If there are existing duplicate values, this will fail.
*/

-- First, add columns with default values
ALTER TABLE "Application" ADD COLUMN "coverLetter" TEXT;
ALTER TABLE "Application" ADD COLUMN "resumeUrl" TEXT;
ALTER TABLE "Application" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Application" ADD COLUMN "userId" TEXT;

ALTER TABLE "Candidate" ADD COLUMN "education" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "experience" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "skills" TEXT[] DEFAULT '{}';
ALTER TABLE "Candidate" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Candidate" ADD COLUMN "userId" TEXT;

ALTER TABLE "JobPosting" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "JobPosting" ADD COLUMN "requirements" TEXT[] DEFAULT '{}';
ALTER TABLE "JobPosting" ADD COLUMN "salary" TEXT;
ALTER TABLE "JobPosting" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ResumeParse" ADD COLUMN "parsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- Migrate existing data
-- For Application table, we need to set userId based on candidateId
UPDATE "Application" SET "userId" = (
  SELECT "userId" FROM "Candidate" WHERE "Candidate"."id" = "Application"."candidateId"
);

-- For Candidate table, we need to create a User record and link it
-- First, create User records for existing candidates
INSERT INTO "User" ("id", "email", "password", "name", "role", "phone", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  "email",
  '$2b$10$defaultpassword', -- You should update this with proper hashed passwords
  "name",
  'RECRUITER', -- Use existing role instead of CANDIDATE
  "phone",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Candidate";

-- Then update Candidate records with the new userId
UPDATE "Candidate" SET "userId" = (
  SELECT "id" FROM "User" WHERE "User"."email" = "Candidate"."email"
);

-- Now make the columns NOT NULL
ALTER TABLE "Application" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Candidate" ALTER COLUMN "userId" SET NOT NULL;

-- Drop old columns
ALTER TABLE "Application" DROP COLUMN "resume";
ALTER TABLE "Candidate" DROP COLUMN "email";
ALTER TABLE "Candidate" DROP COLUMN "name";
ALTER TABLE "Candidate" DROP COLUMN "phone";
ALTER TABLE "Candidate" ALTER COLUMN "resumeUrl" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_userId_key" ON "Candidate"("userId");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Finally, add the CANDIDATE enum value
ALTER TYPE "Role" ADD VALUE 'CANDIDATE';

-- Set default role to CANDIDATE
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CANDIDATE';
