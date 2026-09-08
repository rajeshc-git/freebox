import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  Res,
  Req,
  Headers,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { diskStorage } from 'multer';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { DriveService } from './drive.service';

const uploadSpoolDir = path.join(os.tmpdir(), 'freebox-spool');
if (!fs.existsSync(uploadSpoolDir)) {
  try {
    fs.mkdirSync(uploadSpoolDir, { recursive: true });
  } catch {}
}

const multerDiskStorage = diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadSpoolDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  },
});

@Controller('drive')
export class DriveController {
  constructor(
    private readonly driveService: DriveService,
    private readonly jwtService: JwtService,
  ) {}



  /**
   * Extract user phone from JWT Bearer token or query param.
   */
  private getUserPhone(authHeader?: string, queryToken?: string): string {
    // Try Authorization header first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = this.jwtService.verify(token);
        return decoded.phone;
      } catch {}
    }

    // Fall back to query param token (for <img>, <video>, <audio> src)
    if (queryToken) {
      try {
        const decoded = this.jwtService.verify(queryToken);
        return decoded.phone;
      } catch {}
    }

    throw new UnauthorizedException('Authentication required');
  }

  @Get('folders')
  async getFolders(@Query('parentId') parentId?: string) {
    return this.driveService.getFolders(parentId);
  }

  @Post('folders')
  async createFolder(@Body() body: { name: string; parentId?: string; color?: string }) {
    if (!body.name || !body.name.trim()) {
      throw new BadRequestException('Folder name is required');
    }
    return this.driveService.createFolder(body.name.trim(), body.parentId, body.color);
  }

  @Patch('folders/:id')
  async renameFolder(
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    if (!name || !name.trim()) {
      throw new BadRequestException('Folder name is required');
    }
    return this.driveService.renameFolder(id, name.trim());
  }

  @Delete('folders/:id')
  async deleteFolder(@Param('id') id: string) {
    return this.driveService.deleteFolder(id);
  }

  @Get('files')
  async getFiles(
    @Query('folderId') folderId?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('nav') nav?: string,
  ) {
    return this.driveService.getFiles({ folderId, category, search, nav });
  }

  @Get('storage/metrics')
  async getStorageMetrics() {
    return this.driveService.getStorageMetrics();
  }

  @Get('storage-metrics')
  async getStorageMetricsAlias() {
    return this.driveService.getStorageMetrics();
  }

  /**
   * Upload file to Telegram MTProto storage using disk-spooled streaming (zero RAM buffering).
   */
  @Post('files/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerDiskStorage,
      limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('folderId') folderId: string,
    @Headers('authorization') authHeader: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const userPhone = this.getUserPhone(authHeader);
    const targetFolderId = folderId === 'root' || !folderId ? null : folderId;

    return this.driveService.uploadFileToTelegram(
      userPhone,
      {
        filePath: file.path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
      file.originalname,
      file.mimetype,
      file.size,
      targetFolderId,
    );
  }

  /**
   * Stream a file from Telegram directly to response.
   * Accepts auth via Bearer header or ?token= query param (for media elements).
   */
  @Get('files/:id/stream')
  async streamFile(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
    @Query('token') queryToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userPhone = this.getUserPhone(authHeader, queryToken);
    await this.driveService.streamFile(id, userPhone, req, res, false);
  }

  /**
   * Batch download multiple files zipped on-the-fly.
   */
  @Get('files/batch/download')
  async downloadBatch(
    @Query('ids') idsParam: string,
    @Headers('authorization') authHeader: string,
    @Query('token') queryToken: string,
    @Res() res: Response,
  ) {
    const userPhone = this.getUserPhone(authHeader, queryToken);
    const ids = idsParam ? idsParam.split(',').filter(Boolean) : [];
    if (!ids.length) {
      throw new BadRequestException('No file IDs specified for batch download');
    }

    await this.driveService.downloadBatchZip(ids, userPhone, res);
  }

  /**
   * Download a file as attachment (forces browser download).
   * Accepts auth via Bearer header or ?token= query param.
   */
  @Get('files/:id/download')
  async downloadFile(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
    @Query('token') queryToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userPhone = this.getUserPhone(authHeader, queryToken);
    await this.driveService.streamFile(id, userPhone, req, res, true);
  }

  /**
   * Public file metadata for shared direct links.
   */
  @Get('public/share/:spoolHash')
  async getPublicShareInfo(@Param('spoolHash') spoolHash: string) {
    const file = await this.driveService.getPublicFileBySpool(spoolHash);
    return {
      ...file,
      streamUrl: `/api/drive/public/stream/${file.spoolHash}`,
      downloadUrl: `/api/drive/public/download/${file.spoolHash}`,
    };
  }

  /**
   * Public file streaming for media and inline rendering.
   */
  @Get('public/stream/:spoolHash')
  async streamPublicFile(
    @Param('spoolHash') spoolHash: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.driveService.streamPublicFile(spoolHash, req, res, false);
  }

  /**
   * Public direct download attachment via Telegram high-speed CDN.
   */
  @Get('public/download/:spoolHash')
  async downloadPublicFile(
    @Param('spoolHash') spoolHash: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.driveService.streamPublicFile(spoolHash, req, res, true);
  }

  @Patch('files/:id/move')
  async moveFile(
    @Param('id') id: string,
    @Body() body: { folderId: string | null },
  ) {
    return this.driveService.moveFile(id, body.folderId);
  }

  @Patch('files/batch/move')
  async moveFiles(
    @Body() body: { ids: string[]; folderId: string | null },
  ) {
    return this.driveService.moveFiles(body.ids, body.folderId);
  }

  @Patch('files/:id/star')
  async toggleStar(@Param('id') id: string) {
    return this.driveService.toggleStar(id);
  }

  @Delete('trash/empty')
  async emptyTrash(@Headers('authorization') authHeader?: string) {
    let userPhone: string | undefined;
    try {
      if (authHeader) userPhone = this.getUserPhone(authHeader);
    } catch {}
    return this.driveService.emptyTrash(userPhone);
  }

  @Post('trash/restore-batch')
  async restoreBatch(@Body('ids') ids: string[]) {
    return this.driveService.restoreFilesBatch(ids);
  }

  @Delete('trash/delete-batch')
  async deleteBatchPermanent(
    @Body('ids') ids: string[],
    @Headers('authorization') authHeader?: string,
  ) {
    let userPhone: string | undefined;
    try {
      if (authHeader) userPhone = this.getUserPhone(authHeader);
    } catch {}
    return this.driveService.deleteFilesBatch(ids, true, userPhone);
  }

  @Delete('files/:id')
  async deleteFile(
    @Param('id') id: string,
    @Query('permanent') permanent?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    let userPhone: string | undefined;
    try {
      if (authHeader) userPhone = this.getUserPhone(authHeader);
    } catch {
      // Delete from DB only if no valid auth
    }
    return this.driveService.deleteFile(id, permanent === 'true', userPhone);
  }

  @Post('files/:id/restore')
  async restoreFile(@Param('id') id: string) {
    return this.driveService.restoreFile(id);
  }
}
