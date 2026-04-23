import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { UploadService } from './upload.service';

const MULTER_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB — hard limit before hitting the service
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          '허용되지 않는 파일 형식입니다. jpg, png, webp만 업로드 가능합니다',
        ),
        false,
      );
    }
  },
};

@Controller('upload')
@UseGuards(AuthGuard('jwt'))
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /api/upload/city
   * Multipart field: file
   * Admin uploads a city cover image to S3.
   * Returns: { url, filename }
   */
  @Post('city')
  @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS))
  async uploadCityImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('파일이 없습니다 (field name: file)');
    }
    this.logger.log(
      `[upload/city] ${file.originalname} (${file.mimetype}, ${file.size} bytes)`,
    );
    return this.uploadService.uploadImage(file, 'city');
  }

  /**
   * POST /api/upload/community
   * Multipart field: file
   * Admin uploads a community post image to S3.
   * Returns: { url, filename }
   */
  @Post('community')
  @UseInterceptors(FileInterceptor('file', MULTER_OPTIONS))
  async uploadCommunityImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('파일이 없습니다 (field name: file)');
    }
    this.logger.log(
      `[upload/community] ${file.originalname} (${file.mimetype}, ${file.size} bytes)`,
    );
    return this.uploadService.uploadImage(file, 'community');
  }
}
