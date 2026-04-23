import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import { extname } from 'path';

export type UploadCategory = 'city' | 'community';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    const region = config.getOrThrow<string>('AWS_REGION');
    const endpoint = config.get<string>('AWS_ENDPOINT_URL_S3');
    const bucket = config.getOrThrow<string>('AWS_S3_BUCKET');

    this.bucket = bucket;

    this.s3 = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });

    // Public base URL: prefer explicit env var, otherwise derive from endpoint or S3 virtual-hosted style
    this.publicBase =
      config.get<string>('S3_PUBLIC_URL') ??
      (endpoint
        ? `${endpoint.replace(/\/$/, '')}/${bucket}`
        : `https://${bucket}.s3.${region}.amazonaws.com`);

    this.logger.log(
      `[UploadService] S3 ready — bucket=${bucket} region=${region} publicBase=${this.publicBase}`,
    );
  }

  async uploadImage(
    file: Express.Multer.File,
    category: UploadCategory,
  ): Promise<{ url: string; filename: string }> {
    this.validateFile(file);

    const filename = this.generateFilename(file.originalname);
    const key = `images/${category}/${filename}`;

    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Objects are public-read so the returned URL is directly accessible
      ACL: 'public-read',
    };

    try {
      await this.s3.send(new PutObjectCommand(params));
    } catch (err) {
      this.logger.error(`[UploadService] S3 upload failed: ${String(err)}`);
      throw new InternalServerErrorException('이미지 업로드에 실패했습니다');
    }

    const url = `${this.publicBase}/${key}`;
    this.logger.log(`[UploadService] Uploaded ${key} → ${url}`);

    return { url, filename };
  }

  // ── private helpers ──────────────────────────────────────────

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('파일이 없습니다');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `허용되지 않는 파일 형식입니다. 허용 형식: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `파일 크기가 너무 큽니다. 최대 허용 크기: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }
  }

  private generateFilename(originalName: string): string {
    const ext = extname(originalName).toLowerCase();
    const random = randomBytes(8).toString('hex');
    return `${Date.now()}-${random}${ext}`;
  }
}
