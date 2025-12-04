import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventBusService } from './event-bus.service';
import { QueueService } from './queue.service';
import { WorkersService } from './workers.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [EventBusService, QueueService, WorkersService],
  exports: [EventBusService, QueueService],
})
export class EventsModule {}
