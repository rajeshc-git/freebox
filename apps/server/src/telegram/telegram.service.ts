import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramClientService } from './telegram-client.service';

@Injectable()
export class TelegramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramClient: TelegramClientService,
  ) {}

  async getSavedMessages() {
    const files = await this.prisma.file.findMany({
      where: { isTrashed: false },
      orderBy: { createdAt: 'desc' },
    });

    return {
      chatTitle: 'Saved Messages',
      totalMessages: files.length,
      messages: files.map((f) => ({
        id: f.telegramMsgId,
        fileId: f.id,
        fileName: f.name,
        spoolHash: f.spoolHash,
        size: f.size,
        type: f.type,
        mimeType: f.mimeType,
        time: new Date(f.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date(f.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
        status: f.telegramStatus,
        thumbnailUrl: f.telegramMsgId > 0 ? `/api/drive/files/${f.id}/stream` : null,
      })),
    };
  }

  async getArchivedChats(phone: string) {
    return this.telegramClient.getArchivedChats(phone);
  }

  async getChatMedia(phone: string, chatId: string, category?: string, limit = 60, offsetId?: number) {
    return this.telegramClient.getChatMedia(phone, chatId, category, limit, offsetId);
  }

  async downloadChatMedia(phone: string, chatId: string, messageId: number) {
    return this.telegramClient.downloadChatMedia(phone, chatId, messageId);
  }

  async streamChatMedia(phone: string, chatId: string, messageId: number, req: any, res: any) {
    return this.telegramClient.streamMessageMedia(phone, messageId, req, res, { chatId });
  }

  async getChatStats(phone: string, chatId: string) {
    return this.telegramClient.getChatStats(phone, chatId);
  }
}
