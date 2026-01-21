import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import {
  ScheduleInterviewDto,
  UpdateInterviewDto,
  AddParticipantDto,
  FeedbackDto,
  AvailabilityCheckDto,
  CancelInterviewDto,
  TimeSlotDto,
} from '../common/dto/interview.dto';

@Injectable()
export class InterviewService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async scheduleInterview(data: ScheduleInterviewDto, createdBy: string) {
    // Validate candidate exists
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: data.candidateId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    // Validate job exists
    const job = await this.prisma.jobPosting.findUnique({
      where: { id: data.jobId },
    });
    if (!job) {
      throw new NotFoundException('Job posting not found');
    }

    // Check for scheduling conflicts
    const scheduledAt = new Date(data.scheduledAt);
    const endTime = new Date(scheduledAt.getTime() + data.duration * 60000);

    await this.checkSchedulingConflicts(
      data.participants?.map((p) => p.userId) || [],
      scheduledAt,
      endTime,
    );

    // Create interview
    const interview = await this.prisma.interview.create({
      data: {
        candidateId: data.candidateId,
        jobId: data.jobId,
        scheduledAt,
        duration: data.duration,
        location: data.location,
        type: data.type,
        notes: data.notes,
        createdBy,
        interviewers: {
          create:
            data.participants?.map((p) => ({
              userId: p.userId,
              role: p.role,
            })) || [],
        },
      },
      include: {
        interviewers: true,
        candidate: {
          include: {
            user: true,
          },
        },
      },
    });

    // Emit event for interview scheduled
    this.eventBus.publish('interview.scheduled', {
      interviewId: interview.id,
      candidateId: interview.candidateId,
      jobId: interview.jobId,
      scheduledAt: interview.scheduledAt,
      participants: interview.interviewers,
    });

