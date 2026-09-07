import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TelegramService } from './telegram.service';
import { TelegramClientService } from './telegram-client.service';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dock_jwt_secret_super_secure_key_2026',
    }),
  ],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramClientService],
  exports: [TelegramService, TelegramClientService],
})
export class TelegramModule {}

