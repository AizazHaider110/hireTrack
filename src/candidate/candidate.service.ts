import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CandidateService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.candidate.findMany({
      include: {
        applications: true,
      },
    });
  }

  async create(data: Prisma.CandidateCreateInput) {
    return this.prisma.candidate.create({ data });
  }

  async delete(id: string) {
    return this.prisma.candidate.delete({ where: { id } });
  }
}
