import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { Challenge } from './challenge.entity';
import { ChallengeCompletion } from './challenge-completion.entity';
import { SbtsModule } from '../sbts/sbts.module';
import { OnChainVerifierService } from './on-chain-verifier.service';
import { OnChainController } from './on-chain.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Challenge, ChallengeCompletion]), SbtsModule],
  providers: [ChallengesService, OnChainVerifierService],
  controllers: [ChallengesController, OnChainController],
  exports: [ChallengesService],
})
export class ChallengesModule {}
