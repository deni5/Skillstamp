use anchor_lang::prelude::*;

declare_id!("AepAzQjMBoi4LYobGknc9G3iGPjzUijf3KTwG1CRXpLy");

pub const REGISTRY_SEED:    &[u8] = b"challenge_registry";
pub const CHALLENGE_SEED:   &[u8] = b"challenge";
pub const COMPLETION_SEED:  &[u8] = b"completion";
pub const MAX_TITLE_LEN:    usize = 64;
pub const MAX_DESC_LEN:     usize = 256;
pub const MAX_TAGS_LEN:     usize = 8;
pub const MAX_TAG_LEN:      usize = 32;

// ─────────────────────────────────────────────────────────────
// PROGRAM
// ─────────────────────────────────────────────────────────────

#[program]
pub mod skillstamp_challenge {
    use super::*;

    /// Initialize the challenge registry — called once.
    pub fn initialize_registry(ctx: Context<InitializeRegistry>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.authority       = ctx.accounts.authority.key();
        registry.total_challenges = 0;
        registry.bump            = ctx.bumps.registry;
        msg!("Challenge registry initialized");
        Ok(())
    }

    /// Create a new challenge. Only admin / verifier can create.
    pub fn create_challenge(
        ctx: Context<CreateChallenge>,
        params: CreateChallengeParams,
    ) -> Result<()> {
        require!(params.title.len() <= MAX_TITLE_LEN, ChallengeError::StringTooLong);
        require!(params.description.len() <= MAX_DESC_LEN, ChallengeError::StringTooLong);
        require!(params.skill_tags.len() <= MAX_TAGS_LEN, ChallengeError::TooManyTags);
        require!(
            params.difficulty >= 1 && params.difficulty <= 5,
            ChallengeError::InvalidDifficulty
        );

        let challenge = &mut ctx.accounts.challenge;
        challenge.id              = ctx.accounts.registry.total_challenges;
        challenge.title           = params.title;
        challenge.description     = params.description;
        challenge.skill_tags      = params.skill_tags;
        challenge.difficulty      = params.difficulty;
        challenge.verification_type = params.verification_type;
        challenge.sbt_reward_title = params.sbt_reward_title;
        challenge.active          = true;
        challenge.total_completions = 0;
        challenge.created_at      = Clock::get()?.unix_timestamp;
        challenge.bump            = ctx.bumps.challenge;

        ctx.accounts.registry.total_challenges += 1;

        emit!(ChallengeCreated {
            challenge_id: challenge.id,
            title:        challenge.title.clone(),
            difficulty:   challenge.difficulty,
        });

        msg!("Challenge #{} created: {}", challenge.id, challenge.title);
        Ok(())
    }

    /// Record that a student has started a challenge.
    pub fn start_challenge(ctx: Context<StartChallenge>, challenge_id: u64) -> Result<()> {
        require!(ctx.accounts.challenge.active, ChallengeError::ChallengeInactive);

        let completion = &mut ctx.accounts.completion_record;
        completion.student        = ctx.accounts.student.key();
        completion.challenge_id   = challenge_id;
        completion.status         = CompletionStatus::InProgress;
        completion.submission_hash = [0u8; 32];
        completion.score          = 0;
        completion.started_at     = Clock::get()?.unix_timestamp;
        completion.submitted_at   = 0;
        completion.verified_at    = 0;
        completion.verifier       = Pubkey::default();
        completion.sbt_minted     = false;
        completion.bump           = ctx.bumps.completion_record;

        msg!("Challenge #{} started by {}", challenge_id, ctx.accounts.student.key());
        Ok(())
    }

    /// Student submits their work — stores IPFS/Arweave hash on-chain.
    /// This is the immutable proof of submission.
    pub fn submit_challenge(
        ctx: Context<SubmitChallenge>,
        submission_hash: [u8; 32],
    ) -> Result<()> {
        let completion = &mut ctx.accounts.completion_record;

        require!(
            completion.status == CompletionStatus::InProgress,
            ChallengeError::InvalidStatus
        );
        require!(
            completion.student == ctx.accounts.student.key(),
            ChallengeError::Unauthorized
        );

        completion.submission_hash = submission_hash;
        completion.status          = CompletionStatus::Submitted;
        completion.submitted_at    = Clock::get()?.unix_timestamp;

        emit!(ChallengeSubmitted {
            student:         ctx.accounts.student.key(),
            challenge_id:    completion.challenge_id,
            submission_hash,
            submitted_at:    completion.submitted_at,
        });

        msg!("Challenge #{} submitted", completion.challenge_id);
        Ok(())
    }

