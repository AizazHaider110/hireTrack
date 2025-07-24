import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class JobService {
  constructor(private prisma: PrismaService) {}

  async getAllJobs() {
    return this.prisma.jobPosting.findMany({
      include: {
        user: true,
        applications: true,
      },
    });
  }

  async createJob(data: Prisma.JobPostingCreateInput) {
    return this.prisma.jobPosting.create({ data });
  }

  async deleteJob(id: string) {
    return this.prisma.jobPosting.delete({ where: { id } });
  }
}