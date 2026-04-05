import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  getAccount,
  mintTo
} from "@solana/spl-token";
import { Keypair, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
 
const PLATFORM_SEED   = Buffer.from("skillstamp_platform");
const ISSUER_SEED     = Buffer.from("issuer");
const REGISTRY_SEED   = Buffer.from("challenge_registry");
const CHALLENGE_SEED  = Buffer.from("challenge");
const COMPLETION_SEED = Buffer.from("completion");
const ESCROW_CFG_SEED = Buffer.from("escrow_config");
const TASK_SEED       = Buffer.from("task");
const VAULT_SEED      = Buffer.from("vault");
 
function u64Bytes(n: number | BN): Buffer {
  const buf = Buffer.alloc(8);
  const val = typeof n === "number" ? new BN(n) : n;
  val.toArrayLike(Buffer, "le", 8).copy(buf);
  return buf;
}
 
describe("skillstamp-sbt", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet  = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.SkillstampSbt as Program<any>;
  const issuerKp = Keypair.generate();
  let platformConfig: PublicKey;
  let issuerRecord: PublicKey;
 
  before(async () => {
    [platformConfig] = PublicKey.findProgramAddressSync([PLATFORM_SEED], program.programId);
    [issuerRecord]   = PublicKey.findProgramAddressSync([ISSUER_SEED, issuerKp.publicKey.toBuffer()], program.programId);
    console.log("  Wallet:", wallet.publicKey.toBase58());
  });
 
  it("initializes platform", async () => {
    try {
      await program.methods.initializePlatform(wallet.publicKey)
        .accounts({ platformConfig, authority: wallet.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      console.log("  ✓ Platform initialized");
    } catch (e: any) {
      if (e.message?.includes("already in use")) { console.log("  ℹ Already initialized"); return; }
      throw e;
    }
    const cfg = await program.account.platformConfig.fetch(platformConfig);
    assert.equal(cfg.authority.toBase58(), wallet.publicKey.toBase58());
    assert.equal(cfg.paused, false);
  });
 
  it("registers an issuer", async () => {
    try {
      await program.methods.registerIssuer("DeFiLab", { employer: {} })
        .accounts({ issuerRecord, platformConfig, issuerAuthority: issuerKp.publicKey, authority: wallet.publicKey, payer: wallet.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      console.log("  ✓ Issuer registered: DeFiLab");
    } catch (e: any) {
      if (e.message?.includes("already in use")) { console.log("  ℹ Already registered"); return; }
      throw e;
    }
    const rec = await program.account.issuerRecord.fetch(issuerRecord);
    assert.equal(rec.name, "DeFiLab");
    assert.equal(rec.active, true);
  });
 
  it("fetches platform config", async () => {
    const cfg = await program.account.platformConfig.fetch(platformConfig);
    assert.ok(cfg.authority);
    assert.equal(cfg.paused, false);
    console.log("  ✓ Platform config OK, total issued:", cfg.totalIssued.toString());
  });
});
 
describe("skillstamp-challenge", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet  = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.SkillstampChallenge as Program<any>;
  let registry: PublicKey;
  let challenge: PublicKey;
  let completion: PublicKey;
 
  before(async () => {
    [registry] = PublicKey.findProgramAddressSync([REGISTRY_SEED], program.programId);
    console.log("  Registry PDA:", registry.toBase58());
  });
 
  it("initializes registry", async () => {
    try {
      await program.methods.initializeRegistry()
        .accounts({ registry, authority: wallet.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      console.log("  ✓ Registry initialized");
    } catch (e: any) {
      if (e.message?.includes("already in use")) { console.log("  ℹ Already initialized"); return; }
      throw e;
    }
    const reg = await program.account.challengeRegistry.fetch(registry);
    assert.ok(reg.totalChallenges.gte(new BN(0)));
  });
 
  it("creates a challenge", async () => {
    const reg = await program.account.challengeRegistry.fetch(registry);
    const challengeId = reg.totalChallenges;
    [challenge] = PublicKey.findProgramAddressSync([CHALLENGE_SEED, u64Bytes(challengeId)], program.programId);
 
    await program.methods.createChallenge({
      title: "Tokenomics analysis",
      description: "Analyse real protocol tokenomics",
      skillTags: ["defi", "tokenomics"],
      difficulty: 2,
      verificationType: { llm: {} },
      sbtRewardTitle: "Tokenomics Analyst",
    }).accounts({ challenge, registry, authority: wallet.publicKey, systemProgram: SystemProgram.programId }).rpc();
 
    const ch = await program.account.challenge.fetch(challenge);
    assert.equal(ch.title, "Tokenomics analysis");
    assert.equal(ch.active, true);
    console.log("  ✓ Challenge created:", ch.title);
  });
 
  it("student starts and submits challenge", async () => {
    const reg = await program.account.challengeRegistry.fetch(registry);
    const challengeId = reg.totalChallenges.subn(1);
    [challenge]  = PublicKey.findProgramAddressSync([CHALLENGE_SEED,  u64Bytes(challengeId)], program.programId);
    [completion] = PublicKey.findProgramAddressSync([COMPLETION_SEED, wallet.publicKey.toBuffer(), u64Bytes(challengeId)], program.programId);
 
    try {
      await program.methods.startChallenge(challengeId)
        .accounts({ completionRecord: completion, challenge, student: wallet.publicKey, payer: wallet.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      console.log("  ✓ Challenge started");
    } catch (e: any) {
      if (e.message?.includes("already in use")) { console.log("  ℹ Already started"); }
      else throw e;
    }
 
    await program.methods.submitChallenge([...Buffer.alloc(32, 42)])
      .accounts({ completionRecord: completion, student: wallet.publicKey })
      .rpc();
 
    const rec = await program.account.completionRecord.fetch(completion);
    assert.deepEqual(rec.status, { submitted: {} });
    console.log("  ✓ Challenge submitted, hash on-chain");
  });
 
  it("verifier approves with score", async () => {
    const reg = await program.account.challengeRegistry.fetch(registry);
    const challengeId = reg.totalChallenges.subn(1);
    [challenge]  = PublicKey.findProgramAddressSync([CHALLENGE_SEED,  u64Bytes(challengeId)], program.programId);
    [completion] = PublicKey.findProgramAddressSync([COMPLETION_SEED, wallet.publicKey.toBuffer(), u64Bytes(challengeId)], program.programId);
 
    await program.methods.verifyCompletion(91, true)
      .accounts({ completionRecord: completion, challenge, registry, authority: wallet.publicKey, verifier: wallet.publicKey })
      .rpc();
 
    const rec = await program.account.completionRecord.fetch(completion);
    assert.deepEqual(rec.status, { verified: {} });
    assert.equal(rec.score, 91);
    console.log("  ✓ Verified with score:", rec.score);
  });
});
 
describe("skillstamp-escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const wallet  = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.SkillstampEscrow as Program<any>;
 
  let escrowConfig: PublicKey;
  let usdcMint:     PublicKey;
  let employerUsdc: PublicKey;
  let studentUsdc:  PublicKey;
  let treasuryUsdc: PublicKey;
  let task: PublicKey;
  let vault: PublicKey;
 
  before(async () => {
    [escrowConfig] = PublicKey.findProgramAddressSync([ESCROW_CFG_SEED], program.programId);
 
    const payer = (wallet as any).payer as Keypair;
 
    // Explicit keypairs для token accounts — уникаємо ATA owner помилки
    const employerAtaKp = Keypair.generate();
    const studentAtaKp  = Keypair.generate();
    const treasuryAtaKp = Keypair.generate();
 
    usdcMint = await createMint(
      provider.connection, payer,
      wallet.publicKey, wallet.publicKey, 6
    );
 
    employerUsdc = await createAccount(
      provider.connection, payer, usdcMint, wallet.publicKey, employerAtaKp
    );
    studentUsdc = await createAccount(
      provider.connection, payer, usdcMint, wallet.publicKey, studentAtaKp
    );
    treasuryUsdc = await createAccount(
      provider.connection, payer, usdcMint, wallet.publicKey, treasuryAtaKp
    );
 
    await mintTo(
      provider.connection, payer, usdcMint,
      employerUsdc, wallet.publicKey, 1000 * 1_000_000
    );
 
    console.log("  ✓ Test accounts ready, USDC mint:", usdcMint.toBase58());
  });
 
  it("initializes escrow config", async () => {
    try {
      await program.methods.initializeEscrowConfig(wallet.publicKey, wallet.publicKey)
        .accounts({ escrowConfig, authority: wallet.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      console.log("  ✓ Escrow config initialized");
    } catch (e: any) {
      if (e.message?.includes("already in use")) { console.log("  ℹ Already initialized"); return; }
      throw e;
    }
    const cfg = await program.account.escrowConfig.fetch(escrowConfig);
    assert.equal(cfg.paused, false);
  });
 
  it("employer creates task with USDC deposit", async () => {
    const cfg = await program.account.escrowConfig.fetch(escrowConfig);
    const taskId = cfg.totalTasks;
    [task]  = PublicKey.findProgramAddressSync([TASK_SEED,  u64Bytes(taskId)], program.programId);
    [vault] = PublicKey.findProgramAddressSync([VAULT_SEED, u64Bytes(taskId)], program.programId);
 
    await program.methods.createTask({
      title:           "DeFi Research Report",
      description:     "Analyse top Solana DeFi protocols",
      requiredSbtTags: ["defi", "tokenomics"],
      minDaoLevel:     1,
      rewardAmount:    new BN(100 * 1_000_000),
      deadline:        new BN(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60),
    }).accounts({
      task, vault, escrowConfig, employerUsdc, usdcMint,
      employer: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    }).rpc();
 
    const t = await program.account.task.fetch(task);
    assert.deepEqual(t.status, { open: {} });
    assert.equal(t.rewardAmount.toNumber(), 100 * 1_000_000);
    const vaultBal = (await getAccount(provider.connection, vault)).amount;
    assert.equal(vaultBal.toString(), (100 * 1_000_000).toString());
    console.log("  ✓ Task created:", t.title);
    console.log("  Reward:", t.rewardAmount.toNumber() / 1_000_000, "USDC");
    console.log("  Fee:", t.platformFee.toNumber() / 1_000_000, "USDC");
    console.log("  Vault:", Number(vaultBal) / 1_000_000, "USDC");
  });
 
  it("assigns student and submits work", async () => {
    const cfg = await program.account.escrowConfig.fetch(escrowConfig);
    const taskId = cfg.totalTasks.subn(1);
    [task] = PublicKey.findProgramAddressSync([TASK_SEED, u64Bytes(taskId)], program.programId);
 
    await program.methods.assignStudent(taskId)
      .accounts({ task, escrowConfig, student: wallet.publicKey, authority: wallet.publicKey })
      .rpc();
 
    let t = await program.account.task.fetch(task);
    assert.deepEqual(t.status, { inProgress: {} });
    console.log("  ✓ Student assigned");
 
    await program.methods.submitTask([...Buffer.alloc(32, 77)])
      .accounts({ task, student: wallet.publicKey })
      .rpc();
 
    t = await program.account.task.fetch(task);
    assert.deepEqual(t.status, { submitted: {} });
    console.log("  ✓ Work submitted, hash on-chain");
  });
 
  it("employer confirms and USDC releases", async () => {
    const cfg = await program.account.escrowConfig.fetch(escrowConfig);
    const taskId = cfg.totalTasks.subn(1);
    [task]  = PublicKey.findProgramAddressSync([TASK_SEED,  u64Bytes(taskId)], program.programId);
    [vault] = PublicKey.findProgramAddressSync([VAULT_SEED, u64Bytes(taskId)], program.programId);
 
    await program.methods.confirmCompletion()
      .accounts({ task, vault, studentUsdc, treasuryUsdc, employer: wallet.publicKey, tokenProgram: TOKEN_PROGRAM_ID })
      .rpc();
 
    const final = await program.account.task.fetch(task);
    assert.deepEqual(final.status, { completed: {} });
 
    const studentBal  = (await getAccount(provider.connection, studentUsdc)).amount;
    const treasuryBal = (await getAccount(provider.connection, treasuryUsdc)).amount;
 
    assert.equal(Number(studentBal),  95 * 1_000_000);
    assert.equal(Number(treasuryBal),  5 * 1_000_000);
    console.log("  ✓ Task completed");
    console.log("  Student received:", Number(studentBal) / 1_000_000, "USDC");
    console.log("  Platform fee:", Number(treasuryBal) / 1_000_000, "USDC");
  });
});