    /// Verifier approves the submission and sets the score.
    /// After this, the backend can trigger SBT minting.
    pub fn verify_completion(
        ctx: Context<VerifyCompletion>,
        score: u8,
        passed: bool,
    ) -> Result<()> {
        require!(score <= 100, ChallengeError::InvalidScore);

        let completion = &mut ctx.accounts.completion_record;

        require!(
            completion.status == CompletionStatus::Submitted,
            ChallengeError::InvalidStatus
        );

        completion.score       = score;
        completion.verifier    = ctx.accounts.verifier.key();
        completion.verified_at = Clock::get()?.unix_timestamp;
        completion.status      = if passed {
            CompletionStatus::Verified
        } else {
            CompletionStatus::Failed
        };

        ctx.accounts.challenge.total_completions += if passed { 1 } else { 0 };

        emit!(ChallengeVerified {
            student:      completion.student,
            challenge_id: completion.challenge_id,
            score,
            passed,
            verifier:     ctx.accounts.verifier.key(),
            verified_at:  completion.verified_at,
        });

        msg!(
            "Challenge #{} verified: passed={} score={}",
            completion.challenge_id, passed, score
        );
        Ok(())
    }

    /// Mark SBT as minted — called by backend after successful mint_sbt CPI.
    pub fn mark_sbt_minted(ctx: Context<MarkSbtMinted>) -> Result<()> {
        let completion = &mut ctx.accounts.completion_record;

        require!(
            completion.status == CompletionStatus::Verified,
            ChallengeError::InvalidStatus
        );
        require!(!completion.sbt_minted, ChallengeError::SbtAlreadyMinted);

        completion.sbt_minted = true;
        msg!("SBT marked as minted for challenge #{}", completion.challenge_id);
        Ok(())
    }

    /// Toggle challenge active status.
    pub fn set_challenge_active(
        ctx: Context<SetChallengeActive>,
        active: bool,
    ) -> Result<()> {
        ctx.accounts.challenge.active = active;
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────
// ACCOUNTS
// ─────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = authority,
        space = ChallengeRegistry::LEN,
        seeds = [REGISTRY_SEED],
        bump
    )]
    pub registry: Account<'info, ChallengeRegistry>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: CreateChallengeParams)]
pub struct CreateChallenge<'info> {
    #[account(
        init,
        payer = authority,
        space = Challenge::LEN,
        seeds = [CHALLENGE_SEED, &registry.total_challenges.to_le_bytes()],
        bump
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        mut,
        seeds  = [REGISTRY_SEED],
        bump   = registry.bump,
        has_one = authority,
    )]
    pub registry: Account<'info, ChallengeRegistry>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(challenge_id: u64)]
pub struct StartChallenge<'info> {
    #[account(
        init,
        payer = payer,
        space = CompletionRecord::LEN,
        seeds = [
            COMPLETION_SEED,
            student.key().as_ref(),
            &challenge_id.to_le_bytes(),
        ],
        bump
    )]
    pub completion_record: Account<'info, CompletionRecord>,

    #[account(
        seeds = [CHALLENGE_SEED, &challenge_id.to_le_bytes()],
        bump  = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    /// CHECK: student wallet — any pubkey
    pub student: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitChallenge<'info> {
    #[account(
        mut,
        seeds = [
            COMPLETION_SEED,
            student.key().as_ref(),
            &completion_record.challenge_id.to_le_bytes(),
        ],
        bump = completion_record.bump,
    )]
    pub completion_record: Account<'info, CompletionRecord>,

    pub student: Signer<'info>,
}

#[derive(Accounts)]
pub struct VerifyCompletion<'info> {
    #[account(
        mut,
        seeds = [
            COMPLETION_SEED,
            completion_record.student.as_ref(),
            &completion_record.challenge_id.to_le_bytes(),
        ],
        bump = completion_record.bump,
    )]
    pub completion_record: Account<'info, CompletionRecord>,

    #[account(
        mut,
        seeds = [CHALLENGE_SEED, &completion_record.challenge_id.to_le_bytes()],
        bump  = challenge.bump,
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(seeds = [REGISTRY_SEED], bump = registry.bump, has_one = authority)]
    pub registry: Account<'info, ChallengeRegistry>,

    pub authority: Signer<'info>,
    pub verifier:  Signer<'info>,
}

