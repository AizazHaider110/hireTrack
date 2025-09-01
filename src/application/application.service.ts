import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto, UpdateApplicationDto } from '../common/dto/application.dto';
import { Role, ApplicationStatus } from '@prisma/client';

@Injectable()
export class ApplicationService {
  constructor(private prisma: PrismaService) {}

  async createApplication(userId: string, userRole: Role, createApplicationDto: CreateApplicationDto) {
    if (userRole !== Role.CANDIDATE) {
      throw new ForbiddenException('Only candidates can apply to jobs');
    }

    // Check if job exists and is active
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: createApplicationDto.jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (!job.isActive) {
      throw new ForbiddenException('This job is not active');
    }

    // Get candidate profile
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }

    // Check if already applied
    const existingApplication = await this.prisma.application.findUnique({
      where: {
        candidateId_jobId: {
          candidateId: candidate.id,
          jobId: createApplicationDto.jobId,
        },
      },
    });

    if (existingApplication) {
      throw new ConflictException('You have already applied to this job');
    }

    return this.prisma.application.create({
      data: {
        candidateId: candidate.id,
        jobId: createApplicationDto.jobId,
        userId,
        coverLetter: createApplicationDto.coverLetter,
        resumeUrl: createApplicationDto.resumeUrl,
      },
      include: {
        job: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        candidate: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async getApplicationsByCandidate(userId: string, userRole: Role) {
    if (userRole !== Role.CANDIDATE) {
      throw new ForbiddenException('Only candidates can view their applications');
    }

    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }

    return this.prisma.application.findMany({
      where: { candidateId: candidate.id },
      include: {
        job: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    });
  }

  async getApplicationsByJob(jobId: string, userId: string, userRole: Role) {
    // Check if user owns the job or is admin
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only view applications for your own jobs');
    }

    return this.prisma.application.findMany({
      where: { jobId },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            resumeParse: true,
          },
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    });
  }

  async updateApplicationStatus(
    applicationId: string,
    userId: string,
    userRole: Role,
    updateApplicationDto: UpdateApplicationDto,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Only job owner or admin can update application status
    if (application.job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only update applications for your own jobs');
    }

    return this.prisma.application.update({
      where: { id: applicationId },
      data: updateApplicationDto,
      include: {
        job: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        candidate: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async getAllApplications(userRole: Role) {
    if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can view all applications');
    }

    return this.prisma.application.findMany({
      include: {
        job: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        candidate: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    });
  }
}
