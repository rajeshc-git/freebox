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
  Headers,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { DriveService } from './drive.service';

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

    throw new UnauthorizedException('Authentication required. Please log in.');
  }

  @Get('folders')
  async getFolders(@Query('parentId') parentId?: string) {
    return this.driveService.getFolders(parentId);
  }

  @Post('folders')
  async createFolder(@Body() body: { name: string; parentId?: string; color?: string }) {
    return this.driveService.createFolder(body.name, body.parentId, body.color);
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

  /**
   * Upload a file to Telegram Saved Messages.
   * Accepts multipart/form-data with the actual file bytes.
   */
  @Post('files/upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB max (Telegram limit)
  }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { folderId?: string },
    @Headers('authorization') authHeader: string,
  ) {
    const userPhone = this.getUserPhone(authHeader);

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size (2 GB for standard, 4 GB for premium)
    const maxSize = 2 * 1024 * 1024 * 1024; // 2 GB
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size (${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB) exceeds the Telegram limit of 2 GB. Use Telegram Premium for up to 4 GB.`
      );
    }

    return this.driveService.uploadFileToTelegram(
      userPhone,
      file.buffer,
      file.originalname,
      file.mimetype,
      file.size,
      body.folderId,
    );
  }

  /**
   * Stream / download a file from Telegram.
   * Accepts auth via Bearer header or ?token= query param (for media elements).
   */
  @Get('files/:id/stream')
  async streamFile(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
    @Query('token') queryToken: string,
    @Res() res: Response,
  ) {
    const userPhone = this.getUserPhone(authHeader, queryToken);
    const { buffer, file } = await this.driveService.streamFile(id, userPhone);

    res.set({
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': 'bytes',
    });

    res.send(buffer);
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
    @Res() res: Response,
  ) {
    const userPhone = this.getUserPhone(authHeader, queryToken);
    const { buffer, file } = await this.driveService.streamFile(id, userPhone);

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
    });

    res.send(buffer);
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
    @Res() res: Response,
  ) {
    const { buffer, file } = await this.driveService.streamPublicFile(spoolHash);

    res.set({
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
      'Cache-Control': 'public, max-age=86400',
      'Accept-Ranges': 'bytes',
    });

    res.send(buffer);
  }

  /**
   * Public direct download attachment via Telegram high-speed CDN.
   */
  @Get('public/download/:spoolHash')
  async downloadPublicFile(
    @Param('spoolHash') spoolHash: string,
    @Res() res: Response,
  ) {
    const { buffer, file } = await this.driveService.streamPublicFile(spoolHash);

    res.set({
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
    });

    res.send(buffer);
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

  @Get('storage-metrics')
  async getStorageMetrics() {
    return this.driveService.getStorageMetrics();
  }
}
