import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Challenge } from './challenge.entity';

export enum CompletionStatus { IN_PROGRESS = 'in_progress', SUBMITTED = 'submitted', IN_REVIEW = 'in_review', VERIFIED = 'verified', FAILED = 'failed' }

@Entity('challenge_completions')
export class ChallengeCompletion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'student_id' }) student: User;
  @Column() studentWallet: string;
  @ManyToOne(() => Challenge) @JoinColumn({ name: 'challenge_id' }) challenge: Challenge;
  @Column({ type: 'enum', enum: CompletionStatus, default: CompletionStatus.IN_PROGRESS }) status: CompletionStatus;
  @Column('text', { nullable: true }) submissionText: string;
  @Column({ nullable: true }) submissionHash: string;
  @Column({ nullable: true }) submissionVideoUrl: string;
  @Column('jsonb', { nullable: true }) revisionHistory: any[];
  @Column({ type: 'int', nullable: true }) score: number;
  @Column({ nullable: true }) verifierWallet: string;
  @Column('text', { nullable: true }) verifierFeedback: string;
  @Column({ default: false }) flaggedForReview: boolean;
  @Column({ type: 'int', nullable: true }) completionTimeMinutes: number;
  @Column({ nullable: true }) sbtMintAddress: string;
  @Column({ nullable: true }) onChainSignature: string;
  @CreateDateColumn() startedAt: Date;
  @Column({ nullable: true }) submittedAt: Date;
  @Column({ nullable: true }) verifiedAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
