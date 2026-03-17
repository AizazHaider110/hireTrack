import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../events/queue.service';
import { EventBusService } from '../events/event-bus.service';
import { EmailTemplateType } from '@prisma/client';

describe('EmailService', () => {
  let service: EmailService;
  let prismaService: PrismaService;
  let queueService: QueueService;
  let eventBusService: EventBusService;

  const mockPrismaService = {
    emailTemplate: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    emailJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    emailMetrics: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockQueueService = {
    addJob: jest.fn(),
  };

  const mockEventBusService = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: EventBusService,
          useValue: mockEventBusService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    prismaService = module.get<PrismaService>(PrismaService);
    queueService = module.get<QueueService>(QueueService);
    eventBusService = module.get<EventBusService>(EventBusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTemplate', () => {
    it('should create an email template', async () => {
      const templateData = {
        name: 'Test Template',
        subject: 'Test Subject',
        body: 'Hello {{name}}',
        variables: ['name'],
        type: EmailTemplateType.APPLICATION_RECEIVED,
      };

      const mockTemplate = {
        id: 'template-1',
        ...templateData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.emailTemplate.create.mockResolvedValue(mockTemplate);

      const result = await service.createTemplate(templateData);

      expect(result).toEqual(mockTemplate);
      expect(mockPrismaService.emailTemplate.create).toHaveBeenCalledWith({
        data: {
          ...templateData,
          isActive: true,
        },
      });
      expect(mockEventBusService.publish).toHaveBeenCalledWith(
        'email.template_created',
        {
          templateId: mockTemplate.id,
          name: mockTemplate.name,
          type: mockTemplate.type,
        },
      );
    });
  });

  describe('sendTemplateEmail', () => {
    it('should queue template email for sending', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Test Template',
        subject: 'Hello {{name}}',
        body: 'Welcome {{name}}!',
        variables: ['name'],
        type: EmailTemplateType.APPLICATION_RECEIVED,
        isActive: true,
      };

      const mockEmailJob = {
        id: 'job-1',
        to: 'test@example.com',
        subject: 'Hello John',
        body: 'Welcome John!',
        templateId: 'template-1',
        variables: { name: 'John' },
        status: 'PENDING',
      };

      mockPrismaService.emailTemplate.findFirst.mockResolvedValue(mockTemplate);
      mockPrismaService.emailJob.create.mockResolvedValue(mockEmailJob);

      await service.sendTemplateEmail({
        templateType: EmailTemplateType.APPLICATION_RECEIVED,
        to: 'test@example.com',
        variables: { name: 'John' },
      });

      expect(mockPrismaService.emailTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          type: EmailTemplateType.APPLICATION_RECEIVED,
          isActive: true,
        },
      });

      expect(mockPrismaService.emailJob.create).toHaveBeenCalledWith({
        data: {
          to: 'test@example.com',
          subject: 'Hello John',
          body: 'Welcome John!',
          templateId: 'template-1',
          variables: { name: 'John' },
          scheduledFor: undefined,
          status: 'PENDING',
        },
      });

      expect(mockQueueService.addJob).toHaveBeenCalled();
      expect(mockEventBusService.publish).toHaveBeenCalledWith('email.queued', {
        emailJobId: 'job-1',
        templateType: EmailTemplateType.APPLICATION_RECEIVED,
        recipient: 'test@example.com',
      });
    });
  });
});
