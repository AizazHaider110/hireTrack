import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let service: QueueService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    // Clean up connections
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should use config service for Redis connection', () => {
    expect(configService.get).toHaveBeenCalledWith('REDIS_HOST', 'localhost');
    expect(configService.get).toHaveBeenCalledWith('REDIS_PORT', 6379);
  });

  // Note: The following tests require a running Redis instance
  // They are skipped by default to avoid test failures in CI/CD
  // Uncomment and run locally with Redis running for integration testing

  it.skip('should add a job to a queue', async () => {
    const queueName = 'test-queue';
    const jobName = 'test-job';
    const data = {
      type: 'test',
      payload: { message: 'Hello' },
    };

    const job = await service.addJob(queueName, jobName, data);

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.name).toBe(jobName);
    expect(job.data).toEqual(data);
  });

  it.skip('should register a worker and process jobs', async () => {
    const queueName = 'test-worker-queue';
    const jobName = 'test-worker-job';
    let processed = false;

    service.registerWorker(queueName, async (job) => {
      processed = true;
      return { success: true };
    });

    await service.addJob(queueName, jobName, {
      type: 'test',
      payload: {},
    });

    // Wait for job to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(processed).toBe(true);
  });

  it.skip('should get queue metrics', async () => {
    const queueName = 'test-metrics-queue';

    const metrics = await service.getQueueMetrics(queueName);

    expect(metrics).toBeDefined();
    expect(metrics).toHaveProperty('waiting');
    expect(metrics).toHaveProperty('active');
    expect(metrics).toHaveProperty('completed');
    expect(metrics).toHaveProperty('failed');
    expect(metrics).toHaveProperty('delayed');
  });
});