    return interview;
  }

  async updateInterview(id: string, data: UpdateInterviewDto) {
    const existingInterview = await this.prisma.interview.findUnique({
      where: { id },
      include: { interviewers: true },
    });

    if (!existingInterview) {
      throw new NotFoundException('Interview not found');
    }

    // Check for scheduling conflicts if time is being updated
    if (data.scheduledAt || data.duration) {
      const scheduledAt = data.scheduledAt
        ? new Date(data.scheduledAt)
        : existingInterview.scheduledAt;
      const duration = data.duration || existingInterview.duration;
      const endTime = new Date(scheduledAt.getTime() + duration * 60000);

      const participantIds = existingInterview.interviewers.map(
        (p) => p.userId,
      );
      await this.checkSchedulingConflicts(
        participantIds,
        scheduledAt,
        endTime,
        id,
      );
    }

    const updatedInterview = await this.prisma.interview.update({
      where: { id },
      data: {
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        duration: data.duration,
        location: data.location,
        type: data.type,
        status: data.status,
        notes: data.notes,
        calendarEventId: data.calendarEventId,
      },
      include: {
        interviewers: true,
        candidate: {
          include: {
            user: true,
          },
        },
      },
    });

    // Emit event for interview updated
    this.eventBus.publish('interview.updated', {
      interviewId: updatedInterview.id,
      candidateId: updatedInterview.candidateId,
      jobId: updatedInterview.jobId,
      changes: data,
    });

    return updatedInterview;
  }

  async cancelInterview(id: string, data: CancelInterviewDto) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: { interviewers: true },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    if (interview.status === 'CANCELLED') {
      throw new BadRequestException('Interview is already cancelled');
    }

    const updatedInterview = await this.prisma.interview.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: interview.notes
          ? `${interview.notes}\n\nCancelled: ${data.reason}`
          : `Cancelled: ${data.reason}`,
      },
      include: {
        interviewers: true,
        candidate: {
          include: {
            user: true,
          },
        },
      },
    });

    // Emit event for interview cancelled
    this.eventBus.publish('interview.cancelled', {
      interviewId: updatedInterview.id,
      candidateId: updatedInterview.candidateId,
      jobId: updatedInterview.jobId,
      reason: data.reason,
      notifyParticipants: data.notifyParticipants,
    });

    return updatedInterview;
  }

  async addParticipant(interviewId: string, data: AddParticipantDto) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if participant already exists
    const existingParticipant =
      await this.prisma.interviewParticipant.findUnique({
        where: {
          interviewId_userId: {
            interviewId,
            userId: data.userId,
          },
        },
      });

    if (existingParticipant) {
      throw new ConflictException(
        'User is already a participant in this interview',
      );
    }

    // Check for scheduling conflicts
    const endTime = new Date(
      interview.scheduledAt.getTime() + interview.duration * 60000,
    );
    await this.checkSchedulingConflicts(
      [data.userId],
      interview.scheduledAt,
      endTime,
    );

    const participant = await this.prisma.interviewParticipant.create({
      data: {
        interviewId,
        userId: data.userId,
        role: data.role,
      },
    });

    // Emit event for participant added
    this.eventBus.publish('interview.participant.added', {
      interviewId,
      participantId: participant.id,
      userId: data.userId,
      role: data.role,
    });

    return participant;
  }

  async submitFeedback(interviewId: string, userId: string, data: FeedbackDto) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    // Check if user is a participant
    const participant = await this.prisma.interviewParticipant.findUnique({
      where: {
        interviewId_userId: {
          interviewId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new BadRequestException(
        'User is not a participant in this interview',
      );
    }

    const feedback = await this.prisma.feedback.create({
      data: {
        candidateId: interview.candidateId,
        interviewId,
        userId,
        rating: data.rating,
        comment: data.comment,
        isPrivate:
          typeof data.isPrivate === 'boolean'
            ? data.isPrivate
            : data.isPrivate === 'true',
      },
    });

    // Emit event for feedback submitted
    this.eventBus.publish('interview.feedback.submitted', {
      interviewId,
      feedbackId: feedback.id,
      candidateId: interview.candidateId,
      rating: data.rating,
    });

    return feedback;
  }

  async getInterviewsByCandidate(candidateId: string) {
    return this.prisma.interview.findMany({
      where: { candidateId },
      include: {
        interviewers: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getInterviewsByJob(jobId: string) {
    return this.prisma.interview.findMany({
      where: { jobId },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        interviewers: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getAvailableTimeSlots(
    data: AvailabilityCheckDto,
  ): Promise<TimeSlotDto[]> {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    // Get all interviews for the participants in the date range
    const existingInterviews = await this.prisma.interview.findMany({
      where: {
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['SCHEDULED', 'RESCHEDULED'],
        },
        interviewers: {
          some: {
            userId: {
              in: data.participantIds,
            },
          },
        },
      },
      include: {
        interviewers: true,
      },
    });

    // Generate available time slots (simplified logic)
    const timeSlots: TimeSlotDto[] = [];
    const workingHours = { start: 9, end: 17 }; // 9 AM to 5 PM

    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      for (let hour = workingHours.start; hour < workingHours.end; hour++) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setTime(slotEnd.getTime() + data.duration * 60000);

        // Check if this slot conflicts with existing interviews
        const hasConflict = existingInterviews.some((interview) => {
          const interviewEnd = new Date(
            interview.scheduledAt.getTime() + interview.duration * 60000,
          );
          return (
            (slotStart >= interview.scheduledAt && slotStart < interviewEnd) ||
            (slotEnd > interview.scheduledAt && slotEnd <= interviewEnd) ||
            (slotStart <= interview.scheduledAt && slotEnd >= interviewEnd)
          );
        });

        if (!hasConflict) {
          timeSlots.push({
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            availableParticipants: data.participantIds,
          });
        }
      }
    }

    return timeSlots;
  }

  async getInterviewById(id: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        interviewers: true,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return interview;
  }

  async getInterviewFeedback(interviewId: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return this.prisma.feedback.findMany({
      where: { interviewId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAggregatedFeedback(interviewId: string): Promise<{
    averageRating: number;
    totalFeedback: number;
    ratings: { [key: number]: number };
    feedback: any[];
  }> {
    const feedback = await this.getInterviewFeedback(interviewId);

    if (feedback.length === 0) {
      return {
        averageRating: 0,
        totalFeedback: 0,
        ratings: {},
        feedback: [],
      };
    }

    const ratings = feedback.reduce(
      (acc, f) => {
        acc[f.rating] = (acc[f.rating] || 0) + 1;
        return acc;
      },
      {} as { [key: number]: number },
    );

    const averageRating =
      feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;

    return {
      averageRating: Math.round(averageRating * 100) / 100,
      totalFeedback: feedback.length,
      ratings,
      feedback,
    };
  }

  async getUpcomingInterviews(userId?: string, daysAhead: number = 7) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);

    const whereClause: any = {
      scheduledAt: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        in: ['SCHEDULED', 'RESCHEDULED'],
      },
    };

    // If userId is provided, filter by user participation
    if (userId) {
      whereClause.OR = [
        { createdBy: userId },
        {
          interviewers: {
            some: {
              userId,
            },
          },
        },
      ];
    }

    return this.prisma.interview.findMany({
      where: whereClause,
      include: {
        candidate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        interviewers: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getInterviewsNeedingReminders() {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(
      now.getTime() + 24 * 60 * 60 * 1000,
    );
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    return this.prisma.interview.findMany({
      where: {
        status: {
          in: ['SCHEDULED', 'RESCHEDULED'],
        },
        scheduledAt: {
          gte: now,
          lte: twentyFourHoursFromNow,
        },
        OR: [
          // 24-hour reminder
          {
            scheduledAt: {
              gte: twentyFourHoursFromNow,
              lte: new Date(twentyFourHoursFromNow.getTime() + 60 * 60 * 1000), // 1-hour window
            },
          },
          // 1-hour reminder
          {
            scheduledAt: {
              gte: oneHourFromNow,
              lte: new Date(oneHourFromNow.getTime() + 15 * 60 * 1000), // 15-minute window
            },
          },
        ],
      },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        interviewers: true,
      },
    });
  }

  async sendInterviewReminders(): Promise<{ sent: number; failed: number }> {
    const interviews = await this.getInterviewsNeedingReminders();
    let sent = 0;
    let failed = 0;

    for (const interview of interviews) {
      try {
        const timeUntilInterview = interview.scheduledAt.getTime() - Date.now();
        const hoursUntil = Math.round(timeUntilInterview / (60 * 60 * 1000));

        let reminderType: string;
        if (hoursUntil >= 20 && hoursUntil <= 28) {
          reminderType = '24-hour';
        } else if (hoursUntil >= 0.5 && hoursUntil <= 1.5) {
          reminderType = '1-hour';
        } else {
          continue; // Skip if not in reminder window
        }

        // Emit event for reminder (would be handled by communication service)
        this.eventBus.publish('interview.reminder', {
          interviewId: interview.id,
          candidateId: interview.candidateId,
          reminderType,
          scheduledAt: interview.scheduledAt,
          participants: [
            interview.candidate.user,
            ...interview.interviewers.map((i: any) => ({
              userId: i.userId,
              role: i.role,
            })),
          ],
        });

        sent++;
      } catch (error) {
        console.error(
          `Failed to send reminder for interview ${interview.id}:`,
          error,
        );
        failed++;
      }
    }

    return { sent, failed };
  }

  async getInterviewAnalytics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalInterviews: number;
    completedInterviews: number;
    cancelledInterviews: number;
    averageRating: number;
    interviewsByType: { [key: string]: number };
    interviewsByStatus: { [key: string]: number };
  }> {
    const interviews = await this.prisma.interview.findMany({
      where: {
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalInterviews = interviews.length;
    const completedInterviews = interviews.filter(
      (i) => i.status === 'COMPLETED',
    ).length;
    const cancelledInterviews = interviews.filter(
      (i) => i.status === 'CANCELLED',
    ).length;

    // Get all feedback for these interviews
    const allFeedback = await this.prisma.feedback.findMany({
      where: {
        interviewId: {
          in: interviews.map((i) => i.id),
        },
      },
    });

    const averageRating =
      allFeedback.length > 0
        ? allFeedback.reduce((sum, f) => sum + f.rating, 0) / allFeedback.length
        : 0;

    // Group by type
    const interviewsByType = interviews.reduce(
      (acc, interview) => {
        acc[interview.type] = (acc[interview.type] || 0) + 1;
        return acc;
      },
      {} as { [key: string]: number },
    );

    // Group by status
    const interviewsByStatus = interviews.reduce(
      (acc, interview) => {
        acc[interview.status] = (acc[interview.status] || 0) + 1;
        return acc;
      },
      {} as { [key: string]: number },
    );

    return {
      totalInterviews,
      completedInterviews,
      cancelledInterviews,
      averageRating: Math.round(averageRating * 100) / 100,
      interviewsByType,
      interviewsByStatus,
    };
  }

  private async checkSchedulingConflicts(
    participantIds: string[],
    startTime: Date,
    endTime: Date,
    excludeInterviewId?: string,
  ): Promise<void> {
    if (!participantIds.length) return;

    const conflicts = await this.prisma.interview.findMany({
      where: {
        id: excludeInterviewId ? { not: excludeInterviewId } : undefined,
        status: {
          in: ['SCHEDULED', 'RESCHEDULED'],
        },
        interviewers: {
          some: {
            userId: {
              in: participantIds,
            },
          },
        },
        OR: [
          {
            // Interview starts during the new interview
            scheduledAt: {
              gte: startTime,
              lt: endTime,
            },
          },
          {
            // Interview ends during the new interview
            AND: [
              {
                scheduledAt: {
                  lt: startTime,
                },
              },
              // We need to calculate the end time of existing interviews
              // This is a simplified check - in production, you might want to use raw SQL
            ],
          },
        ],
      },
      include: {
        interviewers: true,
      },
    });

    // Additional check for interviews that end during the new interview time
    const additionalConflicts = await this.prisma.interview.findMany({
      where: {
        id: excludeInterviewId ? { not: excludeInterviewId } : undefined,
        status: {
          in: ['SCHEDULED', 'RESCHEDULED'],
        },
        scheduledAt: {
          lt: endTime,
        },
        interviewers: {
          some: {
            userId: {
              in: participantIds,
            },
          },
        },
      },
    });

    // Filter for actual time conflicts
    const actualConflicts = additionalConflicts.filter((interview) => {
      const interviewEndTime = new Date(
        interview.scheduledAt.getTime() + interview.duration * 60000,
      );
      return interviewEndTime > startTime;
    });

    const allConflicts = [...conflicts, ...actualConflicts];

    if (allConflicts.length > 0) {
      const conflictDetails = allConflicts
        .map((interview) => {
          const interviewEndTime = new Date(
            interview.scheduledAt.getTime() + interview.duration * 60000,
          );
          return `Interview on ${interview.scheduledAt.toISOString()} - ${interviewEndTime.toISOString()}`;
        })
        .join(', ');

      throw new ConflictException(
        `Scheduling conflict detected: ${conflictDetails}`,
      );
    }
  }
}
