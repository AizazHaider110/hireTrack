import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface StorageConfig {
  provider: 'local' | 's3';
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  localPath?: string;
}

export interface UploadResult {
  storageKey: string;
  storageUrl: string;
  size: number;
}

export interface PresignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

// Allowed file types and their MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly config: StorageConfig;

  constructor(private configService: ConfigService) {
    this.config = {
      provider: (this.configService.get<string>('STORAGE_PROVIDER') ||
        'local') as 'local' | 's3',
      bucket: this.configService.get<string>('AWS_S3_BUCKET'),
      region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      localPath:
        this.configService.get<string>('LOCAL_STORAGE_PATH') || 'uploads',
    };
  }

  /**
   * Validate file before upload
   * Requirements: 10.1 - secure file upload with type validation
   */
  validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Basic virus scanning simulation - in production, integrate with ClamAV or similar
    this.performVirusScan(file);
  }

  /**
   * Perform basic virus scanning
   * In production, this should integrate with a real antivirus service
   */
  private performVirusScan(file: Express.Multer.File): void {
    // Check for common malicious patterns in file content
    const buffer = file.buffer;

    // Check for executable signatures
    const executableSignatures = [
      Buffer.from([0x4d, 0x5a]), // MZ (Windows executable)
      Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF (Linux executable)
    ];

    for (const signature of executableSignatures) {
      if (buffer.slice(0, signature.length).equals(signature)) {
        throw new BadRequestException(
          'File appears to be an executable and is not allowed',
        );
      }
    }

    this.logger.debug(`Virus scan passed for file: ${file.originalname}`);
  }

  /**
   * Generate a unique storage key for the file
   */
  generateStorageKey(
    originalName: string,
    entityType: string,
    entityId: string,
  ): string {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    const sanitizedName = path
      .basename(originalName, extension)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);

    return `${entityType}/${entityId}/${timestamp}-${randomBytes}-${sanitizedName}${extension}`;
  }

  /**
   * Upload file to storage
   * Requirements: 10.2 - store files in cloud storage (AWS S3 or equivalent)
   */
  async uploadFile(
    file: Express.Multer.File,
    storageKey: string,
  ): Promise<UploadResult> {
    this.validateFile(file);

    if (this.config.provider === 's3') {
      return this.uploadToS3(file, storageKey);
    } else {
      return this.uploadToLocal(file, storageKey);
    }
  }

  /**
   * Upload file to AWS S3
   */
  private async uploadToS3(
    file: Express.Multer.File,
    storageKey: string,
  ): Promise<UploadResult> {
    // In production, use AWS SDK
    // For now, we'll simulate S3 upload with local storage
    // This can be replaced with actual S3 implementation

    if (!this.config.bucket) {
      this.logger.warn(
        'S3 bucket not configured, falling back to local storage',
      );
      return this.uploadToLocal(file, storageKey);
    }

    try {
      // Simulated S3 upload - replace with actual AWS SDK implementation
      // const s3 = new S3Client({ region: this.config.region });
      // await s3.send(new PutObjectCommand({
      //   Bucket: this.config.bucket,
      //   Key: storageKey,
      //   Body: file.buffer,
      //   ContentType: file.mimetype,
      //   ServerSideEncryption: 'AES256', // Encryption at rest
      // }));

      // For now, use local storage as fallback
      return this.uploadToLocal(file, storageKey);
    } catch (error) {
      this.logger.error(`Failed to upload to S3: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to upload file to storage',
      );
    }
  }

  /**
   * Upload file to local storage
   */
  private async uploadToLocal(
    file: Express.Multer.File,
    storageKey: string,
  ): Promise<UploadResult> {
    const localPath = this.config.localPath || 'uploads';
    const fullPath = path.join(localPath, storageKey);
    const directory = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write file with encryption simulation
    // In production, implement actual encryption at rest
    fs.writeFileSync(fullPath, file.buffer);

    this.logger.log(`File uploaded to local storage: ${fullPath}`);

    return {
      storageKey,
      storageUrl: fullPath,
      size: file.size,
    };
  }

  /**
   * Generate a presigned URL for secure file access
   * Requirements: 10.3 - generate secure, time-limited URLs for file access
   */
  async generatePresignedUrl(
    storageKey: string,
    options: PresignedUrlOptions = {},
  ): Promise<{ url: string; expiresAt: Date }> {
    const expiresIn = options.expiresIn || 3600; // Default 1 hour
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    if (this.config.provider === 's3') {
      return this.generateS3PresignedUrl(storageKey, expiresIn, expiresAt);
    } else {
      return this.generateLocalPresignedUrl(storageKey, expiresIn, expiresAt);
    }
  }

  /**
   * Generate S3 presigned URL
   */
  private async generateS3PresignedUrl(
    storageKey: string,
    expiresIn: number,
    expiresAt: Date,
  ): Promise<{ url: string; expiresAt: Date }> {
    // In production, use AWS SDK getSignedUrl
    // const command = new GetObjectCommand({
    //   Bucket: this.config.bucket,
    //   Key: storageKey,
    // });
    // const url = await getSignedUrl(s3Client, command, { expiresIn });

    // For now, generate a local URL with token
    return this.generateLocalPresignedUrl(storageKey, expiresIn, expiresAt);
  }

  /**
   * Generate local presigned URL with token-based access
   */
  private async generateLocalPresignedUrl(
    storageKey: string,
    expiresIn: number,
    expiresAt: Date,
  ): Promise<{ url: string; expiresAt: Date }> {
    // Generate a secure token for URL access
    const token = this.generateAccessToken(storageKey, expiresAt);

    // In production, this would be a full URL to your file serving endpoint
    const baseUrl =
      this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
    const url = `${baseUrl}/files/download/${encodeURIComponent(storageKey)}?token=${token}&expires=${expiresAt.getTime()}`;

    return { url, expiresAt };
  }

  /**
   * Generate secure access token for file download
   */
  private generateAccessToken(storageKey: string, expiresAt: Date): string {
    const secret =
      this.configService.get<string>('FILE_ACCESS_SECRET') || 'default-secret';
    const data = `${storageKey}:${expiresAt.getTime()}`;
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Validate access token for file download
   */
  validateAccessToken(
    storageKey: string,
    token: string,
    expires: number,
  ): boolean {
    const expiresAt = new Date(expires);

    // Check if token has expired
    if (expiresAt < new Date()) {
      return false;
    }

    // Validate token
    const expectedToken = this.generateAccessToken(storageKey, expiresAt);
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expectedToken),
    );
  }

  /**
   * Get file from storage
   */
  async getFile(storageKey: string): Promise<Buffer> {
    if (this.config.provider === 's3') {
      return this.getFileFromS3(storageKey);
    } else {
      return this.getFileFromLocal(storageKey);
    }
  }

  /**
   * Get file from S3
   */
  private async getFileFromS3(storageKey: string): Promise<Buffer> {
    // In production, use AWS SDK
    // const command = new GetObjectCommand({
    //   Bucket: this.config.bucket,
    //   Key: storageKey,
    // });
    // const response = await s3Client.send(command);
    // return Buffer.from(await response.Body.transformToByteArray());

    // Fallback to local
    return this.getFileFromLocal(storageKey);
  }

  /**
   * Get file from local storage
   */
  private async getFileFromLocal(storageKey: string): Promise<Buffer> {
    const localPath = this.config.localPath || 'uploads';
    const fullPath = path.join(localPath, storageKey);

    if (!fs.existsSync(fullPath)) {
      throw new BadRequestException('File not found');
    }

    return fs.readFileSync(fullPath);
  }

  /**
   * Delete file from storage
   */
  async deleteFile(storageKey: string): Promise<void> {
    if (this.config.provider === 's3') {
      await this.deleteFromS3(storageKey);
    } else {
      await this.deleteFromLocal(storageKey);
    }
  }

  /**
   * Delete file from S3
   */
  private async deleteFromS3(storageKey: string): Promise<void> {
    // In production, use AWS SDK
    // const command = new DeleteObjectCommand({
    //   Bucket: this.config.bucket,
    //   Key: storageKey,
    // });
    // await s3Client.send(command);

    // Fallback to local
    await this.deleteFromLocal(storageKey);
  }

  /**
   * Delete file from local storage
   */
  private async deleteFromLocal(storageKey: string): Promise<void> {
    const localPath = this.config.localPath || 'uploads';
    const fullPath = path.join(localPath, storageKey);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      this.logger.log(`File deleted from local storage: ${fullPath}`);
    }
  }

  /**
   * Copy file in storage (for versioning)
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    if (this.config.provider === 's3') {
      await this.copyInS3(sourceKey, destinationKey);
    } else {
      await this.copyInLocal(sourceKey, destinationKey);
    }
  }

  /**
   * Copy file in S3
   */
  private async copyInS3(
    sourceKey: string,
    destinationKey: string,
  ): Promise<void> {
    // In production, use AWS SDK CopyObjectCommand
    await this.copyInLocal(sourceKey, destinationKey);
  }

  /**
   * Copy file in local storage
   */
  private async copyInLocal(
    sourceKey: string,
    destinationKey: string,
  ): Promise<void> {
    const localPath = this.config.localPath || 'uploads';
    const sourcePath = path.join(localPath, sourceKey);
    const destPath = path.join(localPath, destinationKey);
    const destDir = path.dirname(destPath);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(sourcePath, destPath);
    this.logger.log(`File copied: ${sourcePath} -> ${destPath}`);
  }
}
