import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { ConfigService } from '@nestjs/config';
import { extname, join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';

@Injectable()
export class S3Service {
  private s3: AWS.S3 | null = null;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly isLocal: boolean;
  private readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.isLocal =
      (config.get<string>('NODE_ENV') ?? 'development') !== 'production';

    if (this.isLocal) {
      // 개발 환경 — 로컬 디스크에 저장
      this.uploadDir = join(process.cwd(), 'uploads');
      if (!existsSync(this.uploadDir))
        mkdirSync(this.uploadDir, { recursive: true });
      this.bucket = '';
      this.publicUrl = '';
    } else {
      this.bucket = config.getOrThrow<string>('AWS_S3_BUCKET');
      this.publicUrl = config
        .getOrThrow<string>('BUCKET_PUBLIC_URL')
        .replace(/\/$/, '');
      this.uploadDir = '';
      this.s3 = new AWS.S3({
        endpoint: config.getOrThrow<string>('AWS_ENDPOINT_URL_S3'),
        accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
        region: config.get<string>('AWS_REGION') ?? 'auto',
        // R2는 path-style로 업로드, 공개 접근은 pub URL 사용
        s3ForcePathStyle: true,
      });
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    const unique = `${Date.now()}-${Math.round(Math.random() * 9999)}`;
    const filename = `${unique}${extname(file.originalname)}`;

    if (this.isLocal) {
      const dir = join(this.uploadDir, folder);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, filename), file.buffer);
      const port = this.config.get<string>('PORT') ?? '3001';
      return `http://localhost:${port}/uploads/${folder}/${filename}`;
    }

    const key = `${folder}/${filename}`;
    await this.s3!.upload({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }).promise();

    // 퍼블릭 URL: https://{bucket-domain}/{key}
    return `${this.publicUrl}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    if (this.isLocal) {
      const filePath = join(this.uploadDir, key);
      if (existsSync(filePath)) unlinkSync(filePath);
      return;
    }
    await this.s3!.deleteObject({ Bucket: this.bucket, Key: key }).promise();
  }

  urlToKey(url: string): string {
    if (this.isLocal) {
      // http://localhost:3001/uploads/community/xxx.jpg → community/xxx.jpg
      return url.replace(/^https?:\/\/[^/]+\/uploads\//, '');
    }
    return url.replace(`${this.publicUrl}/`, '');
  }
}
