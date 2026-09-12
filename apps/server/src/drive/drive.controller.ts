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
   * Extract user ID and phone from JWT Bearer token or query param.
   */
  private getAuthUser(authHeader?: string, queryToken?: string): { userId: string; phone: string } {
    // Try Authorization header first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded: any = this.jwtService.verify(token);
        if (decoded && (decoded.sub || decoded.phone)) {
          return { userId: decoded.sub, phone: decoded.phone };
        }
      } catch {}
    }

    // Fall back to query param token (for <img>, <video>, <audio> src)
    if (queryToken) {
      try {
        const decoded: any = this.jwtService.verify(queryToken);
        if (decoded && (decoded.sub || decoded.phone)) {
          return { userId: decoded.sub, phone: decoded.phone };
        }
      } catch {}
    }

    throw new UnauthorizedException('Authentication required');
  }

  @Get('folders')
  async getFolders(
    @Headers('authorization') authHeader: string,
    @Query('parentId') parentId?: string,
  ) {
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.getFolders(userId, parentId);
  }

  @Post('folders')
  async createFolder(
    @Headers('authorization') authHeader: string,
    @Body() body: { name: string; parentId?: string; color?: string },
  ) {
    if (!body.name || !body.name.trim()) {
      throw new BadRequestException('Folder name is required');
    }
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.createFolder(userId, body.name.trim(), body.parentId, body.color);
  }

  @Patch('folders/:id')
  async renameFolder(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    if (!name || !name.trim()) {
      throw new BadRequestException('Folder name is required');
    }
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.renameFolder(userId, id, name.trim());
  }

  @Delete('folders/:id')
  async deleteFolder(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.deleteFolder(userId, id);
  }

  @Get('files')
  async getFiles(
    @Headers('authorization') authHeader: string,
    @Query('folderId') folderId?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('nav') nav?: string,
  ) {
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.getFiles(userId, { folderId, category, search, nav });
  }

  @Get('storage/metrics')
  async getStorageMetrics(@Headers('authorization') authHeader: string) {
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.getStorageMetrics(userId);
  }

  @Get('storage-metrics')
  async getStorageMetricsAlias(@Headers('authorization') authHeader: string) {
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.getStorageMetrics(userId);
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

    const { userId, phone } = this.getAuthUser(authHeader);
    const targetFolderId = folderId === 'root' || !folderId ? null : folderId;

    return this.driveService.uploadFileToTelegram(
      userId,
      phone,
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
    const { userId, phone } = this.getAuthUser(authHeader, queryToken);
    await this.driveService.streamFile(id, userId, phone, req, res, false);
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
    const { userId, phone } = this.getAuthUser(authHeader, queryToken);
    const ids = idsParam ? idsParam.split(',').filter(Boolean) : [];
    if (!ids.length) {
      throw new BadRequestException('No file IDs specified for batch download');
    }

    await this.driveService.downloadBatchZip(ids, userId, phone, res);
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
    const { userId, phone } = this.getAuthUser(authHeader, queryToken);
    await this.driveService.streamFile(id, userId, phone, req, res, true);
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
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { folderId: string | null },
  ) {
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.moveFile(userId, id, body.folderId);
  }

  @Patch('files/batch/move')
  async moveFiles(
    @Headers('authorization') authHeader: string,
    @Body() body: { ids: string[]; folderId: string | null },
  ) {
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.moveFiles(userId, body.ids, body.folderId);
  }

  @Patch('files/:id/star')
  async toggleStar(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.toggleStar(userId, id);
  }

  @Delete('trash/empty')
  async emptyTrash(@Headers('authorization') authHeader: string) {
    const { userId, phone } = this.getAuthUser(authHeader);
    return this.driveService.emptyTrash(userId, phone);
  }

  @Post('trash/restore-batch')
  async restoreBatch(
    @Headers('authorization') authHeader: string,
    @Body('ids') ids: string[],
  ) {
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.restoreFilesBatch(userId, ids);
  }

  @Delete('trash/delete-batch')
  async deleteBatchPermanent(
    @Headers('authorization') authHeader: string,
    @Body('ids') ids: string[],
  ) {
    const { userId, phone } = this.getAuthUser(authHeader);
    return this.driveService.deleteFilesBatch(userId, ids, true, phone);
  }

  @Delete('files/:id')
  async deleteFile(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Query('permanent') permanent?: string,
  ) {
    const { userId, phone } = this.getAuthUser(authHeader);
    return this.driveService.deleteFile(userId, id, permanent === 'true', phone);
  }

  @Post('files/:id/restore')
  async restoreFile(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
  ) {
    const { userId } = this.getAuthUser(authHeader);
    return this.driveService.restoreFile(userId, id);
  }
}
