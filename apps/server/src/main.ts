import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('FreeBox_Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS for web frontend
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 5005;
  await app.listen(port);
  logger.log(`🚀 FreeBox Backend API is running on: http://localhost:${port}/api`);
}
bootstrap();
