import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DriveService } from './drive.service';
import { DriveController } from './drive.controller';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TelegramModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [DriveController],
  providers: [DriveService],
  exports: [DriveService],
})
export class DriveModule {}
