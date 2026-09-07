import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramClientService } from './telegram-client.service';
import { TelegramController } from './telegram.controller';

@Module({
  controllers: [TelegramController],
  providers: [TelegramService, TelegramClientService],
  exports: [TelegramService, TelegramClientService],
})
export class TelegramModule {}
