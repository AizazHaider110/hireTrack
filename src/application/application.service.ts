import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, ApplicationStatus } from '@prisma/client';

@Injectable()
export class ApplicationService {
  constructor(private prisma: PrismaService) {}

  async apply(candidateId: string, jobId: string, resume?: string) {
    return this.prisma.application.create({
      data: {
        candidate: { connect: { id: candidateId } },
        job: { connect: { id: jobId } },
        resume,
      },
    });
  }

  async getAll() {
    return this.prisma.application.findMany({
      include: { candidate: true, job: true },
    });
  }

  async updateStatus(id: string, status: ApplicationStatus) {
    return this.prisma.application.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string) {
    return this.prisma.application.delete({ where: { id } });
  }
}
