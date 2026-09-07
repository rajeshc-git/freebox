import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TelegramService {
  constructor(private readonly prisma: PrismaService) {}

  async getSavedMessages() {
    const files = await this.prisma.file.findMany({
      where: { isTrashed: false },
      orderBy: { createdAt: 'desc' },
    });

    return {
      chatTitle: 'Saved Messages',
      totalMessages: files.length,
      messages: files.map(f => ({
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
}
