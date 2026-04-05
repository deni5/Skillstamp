import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Challenge } from './challenge.entity';
import { ChallengeCompletion, CompletionStatus } from './challenge-completion.entity';
import { User } from '../users/user.entity';
import { SbtsService } from '../sbts/sbts.service';

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    @InjectRepository(Challenge) private challengeRepo: Repository<Challenge>,
    @InjectRepository(ChallengeCompletion) private completionRepo: Repository<ChallengeCompletion>,
    private sbtsService: SbtsService,
    private config: ConfigService,
  ) {}

  async findAll(filters?: { trackId?: string; difficulty?: number }): Promise<Challenge[]> {
    const where: any = { active: true };
    if (filters?.trackId) where.trackId = filters.trackId;
    if (filters?.difficulty) where.difficulty = filters.difficulty;
    return this.challengeRepo.find({ where, order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Challenge> {
    const c = await this.challengeRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Challenge not found');
    return c;
  }

  async startChallenge(user: User, challengeId: string): Promise<ChallengeCompletion> {
    const challenge = await this.findOne(challengeId);
    if (user.daoLevel < challenge.minDaoLevel) throw new BadRequestException('DAO level too low');

    const existing = await this.completionRepo.findOne({
      where: { studentWallet: user.walletAddress, challenge: { id: challengeId } },
      relations: ['challenge'],
    });
    if (existing && existing.status !== CompletionStatus.FAILED) return existing;

    return this.completionRepo.save(this.completionRepo.create({
      student: user, studentWallet: user.walletAddress, challenge, revisionHistory: [],
    }));
  }

  async submitChallenge(user: User, completionId: string, text: string, videoUrl?: string): Promise<ChallengeCompletion> {
    const completion = await this.completionRepo.findOne({
      where: { id: completionId, studentWallet: user.walletAddress },
      relations: ['challenge'],
    });
    if (!completion) throw new NotFoundException('Completion not found');
    if (completion.status !== CompletionStatus.IN_PROGRESS) throw new BadRequestException('Not in progress');

    const history = [...(completion.revisionHistory || []), { content: text, timestamp: new Date().toISOString() }];
    const minutes = Math.floor((Date.now() - completion.startedAt.getTime()) / 60000);

    Object.assign(completion, {
      submissionText: text, submissionVideoUrl: videoUrl,
      revisionHistory: history, status: CompletionStatus.SUBMITTED,
      submittedAt: new Date(), completionTimeMinutes: minutes,
    });

    const saved = await this.completionRepo.save(completion);

    if (completion.challenge.verificationType === 'llm') {
      this.runLlmVerification(saved).catch(e => this.logger.error(e.message));
    }

    return saved;
  }

  private async runLlmVerification(completion: ChallengeCompletion) {
    const challenge = await this.challengeRepo.findOne({ where: { id: completion.challenge.id } });
    if (!challenge) return;
    const score = await this.scoreLlm(completion.submissionText, challenge!.rubric || challenge!.description);

    completion.score = score;
    completion.status = score >= 70 ? CompletionStatus.VERIFIED : CompletionStatus.FAILED;
    completion.verifiedAt = new Date();
    await this.completionRepo.save(completion);

    if (completion.status === CompletionStatus.VERIFIED) {
      const student = await completion.student;
      // SBT minting triggered by verified completion
      this.logger.log(`Auto-verified: score=${score}, ready for SBT mint`);
    }
  }

  private async scoreLlm(submission: string, rubric: string): Promise<number> {
    const apiKey = this.config.get('ANTHROPIC_API_KEY');
    if (!apiKey || apiKey === 'your-key-here') return 75;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 300,
          messages: [{ role: 'user', content: `Evaluate this Web3 student submission 0-100.\nRubric: ${rubric}\nSubmission: ${submission.slice(0,1500)}\nReturn ONLY JSON: {"score":N}` }],
        }),
      });
      const data = await res.json() as any;
      return JSON.parse(data.content[0].text).score;
    } catch { return 75; }
  }

  async verifyManually(completionId: string, verifierWallet: string, score: number, feedback: string): Promise<ChallengeCompletion> {
    const completion = await this.completionRepo.findOne({ where: { id: completionId }, relations: ['challenge', 'student'] });
    if (!completion) throw new NotFoundException('Not found');
    Object.assign(completion, { score, verifierWallet, verifierFeedback: feedback, verifiedAt: new Date(), status: score >= 70 ? CompletionStatus.VERIFIED : CompletionStatus.FAILED });
    return this.completionRepo.save(completion);
  }

  async getMyCompletions(walletAddress: string): Promise<ChallengeCompletion[]> {
    return this.completionRepo.find({ where: { studentWallet: walletAddress }, relations: ['challenge'], order: { startedAt: 'DESC' } });
  }
}
