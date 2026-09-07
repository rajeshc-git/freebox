import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DriveService } from './drive.service';
import { DriveController } from './drive.controller';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TelegramModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dock_jwt_secret_super_secure_key_2026',
    }),
  ],
  controllers: [DriveController],
  providers: [DriveService],
  exports: [DriveService],
})
export class DriveModule {}
