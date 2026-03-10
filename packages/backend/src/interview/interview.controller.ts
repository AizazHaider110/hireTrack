import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InterviewService } from './interview.service';
import { CalendarIntegrationService } from './calendar-integration.service';
import {
  ScheduleInterviewDto,
  UpdateInterviewDto,
  AddParticipantDto,
  FeedbackDto,
  AvailabilityCheckDto,
  CancelInterviewDto,
} from '../common/dto/interview.dto';
import { Role } from '@prisma/client';

@Controller('interviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly calendarService: CalendarIntegrationService,
  ) {}

  @Post()
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async scheduleInterview(
    @Body() scheduleInterviewDto: ScheduleInterviewDto,
    @Request() req,
  ) {
    const interview = await this.interviewService.scheduleInterview(
      scheduleInterviewDto,
      req.user.id,
    );

    // Create calendar event - skip for now since we need proper user data structure
    try {
      // Get full interview data with user information for calendar integration
      const fullInterview = await this.interviewService.getInterviewById(
        interview.id,
      );

      // For now, skip calendar integration until we have proper user data structure
      // const calendarEventId = await this.calendarService.createCalendarEvent(fullInterview);

      // Update interview with calendar event ID
      // await this.interviewService.updateInterview(interview.id, {
      //   calendarEventId,
      // });

      return interview;
    } catch (error) {
      // Interview was created but calendar event failed
      // Log the error but don't fail the request
      console.error('Failed to create calendar event:', error);
      return interview;
    }
  }

  @Put(':id')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async updateInterview(
    @Param('id') id: string,
    @Body() updateInterviewDto: UpdateInterviewDto,
  ) {
    const interview = await this.interviewService.updateInterview(
      id,
      updateInterviewDto,
    );

    // Update calendar event if it exists - skip for now
    // if (interview.calendarEventId) {
    //   try {
    //     await this.calendarService.updateCalendarEvent(interview.calendarEventId, interview);
    //   } catch (error) {
    //     console.error('Failed to update calendar event:', error);
    //     // Continue with the response even if calendar update fails
    //   }
    // }

    return interview;
  }

  @Delete(':id')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelInterview(
    @Param('id') id: string,
    @Body() cancelInterviewDto: CancelInterviewDto,
  ) {
    const interview = await this.interviewService.cancelInterview(
      id,
      cancelInterviewDto,
    );

    // Delete calendar event if it exists
    if (interview.calendarEventId) {
      try {
        await this.calendarService.deleteCalendarEvent(
          interview.calendarEventId,
        );
      } catch (error) {
        console.error('Failed to delete calendar event:', error);
        // Continue even if calendar deletion fails
      }
    }

    return interview;
  }

  @Get(':id')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER, Role.ADMIN)
  async getInterview(@Param('id') id: string) {
    return this.interviewService.getInterviewById(id);
  }

  @Get('candidate/:candidateId')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER, Role.ADMIN)
  async getInterviewsByCandidate(@Param('candidateId') candidateId: string) {
    return this.interviewService.getInterviewsByCandidate(candidateId);
  }

  @Get('job/:jobId')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER, Role.ADMIN)
  async getInterviewsByJob(@Param('jobId') jobId: string) {
    return this.interviewService.getInterviewsByJob(jobId);
  }

  @Post(':id/participants')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async addParticipant(
    @Param('id') interviewId: string,
    @Body() addParticipantDto: AddParticipantDto,
  ) {
    const participant = await this.interviewService.addParticipant(
      interviewId,
      addParticipantDto,
    );

    // Update calendar event to include new participant - skip for now
    // const interview = await this.interviewService.getInterviewById(interviewId);
    // if (interview.calendarEventId) {
    //   try {
    //     await this.calendarService.updateCalendarEvent(interview.calendarEventId, interview);
    //   } catch (error) {
    //     console.error('Failed to update calendar event with new participant:', error);
    //   }
    // }

    return participant;
  }

  @Post(':id/feedback')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER, Role.ADMIN)
  async submitFeedback(
    @Param('id') interviewId: string,
    @Body() feedbackDto: FeedbackDto,
    @Request() req,
  ) {
    return this.interviewService.submitFeedback(
      interviewId,
      req.user.id,
      feedbackDto,
    );
  }

  @Post('availability/check')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async checkAvailability(@Body() availabilityCheckDto: AvailabilityCheckDto) {
    return this.interviewService.getAvailableTimeSlots(availabilityCheckDto);
  }

  @Get('calendar/availability/:userId')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async getCalendarAvailability(
    @Param('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.calendarService.getAvailability(userId, start, end);
  }

  @Get('calendar/auth/:provider')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER, Role.ADMIN)
  async getCalendarAuthUrl(
    @Param('provider') provider: string,
    @Request() req,
  ) {
    const authUrl = await this.calendarService.getAuthUrl(
      provider,
      req.user.id,
    );
    return { authUrl };
  }

  @Post('calendar/auth/callback')
  async handleCalendarAuthCallback(
    @Body() body: { code: string; state: string },
  ) {
    return this.calendarService.handleAuthCallback(body.code, body.state);
  }

  // Reminder system endpoints
  @Post('reminders/send')
  @Roles(Role.ADMIN) // Only admin can manually trigger reminders
  async sendInterviewReminders() {
    return this.interviewService.sendInterviewReminders();
  }

  @Get('upcoming')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.INTERVIEWER, Role.ADMIN)
  async getUpcomingInterviews(
    @Request() req,
    @Query('days') days: string = '7',
  ) {
    const daysAhead = parseInt(days, 10);
    return this.interviewService.getUpcomingInterviews(req.user.id, daysAhead);
  }

  @Get('feedback/:interviewId')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async getInterviewFeedback(@Param('interviewId') interviewId: string) {
    return this.interviewService.getAggregatedFeedback(interviewId);
  }

  @Get('analytics/summary')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async getInterviewAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.interviewService.getInterviewAnalytics(start, end);
  }
}
