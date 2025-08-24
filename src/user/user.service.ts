import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        candidate: {
          include: {
            resumeParse: true,
          },
        },
        jobs: {
          include: {
            _count: {
              select: {
                applications: true,
              },
            },
          },
        },
        applications: {
          include: {
                            job: {
                  select: {
                    title: true,
                  },
                },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, updateData: { name?: string; phone?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getCandidateProfile(userId: string, userRole: Role) {
    if (userRole !== Role.CANDIDATE) {
      throw new ForbiddenException('Only candidates can access candidate profile');
    }

    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        resumeParse: true,
        applications: {
          include: {
            job: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }

    return candidate;
  }
}
