import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole { STUDENT = 'student', EMPLOYER = 'employer', ADMIN = 'admin' }

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) walletAddress: string;
  @Column({ unique: true, nullable: true }) email: string;
  @Column({ nullable: true }) name: string;
  @Column({ nullable: true }) nickname: string;
  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT }) role: UserRole;
  @Column({ nullable: true }) university: string;
  @Column({ nullable: true }) faculty: string;
  @Column({ nullable: true }) targetRole: string;
  @Column('simple-array', { nullable: true }) languages: string[];
  @Column('simple-array', { nullable: true }) interests: string[];
  @Column({ type: 'int', default: 0 }) daoLevel: number;
  @Column({ type: 'int', default: 0 }) reputationScore: number;
  @Column({ type: 'int', default: 0 }) streakDays: number;
  @Column({ type: 'timestamp', nullable: true }) lastActiveAt: Date;
  @Column({ nullable: true }) companyName: string;
  @Column({ nullable: true }) companyType: string;
  @Column({ default: false }) onboardingCompleted: boolean;
  @Column('jsonb', { nullable: true }) onboardingAnswers: Record<string, any>;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
