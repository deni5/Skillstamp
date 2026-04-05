import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum TaskStatus { OPEN = 'open', IN_PROGRESS = 'in_progress', SUBMITTED = 'submitted', COMPLETED = 'completed', DISPUTED = 'disputed', CANCELLED = 'cancelled' }

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ nullable: true }) onChainTaskId: number;
  @ManyToOne(() => User) @JoinColumn({ name: 'employer_id' }) employer: User;
  @Column() employerWallet: string;
  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'student_id' }) student: User;
  @Column({ nullable: true }) studentWallet: string;
  @Column() title: string;
  @Column('text') description: string;
  @Column('simple-array') requiredSbtTags: string[];
  @Column({ type: 'int', default: 0 }) minDaoLevel: number;
  @Column({ type: 'bigint' }) rewardAmount: number;
  @Column({ type: 'bigint' }) platformFee: number;
  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.OPEN }) status: TaskStatus;
  @Column({ type: 'timestamp' }) deadline: Date;
  @Column({ nullable: true }) submissionHash: string;
  @Column({ type: 'timestamp', nullable: true }) submittedAt: Date;
  @Column({ type: 'timestamp', nullable: true }) confirmedAt: Date;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
