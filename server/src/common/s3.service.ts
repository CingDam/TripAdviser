import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';

@Injectable()
export class S3Service {
  private s3: AWS.S3;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow<string>('AWS_S3_BUCKET');
    // R2 공개 URL — Cloudflare 대시보드에서 Public Development URL 활성화 후 설정
    this.publicUrl = config.getOrThrow<string>('BUCKET_PUBLIC_URL').replace(/\/$/, '');

    this.s3 = new AWS.S3({
      endpoint: config.getOrThrow<string>('AWS_ENDPOINT_URL_S3'),
      accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      region: config.get<string>('AWS_REGION') ?? 'auto',
      // R2는 path-style로 업로드, 공개 접근은 pub URL 사용
      s3ForcePathStyle: true,
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    const unique = `${Date.now()}-${Math.round(Math.random() * 9999)}`;
    const key = `${folder}/${unique}${extname(file.originalname)}`;

    await this.s3
      .upload({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
      .promise();

    // 퍼블릭 URL: https://{bucket-domain}/{key}
    return `${this.publicUrl}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.deleteObject({ Bucket: this.bucket, Key: key }).promise();
  }

  urlToKey(url: string): string {
    return url.replace(`${this.publicUrl}/`, '');
  }
}
