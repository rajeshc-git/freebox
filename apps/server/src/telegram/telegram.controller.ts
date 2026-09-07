import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  Headers,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Serve a buffer with RFC 7233 HTTP 206 Partial Content / Range support for instant video playback and seeking.
   */
  private serveBufferWithRange(
    req: Request,
    res: Response,
    buffer: Buffer,
    file: { name: string; mimeType: string },
    isPublic = false,
  ) {
    const totalSize = buffer.length;
    const rangeHeader = req.headers.range;

    let mimeType = file.mimeType || 'application/octet-stream';
    if (mimeType.includes(';')) {
      mimeType = mimeType.split(';')[0].trim();
    }
    if (file.name && file.name.endsWith('.ogg') && (mimeType === 'application/octet-stream' || mimeType === 'audio/opus')) {
      mimeType = 'audio/ogg';
    } else if (file.name && file.name.endsWith('.mp3') && mimeType === 'application/octet-stream') {
      mimeType = 'audio/mpeg';
    }
    const filename = encodeURIComponent(file.name || 'media');

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
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = this.jwtService.verify(token);
        return decoded.phone;
      } catch {}
    }

    if (queryToken) {
      try {
        const decoded = this.jwtService.verify(queryToken);
        return decoded.phone;
      } catch {}
    }

    throw new UnauthorizedException('Authentication required');
  }

  @Get('saved-messages')
  async getSavedMessages() {
    return this.telegramService.getSavedMessages();
  }

  @Get('archived-chats')
  async getArchivedChats(@Headers('authorization') auth?: string) {
    const phone = this.getUserPhone(auth);
    return this.telegramService.getArchivedChats(phone);
  }

  @Get('chats/:chatId/media')
  async getChatMedia(
    @Param('chatId') chatId: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('offsetId') offsetId?: string,
    @Headers('authorization') auth?: string,
  ) {
    const phone = this.getUserPhone(auth);
    const parsedLimit = limit ? parseInt(limit, 10) : 60;
    const parsedOffsetId = offsetId ? parseInt(offsetId, 10) : undefined;
    return this.telegramService.getChatMedia(phone, chatId, category, parsedLimit, parsedOffsetId);
  }

  @Get('chats/:chatId/media/:messageId/stream')
  async streamChatMedia(
    @Param('chatId') chatId: string,
    @Param('messageId') messageIdStr: string,
    @Query('token') queryToken: string,
    @Headers('authorization') auth: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const phone = this.getUserPhone(auth, queryToken);
    const messageId = parseInt(messageIdStr, 10);
    if (isNaN(messageId)) {
      throw new BadRequestException('Invalid messageId');
    }

    const mediaResult = await this.telegramService.downloadChatMedia(phone, chatId, messageId);
    this.serveBufferWithRange(req, res, mediaResult.buffer, {
      name: mediaResult.fileName,
      mimeType: mediaResult.mimeType,
    });
  }

  @Get('chats/:chatId/stats')
  async getChatStats(
    @Param('chatId') chatId: string,
    @Headers('authorization') auth?: string,
  ) {
    const phone = this.getUserPhone(auth);
    return this.telegramService.getChatStats(phone, chatId);
  }
}

