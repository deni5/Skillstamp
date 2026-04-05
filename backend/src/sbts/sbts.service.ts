import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sbt, IssuerType } from './sbt.entity';
import { User } from '../users/user.entity';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class SbtsService {
  private readonly logger = new Logger(SbtsService.name);

  constructor(
    @InjectRepository(Sbt) private sbtRepo: Repository<Sbt>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private blockchain: BlockchainService,
  ) {}

  async mintPlatformSbt(params: { student: User; title: string; skillTags: string[]; difficulty: number; score: number; challengeId: string }): Promise<Sbt> {
    const metadataUri = `https://api.skillstamp.io/metadata/${params.challengeId}`;
    const { signature, mintAddress } = await this.blockchain.mintSbt({
      studentWallet: params.student.walletAddress,
      challengeId: 0,
      title: params.title,
      skillTags: params.skillTags,
      difficultyLevel: params.difficulty,
      score: params.score,
      metadataUri,
    });

    const sbt = this.sbtRepo.create({
      studentWallet: params.student.walletAddress,
      student: params.student,
      challengeId: params.challengeId,
      title: params.title,
      skillTags: params.skillTags,
      difficultyLevel: params.difficulty,
      score: params.score,
      issuerType: IssuerType.PLATFORM,
      issuerName: 'Skillstamp Protocol',
      issuerWallet: this.blockchain.getPlatformKeypair().publicKey.toBase58(),
      mintAddress,
      metadataUri,
      onChainSignature: signature,
    });

    const saved = await this.sbtRepo.save(sbt);
    await this.updateReputation(params.student, params.difficulty);
    this.logger.log(`SBT minted: ${params.title} → ${params.student.walletAddress}`);
    return saved;
  }

  async getStudentSbts(walletAddress: string): Promise<Sbt[]> {
    return this.sbtRepo.find({ where: { studentWallet: walletAddress, revoked: false }, order: { issuedAt: 'DESC' } });
  }

  async getStudentTags(walletAddress: string): Promise<string[]> {
    const sbts = await this.getStudentSbts(walletAddress);
    return [...new Set(sbts.flatMap(s => s.skillTags))];
  }

  async checkEligibility(walletAddress: string, requiredTags: string[], minDaoLevel: number): Promise<{ eligible: boolean; missingTags: string[] }> {
    const user = await this.userRepo.findOne({ where: { walletAddress } });
    if (!user || user.daoLevel < minDaoLevel) return { eligible: false, missingTags: requiredTags };
    const tags = await this.getStudentTags(walletAddress);
    const missingTags = requiredTags.filter(t => !tags.includes(t));
    return { eligible: missingTags.length === 0, missingTags };
  }

  private async updateReputation(user: User, difficulty: number) {
    user.reputationScore += 50 + difficulty * 30;
    user.daoLevel = [0,50,200,500,1000,2000].findLastIndex(t => user.reputationScore >= t);
    await this.userRepo.save(user);
  }
}
