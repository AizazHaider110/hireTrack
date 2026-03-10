import { Test, TestingModule } from '@nestjs/testing';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { AuditService } from '../audit/audit.service';
import { Reflector } from '@nestjs/core';

describe('JobController', () => {
  let controller: JobController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobController],
      providers: [
        {
          provide: JobService,
          useValue: {
            getAllJobs: jest.fn(),
            getJobById: jest.fn(),
            createJob: jest.fn(),
            updateJob: jest.fn(),
            deleteJob: jest.fn(),
            getJobsByRecruiter: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logAction: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<JobController>(JobController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
