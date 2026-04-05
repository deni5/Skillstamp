import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as fs from 'fs';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private connection: Connection;
  private platformKeypair: Keypair;

  readonly SBT_PROGRAM_ID:       PublicKey;
  readonly CHALLENGE_PROGRAM_ID: PublicKey;
  readonly ESCROW_PROGRAM_ID:    PublicKey;

  private readonly PLATFORM_SEED   = Buffer.from('skillstamp_platform');
  private readonly SBT_RECORD_SEED = Buffer.from('sbt_record');
  private readonly TASK_SEED       = Buffer.from('task');
  private readonly VAULT_SEED      = Buffer.from('vault');
  private readonly ESCROW_CFG_SEED = Buffer.from('escrow_config');
  private readonly ISSUER_SEED     = Buffer.from('issuer');

  constructor(private config: ConfigService) {
    this.SBT_PROGRAM_ID       = new PublicKey(config.get('SBT_PROGRAM_ID')!);
    this.CHALLENGE_PROGRAM_ID = new PublicKey(config.get('CHALLENGE_PROGRAM_ID')!);
    this.ESCROW_PROGRAM_ID    = new PublicKey(config.get('ESCROW_PROGRAM_ID')!);
  }

  async onModuleInit() {
    this.connection = new Connection(this.config.get<string>('SOLANA_RPC_URL', 'https://api.devnet.solana.com'), 'confirmed');
    const keypairPath = this.config.get('PLATFORM_KEYPAIR_PATH').replace('~', process.env.HOME);
    const data = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    this.platformKeypair = Keypair.fromSecretKey(Uint8Array.from(data));
    this.logger.log(`Platform: ${this.platformKeypair.publicKey.toBase58()}`);
    this.logger.log(`Solana: ${this.config.get('SOLANA_RPC_URL')}`);
  }

  getPlatformConfigPda(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync([this.PLATFORM_SEED], this.SBT_PROGRAM_ID);
    return pda;
  }

  getSbtRecordPda(studentWallet: string, challengeId: number): PublicKey {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(challengeId));
    const [pda] = PublicKey.findProgramAddressSync(
      [this.SBT_RECORD_SEED, new PublicKey(studentWallet).toBuffer(), buf],
      this.SBT_PROGRAM_ID
    );
    return pda;
  }

  getTaskPda(taskId: number): PublicKey {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(taskId));
    const [pda] = PublicKey.findProgramAddressSync([this.TASK_SEED, buf], this.ESCROW_PROGRAM_ID);
    return pda;
  }

  async mintSbt(params: { studentWallet: string; challengeId: number; title: string; skillTags: string[]; difficultyLevel: number; score: number; metadataUri: string }): Promise<{ signature: string; mintAddress: string }> {
    this.logger.log(`Mock SBT mint: ${params.title} → ${params.studentWallet}`);
    return { signature: `sig_${Date.now()}`, mintAddress: `mint_${Date.now()}` };
  }

  async getBalance(wallet: string): Promise<number> {
    return (await this.connection.getBalance(new PublicKey(wallet))) / 1e9;
  }

  getConnection(): Connection { return this.connection; }
  getPlatformKeypair(): Keypair { return this.platformKeypair; }
}
