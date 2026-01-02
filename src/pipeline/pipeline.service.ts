import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  CreatePipelineDto,
  UpdatePipelineStagesDto,
  MoveCandidateDto,
  BulkMoveCandidatesDto,
  StageTemplateDto,
} from '../common/dto/pipeline.dto';
import { Role } from '@prisma/client';

@Injectable()
export class PipelineService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async createPipeline(
    userId: string,
    userRole: Role,
    createPipelineDto: CreatePipelineDto,
  ) {
    // Check if job exists and user has access
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: createPipelineDto.jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only create pipelines for your own jobs');
    }

    // Check if pipeline already exists
    const existingPipeline = await this.prisma.pipeline.findUnique({
      where: { jobId: createPipelineDto.jobId },
    });

    if (existingPipeline) {
      throw new ConflictException('Pipeline already exists for this job');
    }

    // Default stages if none provided
    const defaultStages: StageTemplateDto[] = [
      { name: 'Applied', order: 0, color: '#3B82F6' },
      { name: 'Phone Screen', order: 1, color: '#F59E0B' },
      { name: 'Technical Interview', order: 2, color: '#8B5CF6' },
      { name: 'Final Interview', order: 3, color: '#10B981' },
      { name: 'Offer', order: 4, color: '#EF4444' },
      { name: 'Hired', order: 5, color: '#059669' },
    ];

    const stages = createPipelineDto.stages || defaultStages;

    return this.prisma.pipeline.create({
      data: {
        jobId: createPipelineDto.jobId,
        stages: {
          create: stages.map((stage) => ({
            name: stage.name,
            order: stage.order,
            color: stage.color || '#6B7280',
          })),
        },
      },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            candidates: {
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
        job: {
          select: {
            title: true,
            id: true,
          },
        },
      },
    });
  }

  async updatePipelineStages(
    pipelineId: string,
    userId: string,
    userRole: Role,
    updateStagesDto: UpdatePipelineStagesDto,
  ) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        job: true,
        stages: true,
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    if (pipeline.job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only update your own job pipelines');
    }

    // Use transaction to update stages
    return this.prisma.$transaction(async (tx) => {
      // Delete existing stages
      await tx.stage.deleteMany({
        where: { pipelineId },
      });

      // Create new stages
      await tx.stage.createMany({
        data: updateStagesDto.stages.map((stage) => ({
          pipelineId,
          name: stage.name,
          order: stage.order,
          color: stage.color || '#6B7280',
        })),
      });

      // Return updated pipeline
      return tx.pipeline.findUnique({
        where: { id: pipelineId },
        include: {
          stages: {
            orderBy: { order: 'asc' },
            include: {
              candidates: {
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
          job: {
            select: {
              title: true,
              id: true,
            },
          },
        },
      });
    });
  }

  async moveCandidateToStage(
    userId: string,
    userRole: Role,
    moveCandidateDto: MoveCandidateDto,
  ) {
    // Verify candidate exists
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: moveCandidateDto.candidateId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    // Verify stage exists and get pipeline info
    const stage = await this.prisma.stage.findUnique({
      where: { id: moveCandidateDto.stageId },
      include: {
        pipeline: {
          include: {
            job: true,
          },
        },
      },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    // Check permissions
    if (stage.pipeline.job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only move candidates in your own job pipelines');
    }

    // Get current candidate card if exists
    const currentCard = await this.prisma.candidateCard.findFirst({
      where: {
        candidateId: moveCandidateDto.candidateId,
        stage: {
          pipelineId: stage.pipelineId,
        },
      },
      include: {
        stage: true,
      },
    });

    return this.prisma.$transaction(async (tx) => {
      let fromStageId = null;

      // If candidate is already in pipeline, update existing card
      if (currentCard) {
        fromStageId = currentCard.stageId;
        
        // Don't move if already in target stage
        if (currentCard.stageId === moveCandidateDto.stageId) {
          return currentCard;
        }

        await tx.candidateCard.update({
          where: { id: currentCard.id },
          data: {
            stageId: moveCandidateDto.stageId,
            enteredStageAt: new Date(),
          },
        });
      } else {
        // Create new candidate card
        await tx.candidateCard.create({
          data: {
            candidateId: moveCandidateDto.candidateId,
            stageId: moveCandidateDto.stageId,
            position: 0, // Will be updated by position logic if needed
          },
        });
      }

      // Log stage transition
      await tx.stageTransition.create({
        data: {
          candidateId: moveCandidateDto.candidateId,
          fromStageId: fromStageId || moveCandidateDto.stageId,
          toStageId: moveCandidateDto.stageId,
          movedBy: userId,
          reason: moveCandidateDto.reason,
        },
      });

      // Get updated candidate card
      const updatedCard = await tx.candidateCard.findFirst({
        where: {
          candidateId: moveCandidateDto.candidateId,
          stageId: moveCandidateDto.stageId,
        },
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
          stage: {
            include: {
              pipeline: {
                include: {
                  job: {
                    select: {
                      title: true,
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Emit stage change event
      this.eventBus.publish('candidate.stage.changed', {
        candidateId: moveCandidateDto.candidateId,
        jobId: stage.pipeline.job.id,
        fromStageId,
        toStageId: moveCandidateDto.stageId,
        movedBy: userId,
        reason: moveCandidateDto.reason,
      });

      return updatedCard;
    });
  }

  async bulkMoveCandidates(
    userId: string,
    userRole: Role,
    bulkMoveDto: BulkMoveCandidatesDto,
  ) {
    // Verify stage exists and get pipeline info
    const stage = await this.prisma.stage.findUnique({
      where: { id: bulkMoveDto.stageId },
      include: {
        pipeline: {
          include: {
            job: true,
          },
        },
      },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    // Check permissions
    if (stage.pipeline.job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only move candidates in your own job pipelines');
    }

    const results = [];

    // Process each candidate
    for (const candidateId of bulkMoveDto.candidateIds) {
      try {
        const result = await this.moveCandidateToStage(userId, userRole, {
          candidateId,
          stageId: bulkMoveDto.stageId,
          reason: bulkMoveDto.reason,
        });
        results.push(result);
      } catch (error) {
        // Continue with other candidates if one fails
        console.error(`Failed to move candidate ${candidateId}:`, error.message);
      }
    }

    return results;
  }

  async getPipelineByJob(jobId: string, userId: string, userRole: Role) {
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only view pipelines for your own jobs');
    }

    const pipeline = await this.prisma.pipeline.findUnique({
      where: { jobId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            candidates: {
              include: {
                candidate: {
                  include: {
                    user: {
                      select: {
                        name: true,
                        email: true,
                      },
                    },
                    applications: {
                      where: { jobId },
                      select: {
                        status: true,
                        appliedAt: true,
                      },
                    },
                  },
                },
              },
              orderBy: { enteredStageAt: 'desc' },
            },
          },
        },
        job: {
          select: {
            title: true,
            id: true,
          },
        },
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found for this job');
    }

    return pipeline;
  }

  async getStageTransitionHistory(candidateId: string, userId: string, userRole: Role) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    // Get all transitions for this candidate
    const transitions = await this.prisma.stageTransition.findMany({
      where: { candidateId },
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
      orderBy: { movedAt: 'desc' },
    });

    // For non-admin users, filter transitions to only jobs they own
    if (userRole !== Role.ADMIN) {
      // Get job IDs that the user owns
      const userJobs = await this.prisma.jobPosting.findMany({
        where: { userId },
        select: { id: true },
      });
      const userJobIds = userJobs.map(job => job.id);

      // Get stages that belong to user's jobs
      const userStages = await this.prisma.stage.findMany({
        where: {
          pipeline: {
            jobId: { in: userJobIds },
          },
        },
        select: { id: true },
      });
      const userStageIds = userStages.map(stage => stage.id);

      // Filter transitions to only those involving user's job stages
      return transitions.filter(transition => 
        userStageIds.includes(transition.fromStageId) || 
        userStageIds.includes(transition.toStageId)
      );
    }

    return transitions;
  }

  async getCandidateCard(candidateId: string, jobId: string, userId: string, userRole: Role) {
    // Verify job access
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only view candidate cards for your own jobs');
    }

    // Get pipeline for the job
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { jobId },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found for this job');
    }

    // Get candidate card
    const candidateCard = await this.prisma.candidateCard.findFirst({
      where: {
        candidateId,
        stage: {
          pipelineId: pipeline.id,
        },
      },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            applications: {
              where: { jobId },
              select: {
                status: true,
                appliedAt: true,
                coverLetter: true,
                resumeUrl: true,
              },
            },
          },
        },
        stage: {
          include: {
            pipeline: {
              include: {
                job: {
                  select: {
                    title: true,
                    id: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return candidateCard;
  }

  async updateCandidateCardPosition(
    candidateId: string,
    stageId: string,
    newPosition: number,
    userId: string,
    userRole: Role,
  ) {
    // Verify stage exists and get pipeline info
    const stage = await this.prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        pipeline: {
          include: {
            job: true,
          },
        },
      },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    // Check permissions
    if (stage.pipeline.job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only update candidate positions in your own job pipelines');
    }

    // Get candidate card
    const candidateCard = await this.prisma.candidateCard.findFirst({
      where: {
        candidateId,
        stageId,
      },
    });

    if (!candidateCard) {
      throw new NotFoundException('Candidate card not found in this stage');
    }

    // Update position
    return this.prisma.candidateCard.update({
      where: { id: candidateCard.id },
      data: { position: newPosition },
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
        stage: true,
      },
    });
  }

  async removeCandidateFromPipeline(
    candidateId: string,
    jobId: string,
    userId: string,
    userRole: Role,
    reason?: string,
  ) {
    // Verify job access
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only remove candidates from your own job pipelines');
    }

    // Get pipeline
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { jobId },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found for this job');
    }

    // Get candidate card
    const candidateCard = await this.prisma.candidateCard.findFirst({
      where: {
        candidateId,
        stage: {
          pipelineId: pipeline.id,
        },
      },
      include: {
        stage: true,
      },
    });

    if (!candidateCard) {
      throw new NotFoundException('Candidate not found in this pipeline');
    }

    return this.prisma.$transaction(async (tx) => {
      // Log removal as stage transition
      await tx.stageTransition.create({
        data: {
          candidateId,
          fromStageId: candidateCard.stageId,
          toStageId: candidateCard.stageId, // Same stage for removal
          movedBy: userId,
          reason: reason || 'Removed from pipeline',
        },
      });

      // Remove candidate card
      await tx.candidateCard.delete({
        where: { id: candidateCard.id },
      });

      // Emit removal event
      this.eventBus.publish('candidate.removed.from.pipeline', {
        candidateId,
        jobId,
        stageId: candidateCard.stageId,
        removedBy: userId,
        reason,
      });

      return { success: true, message: 'Candidate removed from pipeline' };
    });
  }

  async addCandidateToPipeline(
    candidateId: string,
    jobId: string,
    stageId: string,
    userId: string,
    userRole: Role,
  ) {
    // Verify candidate exists
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    // Verify stage exists and belongs to the job
    const stage = await this.prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        pipeline: {
          include: {
            job: true,
          },
        },
      },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    if (stage.pipeline.jobId !== jobId) {
      throw new BadRequestException('Stage does not belong to the specified job');
    }

    // Check permissions
    if (stage.pipeline.job.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only add candidates to your own job pipelines');
    }

    // Check if candidate is already in this pipeline
    const existingCard = await this.prisma.candidateCard.findFirst({
      where: {
        candidateId,
        stage: {
          pipelineId: stage.pipelineId,
        },
      },
    });

    if (existingCard) {
      throw new ConflictException('Candidate is already in this pipeline');
    }

    return this.prisma.$transaction(async (tx) => {
      // Create candidate card
      const candidateCard = await tx.candidateCard.create({
        data: {
          candidateId,
          stageId,
          position: 0,
        },
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
          stage: {
            include: {
              pipeline: {
                include: {
                  job: {
                    select: {
                      title: true,
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Log addition as stage transition
      await tx.stageTransition.create({
        data: {
          candidateId,
          fromStageId: stageId, // Same stage for addition
          toStageId: stageId,
          movedBy: userId,
          reason: 'Added to pipeline',
        },
      });

      // Emit addition event
      this.eventBus.publish('candidate.added.to.pipeline', {
        candidateId,
        jobId,
        stageId,
        addedBy: userId,
      });

      return candidateCard;
    });
  }
}