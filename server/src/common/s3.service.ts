import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private s3: AWS.S3;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow<string>('AWS_S3_BUCKET');
    this.publicUrl = config.getOrThrow<string>('BUCKET_PUBLIC_URL');

    this.s3 = new AWS.S3({
      endpoint: config.getOrThrow<string>('AWS_ENDPOINT_URL_S3'),
      accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      region: config.get<string>('AWS_REGION') ?? 'auto',
      // Tigris는 virtual-hosted-style 권장
      s3ForcePathStyle: false,
    });
  }

  async onModuleInit() {
    // 버킷 전체를 공개 읽기로 설정 — ACL 대신 bucket policy 사용 (Tigris 호환)
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicRead',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${this.bucket}/*`,
        },
      ],
    });

    try {
      await this.s3.putBucketPolicy({ Bucket: this.bucket, Policy: policy }).promise();
      this.logger.log(`버킷 공개 정책 적용 완료 — ${this.bucket}`);
    } catch (err: unknown) {
      this.logger.warn(
        `버킷 공개 정책 적용 실패 (이미 설정됐거나 미지원) — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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

    return `${this.publicUrl}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.deleteObject({ Bucket: this.bucket, Key: key }).promise();
  }

  urlToKey(url: string): string {
    return url.replace(`${this.publicUrl}/`, '');
  }
}
