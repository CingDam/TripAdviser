import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { ConfigService } from '@nestjs/config';
import { extname } from 'path';

@Injectable()
export class S3Service {
  private s3: AWS.S3;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow<string>('BUCKET_NAME');
    this.endpoint = config.getOrThrow<string>('BUCKET_ENDPOINT');
    // 업로드 후 외부에서 접근할 공개 URL (R2 Public Dev URL 또는 커스텀 도메인)
    this.publicUrl = config.getOrThrow<string>('BUCKET_PUBLIC_URL');

    this.s3 = new AWS.S3({
      endpoint: this.endpoint,
      accessKeyId: config.getOrThrow<string>('BUCKET_ACCESS_KEY'),
      secretAccessKey: config.getOrThrow<string>('BUCKET_SECRET_KEY'),
      region: config.get<string>('BUCKET_REGION') ?? 'auto',
      // Tigris는 virtual-hosted-style 권장 (path-style 비권장)
      s3ForcePathStyle: false,
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
        // 업로드한 파일을 URL로 공개 접근 가능하게 설정
        ACL: 'public-read',
      })
      .promise();

    return `${this.publicUrl}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3
      .deleteObject({ Bucket: this.bucket, Key: key })
      .promise();
  }

  // 저장된 public URL에서 S3 key만 추출
  urlToKey(url: string): string {
    return url.replace(`${this.publicUrl}/`, '');
  }
}
