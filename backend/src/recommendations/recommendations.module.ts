import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Challenge } from '../challenges/challenge.entity';
import { Sbt } from '../sbts/sbt.entity';
import { User } from '../users/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SbtsModule } from '../sbts/sbts.module';

const ROLE_PATHS: Record<string, string[]> = {
  web3_analyst:        ['defi', 'tokenomics', 'research', 'on-chain'],
  solana_developer:    ['solana', 'rust', 'smart-contract'],
  dao_researcher:      ['dao', 'governance', 'defi'],
  on_chain_analyst:    ['dune', 'analytics', 'on-chain', 'defi'],
  web3_legal:          ['legal', 'compliance', 'tokenomics'],
  web3_marketer:       ['marketing', 'community', 'content'],
  protocol_researcher: ['research', 'tokenomics', 'defi', 'on-chain'],
};

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(Challenge) private challengeRepo: Repository<Challenge>,
    @InjectRepository(Sbt) private sbtRepo: Repository<Sbt>,
  ) {}

  async recommendChallenges(user: User) {
    const sbts = await this.sbtRepo.find({ where: { studentWallet: user.walletAddress, revoked: false } });
    const earnedTags = new Set(sbts.flatMap(s => s.skillTags));
    const path = ROLE_PATHS[user.targetRole] || ROLE_PATHS['web3_analyst'];
    const skillGaps = path.filter(t => !earnedTags.has(t));
    const challenges = await this.challengeRepo.find({ where: { active: true } });

    const scored = challenges
      .filter(c => !c.skillTags.every(t => earnedTags.has(t)))
      .map(c => {
        const gapFill = c.skillTags.filter(t => skillGaps.includes(t)).length;
        const eligible = c.minDaoLevel <= user.daoLevel;
        return { challenge: c, score: gapFill * 40 + (eligible ? 30 : 0), locked: !eligible };
      })
      .sort((a, b) => b.score - a.score);

    return {
      recommended: scored.filter(s => !s.locked).slice(0, 6).map(s => s.challenge),
      locked:      scored.filter(s => s.locked).slice(0, 3).map(s => s.challenge),
      skillGaps,
      progress:    Math.round(((path.length - skillGaps.length) / path.length) * 100),
    };
  }

  async getLearningPath(user: User) {
    const path = ROLE_PATHS[user.targetRole] || ROLE_PATHS['web3_analyst'];
    const sbts = await this.sbtRepo.find({ where: { studentWallet: user.walletAddress, revoked: false } });
    const earned = new Set(sbts.flatMap(s => s.skillTags));
    const completed = path.filter(t => earned.has(t)).length;
    const nextTag = path.find(t => !earned.has(t));
    const nextChallenge = nextTag ? await this.challengeRepo
      .createQueryBuilder('c').where('c.active = true')
      .andWhere(':tag = ANY(c.skillTags)', { tag: nextTag })
      .orderBy('c.difficulty', 'ASC').limit(1).getOne() : null;

    return { targetRole: user.targetRole || 'web3_analyst', totalSteps: path.length, completed, nextChallenge, progress: Math.round((completed / path.length) * 100) };
  }
}

@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(private s: RecommendationsService) {}

  @Get('challenges')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'Personalised recommendations' })
  getRecommendations(@Request() req) { return this.s.recommendChallenges(req.user); }

  @Get('learning-path')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'Learning path progress' })
  getLearningPath(@Request() req) { return this.s.getLearningPath(req.user); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Challenge, Sbt, User]), SbtsModule],
  providers: [RecommendationsService],
  controllers: [RecommendationsController],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
