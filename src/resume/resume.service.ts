import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResumeParsingService, ParsedResumeData } from './resume-parsing.service';
import * as fs from 'fs';
import * as path from 'path';

export interface ParsedResume {
  skills: string[];
  education?: string;
  experience?: string;
  rawText?: string;
}

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    private prisma: PrismaService,
    private resumeParsingService: ResumeParsingService,
  ) {}

  async uploadResume(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    // Ensure uploads directory exists
    const uploadsDir = 'uploads';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(uploadsDir, fileName);

    // Save file to uploads directory
    fs.writeFileSync(filePath, file.buffer);
    this.logger.log(`Resume uploaded: ${filePath}`);

    return filePath;
  }

  async parseResume(filePath: string): Promise<ParsedResume> {
    // Use the enhanced parsing service
    const parsedData = await this.resumeParsingService.parseResume(filePath);

    return {
      skills: parsedData.skills,
      education: parsedData.education.map(e => `${e.degree} - ${e.institution}`).join('; '),
      experience: parsedData.experience.map(e => `${e.title} at ${e.company}`).join('; '),
      rawText: parsedData.rawText,
    };
  }

  async parseResumeEnhanced(filePath: string): Promise<ParsedResumeData> {
    // Use AI-enhanced parsing if available
    return this.resumeParsingService.parseResumeWithAI(filePath);
  }

  async updateCandidateResume(userId: string, file: Express.Multer.File) {
    // Get candidate profile
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
    });

    if (!candidate) {
      throw new BadRequestException('Candidate profile not found');
    }

    // Upload resume
    const resumeUrl = await this.uploadResume(userId, file);

    // Parse resume using enhanced service
    const parsedData = await this.resumeParsingService.parseAndStoreResume(candidate.id, resumeUrl);

    // Update candidate profile with parsed data
    const updatedCandidate = await this.prisma.candidate.update({
      where: { userId },
      data: {
        resumeUrl,
        skills: parsedData.skills,
        education: parsedData.education.map(e => `${e.degree} - ${e.institution}`).join('; '),
        experience: parsedData.experience.map(e => `${e.title} at ${e.company}`).join('; '),
      },
    });

    return {
      candidate: updatedCandidate,
      parsedData: {
        skills: parsedData.skills,
        education: parsedData.education,
        experience: parsedData.experience,
        contactInfo: parsedData.contactInfo,
        summary: parsedData.summary,
        certifications: parsedData.certifications,
        languages: parsedData.languages,
        totalYearsExperience: parsedData.totalYearsExperience,
      },
    };
  }

  async getCandidateResume(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: {
        resumeParse: true,
      },
    });

    if (!candidate) {
      throw new BadRequestException('Candidate profile not found');
    }

    return candidate;
  }

  /**
   * Flag resume for manual review when parsing fails
   */
  async flagResumeForReview(candidateId: string, reason: string): Promise<void> {
    this.logger.warn(`Resume flagged for manual review: ${candidateId}, reason: ${reason}`);
    
    // In production, this could create a task or notification for recruiters
    await this.prisma.resumeParse.upsert({
      where: { candidateId },
      update: {
        rawText: `FLAGGED FOR REVIEW: ${reason}`,
        parsedAt: new Date(),
      },
      create: {
        candidateId,
        skills: [],
        rawText: `FLAGGED FOR REVIEW: ${reason}`,
      },
    });
  }
}
