import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';

interface CachedClient {
  client: TelegramClient;
  lastUsed: number;
}

@Injectable()
export class TelegramClientService {
  private readonly logger = new Logger(TelegramClientService.name);
  private clients = new Map<string, CachedClient>();

  private readonly apiId = parseInt(process.env.TELEGRAM_API_ID || '6', 10);
  private readonly apiHash = process.env.TELEGRAM_API_HASH || 'eb06d4abfb49dc3eeb1aeb98ae0f581e';

  constructor(private readonly redis: RedisService) {
    // Clean up idle clients every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [phone, cached] of this.clients.entries()) {
        if (now - cached.lastUsed > 15 * 60 * 1000) {
          cached.client.disconnect().catch(() => {});
          this.clients.delete(phone);
          this.logger.log(`Disconnected idle Telegram client for ${phone}`);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Get an authenticated TelegramClient for the given user phone.
   * Loads the session from Redis and connects if needed.
   */
  async getClient(phone: string): Promise<TelegramClient> {
    // Return cached connected client
    const cached = this.clients.get(phone);
    if (cached && cached.client.connected) {
      cached.lastUsed = Date.now();
      return cached.client;
    }

    // Load session string from Redis
    const sessionString = await this.redis.get(`tg_session:${phone}`);
    if (!sessionString) {
      throw new Error(`No Telegram session found for ${phone}. Please log in again.`);
    }

    const client = new TelegramClient(
      new StringSession(sessionString),
      this.apiId,
      this.apiHash,
      {
        useWSS: true,
        connectionRetries: 5,
        timeout: 15000,
      }
    );

    await client.connect();
    this.clients.set(phone, { client, lastUsed: Date.now() });
    this.logger.log(`Connected Telegram client for ${phone}`);

    return client;
  }

  /**
   * Upload a file to Telegram Saved Messages ("me").
   * Returns the sent Message containing the file.
   */
  async uploadFile(
    phone: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number,
    onProgress?: (progress: number) => void,
  ): Promise<Api.Message> {
    const client = await this.getClient(phone);

    const customFile = new CustomFile(fileName, fileSize, '', fileBuffer);

    const message = await client.sendFile('me', {
      file: customFile,
      caption: `📁 ${fileName}`,
      forceDocument: true,
      progressCallback: onProgress
        ? (progress: number) => {
            onProgress(Math.round(progress * 100));
          }
        : undefined,
    });

    this.logger.log(`Uploaded "${fileName}" (${fileSize} bytes) to Saved Messages for ${phone}, msgId=${message.id}`);

    return message as Api.Message;
  }

  /**
   * Download media from a Telegram message in Saved Messages.
   * Returns the file content as a Buffer.
   */
  async downloadMedia(
    phone: string,
    messageId: number,
  ): Promise<Buffer> {
    const client = await this.getClient(phone);

    // Fetch the message from Saved Messages
    const messages = await client.getMessages('me', {
      ids: [messageId],
    });

    if (!messages || messages.length === 0 || !messages[0]) {
      throw new Error(`Message #${messageId} not found in Saved Messages`);
    }

    const message = messages[0];

    const buffer = await client.downloadMedia(message, {}) as Buffer;
    if (!buffer) {
      throw new Error(`Could not download media from message #${messageId}`);
    }

    this.logger.log(`Downloaded media from message #${messageId} for ${phone} (${buffer.length} bytes)`);
    return buffer;
  }

  /**
   * Fetch recent messages from Saved Messages.
   */
  async getSavedMessages(
    phone: string,
    limit = 50,
    offsetId?: number,
  ): Promise<Api.Message[]> {
    const client = await this.getClient(phone);

    const messages = await client.getMessages('me', {
      limit,
      offsetId,
    });

    return messages as Api.Message[];
  }

  /**
   * Delete a message from Saved Messages.
   */
  async deleteMessage(phone: string, messageId: number): Promise<void> {
    const client = await this.getClient(phone);

    await client.deleteMessages('me', [messageId], { revoke: true });
    this.logger.log(`Deleted message #${messageId} from Saved Messages for ${phone}`);
  }

  /**
   * Delete multiple messages from Saved Messages.
   */
  async deleteMessages(phone: string, messageIds: number[]): Promise<void> {
    if (!messageIds.length) return;
    const client = await this.getClient(phone);

    await client.deleteMessages('me', messageIds, { revoke: true });
    this.logger.log(`Deleted ${messageIds.length} messages from Saved Messages for ${phone}`);
  }

  /**
   * Extract file info from a Telegram message's media.
   */
  extractFileInfo(message: Api.Message): {
    fileId: string;
    accessHash: string;
    size: number;
    mimeType: string;
  } | null {
    const doc = (message.media as any)?.document;
    if (doc) {
      return {
        fileId: doc.id?.toString() || '',
        accessHash: doc.accessHash?.toString() || '',
        size: Number(doc.size || 0),
        mimeType: doc.mimeType || 'application/octet-stream',
      };
    }

    const photo = (message.media as any)?.photo;
    if (photo) {
      return {
        fileId: photo.id?.toString() || '',
        accessHash: photo.accessHash?.toString() || '',
        size: 0,
        mimeType: 'image/jpeg',
      };
    }

    return null;
  }

  /**
   * Fetch all chats in the Telegram Archive folder (folder = 1).
   */
  async getArchivedChats(phone: string): Promise<{
    id: string;
    title: string;
    isChannel: boolean;
    isGroup: boolean;
    isUser: boolean;
    unreadCount: number;
    date: number;
  }[]> {
    const client = await this.getClient(phone);
    const dialogs = await client.getDialogs({ folder: 1 });

    return dialogs.map((d) => {
      const entity = d.entity as any;
      const title =
        d.title ||
        d.name ||
        entity?.title ||
        `${entity?.firstName || ''} ${entity?.lastName || ''}`.trim() ||
        'Archived Chat';

      return {
        id: d.id?.toString() || entity?.id?.toString() || '',
        title,
        isChannel: !!d.isChannel,
        isGroup: !!d.isGroup,
        isUser: !!d.isUser,
        unreadCount: d.unreadCount || 0,
        date: d.date || 0,
      };
    });
  }

  private async resolveEntity(client: any, chatId: string): Promise<any> {
    try {
      if (/^-?\d+$/.test(chatId)) {
        try {
          return await client.getEntity(BigInt(chatId));
        } catch {
          return await client.getEntity(chatId);
        }
      }
      return await client.getEntity(chatId);
    } catch (e1: any) {
      try {
        const dialogs = await client.getDialogs({ folder: 1 });
        const cleanId = chatId.replace(/^-100/, '').replace(/^-/, '');
        const found = dialogs.find(
          (d: any) =>
            d.id?.toString() === chatId ||
            d.id?.toString() === cleanId ||
            (d.entity as any)?.id?.toString() === chatId ||
            (d.entity as any)?.id?.toString() === cleanId ||
            `-100${(d.entity as any)?.id?.toString()}` === chatId,
        );
        if (found?.entity) return found.entity;
      } catch (e2) {}

      try {
        return await client.getInputEntity(chatId);
      } catch (e3) {
        throw new Error(`Could not resolve Telegram chat/channel ${chatId}: ${e1?.message || e1}`);
      }
    }
  }

  /**
   * Fetch media messages from a specific Telegram chat/channel.
   */
  async getChatMedia(
    phone: string,
    chatId: string,
    category?: string,
    limit = 100,
    offsetId?: number,
  ): Promise<{
    media: {
      id: number;
      chatId: string;
      name: string;
      fileName: string;
      size: number;
      type: 'image' | 'video' | 'document' | 'audio';
      mimeType: string;
      date: number;
      telegramMsgId: number;
    }[];
    count: number;
    hasMore: boolean;
    nextOffsetId: number | null;
  }> {
    const client = await this.getClient(phone);
    const entity = await this.resolveEntity(client, chatId);

    let filter: any = undefined;
    if (category === 'media' || category === 'photo_video') {
      filter = new Api.InputMessagesFilterPhotoVideo();
    } else if (category === 'image' || category === 'photo') {
      filter = new Api.InputMessagesFilterPhotos();
    } else if (category === 'video') {
      filter = new Api.InputMessagesFilterVideo();
    } else if (category === 'files' || category === 'document') {
      filter = new Api.InputMessagesFilterDocument();
    } else if (category === 'voice' || category === 'audio') {
      filter = new Api.InputMessagesFilterMusic();
    }

    const messages = await client.getMessages(entity, {
      filter,
      limit,
      offsetId,
    });

    const results: any[] = [];
    for (const msg of messages) {
      if (!msg.media) continue;

      let name = `media_${msg.id}`;
      let size = 0;
      let mimeType = 'application/octet-stream';
      let type: 'image' | 'video' | 'document' | 'audio' = 'document';

      const doc = (msg.media as any)?.document;
      const photo = (msg.media as any)?.photo;

      if (doc) {
        mimeType = doc.mimeType || 'application/octet-stream';
        size = Number(doc.size || 0);

        const fileNameAttr = doc.attributes?.find(
          (a: any) => a.className === 'DocumentAttributeFilename' || a.fileName,
        );
        const audioAttr = doc.attributes?.find(
          (a: any) => a.className === 'DocumentAttributeAudio' || a.duration !== undefined || a.voice !== undefined,
        );

        if (fileNameAttr?.fileName) {
          name = fileNameAttr.fileName;
        } else if (audioAttr) {
          name = audioAttr.title || (audioAttr.voice ? `Voice Message (${audioAttr.duration || 0}s)` : `Audio ${msg.id}.mp3`);
        } else if (mimeType.startsWith('image/')) {
          name = `photo_${msg.id}.${mimeType.split('/')[1] || 'jpg'}`;
        } else if (mimeType.startsWith('video/')) {
          name = `video_${msg.id}.${mimeType.split('/')[1] || 'mp4'}`;
        }

        if (mimeType.startsWith('image/')) {
          type = 'image';
        } else if (mimeType.startsWith('video/')) {
          type = 'video';
        } else if (mimeType.startsWith('audio/') || audioAttr) {
          type = 'audio';
          if (!mimeType.startsWith('audio/')) {
            mimeType = 'audio/ogg';
          }
        } else {
          type = 'document';
        }
      } else if (photo) {
        type = 'image';
        mimeType = 'image/jpeg';
        name = `photo_${msg.id}.jpg`;
        size = 0;
      } else {
        continue;
      }

      results.push({
        id: msg.id,
        chatId: chatId.toString(),
        name,
        fileName: name,
        size,
        type,
        mimeType,
        date: msg.date || 0,
        telegramMsgId: msg.id,
      });
    }

    const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : null;
    const nextOffsetId = lastMsg ? lastMsg.id : null;
    const hasMore = messages && messages.length >= limit;

    return {
      media: results,
      count: results.length,
      hasMore: !!hasMore,
      nextOffsetId,
    };
  }

  /**
   * Download media from a specific chat message.
   */
  async downloadChatMedia(
    phone: string,
    chatId: string,
    messageId: number,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const client = await this.getClient(phone);
    const entity = await this.resolveEntity(client, chatId);
    const messages = await client.getMessages(entity, { ids: [messageId] });

    if (!messages || messages.length === 0 || !messages[0]) {
      throw new Error(`Message #${messageId} not found in chat ${chatId}`);
    }

    const message = messages[0];
    const buffer = (await client.downloadMedia(message, {})) as Buffer;
    if (!buffer) {
      throw new Error(`Could not download media from message #${messageId}`);
    }

    let mimeType = 'application/octet-stream';
    let fileName = `file_${messageId}`;

    const doc = (message.media as any)?.document;
    if (doc) {
      mimeType = doc.mimeType || 'application/octet-stream';
      const audioAttr = doc.attributes?.find(
        (a: any) => a.className === 'DocumentAttributeAudio' || a.duration !== undefined || a.voice !== undefined,
      );
      const fileNameAttr = doc.attributes?.find(
        (a: any) => a.className === 'DocumentAttributeFilename' || a.fileName,
      );

      if (fileNameAttr?.fileName) {
        fileName = fileNameAttr.fileName;
      } else if (audioAttr) {
        fileName = audioAttr.voice ? `voice_${messageId}.ogg` : `audio_${messageId}.mp3`;
      }

      if (audioAttr && (!mimeType || mimeType === 'application/octet-stream')) {
        mimeType = 'audio/ogg';
      }
    } else if ((message.media as any)?.photo) {
      mimeType = 'image/jpeg';
      fileName = `photo_${messageId}.jpg`;
    }

    return { buffer, mimeType, fileName };
  }

  /**
   * Get exact item counts for official Telegram tabs (Media, Files, Voice).
   */
  async getChatStats(
    phone: string,
    chatId: string,
  ): Promise<{
    photos: number;
    videos: number;
    media: number;
    files: number;
    voice: number;
  }> {
    const client = await this.getClient(phone);
    const entity = await this.resolveEntity(client, chatId);

    let photos = 0;
    let videos = 0;
    let files = 0;
    let voice = 0;

    try {
      const photosRes = await client.getMessages(entity, {
        filter: new Api.InputMessagesFilterPhotos(),
        limit: 1,
      });
      photos = (photosRes as any)?.total || (photosRes as any)?.count || (Array.isArray(photosRes) ? photosRes.length : 0);
    } catch {}

    try {
      const videosRes = await client.getMessages(entity, {
        filter: new Api.InputMessagesFilterVideo(),
        limit: 1,
      });
      videos = (videosRes as any)?.total || (videosRes as any)?.count || (Array.isArray(videosRes) ? videosRes.length : 0);
    } catch {}

    try {
      const filesRes = await client.getMessages(entity, {
        filter: new Api.InputMessagesFilterDocument(),
        limit: 1,
      });
      files = (filesRes as any)?.total || (filesRes as any)?.count || (Array.isArray(filesRes) ? filesRes.length : 0);
    } catch {}

    try {
      const voiceRes = await client.getMessages(entity, {
        filter: new Api.InputMessagesFilterVoice(),
        limit: 1,
      });
      const musicRes = await client.getMessages(entity, {
        filter: new Api.InputMessagesFilterMusic(),
        limit: 1,
      });
      const vCount = (voiceRes as any)?.total || 0;
      const mCount = (musicRes as any)?.total || 0;
      voice = vCount + mCount;
    } catch {}

    return {
      photos,
      videos,
      media: photos + videos,
      files,
      voice,
    };
  }
}

