import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

export interface QueueJobData {
  type: string;
  payload: any;
  metadata?: Record<string, any>;
}

export interface QueueOptions {
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  delay?: number;
  priority?: number;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: Redis;
  private readonly queues: Map<string, Queue> = new Map();
  private readonly workers: Map<string, Worker> = new Map();
  private readonly queueEvents: Map<string, QueueEvents> = new Map();

  constructor(private readonly configService: ConfigService) {
    // Initialize Redis connection
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.connection = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: null,
    });

    this.logger.log(`Connected to Redis at ${redisHost}:${redisPort}`);
  }

  /**
   * Get or create a queue
   */
  private getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            count: 100, // Keep last 100 completed jobs
            age: 24 * 3600, // Keep for 24 hours
          },
          removeOnFail: {
            count: 500, // Keep last 500 failed jobs
            age: 7 * 24 * 3600, // Keep for 7 days
          },
        },
      });

      this.queues.set(queueName, queue);
      this.logger.log(`Created queue: ${queueName}`);
    }

    return this.queues.get(queueName)!;
  }

  /**
   * Add a job to a queue
   */
  async addJob(
    queueName: string,
    jobName: string,
    data: QueueJobData,
    options?: QueueOptions,
  ): Promise<Job> {
    const queue = this.getQueue(queueName);

    const job = await queue.add(jobName, data, {
      attempts: options?.attempts,
      backoff: options?.backoff,
      delay: options?.delay,
      priority: options?.priority,
    });

    this.logger.debug(`Added job ${jobName} to queue ${queueName}`, {
      jobId: job.id,
      data,
    });

    return job;
  }

  /**
   * Register a worker to process jobs from a queue
   */
  registerWorker(
    queueName: string,
    processor: (job: Job<QueueJobData>) => Promise<any>,
    concurrency: number = 1,
  ): void {
    if (this.workers.has(queueName)) {
      this.logger.warn(`Worker for queue ${queueName} already exists`);
      return;
    }

    const worker = new Worker(
      queueName,
      async (job: Job<QueueJobData>) => {
        this.logger.debug(`Processing job ${job.name} from queue ${queueName}`, {
          jobId: job.id,
          attempt: job.attemptsMade + 1,
        });

        try {
          const result = await processor(job);
          this.logger.debug(`Job ${job.id} completed successfully`);
          return result;
        } catch (error) {
          this.logger.error(`Job ${job.id} failed:`, error);
          throw error;
        }
      },
      {
        connection: this.connection,
        concurrency,
      },
    );

    // Set up event listeners for monitoring
    worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed in queue ${queueName}`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed in queue ${queueName}:`, err);
    });

    worker.on('error', (err) => {
      this.logger.error(`Worker error in queue ${queueName}:`, err);
    });

    this.workers.set(queueName, worker);
    this.logger.log(`Registered worker for queue: ${queueName} with concurrency ${concurrency}`);

    // Set up queue events for monitoring
    const queueEvents = new QueueEvents(queueName, {
      connection: this.connection,
    });

    queueEvents.on('waiting', ({ jobId }) => {
      this.logger.debug(`Job ${jobId} is waiting in queue ${queueName}`);
    });

    queueEvents.on('active', ({ jobId }) => {
      this.logger.debug(`Job ${jobId} is active in queue ${queueName}`);
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      this.logger.debug(`Job ${jobId} progress in queue ${queueName}:`, data);
    });

    this.queueEvents.set(queueName, queueEvents);
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
    };
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    this.logger.log(`Queue ${queueName} paused`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    this.logger.log(`Queue ${queueName} resumed`);
  }

  /**
   * Clean up completed jobs
   */
  async cleanQueue(queueName: string, grace: number = 0, limit: number = 1000): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.clean(grace, limit, 'completed');
    this.logger.log(`Cleaned completed jobs from queue ${queueName}`);
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing queue connections...');

    // Close all workers
    for (const [queueName, worker] of this.workers.entries()) {
      await worker.close();
      this.logger.log(`Closed worker for queue: ${queueName}`);
    }

    // Close all queue events
    for (const [queueName, queueEvents] of this.queueEvents.entries()) {
      await queueEvents.close();
      this.logger.log(`Closed queue events for: ${queueName}`);
    }

    // Close all queues
    for (const [queueName, queue] of this.queues.entries()) {
      await queue.close();
      this.logger.log(`Closed queue: ${queueName}`);
    }

    // Close Redis connection
    await this.connection.quit();
    this.logger.log('Redis connection closed');
  }
}
