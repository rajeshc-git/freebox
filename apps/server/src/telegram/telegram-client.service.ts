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
}
