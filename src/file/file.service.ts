import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from './file-storage.service';
import { EventBusService } from '../events/event-bus.service';
import {
  UploadFileDto,
  FileQueryDto,
  FileResponseDto,
  FileEntityType,
} from '../common/dto/file.dto';

const RECOVERY_RETENTION_DAYS = 30;

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private prisma: PrismaService,
    private fileStorageService: FileStorageService,
    private eventBus: EventBusService,
  ) {}

  /**
   * Upload a file with validation and storage
   * Requirements: 10.1, 10.2
   */
  async uploadFile(
    file: Express.Multer.File,
    uploadDto: UploadFileDto,
    userId: string,
  ): Promise<FileResponseDto> {
    // Validate file
    this.fileStorageService.validateFile(file);

    // Generate storage key
    const storageKey = this.fileStorageService.generateStorageKey(
      file.originalname,
      uploadDto.entityType,
      uploadDto.entityId,
    );

    // Upload to storage
    const uploadResult = await this.fileStorageService.uploadFile(
      file,
      storageKey,
    );

    // Create file record in database
    const fileRecord = await this.prisma.file.create({
      data: {
        filename: storageKey.split('/').pop() || file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: uploadResult.size,
        storageKey: uploadResult.storageKey,
        storageUrl: uploadResult.storageUrl,
        entityType: uploadDto.entityType,
        entityId: uploadDto.entityId,
        uploadedBy: userId,
        metadata: uploadDto.description
          ? { description: uploadDto.description }
          : undefined,
      },
    });

    this.logger.log(`File uploaded: ${fileRecord.id} by user ${userId}`);

    // Emit event
    this.eventBus.publish('file.uploaded', {
      fileId: fileRecord.id,
      entityType: uploadDto.entityType,
      entityId: uploadDto.entityId,
      uploadedBy: userId,
    });

    return this.toFileResponse(fileRecord);
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string, userId: string): Promise<FileResponseDto> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.isDeleted) {
      throw new NotFoundException('File not found');
    }

    // Check access permission
    await this.checkFileAccess(file, userId);

    return this.toFileResponse(file);
  }

  /**
   * Get files by entity
   */
  async getFilesByEntity(
    entityType: FileEntityType,
    entityId: string,
    userId: string,
    includeDeleted = false,
  ): Promise<FileResponseDto[]> {
    const files = await this.prisma.file.findMany({
      where: {
        entityType,
        entityId,
        isDeleted: includeDeleted ? undefined : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return files.map((file) => this.toFileResponse(file));
  }

  /**
   * Query files with filters
   */
  async queryFiles(
    query: FileQueryDto,
    userId: string,
  ): Promise<{ files: FileResponseDto[]; total: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: query.includeDeleted ? undefined : false,
    };

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      files: files.map((file) => this.toFileResponse(file)),
      total,
    };
  }

  /**
   * Generate presigned download URL
   * Requirements: 10.3 - generate secure, time-limited URLs
   */
  async getDownloadUrl(
    fileId: string,
    userId: string,
    expiresIn?: number,
  ): Promise<{ url: string; expiresAt: Date }> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.isDeleted) {
      throw new NotFoundException('File not found');
    }

    // Check access permission
    await this.checkFileAccess(file, userId);

    return this.fileStorageService.generatePresignedUrl(file.storageKey, {
      expiresIn,
    });
  }

  /**
   * Download file content
   */
  async downloadFile(
    fileId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.isDeleted) {
      throw new NotFoundException('File not found');
    }

    // Check access permission
    await this.checkFileAccess(file, userId);

    const buffer = await this.fileStorageService.getFile(file.storageKey);

    return {
      buffer,
      filename: file.originalName,
      mimeType: file.mimeType,
    };
  }

  /**
   * Download file by storage key with token validation
   */
  async downloadByStorageKey(
    storageKey: string,
    token: string,
    expires: number,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    // Validate token
    if (
      !this.fileStorageService.validateAccessToken(storageKey, token, expires)
    ) {
      throw new ForbiddenException('Invalid or expired access token');
    }

    const file = await this.prisma.file.findUnique({
      where: { storageKey },
    });

    if (!file || file.isDeleted) {
      throw new NotFoundException('File not found');
    }

    const buffer = await this.fileStorageService.getFile(storageKey);

    return {
      buffer,
      filename: file.originalName,
      mimeType: file.mimeType,
    };
  }

  /**
   * Create a new version of a file
   * Requirements: 10.4 - maintain version history
   */
  async createVersion(
    fileId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<FileResponseDto> {
    const existingFile = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!existingFile || existingFile.isDeleted) {
      throw new NotFoundException('File not found');
    }

    // Check access permission
    await this.checkFileAccess(existingFile, userId);

    // Validate new file
    this.fileStorageService.validateFile(file);

    // Generate new storage key
    const storageKey = this.fileStorageService.generateStorageKey(
      file.originalname,
      existingFile.entityType,
      existingFile.entityId,
    );

    // Upload new version
    const uploadResult = await this.fileStorageService.uploadFile(
      file,
      storageKey,
    );

    // Get the original file (root of version chain)
    const parentId = existingFile.parentId || existingFile.id;

    // Get current max version
    const maxVersion = await this.prisma.file.aggregate({
      where: {
        OR: [{ id: parentId }, { parentId }],
      },
      _max: { version: true },
    });

    const newVersion = (maxVersion._max.version || 1) + 1;

    // Create new version record
    const newFile = await this.prisma.file.create({
      data: {
        filename: storageKey.split('/').pop() || file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: uploadResult.size,
        storageKey: uploadResult.storageKey,
        storageUrl: uploadResult.storageUrl,
        entityType: existingFile.entityType,
        entityId: existingFile.entityId,
        uploadedBy: userId,
        version: newVersion,
        parentId,
        metadata: existingFile.metadata ?? undefined,
      },
    });

    this.logger.log(`New file version created: ${newFile.id} (v${newVersion})`);

    // Emit event
    this.eventBus.publish('file.version_created', {
      fileId: newFile.id,
      parentId,
      version: newVersion,
      uploadedBy: userId,
    });

    return this.toFileResponse(newFile);
  }

  /**
   * Get all versions of a file
   * Requirements: 10.4 - version history
   */
  async getFileVersions(
    fileId: string,
    userId: string,
  ): Promise<FileResponseDto[]> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check access permission
    await this.checkFileAccess(file, userId);

    // Get the root file ID
    const rootId = file.parentId || file.id;

    // Get all versions
    const versions = await this.prisma.file.findMany({
      where: {
        OR: [{ id: rootId }, { parentId: rootId }],
        isDeleted: false,
      },
      orderBy: { version: 'desc' },
    });

    return versions.map((v) => this.toFileResponse(v));
  }

  /**
   * Rollback to a previous version
   * Requirements: 10.4 - allow rollback
   */
  async rollbackToVersion(
    fileId: string,
    targetVersion: number,
    userId: string,
  ): Promise<FileResponseDto> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check access permission
    await this.checkFileAccess(file, userId);

    // Get the root file ID
    const rootId = file.parentId || file.id;

    // Find the target version
    const targetFile = await this.prisma.file.findFirst({
      where: {
        OR: [
          { id: rootId, version: targetVersion },
          { parentId: rootId, version: targetVersion },
        ],
        isDeleted: false,
      },
    });

    if (!targetFile) {
      throw new NotFoundException(`Version ${targetVersion} not found`);
    }

    // Copy the target version's file to create a new version
    const newStorageKey = this.fileStorageService.generateStorageKey(
      targetFile.originalName,
      targetFile.entityType,
      targetFile.entityId,
    );

    await this.fileStorageService.copyFile(
      targetFile.storageKey,
      newStorageKey,
    );

    // Get current max version
    const maxVersion = await this.prisma.file.aggregate({
      where: {
        OR: [{ id: rootId }, { parentId: rootId }],
      },
      _max: { version: true },
    });

    const newVersion = (maxVersion._max.version || 1) + 1;

    // Create new version record
    const newFile = await this.prisma.file.create({
      data: {
        filename: newStorageKey.split('/').pop() || targetFile.originalName,
        originalName: targetFile.originalName,
        mimeType: targetFile.mimeType,
        size: targetFile.size,
        storageKey: newStorageKey,
        storageUrl: targetFile.storageUrl,
        entityType: targetFile.entityType,
        entityId: targetFile.entityId,
        uploadedBy: userId,
        version: newVersion,
        parentId: rootId,
        metadata: {
          ...(typeof targetFile.metadata === 'object' &&
          targetFile.metadata !== null
            ? targetFile.metadata
            : {}),
          rolledBackFrom: targetVersion,
        },
      },
    });

    this.logger.log(
      `File rolled back to v${targetVersion}, new version: v${newVersion}`,
    );

    return this.toFileResponse(newFile);
  }

  /**
   * Soft delete a file (move to recovery)
   * Requirements: 10.5 - move to recovery folder before permanent deletion
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.isDeleted) {
      throw new BadRequestException('File is already deleted');
    }

    // Check access permission
    await this.checkFileAccess(file, userId);

    // Create recovery record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RECOVERY_RETENTION_DAYS);

    await this.prisma.$transaction([
      // Create recovery record
      this.prisma.fileRecovery.create({
        data: {
          fileId: file.id,
          originalData: {
            filename: file.filename,
            originalName: file.originalName,
            mimeType: file.mimeType,
            size: file.size,
            storageKey: file.storageKey,
            entityType: file.entityType,
            entityId: file.entityId,
            metadata: file.metadata,
          },
          deletedBy: userId,
          expiresAt,
        },
      }),
      // Soft delete the file
      this.prisma.file.update({
        where: { id: fileId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      }),
    ]);

    this.logger.log(
      `File soft deleted: ${fileId}, recovery expires: ${expiresAt}`,
    );

    // Emit event
    this.eventBus.publish('file.deleted', {
      fileId,
      deletedBy: userId,
      recoveryExpiresAt: expiresAt,
    });
  }

  /**
   * Bulk delete files
   * Requirements: 10.6 - support bulk file operations
   */
  async bulkDelete(
    fileIds: string[],
    userId: string,
  ): Promise<{ deleted: number; failed: string[] }> {
    const failed: string[] = [];
    let deleted = 0;

    for (const fileId of fileIds) {
      try {
        await this.deleteFile(fileId, userId);
        deleted++;
      } catch (error) {
        this.logger.warn(`Failed to delete file ${fileId}: ${error.message}`);
        failed.push(fileId);
      }
    }

    return { deleted, failed };
  }

  /**
   * Recover a deleted file
   * Requirements: 10.5 - file recovery system
   */
  async recoverFile(fileId: string, userId: string): Promise<FileResponseDto> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.isDeleted) {
      throw new BadRequestException('File is not deleted');
    }

    // Check if recovery record exists and hasn't expired
    const recovery = await this.prisma.fileRecovery.findFirst({
      where: {
        fileId,
        expiresAt: { gt: new Date() },
      },
    });

    if (!recovery) {
      throw new BadRequestException('File recovery period has expired');
    }

    // Restore the file
    const restoredFile = await this.prisma.$transaction(async (tx) => {
      // Delete recovery record
      await tx.fileRecovery.delete({
        where: { id: recovery.id },
      });

      // Restore file
      return tx.file.update({
        where: { id: fileId },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      });
    });

    this.logger.log(`File recovered: ${fileId}`);

    // Emit event
    this.eventBus.publish('file.recovered', {
      fileId,
      recoveredBy: userId,
    });

    return this.toFileResponse(restoredFile);
  }

  /**
   * Get deleted files pending recovery
   */
  async getDeletedFiles(userId: string): Promise<FileResponseDto[]> {
    const recoveries = await this.prisma.fileRecovery.findMany({
      where: {
        deletedBy: userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { deletedAt: 'desc' },
    });

    const fileIds = recoveries.map((r) => r.fileId);

    const files = await this.prisma.file.findMany({
      where: {
        id: { in: fileIds },
        isDeleted: true,
      },
    });

    return files.map((file) => {
      const recovery = recoveries.find((r) => r.fileId === file.id);
      return {
        ...this.toFileResponse(file),
        recoveryExpiresAt: recovery?.expiresAt,
      };
    });
  }

  /**
   * Permanently delete expired files (cleanup job)
   */
  async cleanupExpiredFiles(): Promise<number> {
    const expiredRecoveries = await this.prisma.fileRecovery.findMany({
      where: {
        expiresAt: { lte: new Date() },
      },
    });

    let cleaned = 0;

    for (const recovery of expiredRecoveries) {
      try {
        const file = await this.prisma.file.findUnique({
          where: { id: recovery.fileId },
        });

        if (file) {
          // Delete from storage
          await this.fileStorageService.deleteFile(file.storageKey);

          // Delete from database
          await this.prisma.$transaction([
            this.prisma.fileRecovery.delete({ where: { id: recovery.id } }),
            this.prisma.file.delete({ where: { id: file.id } }),
          ]);

          cleaned++;
          this.logger.log(`Permanently deleted expired file: ${file.id}`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to cleanup file ${recovery.fileId}: ${error.message}`,
        );
      }
    }

    return cleaned;
  }

  /**
   * Check if user has access to file
   */
  private async checkFileAccess(file: any, userId: string): Promise<void> {
    // File owner always has access
    if (file.uploadedBy === userId) {
      return;
    }

    // Check if user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.role === 'ADMIN') {
      return;
    }

    // Check entity-based access
    switch (file.entityType) {
      case FileEntityType.APPLICATION:
        const application = await this.prisma.application.findUnique({
          where: { id: file.entityId },
          include: { job: true },
        });
        if (
          application?.userId === userId ||
          application?.job?.userId === userId
        ) {
          return;
        }
        break;

      case FileEntityType.JOB:
        const job = await this.prisma.jobPosting.findUnique({
          where: { id: file.entityId },
        });
        if (job?.userId === userId) {
          return;
        }
        break;

      case FileEntityType.CANDIDATE:
        const candidate = await this.prisma.candidate.findUnique({
          where: { id: file.entityId },
        });
        if (candidate?.userId === userId) {
          return;
        }
        break;

      case FileEntityType.TEAM:
        const teamMember = await this.prisma.teamMember.findFirst({
          where: {
            teamId: file.entityId,
            userId,
          },
        });
        if (teamMember) {
          return;
        }
        break;
    }

    throw new ForbiddenException('You do not have access to this file');
  }

  /**
   * Convert database file to response DTO
   */
  private toFileResponse(file: any): FileResponseDto {
    return {
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      entityType: file.entityType,
      entityId: file.entityId,
      uploadedBy: file.uploadedBy,
      version: file.version,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }
}
