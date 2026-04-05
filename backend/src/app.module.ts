import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChallengesModule } from './challenges/challenges.module';
import { SbtsModule } from './sbts/sbts.module';
import { TasksModule } from './tasks/tasks.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { RecommendationsModule } from './recommendations/recommendations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true,
        logging: false,
      }),
      inject: [ConfigService],
    }),
    BlockchainModule,
    AuthModule,
    UsersModule,
    ChallengesModule,
    SbtsModule,
    TasksModule,
    RecommendationsModule,
  ],
})
export class AppModule {}
