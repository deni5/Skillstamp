import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async findByWallet(walletAddress: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { walletAddress } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findOrCreate(walletAddress: string, email?: string): Promise<User> {
    let user = await this.userRepo.findOne({ where: { walletAddress } });
    if (!user) {
      user = this.userRepo.create({ walletAddress, email, role: UserRole.STUDENT });
      await this.userRepo.save(user);
    }
    return user;
  }

  async updateProfile(userId: string, dto: Partial<User>): Promise<User> {
    const user = await this.findById(userId);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async completeOnboarding(userId: string, dto: any): Promise<User> {
    const user = await this.findById(userId);
    user.targetRole = dto.targetRole;
    user.university = dto.university;
    user.interests = dto.interests;
    user.languages = dto.languages;
    user.onboardingAnswers = dto.answers;
    user.onboardingCompleted = true;
    return this.userRepo.save(user);
  }

  async getLeaderboard(limit = 20): Promise<User[]> {
    return this.userRepo.find({
      where: { role: UserRole.STUDENT },
      order: { reputationScore: 'DESC' },
      take: limit,
      select: ['id', 'nickname', 'walletAddress', 'reputationScore', 'daoLevel', 'targetRole'],
    });
  }

  async addReputationPoints(userId: string, points: number): Promise<void> {
    const user = await this.findById(userId);
    user.reputationScore += points;
    user.daoLevel = this.calculateDaoLevel(user.reputationScore);
    await this.userRepo.save(user);
  }

  private calculateDaoLevel(score: number): number {
    if (score >= 2000) return 5;
    if (score >= 1000) return 4;
    if (score >= 500) return 3;
    if (score >= 200) return 2;
    if (score >= 50) return 1;
    return 0;
  }
}
