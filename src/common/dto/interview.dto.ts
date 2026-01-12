import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  IsArray,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InterviewType, InterviewStatus } from '@prisma/client';

export class ScheduleInterviewDto {
  @IsString()
  @IsUUID()
  candidateId: string;

  @IsString()
  @IsUUID()
  jobId: string;

  @IsDateString()
  scheduledAt: string;

  @IsInt()
  @Min(15)
  duration: number; // in minutes

  @IsString()
  location: string;

  @IsEnum(InterviewType)
  type: InterviewType;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewParticipantDto)
  participants?: InterviewParticipantDto[];
}

export class InterviewParticipantDto {
  @IsString()
  @IsUUID()
  userId: string;

  @IsString()
  role: string; // 'interviewer' or 'organizer'
}

export class UpdateInterviewDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  duration?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;

  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  calendarEventId?: string;
}

export class AddParticipantDto {
  @IsString()
  @IsUUID()
  userId: string;

  @IsString()
  role: string;
}

export class FeedbackDto {
  @IsInt()
  @Min(1)
  rating: number;

  @IsString()
  comment: string;

  @IsOptional()
  @IsString()
  isPrivate?: boolean;
}

export class TimeSlotDto {
  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  availableParticipants: string[];
}

export class AvailabilityCheckDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  participantIds: string[];

  @IsInt()
  @Min(15)
  duration: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class CancelInterviewDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notifyParticipants?: boolean;
}