#[derive(Accounts)]
pub struct MarkSbtMinted<'info> {
    #[account(
        mut,
        seeds = [
            COMPLETION_SEED,
            completion_record.student.as_ref(),
            &completion_record.challenge_id.to_le_bytes(),
        ],
        bump = completion_record.bump,
    )]
    pub completion_record: Account<'info, CompletionRecord>,

    #[account(seeds = [REGISTRY_SEED], bump = registry.bump, has_one = authority)]
    pub registry: Account<'info, ChallengeRegistry>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetChallengeActive<'info> {
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,

    #[account(seeds = [REGISTRY_SEED], bump = registry.bump, has_one = authority)]
    pub registry: Account<'info, ChallengeRegistry>,

    pub authority: Signer<'info>,
}

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────

#[account]
pub struct ChallengeRegistry {
    pub authority:         Pubkey,
    pub total_challenges:  u64,
    pub bump:              u8,
}
impl ChallengeRegistry {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 32;
}

#[account]
pub struct Challenge {
    pub id:                u64,
    pub title:             String,
    pub description:       String,
    pub skill_tags:        Vec<String>,
    pub difficulty:        u8,
    pub verification_type: VerificationType,
    pub sbt_reward_title:  String,
    pub active:            bool,
    pub total_completions: u64,
    pub created_at:        i64,
    pub bump:              u8,
}
impl Challenge {
    pub const LEN: usize = 8
        + 8
        + (4 + MAX_TITLE_LEN)
        + (4 + MAX_DESC_LEN)
        + (4 + MAX_TAGS_LEN * (4 + MAX_TAG_LEN))
        + 1 + 1
        + (4 + MAX_TITLE_LEN)
        + 1 + 8 + 8 + 1 + 64;
}

#[account]
pub struct CompletionRecord {
    pub student:          Pubkey,
    pub challenge_id:     u64,
    pub status:           CompletionStatus,
    pub submission_hash:  [u8; 32],
    pub score:            u8,
    pub started_at:       i64,
    pub submitted_at:     i64,
    pub verified_at:      i64,
    pub verifier:         Pubkey,
    pub sbt_minted:       bool,
    pub bump:             u8,
}
impl CompletionRecord {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 32 + 1 + 8 + 8 + 8 + 32 + 1 + 1 + 32;
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VerificationType {
    OnChain,   // Smart contract auto-verify
    LLM,       // Backend LLM scoring
    Peer,      // Peer review (3 validators)
    Employer,  // Employer / mentor sign-off
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum CompletionStatus {
    InProgress,
    Submitted,
    Verified,
    Failed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateChallengeParams {
    pub title:             String,
    pub description:       String,
    pub skill_tags:        Vec<String>,
    pub difficulty:        u8,
    pub verification_type: VerificationType,
    pub sbt_reward_title:  String,
}

// ─────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────

#[event]
pub struct ChallengeCreated {
    pub challenge_id: u64,
    pub title:        String,
    pub difficulty:   u8,
}

#[event]
pub struct ChallengeSubmitted {
    pub student:          Pubkey,
    pub challenge_id:     u64,
    pub submission_hash:  [u8; 32],
    pub submitted_at:     i64,
}

#[event]
pub struct ChallengeVerified {
    pub student:      Pubkey,
    pub challenge_id: u64,
    pub score:        u8,
    pub passed:       bool,
    pub verifier:     Pubkey,
    pub verified_at:  i64,
}

// ─────────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────────

#[error_code]
pub enum ChallengeError {
    #[msg("Challenge is inactive")]
    ChallengeInactive,
    #[msg("Invalid completion status for this action")]
    InvalidStatus,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid score (must be 0-100)")]
    InvalidScore,
    #[msg("Invalid difficulty (must be 1-5)")]
    InvalidDifficulty,
    #[msg("String exceeds maximum length")]
    StringTooLong,
    #[msg("Too many tags")]
    TooManyTags,
    #[msg("SBT already minted for this completion")]
    SbtAlreadyMinted,
}
