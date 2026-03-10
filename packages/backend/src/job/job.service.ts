import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto, UpdateJobDto } from '../common/dto/job.dto';
import { Role } from '@prisma/client';

@Injectable()
export class JobService {
  constructor(private prisma: PrismaService) {}

  async getAllJobs(isActive?: boolean) {
    const where = isActive !== undefined ? { isActive } : {};

    return this.prisma.jobPosting.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        applications: {
          include: {
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
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getJobById(id: string) {
    const job = await this.prisma.jobPosting.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        applications: {
          include: {
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
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  async createJob(userId: string, userRole: Role, createJobDto: CreateJobDto) {
    if (userRole !== Role.RECRUITER && userRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only recruiters and admins can create jobs',
      );
    }

    return this.prisma.jobPosting.create({
      data: {
        ...createJobDto,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async updateJob(
    id: string,
    userId: string,
    userRole: Role,
    updateJobDto: UpdateJobDto,
  ) {
    const job = await this.prisma.jobPosting.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Only the job creator or admin can update
    if (job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only update your own jobs');
    }

    return this.prisma.jobPosting.update({
      where: { id },
      data: updateJobDto,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async deleteJob(id: string, userId: string, userRole: Role) {
    const job = await this.prisma.jobPosting.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Only the job creator or admin can delete
    if (job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only delete your own jobs');
    }

    return this.prisma.jobPosting.delete({
      where: { id },
    });
  }

  async getJobsByRecruiter(userId: string) {
    return this.prisma.jobPosting.findMany({
      where: { userId },
      include: {
        applications: {
          include: {
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
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
