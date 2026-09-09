import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';

interface PendingAuth {
  client: TelegramClient;
  phoneCodeHash: string;
  phone: string;
  createdAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private pendingAuths = new Map<string, PendingAuth>();

  // Telegram MTProto client credentials (Android official client credentials or custom from env)
  private readonly apiId = parseInt(process.env.TELEGRAM_API_ID || '6', 10);
  private readonly apiHash = process.env.TELEGRAM_API_HASH || 'eb06d4abfb49dc3eeb1aeb98ae0f581e';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) {
    // Periodically clean up stale pending auths (> 10 minutes)
    setInterval(() => {
      const now = Date.now();
      for (const [phone, auth] of this.pendingAuths.entries()) {
        if (now - auth.createdAt > 10 * 60 * 1000) {
          auth.client.disconnect().catch(() => {});
          this.pendingAuths.delete(phone);
        }
      }
    }, 60 * 1000);
  }

  private cleanPhoneNumber(phone: string): string {
    let clean = phone.replace(/[^\d+]/g, '');
    if (!clean.startsWith('+')) {
      clean = '+' + clean;
    }
    return clean;
  }

  async sendVerificationCode(phone: string): Promise<{ success: boolean; phone: string; phoneCodeHash: string }> {
    const cleanPhone = this.cleanPhoneNumber(phone);
    if (cleanPhone.length < 7) {
      throw new BadRequestException('Please enter a valid phone number with country code');
    }

    this.logger.log(`Requesting real Telegram MTProto verification code for ${cleanPhone}...`);

    // Clean up any existing pending auth for this phone
    if (this.pendingAuths.has(cleanPhone)) {
      const existing = this.pendingAuths.get(cleanPhone);
      await existing?.client.disconnect().catch(() => {});
      this.pendingAuths.delete(cleanPhone);
    }

    try {
      const client = new TelegramClient(new StringSession(''), this.apiId, this.apiHash, {
        useWSS: true,
        connectionRetries: 5,
        timeout: 10000,
      });

      await client.connect();

      const result = await client.sendCode(
        { apiId: this.apiId, apiHash: this.apiHash },
        cleanPhone
      );

      this.pendingAuths.set(cleanPhone, {
        client,
        phoneCodeHash: result.phoneCodeHash,
        phone: cleanPhone,
        createdAt: Date.now(),
      });

      this.logger.log(`Telegram OTP code successfully sent to ${cleanPhone} via ${result.isCodeViaApp ? 'Telegram App' : 'SMS'}`);

      return {
        success: true,
        phone: cleanPhone,
        phoneCodeHash: result.phoneCodeHash,
      };
    } catch (err: any) {
      this.logger.error(`Failed to send Telegram code to ${cleanPhone}: ${err.message || err.errorMessage}`);
      const msg = err.errorMessage || err.message || '';
      if (msg === 'PHONE_NUMBER_INVALID') {
        throw new BadRequestException('The phone number is invalid for Telegram. Please verify your country code and number.');
      }
      if (msg.startsWith('FLOOD_WAIT_')) {
        const seconds = msg.split('_')[2] || 'a few';
        throw new BadRequestException(`Too many attempts from Telegram. Please wait ${seconds} seconds before trying again.`);
      }
      if (msg === 'PHONE_NUMBER_BANNED') {
        throw new BadRequestException('This phone number has been restricted by Telegram.');
      }
      throw new BadRequestException(`Telegram API Error: ${msg || 'Could not send verification code'}`);
    }
  }

  async verifyCode(
    phone: string,
    code: string,
    password?: string
  ): Promise<{ token: string; user: any; requiresPassword?: boolean }> {
    const cleanPhone = this.cleanPhoneNumber(phone);
    const cleanCode = code.trim();

    if (!cleanCode) {
      throw new BadRequestException('Verification code is required');
    }

    const pending = this.pendingAuths.get(cleanPhone);
    if (!pending) {
      throw new BadRequestException('Verification session expired or not found. Please request a new code.');
    }

    try {
      let authResult: any;

      try {
        authResult = await pending.client.invoke(
          new Api.auth.SignIn({
            phoneNumber: cleanPhone,
            phoneCodeHash: pending.phoneCodeHash,
            phoneCode: cleanCode,
          })
        );
      } catch (signErr: any) {
        if (signErr.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          if (!password) {
            return {
              token: '',
              user: null,
              requiresPassword: true,
            };
          }

          authResult = await pending.client.signInWithPassword(
            {
              apiId: this.apiId,
              apiHash: this.apiHash,
            },
            {
              password: async () => password,
              onError: (err: Error) => {
                throw err;
              },
            }
          );
        } else {
          throw signErr;
        }
      }

      const tgUser = (authResult as any).user;
      const fullName =
        [tgUser?.firstName, tgUser?.lastName].filter(Boolean).join(' ') ||
        tgUser?.username ||
        'Telegram User';
      const avatarText = tgUser?.firstName ? tgUser.firstName.slice(0, 2).toUpperCase() : 'TU';

      // Save user MTProto session string for future operations
      const sessionString = String((pending.client.session as any).save?.() || '');
      if (sessionString) {
        await this.redis.set(`tg_session:${cleanPhone}`, sessionString);
      }

      // Upsert real user in Prisma database
      const user = await this.prisma.user.upsert({
        where: { phone: cleanPhone },
        update: {
          name: fullName,
          avatar: avatarText,
        },
        create: {
          phone: cleanPhone,
          name: fullName,
          avatar: avatarText,
        },
      });

      // Clean up pending auth and keep client session
      this.pendingAuths.delete(cleanPhone);

      const token = this.jwtService.sign({
        sub: user.id,
        phone: user.phone,
      });

      this.logger.log(`User ${user.name} (${user.phone}) logged in successfully via Telegram MTProto!`);

      return { token, user };
    } catch (err: any) {
      this.logger.error(`Telegram OTP verification failed for ${cleanPhone}: ${err.message || err.errorMessage}`);
      const msg = err.errorMessage || err.message || '';
      if (msg === 'PHONE_CODE_INVALID') {
        throw new BadRequestException('Invalid Telegram verification code. Please check the code in your Telegram app.');
      }
      if (msg === 'PHONE_CODE_EXPIRED') {
        throw new BadRequestException('The Telegram verification code has expired. Please request a new code.');
      }
      if (msg === 'PASSWORD_HASH_INVALID') {
        throw new BadRequestException('Invalid Two-Step Verification cloud password.');
      }
      if (msg.startsWith('FLOOD_WAIT_')) {
        const seconds = msg.split('_')[2] || 'a few';
        throw new BadRequestException(`Too many attempts. Telegram requires waiting ${seconds} seconds.`);
      }
      throw new BadRequestException(`Verification failed: ${msg || 'Unknown Telegram error'}`);
    }
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async recordAndGetVisitorCount(clientIp: string): Promise<{ count: number }> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const cleanIp = (clientIp || 'unknown').replace(/[^a-zA-Z0-9.:_-]/g, '').slice(0, 64);
      const ipKey = `visitor:daily:${today}:${cleanIp}`;

      let currentTotalStr = await this.redis.get('freebox_total_visitors');
      let total = currentTotalStr ? parseInt(currentTotalStr, 10) : 0;

      // Initialize base count if not yet seeded in Redis
      if (!currentTotalStr || isNaN(total) || total < 1430) {
        total = 1430;
        await this.redis.set('freebox_total_visitors', total.toString());
      }

      // Check if this IP has visited today
      const alreadySeen = await this.redis.get(ipKey);
      if (!alreadySeen && cleanIp !== 'unknown') {
        await this.redis.set(ipKey, '1', 86400); // 24-hour TTL per IP
        total = await this.redis.incr('freebox_total_visitors');
      }

      return { count: total };
    } catch (err) {
      this.logger.error(`Error in recordAndGetVisitorCount: ${err.message}`);
      return { count: 1430 };
    }
  }
}


