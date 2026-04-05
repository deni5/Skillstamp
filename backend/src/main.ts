import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: ['http://localhost:3000'], credentials: true });
  const config = new DocumentBuilder()
    .setTitle('Skillstamp API')
    .setDescription('EdTech x Web3 Skill Passport on Solana')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth').addTag('users').addTag('challenges')
    .addTag('sbts').addTag('tasks').addTag('recommendations')
    .build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));
  await app.listen(process.env.PORT || 3001);
  console.log(`Skillstamp API: http://localhost:${process.env.PORT || 3001}`);
  console.log(`Swagger: http://localhost:${process.env.PORT || 3001}/api`);
}
bootstrap();
