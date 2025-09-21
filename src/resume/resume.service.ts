import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ParsedResume {
  skills: string[];
  education?: string;
  experience?: string;
  rawText?: string;
}

@Injectable()
export class ResumeService {
  constructor(private prisma: PrismaService) {}

  async uploadResume(userId: string, file: Express.Multer.File): Promise<string> {
    // In a real implementation, you would upload to cloud storage (AWS S3, etc.)
    // For now, we'll store the file path locally
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = `uploads/${fileName}`;
    
    // Save file to uploads directory
    // In production, use cloud storage
    return filePath;
  }

  async parseResume(filePath: string): Promise<ParsedResume> {
    // Placeholder for resume parsing
    // In production, you would:
    // 1. Use pyresparser via microservice
    // 2. Use resume-parser npm package
    // 3. Use AI services like OpenAI for parsing
    
    // Mock parsing result
    const parsedData: ParsedResume = {
      skills: ['JavaScript', 'TypeScript', 'Node.js', 'NestJS', 'PostgreSQL'],
      education: 'Bachelor of Science in Computer Science',
      experience: '3 years of full-stack development experience',
      rawText: 'Mock resume text content...',
    };

    return parsedData;
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

    // Parse resume
    const parsedData = await this.parseResume(resumeUrl);

    // Update candidate profile with parsed data
    const updatedCandidate = await this.prisma.candidate.update({
      where: { userId },
      data: {
        resumeUrl,
        skills: parsedData.skills,
        education: parsedData.education,
        experience: parsedData.experience,
      },
    });

    // Store parsed data
    await this.prisma.resumeParse.upsert({
      where: { candidateId: candidate.id },
      update: {
        skills: parsedData.skills,
        education: parsedData.education,
        experience: parsedData.experience,
        rawText: parsedData.rawText,
      },
      create: {
        candidateId: candidate.id,
        skills: parsedData.skills,
        education: parsedData.education,
        experience: parsedData.experience,
        rawText: parsedData.rawText,
      },
    });

    return {
      candidate: updatedCandidate,
      parsedData,
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
}
