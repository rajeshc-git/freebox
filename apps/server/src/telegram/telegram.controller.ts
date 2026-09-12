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
   * Extract user ID and phone from JWT Bearer token or query param.
   */
  private getAuthUser(authHeader?: string, queryToken?: string): { userId: string; phone: string } {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded: any = this.jwtService.verify(token);
        if (decoded && (decoded.sub || decoded.phone)) {
          return { userId: decoded.sub, phone: decoded.phone };
        }
      } catch {}
    }

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

  @Get('saved-messages')
  async getSavedMessages(@Headers('authorization') auth?: string) {
    const { userId } = this.getAuthUser(auth);
    return this.telegramService.getSavedMessages(userId);
  }

  @Get('archived-chats')
  async getArchivedChats(@Headers('authorization') auth?: string) {
    const { phone } = this.getAuthUser(auth);
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
    const { phone } = this.getAuthUser(auth);
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
    const { phone } = this.getAuthUser(auth, queryToken);
    const messageId = parseInt(messageIdStr, 10);
    if (isNaN(messageId)) {
      throw new BadRequestException('Invalid messageId');
    }

    await this.telegramService.streamChatMedia(phone, chatId, messageId, req, res);
  }

  @Get('chats/:chatId/stats')
  async getChatStats(
    @Param('chatId') chatId: string,
    @Headers('authorization') auth?: string,
  ) {
    const { phone } = this.getAuthUser(auth);
    return this.telegramService.getChatStats(phone, chatId);
  }
}
