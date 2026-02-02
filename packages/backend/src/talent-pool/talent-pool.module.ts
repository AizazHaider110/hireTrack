import { Module } from '@nestjs/common';
import { TalentPoolController } from './talent-pool.controller';
import { TalentPoolService } from './talent-pool.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [TalentPoolController],
  providers: [TalentPoolService],
  exports: [TalentPoolService],
})
export class TalentPoolModule {}
