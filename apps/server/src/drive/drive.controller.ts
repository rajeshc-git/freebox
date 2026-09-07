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
import { DriveService } from './drive.service';

@Controller('drive')
export class DriveController {
  constructor(
    private readonly driveService: DriveService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Serve a buffer with RFC 7233 HTTP 206 Partial Content / Range support for instant video playback and seeking.
   */
  private serveBufferWithRange(
    req: Request,
    res: Response,
    buffer: Buffer,
    file: any,
    isPublic = false,
  ) {
    const totalSize = buffer.length;
    const rangeHeader = req.headers.range;

    const mimeType = file.mimeType || 'application/octet-stream';
    const filename = encodeURIComponent(file.name || 'file');

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        let start = match[1] ? parseInt(match[1], 10) : 0;
        let end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

        if (isNaN(start)) start = 0;
        if (isNaN(end) || end >= totalSize) end = totalSize - 1;

        if (start > end || start >= totalSize) {
          res
            .status(416)
            .set({
              'Content-Range': `bytes */${totalSize}`,
            })
            .end();
          return;
        }

        const chunk = buffer.subarray(start, end + 1);

        res.status(206).set({
          'Content-Type': mimeType,
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunk.length.toString(),
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, max-age=3600',
        });

        res.end(chunk);
        return;
      }
    }

    res.status(200).set({
      'Content-Type': mimeType,
      'Content-Length': totalSize.toString(),
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, max-age=3600',
      'Accept-Ranges': 'bytes',
    });

    res.end(buffer);
  }

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

  /**
   * Upload file to Telegram MTProto storage.
   */
  @Post('files/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 * 1024 } }))
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
      file.buffer,
      file.originalname,
      file.mimetype,
      file.size,
      targetFolderId,
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
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userPhone = this.getUserPhone(authHeader, queryToken);
    const { buffer, file } = await this.driveService.streamFile(id, userPhone);

    this.serveBufferWithRange(req, res, buffer, file, false);
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
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { buffer, file } = await this.driveService.streamPublicFile(spoolHash);

    this.serveBufferWithRange(req, res, buffer, file, true);
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
