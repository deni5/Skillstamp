import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum IssuerType { PLATFORM = 'platform', ACADEMIC = 'academic', EMPLOYER = 'employer' }

@Entity('sbts')
export class Sbt {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() studentWallet: string;
  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'student_id' }) student: User;
  @Column({ nullable: true }) challengeId: string;
  @Column() title: string;
  @Column('simple-array') skillTags: string[];
  @Column({ type: 'int' }) difficultyLevel: number;
  @Column({ type: 'int' }) score: number;
  @Column({ type: 'enum', enum: IssuerType }) issuerType: IssuerType;
  @Column() issuerName: string;
  @Column() issuerWallet: string;
  @Column({ nullable: true }) mintAddress: string;
  @Column({ nullable: true }) metadataUri: string;
  @Column({ nullable: true }) onChainSignature: string;
  @Column({ default: false }) revoked: boolean;
  @Column({ nullable: true }) revokeReason: string;
  @CreateDateColumn() issuedAt: Date;
}
