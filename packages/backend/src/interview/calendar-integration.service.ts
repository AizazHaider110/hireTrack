import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interview } from '@prisma/client';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  location?: string;
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: {
        type: string;
      };
    };
  };
}

export interface AvailabilitySlot {
  start: Date;
  end: Date;
  status: 'free' | 'busy' | 'tentative';
}

export interface CalendarProvider {
  createEvent(event: CalendarEvent): Promise<string>;
  updateEvent(eventId: string, event: CalendarEvent): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  getAvailability(
    email: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AvailabilitySlot[]>;
}

@Injectable()
export class GoogleCalendarProvider implements CalendarProvider {
  private readonly logger = new Logger(GoogleCalendarProvider.name);

  constructor(private configService: ConfigService) {}

  async createEvent(event: CalendarEvent): Promise<string> {
    // In a real implementation, this would use Google Calendar API
    // For now, we'll simulate the behavior
    this.logger.log(`Creating Google Calendar event: ${event.summary}`);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return a mock event ID
    return `google_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async updateEvent(eventId: string, event: CalendarEvent): Promise<void> {
    this.logger.log(
      `Updating Google Calendar event ${eventId}: ${event.summary}`,
    );

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // In real implementation, would make API call to Google Calendar
  }

  async deleteEvent(eventId: string): Promise<void> {
    this.logger.log(`Deleting Google Calendar event: ${eventId}`);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // In real implementation, would make API call to Google Calendar
  }

  async getAvailability(
    email: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AvailabilitySlot[]> {
    this.logger.log(
      `Getting availability for ${email} from ${startDate} to ${endDate}`,
    );

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return mock availability data
    const slots: AvailabilitySlot[] = [];
    const current = new Date(startDate);

    while (current < endDate) {
      // Simulate some busy periods
      const hour = current.getHours();
      const isWorkingHour = hour >= 9 && hour < 17;
      const isWeekday = current.getDay() >= 1 && current.getDay() <= 5;

      if (isWorkingHour && isWeekday) {
        // Randomly mark some slots as busy
        const status = Math.random() > 0.7 ? 'busy' : 'free';

        slots.push({
          start: new Date(current),
          end: new Date(current.getTime() + 60 * 60 * 1000), // 1 hour slots
          status,
        });
      }

      current.setHours(current.getHours() + 1);
    }

    return slots;
  }
}

@Injectable()
export class OutlookCalendarProvider implements CalendarProvider {
  private readonly logger = new Logger(OutlookCalendarProvider.name);

  constructor(private configService: ConfigService) {}

  async createEvent(event: CalendarEvent): Promise<string> {
    this.logger.log(`Creating Outlook Calendar event: ${event.summary}`);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return a mock event ID
    return `outlook_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async updateEvent(eventId: string, event: CalendarEvent): Promise<void> {
    this.logger.log(
      `Updating Outlook Calendar event ${eventId}: ${event.summary}`,
    );

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async deleteEvent(eventId: string): Promise<void> {
    this.logger.log(`Deleting Outlook Calendar event: ${eventId}`);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async getAvailability(
    email: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AvailabilitySlot[]> {
    this.logger.log(
      `Getting availability for ${email} from ${startDate} to ${endDate}`,
    );

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return mock availability data (similar to Google)
    const slots: AvailabilitySlot[] = [];
    const current = new Date(startDate);

    while (current < endDate) {
      const hour = current.getHours();
      const isWorkingHour = hour >= 9 && hour < 17;
      const isWeekday = current.getDay() >= 1 && current.getDay() <= 5;

      if (isWorkingHour && isWeekday) {
        const status = Math.random() > 0.7 ? 'busy' : 'free';

        slots.push({
          start: new Date(current),
          end: new Date(current.getTime() + 60 * 60 * 1000),
          status,
        });
      }

      current.setHours(current.getHours() + 1);
    }

    return slots;
  }
}

@Injectable()
export class CalendarIntegrationService {
  private readonly logger = new Logger(CalendarIntegrationService.name);
  private providers: Map<string, CalendarProvider> = new Map();

  constructor(
    private configService: ConfigService,
    private googleProvider: GoogleCalendarProvider,
    private outlookProvider: OutlookCalendarProvider,
  ) {
    this.providers.set('google', this.googleProvider);
    this.providers.set('outlook', this.outlookProvider);
  }

  async createCalendarEvent(
    interview: Interview & {
      candidate: { user: { name: string; email: string } };
      interviewers: Array<{ user: { name: string; email: string } }>;
    },
  ): Promise<string> {
    const provider = this.getDefaultProvider();

    const event: CalendarEvent = {
      summary: `Interview: ${interview.candidate.user.name}`,
      description: `Interview for candidate ${interview.candidate.user.name}\n\nType: ${interview.type}\nLocation: ${interview.location}\n\nNotes: ${interview.notes || 'No additional notes'}`,
      start: {
        dateTime: interview.scheduledAt.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: new Date(
          interview.scheduledAt.getTime() + interview.duration * 60000,
        ).toISOString(),
        timeZone: 'UTC',
      },
      attendees: [
        {
          email: interview.candidate.user.email,
          displayName: interview.candidate.user.name,
        },
        ...interview.interviewers.map((interviewer) => ({
          email: interviewer.user.email,
          displayName: interviewer.user.name,
        })),
      ],
      location: interview.location,
    };

    // Add video conference link for remote interviews
    if (interview.type === 'VIDEO') {
      event.conferenceData = {
        createRequest: {
          requestId: `interview_${interview.id}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet', // or 'teamsForBusiness' for Outlook
          },
        },
      };
    }

    try {
      const eventId = await provider.createEvent(event);
      this.logger.log(
        `Created calendar event ${eventId} for interview ${interview.id}`,
      );
      return eventId;
    } catch (error) {
      this.logger.error(
        `Failed to create calendar event for interview ${interview.id}:`,
        error,
      );
      throw new BadRequestException('Failed to create calendar event');
    }
  }

  async updateCalendarEvent(
    eventId: string,
    interview: Interview & {
      candidate: { user: { name: string; email: string } };
      interviewers: Array<{ user: { name: string; email: string } }>;
    },
  ): Promise<void> {
    const provider = this.getDefaultProvider();

    const event: CalendarEvent = {
      summary: `Interview: ${interview.candidate.user.name}`,
      description: `Interview for candidate ${interview.candidate.user.name}\n\nType: ${interview.type}\nLocation: ${interview.location}\n\nNotes: ${interview.notes || 'No additional notes'}`,
      start: {
        dateTime: interview.scheduledAt.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: new Date(
          interview.scheduledAt.getTime() + interview.duration * 60000,
        ).toISOString(),
        timeZone: 'UTC',
      },
      attendees: [
        {
          email: interview.candidate.user.email,
          displayName: interview.candidate.user.name,
        },
        ...interview.interviewers.map((interviewer) => ({
          email: interviewer.user.email,
          displayName: interviewer.user.name,
        })),
      ],
      location: interview.location,
    };

    try {
      await provider.updateEvent(eventId, event);
      this.logger.log(
        `Updated calendar event ${eventId} for interview ${interview.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update calendar event ${eventId} for interview ${interview.id}:`,
        error,
      );
      throw new BadRequestException('Failed to update calendar event');
    }
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    const provider = this.getDefaultProvider();

    try {
      await provider.deleteEvent(eventId);
      this.logger.log(`Deleted calendar event ${eventId}`);
    } catch (error) {
      this.logger.error(`Failed to delete calendar event ${eventId}:`, error);
      throw new BadRequestException('Failed to delete calendar event');
    }
  }

  async getAvailability(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AvailabilitySlot[]> {
    // In a real implementation, you would:
    // 1. Get the user's calendar provider preference from database
    // 2. Get their OAuth tokens for the calendar service
    // 3. Use the appropriate provider to fetch availability

    const provider = this.getDefaultProvider();

    // For now, we'll use a mock email - in real implementation, get from user record
    const userEmail = `user_${userId}@company.com`;

    try {
      const availability = await provider.getAvailability(
        userEmail,
        startDate,
        endDate,
      );
      this.logger.log(
        `Retrieved availability for user ${userId}: ${availability.length} slots`,
      );
      return availability;
    } catch (error) {
      this.logger.error(
        `Failed to get availability for user ${userId}:`,
        error,
      );
      throw new BadRequestException('Failed to retrieve calendar availability');
    }
  }

  async checkAvailability(
    userIds: string[],
    startTime: Date,
    endTime: Date,
  ): Promise<{ [userId: string]: boolean }> {
    const availability: { [userId: string]: boolean } = {};

    for (const userId of userIds) {
      try {
        const slots = await this.getAvailability(userId, startTime, endTime);

        // Check if the requested time slot conflicts with any busy periods
        const hasConflict = slots.some((slot) => {
          return (
            slot.status === 'busy' &&
            ((startTime >= slot.start && startTime < slot.end) ||
              (endTime > slot.start && endTime <= slot.end) ||
              (startTime <= slot.start && endTime >= slot.end))
          );
        });

        availability[userId] = !hasConflict;
      } catch (error) {
        this.logger.error(
          `Failed to check availability for user ${userId}:`,
          error,
        );
        availability[userId] = false; // Assume unavailable if we can't check
      }
    }

    return availability;
  }

  private getDefaultProvider(): CalendarProvider {
    // In a real implementation, this could be configurable per organization
    const defaultProvider = this.configService.get<string>(
      'CALENDAR_PROVIDER',
      'google',
    );

    const provider = this.providers.get(defaultProvider);
    if (!provider) {
      throw new BadRequestException(
        `Unsupported calendar provider: ${defaultProvider}`,
      );
    }

    return provider;
  }

  // OAuth 2.0 authentication methods (simplified)
  async getAuthUrl(provider: string, userId: string): Promise<string> {
    // In a real implementation, this would generate OAuth URLs for calendar access
    const baseUrls = {
      google: 'https://accounts.google.com/o/oauth2/v2/auth',
      outlook: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    };

    const clientIds = {
      google: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      outlook: this.configService.get<string>('OUTLOOK_CLIENT_ID'),
    };

    const scopes = {
      google: 'https://www.googleapis.com/auth/calendar',
      outlook: 'https://graph.microsoft.com/calendars.readwrite',
    };

    const redirectUri = this.configService.get<string>('CALENDAR_REDIRECT_URI');

    if (!baseUrls[provider] || !clientIds[provider] || !redirectUri) {
      throw new BadRequestException(
        `Unsupported calendar provider: ${provider}`,
      );
    }

    const params = new URLSearchParams();
    params.append('client_id', clientIds[provider]);
    params.append('response_type', 'code');
    params.append('scope', scopes[provider]);
    params.append('redirect_uri', redirectUri);
    params.append('state', `${provider}_${userId}`);
    params.append('access_type', 'offline');
    params.append('prompt', 'consent');

    return `${baseUrls[provider]}?${params.toString()}`;
  }

  async handleAuthCallback(
    code: string,
    state: string,
  ): Promise<{ provider: string; userId: string; success: boolean }> {
    // Parse state to get provider and user ID
    const [provider, userId] = state.split('_');

    try {
      // In a real implementation, exchange the code for access/refresh tokens
      // and store them securely in the database associated with the user

      this.logger.log(
        `Successfully authenticated ${provider} calendar for user ${userId}`,
      );

      return {
        provider,
        userId,
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Failed to authenticate ${provider} calendar for user ${userId}:`,
        error,
      );

      return {
        provider,
        userId,
        success: false,
      };
    }
  }
}
