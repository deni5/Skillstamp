import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum VerificationType { ON_CHAIN = 'on_chain', LLM = 'llm', PEER = 'peer', EMPLOYER = 'employer' }

@Entity('challenges')
export class Challenge {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ nullable: true }) onChainId: number;
  @Column() title: string;
  @Column('text') description: string;
  @Column('text', { nullable: true }) rubric: string;
  @Column('simple-array') skillTags: string[];
  @Column({ type: 'int' }) difficulty: number;
  @Column({ type: 'enum', enum: VerificationType }) verificationType: VerificationType;
  @Column() sbtRewardTitle: string;
  @Column({ nullable: true }) trackId: string;
  @Column({ nullable: true }) moduleNumber: string;
  @Column('simple-array', { nullable: true }) prerequisiteSbtTags: string[];
  @Column({ type: 'int', default: 0 }) minDaoLevel: number;
  @Column({ type: 'int', default: 0 }) totalCompletions: number;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
