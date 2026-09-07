import { Controller, Get } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('saved-messages')
  async getSavedMessages() {
    return this.telegramService.getSavedMessages();
  }
}
