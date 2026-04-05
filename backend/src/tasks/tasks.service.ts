import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './task.entity';
import { User, UserRole } from '../users/user.entity';
import { SbtsService } from '../sbts/sbts.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private sbtsService: SbtsService,
  ) {}

  async createTask(employer: User, dto: any): Promise<Task> {
    const task = this.taskRepo.create({
      employer, employerWallet: employer.walletAddress,
      ...dto, platformFee: Math.floor(dto.rewardAmount * 0.05),
      status: TaskStatus.OPEN,
    });
    return this.taskRepo.save(task) as any;
  }

  async getStudentFeed(student: User): Promise<any[]> {
    const tasks = await this.taskRepo.find({ where: { status: TaskStatus.OPEN }, relations: ['employer'], order: { createdAt: 'DESC' } });
    const studentTags = await this.sbtsService.getStudentTags(student.walletAddress);

    return tasks.map(task => {
      const required = task.requiredSbtTags || [];
      const matched = required.filter(t => studentTags.includes(t));
      const tagScore = required.length > 0 ? matched.length / required.length : 1;
      const levelOk = student.daoLevel >= task.minDaoLevel;
      const missing = required.filter(t => !studentTags.includes(t));
      const ageH = (Date.now() - new Date(task.createdAt).getTime()) / 3_600_000;
      const score = Math.round((tagScore * 0.45 + (levelOk ? 0.35 : 0) + Math.max(0, 1 - ageH / 168) * 0.20) * 100);
      return { task, score, locked: missing.length > 0 || !levelOk, missingTags: missing };
    }).sort((a, b) => a.locked !== b.locked ? (a.locked ? 1 : -1) : b.score - a.score);
  }

  async applyToTask(student: User, taskId: string): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== TaskStatus.OPEN) throw new BadRequestException('Task not open');

    const { eligible, missingTags } = await this.sbtsService.checkEligibility(student.walletAddress, task.requiredSbtTags, task.minDaoLevel);
    if (!eligible) throw new BadRequestException(`Missing stamps: ${missingTags.join(', ')}`);

    task.student = student;
    task.studentWallet = student.walletAddress;
    task.status = TaskStatus.IN_PROGRESS;
    return this.taskRepo.save(task);
  }

  async submitTask(student: User, taskId: string, hash: string): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, studentWallet: student.walletAddress } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== TaskStatus.IN_PROGRESS) throw new BadRequestException('Not in progress');
    task.submissionHash = hash;
    task.status = TaskStatus.SUBMITTED;
    task.submittedAt = new Date();
    return this.taskRepo.save(task);
  }

  async confirmTask(employer: User, taskId: string): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, employerWallet: employer.walletAddress }, relations: ['student'] });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== TaskStatus.SUBMITTED) throw new BadRequestException('Not submitted');
    task.status = TaskStatus.COMPLETED;
    task.confirmedAt = new Date();
    if (task.student) { task.student.reputationScore += 500; await this.userRepo.save(task.student); }
    return this.taskRepo.save(task);
  }

  async getEmployerTasks(employerWallet: string): Promise<Task[]> {
    return this.taskRepo.find({ where: { employerWallet }, relations: ['student'], order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id }, relations: ['employer', 'student'] });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
