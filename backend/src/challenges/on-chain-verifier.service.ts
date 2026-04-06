import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey } from '@solana/web3.js';

export interface OnChainVerificationRule {
  type: 'account_exists' | 'account_data' | 'program_deployed' | 'call_returns';
  programId?: string;
  expectedValue?: any;
  dataOffset?: number;
  dataLength?: number;
}

export interface VerificationResult {
  passed: boolean;
  score: number;
  feedback: string;
  details?: any;
}

@Injectable()
export class OnChainVerifierService {
  private readonly logger = new Logger(OnChainVerifierService.name);
  private connection: Connection;

  constructor(private config: ConfigService) {
    this.connection = new Connection(
      config.get<string>('SOLANA_RPC_URL', 'https://api.devnet.solana.com'),
      'confirmed'
    );
  }

  async verify(
    studentProgramId: string,
    rules: OnChainVerificationRule[],
    challengeType: string,
  ): Promise<VerificationResult> {
    try {
      let pubkey: PublicKey;
      try {
        pubkey = new PublicKey(studentProgramId);
      } catch {
        return { passed: false, score: 0, feedback: 'Invalid program ID format' };
      }

      for (const rule of rules) {
        const result = await this.applyRule(pubkey, rule, challengeType);
        if (!result.passed) return result;
      }

      return {
        passed: true,
        score: 100,
        feedback: 'All on-chain checks passed! SBT will be minted.',
      };
    } catch (e) {
      this.logger.error(`On-chain verification error: ${e.message}`);
      return { passed: false, score: 0, feedback: `Verification error: ${e.message}` };
    }
  }

  private async applyRule(
    pubkey: PublicKey,
    rule: OnChainVerificationRule,
    challengeType: string,
  ): Promise<VerificationResult> {

    switch (rule.type) {

      // Rule 1: Program is deployed on Devnet
      case 'program_deployed': {
        const info = await this.connection.getAccountInfo(pubkey);
        if (!info) {
          return { passed: false, score: 0, feedback: 'Program not found on Devnet. Make sure you deployed it correctly.' };
        }
        if (!info.executable) {
          return { passed: false, score: 0, feedback: 'Account exists but is not an executable program.' };
        }
        this.logger.log(`Program deployed ✓ ${pubkey.toBase58()}`);
        return { passed: true, score: 50, feedback: 'Program deployed on Devnet ✓' };
      }

      // Rule 2: Program has specific data account with expected value
      case 'account_data': {
        const [pda] = PublicKey.findProgramAddressSync(
          [Buffer.from('answer')],
          pubkey
        );
        const pdaInfo = await this.connection.getAccountInfo(pda);
        if (!pdaInfo) {
          return { passed: false, score: 25, feedback: 'Answer PDA account not found. Call your initialize() instruction first.' };
        }
        const data = pdaInfo.data;
        const offset = rule.dataOffset || 8;
        const len    = rule.dataLength || 8;
        const stored = data.slice(offset, offset + len);
        const value  = stored.readBigInt64LE ? stored.readBigInt64LE(0) : BigInt(0);

        if (rule.expectedValue !== undefined && Number(value) !== rule.expectedValue) {
          return {
            passed: false,
            score: 50,
            feedback: `Expected value ${rule.expectedValue} but got ${value}. Check your program logic.`,
          };
        }
        return { passed: true, score: 100, feedback: `Correct value ${value} found on-chain ✓` };
      }

      // Rule 3: Account simply exists (balance > 0)
      case 'account_exists': {
        const info = await this.connection.getAccountInfo(pubkey);
        if (!info) {
          return { passed: false, score: 0, feedback: 'Account not found on Devnet.' };
        }
        return { passed: true, score: 100, feedback: 'Account exists on Devnet ✓' };
      }

      default:
        return { passed: false, score: 0, feedback: 'Unknown verification rule' };
    }
  }

  // Helper: Get program info for display
  async getProgramInfo(programId: string): Promise<any> {
    try {
      const pubkey = new PublicKey(programId);
      const info = await this.connection.getAccountInfo(pubkey);
      if (!info) return { exists: false };
      return {
        exists: true,
        executable: info.executable,
        owner: info.owner.toBase58(),
        lamports: info.lamports,
        dataLength: info.data.length,
      };
    } catch {
      return { exists: false, error: 'Invalid public key' };
    }
  }
}
