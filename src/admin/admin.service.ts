import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(userRole: Role) {
    if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can access dashboard stats');
    }

    const [totalUsers, totalJobs, totalApplications, totalCandidates] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.jobPosting.count(),
      this.prisma.application.count(),
      this.prisma.candidate.count(),
    ]);

    const usersByRole = await this.prisma.user.groupBy({
      by: ['role'],
      _count: {
        role: true,
      },
    });

    const applicationsByStatus = await this.prisma.application.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const recentJobs = await this.prisma.jobPosting.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    const recentApplications = await this.prisma.application.findMany({
      take: 10,
      orderBy: {
        appliedAt: 'desc',
      },
      include: {
        job: {
          select: {
            title: true,
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

    return {
      stats: {
        totalUsers,
        totalJobs,
        totalApplications,
        totalCandidates,
      },
      usersByRole,
      applicationsByStatus,
      recentJobs,
      recentApplications,
    };
  }

  async getAllUsers(userRole: Role) {
    if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can view all users');
    }

    return this.prisma.user.findMany({
      include: {
        candidate: true,
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
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getUserById(userId: string, userRole: Role) {
    if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can view user details');
    }

    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        candidate: {
          include: {
            resumeParse: true,
          },
        },
        jobs: {
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
  }
}
