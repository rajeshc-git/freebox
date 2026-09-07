import { Controller, Post, Body, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('send-code')
  async sendCode(@Body() body: { phone: string }) {
    return this.authService.sendVerificationCode(body.phone);
  }

  @Post('verify-code')
  async verifyCode(@Body() body: { phone: string; code: string; password?: string }) {
    return this.authService.verifyCode(body.phone, body.code, body.password);
  }

  @Get('me')
  async getMe(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = this.jwtService.verify(token);
      return this.authService.getMe(decoded.sub);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
