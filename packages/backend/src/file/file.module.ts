import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileStorageService } from './file-storage.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, ConfigModule, EventsModule],
  controllers: [FileController],
  providers: [FileService, FileStorageService],
  exports: [FileService, FileStorageService],
})
export class FileModule {}
