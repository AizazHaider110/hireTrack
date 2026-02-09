import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  UploadFileDto,
  FileQueryDto,
  BulkDeleteDto,
  FileEntityType,
} from '../common/dto/file.dto';

@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * Upload a new file
   * Requirements: 10.1, 10.2
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadFileDto,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.fileService.uploadFile(file, uploadDto, req.user.id);
  }

  /**
   * Get file by ID
   */
  @Get(':id')
  async getFile(@Param('id') id: string, @Req() req: any) {
    return this.fileService.getFile(id, req.user.id);
  }

  /**
   * Get files by entity
   */
  @Get('entity/:entityType/:entityId')
  async getFilesByEntity(
    @Param('entityType') entityType: FileEntityType,
    @Param('entityId') entityId: string,
    @Query('includeDeleted') includeDeleted: string,
    @Req() req: any,
  ) {
    return this.fileService.getFilesByEntity(
      entityType,
      entityId,
      req.user.id,
      includeDeleted === 'true',
    );
  }

  /**
   * Query files with filters
   */
  @Get()
  async queryFiles(@Query() query: FileQueryDto, @Req() req: any) {
    return this.fileService.queryFiles(query, req.user.id);
  }

  /**
   * Get presigned download URL
   * Requirements: 10.3
   */
  @Get(':id/download-url')
  async getDownloadUrl(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn: string,
    @Req() req: any,
  ) {
    const expires = expiresIn ? parseInt(expiresIn, 10) : undefined;
    return this.fileService.getDownloadUrl(id, req.user.id, expires);
  }

  /**
   * Download file directly
   */
  @Get(':id/download')
  async downloadFile(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { buffer, filename, mimeType } = await this.fileService.downloadFile(
      id,
      req.user.id,
    );

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  /**
   * Download file by storage key with token (public endpoint for presigned URLs)
   */
  @Get('download/*')
  async downloadByStorageKey(
    @Param('0') storageKey: string,
    @Query('token') token: string,
    @Query('expires') expires: string,
    @Res() res: Response,
  ) {
    if (!token || !expires) {
      throw new BadRequestException(
        'Token and expires parameters are required',
      );
    }

    const { buffer, filename, mimeType } =
      await this.fileService.downloadByStorageKey(
        storageKey,
        token,
        parseInt(expires, 10),
      );

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  /**
   * Create a new version of a file
   * Requirements: 10.4
   */
  @Post(':id/versions')
  @UseInterceptors(FileInterceptor('file'))
  async createVersion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.fileService.createVersion(id, file, req.user.id);
  }

  /**
   * Get all versions of a file
   * Requirements: 10.4
   */
  @Get(':id/versions')
  async getFileVersions(@Param('id') id: string, @Req() req: any) {
    return this.fileService.getFileVersions(id, req.user.id);
  }

  /**
   * Rollback to a previous version
   * Requirements: 10.4
   */
  @Post(':id/rollback/:version')
  async rollbackToVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Req() req: any,
  ) {
    return this.fileService.rollbackToVersion(
      id,
      parseInt(version, 10),
      req.user.id,
    );
  }

  /**
   * Delete a file (soft delete)
   * Requirements: 10.5
   */
  @Delete(':id')
  async deleteFile(@Param('id') id: string, @Req() req: any) {
    await this.fileService.deleteFile(id, req.user.id);
    return { message: 'File deleted successfully' };
  }

  /**
   * Bulk delete files
   * Requirements: 10.6
   */
  @Delete('bulk')
  async bulkDelete(@Body() bulkDeleteDto: BulkDeleteDto, @Req() req: any) {
    return this.fileService.bulkDelete(bulkDeleteDto.fileIds, req.user.id);
  }

  /**
   * Recover a deleted file
   * Requirements: 10.5
   */
  @Post(':id/recover')
  async recoverFile(@Param('id') id: string, @Req() req: any) {
    return this.fileService.recoverFile(id, req.user.id);
  }

  /**
   * Get deleted files pending recovery
   */
  @Get('deleted/pending')
  async getDeletedFiles(@Req() req: any) {
    return this.fileService.getDeletedFiles(req.user.id);
  }

  /**
   * Cleanup expired files (admin only)
   */
  @Post('cleanup')
  @Roles(Role.ADMIN)
  async cleanupExpiredFiles() {
    const cleaned = await this.fileService.cleanupExpiredFiles();
    return { message: `Cleaned up ${cleaned} expired files` };
  }
}
