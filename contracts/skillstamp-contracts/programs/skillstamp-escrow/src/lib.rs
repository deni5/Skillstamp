use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("6VcbhukHioudUSq8utRPgHKJNgas7AJQestGZf7YbM7a");

pub const ESCROW_CONFIG_SEED: &[u8] = b"escrow_config";
pub const TASK_SEED:          &[u8] = b"task";
pub const VAULT_SEED:         &[u8] = b"vault";
pub const PLATFORM_FEE_BPS:   u64  = 500; // 5%
pub const AUTO_RELEASE_DAYS:  i64  = 7 * 24 * 60 * 60; // 7 days in seconds
pub const MAX_TITLE_LEN:      usize = 64;
pub const MAX_DESC_LEN:       usize = 256;
pub const MAX_TAGS_LEN:       usize = 8;
pub const MAX_TAG_LEN:        usize = 32;

// ─────────────────────────────────────────────────────────────
// PROGRAM
// ─────────────────────────────────────────────────────────────

#[program]
pub mod skillstamp_escrow {
    use super::*;

    /// Initialize escrow config — sets treasury and multisig.
    pub fn initialize_escrow_config(
        ctx: Context<InitializeEscrowConfig>,
        treasury:  Pubkey,
        multisig:  Pubkey,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.escrow_config;
        cfg.authority  = ctx.accounts.authority.key();
        cfg.treasury   = treasury;
        cfg.multisig   = multisig;
        cfg.total_tasks = 0;
        cfg.paused     = false;
        cfg.bump       = ctx.bumps.escrow_config;
        msg!("Escrow config initialized");
        Ok(())
    }

    /// Employer creates a task and deposits USDC into escrow vault.
    /// SBT eligibility requirements are stored on-chain.
    pub fn create_task(
        ctx: Context<CreateTask>,
        params: CreateTaskParams,
    ) -> Result<()> {
        require!(!ctx.accounts.escrow_config.paused, EscrowError::Paused);
        require!(params.title.len() <= MAX_TITLE_LEN, EscrowError::StringTooLong);
        require!(params.description.len() <= MAX_DESC_LEN, EscrowError::StringTooLong);
        require!(params.reward_amount > 0, EscrowError::InvalidAmount);
        require!(
            params.deadline > Clock::get()?.unix_timestamp,
            EscrowError::InvalidDeadline
        );

        // Transfer USDC from employer → vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from:      ctx.accounts.employer_usdc.to_account_info(),
                    to:        ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.employer.to_account_info(),
                },
            ),
            params.reward_amount,
        )?;

        let task = &mut ctx.accounts.task;
        task.task_id          = ctx.accounts.escrow_config.total_tasks;
        task.employer         = ctx.accounts.employer.key();
        task.student          = Pubkey::default(); // assigned later
        task.reward_amount    = params.reward_amount;
        task.platform_fee     = params.reward_amount * PLATFORM_FEE_BPS / 10_000;
        task.status           = TaskStatus::Open;
        task.required_sbt_tags = params.required_sbt_tags;
        task.min_dao_level    = params.min_dao_level;
        task.title            = params.title;
        task.description      = params.description;
        task.deadline         = params.deadline;
        task.submission_hash  = [0u8; 32];
        task.created_at       = Clock::get()?.unix_timestamp;
        task.accepted_at      = 0;
        task.submitted_at     = 0;
        task.confirmed_at     = 0;
        task.dispute_opened_at = 0;
        task.vault_bump       = ctx.bumps.vault;
        task.bump             = ctx.bumps.task;

        ctx.accounts.escrow_config.total_tasks += 1;

        emit!(TaskCreated {
            task_id:       task.task_id,
            employer:      task.employer,
            reward_amount: task.reward_amount,
            deadline:      task.deadline,
            title:         task.title.clone(),
        });

        msg!("Task #{} created: {} USDC escrowed", task.task_id, params.reward_amount);
        Ok(())
    }

    /// Assign a student to a task.
    /// Backend verifies SBT eligibility off-chain before calling this.
    /// On-chain stores the assignment for auditability.
    pub fn assign_student(
        ctx: Context<AssignStudent>,
        task_id: u64,
    ) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::Open, EscrowError::InvalidStatus);
        require!(task.task_id == task_id, EscrowError::TaskMismatch);
        require!(
            Clock::get()?.unix_timestamp < task.deadline,
            EscrowError::TaskExpired
        );

        task.student     = ctx.accounts.student.key();
        task.status      = TaskStatus::InProgress;
        task.accepted_at = Clock::get()?.unix_timestamp;

        emit!(TaskAssigned {
            task_id,
            student:      task.student,
            accepted_at:  task.accepted_at,
        });

        msg!("Task #{} assigned to {}", task_id, task.student);
        Ok(())
    }

    /// Student submits work — stores IPFS/Arweave hash on-chain.
    /// Immutable proof of what was submitted and when.
    pub fn submit_task(
        ctx: Context<SubmitTask>,
        submission_hash: [u8; 32],
    ) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::InProgress, EscrowError::InvalidStatus);
        require!(task.student == ctx.accounts.student.key(), EscrowError::Unauthorized);
        require!(
            Clock::get()?.unix_timestamp <= task.deadline,
            EscrowError::TaskExpired
        );

        task.submission_hash = submission_hash;
        task.status          = TaskStatus::Submitted;
        task.submitted_at    = Clock::get()?.unix_timestamp;

        emit!(TaskSubmitted {
            task_id:         task.task_id,
            student:         task.student,
            submission_hash,
            submitted_at:    task.submitted_at,
        });

        msg!("Task #{} submitted by {}", task.task_id, task.student);
        Ok(())
    }

    /// Employer confirms task completion → releases USDC to student.
    /// Platform fee goes to treasury automatically.
    pub fn confirm_completion(ctx: Context<ConfirmCompletion>) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::Submitted, EscrowError::InvalidStatus);
        require!(task.employer == ctx.accounts.employer.key(), EscrowError::Unauthorized);

        let task_id_bytes = task.task_id.to_le_bytes();
        let vault_seeds = &[
            VAULT_SEED,
            task_id_bytes.as_ref(),
            &[task.vault_bump],
        ];
        let signer_seeds = &[&vault_seeds[..]];

        let student_amount = task.reward_amount - task.platform_fee;

        // Release student payment
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from:      ctx.accounts.vault.to_account_info(),
                    to:        ctx.accounts.student_usdc.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            student_amount,
        )?;

        // Release platform fee to treasury
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from:      ctx.accounts.vault.to_account_info(),
                    to:        ctx.accounts.treasury_usdc.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            task.platform_fee,
        )?;

        task.status       = TaskStatus::Completed;
        task.confirmed_at = Clock::get()?.unix_timestamp;

        emit!(TaskCompleted {
            task_id:        task.task_id,
            student:        task.student,
            employer:       task.employer,
            student_amount,
            platform_fee:   task.platform_fee,
            confirmed_at:   task.confirmed_at,
        });

        msg!(
            "Task #{} completed. Student: {} USDC, Fee: {} USDC",
            task.task_id, student_amount, task.platform_fee
        );
        Ok(())
    }

    /// Auto-release: if employer hasn't responded in 7 days after submission,
    /// anyone can trigger this to release funds to student.
    pub fn auto_release(ctx: Context<AutoRelease>) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::Submitted, EscrowError::InvalidStatus);

        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= task.submitted_at + AUTO_RELEASE_DAYS,
            EscrowError::AutoReleaseNotReady
        );

        let task_id_bytes = task.task_id.to_le_bytes();
        let vault_seeds = &[
            VAULT_SEED,
            task_id_bytes.as_ref(),
            &[task.vault_bump],
        ];
        let signer_seeds = &[&vault_seeds[..]];

        let student_amount = task.reward_amount - task.platform_fee;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from:      ctx.accounts.vault.to_account_info(),
                    to:        ctx.accounts.student_usdc.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            student_amount,
        )?;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from:      ctx.accounts.vault.to_account_info(),
                    to:        ctx.accounts.treasury_usdc.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            task.platform_fee,
        )?;

        task.status       = TaskStatus::Completed;
        task.confirmed_at = now;

        emit!(AutoReleased {
            task_id:      task.task_id,
            student:      task.student,
            released_at:  now,
        });

        msg!("Task #{} auto-released after 7 days", task.task_id);
        Ok(())
    }

    /// Open a dispute — either party can trigger.
    pub fn open_dispute(ctx: Context<OpenDispute>) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::Submitted, EscrowError::InvalidStatus);

        let caller = ctx.accounts.caller.key();
        require!(
            caller == task.student || caller == task.employer,
            EscrowError::Unauthorized
        );

        task.status            = TaskStatus::Disputed;
        task.dispute_opened_at = Clock::get()?.unix_timestamp;

        emit!(DisputeOpened {
            task_id:    task.task_id,
            opened_by:  caller,
            opened_at:  task.dispute_opened_at,
        });

        msg!("Dispute opened for task #{}", task.task_id);
        Ok(())
    }

    /// Resolve dispute — only multisig can call.
    /// split_bps: how many basis points go to student (0–10000).
    /// e.g. 10000 = full release to student, 0 = full refund to employer.
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        split_bps: u64,
    ) -> Result<()> {
        require!(split_bps <= 10_000, EscrowError::InvalidSplit);

        let task = &mut ctx.accounts.task;
        require!(task.status == TaskStatus::Disputed, EscrowError::InvalidStatus);

        let task_id_bytes = task.task_id.to_le_bytes();
        let vault_seeds = &[
            VAULT_SEED,
            task_id_bytes.as_ref(),
            &[task.vault_bump],
        ];
        let signer_seeds = &[&vault_seeds[..]];

        let total     = task.reward_amount;
        let to_student   = total * split_bps / 10_000;
        let to_employer  = total - to_student;

        if to_student > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    Transfer {
                        from:      ctx.accounts.vault.to_account_info(),
                        to:        ctx.accounts.student_usdc.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                to_student,
            )?;
        }

        if to_employer > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    Transfer {
                        from:      ctx.accounts.vault.to_account_info(),
                        to:        ctx.accounts.employer_usdc.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                to_employer,
            )?;
        }

        task.status = TaskStatus::Resolved;

        emit!(DisputeResolved {
            task_id:    task.task_id,
            split_bps,
            to_student,
            to_employer,
            resolved_at: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Dispute resolved for task #{}: {}bps to student, {}bps to employer",
            task.task_id, split_bps, 10_000 - split_bps
        );
        Ok(())
    }

    /// Refund employer if task expired with no student assigned.
    pub fn refund_expired(ctx: Context<RefundExpired>) -> Result<()> {
        let task = &mut ctx.accounts.task;

        require!(task.status == TaskStatus::Open, EscrowError::InvalidStatus);
        require!(
            Clock::get()?.unix_timestamp > task.deadline,
            EscrowError::TaskNotExpired
        );
        require!(task.student == Pubkey::default(), EscrowError::TaskHasStudent);

        let task_id_bytes = task.task_id.to_le_bytes();
        let vault_seeds = &[
            VAULT_SEED,
            task_id_bytes.as_ref(),
            &[task.vault_bump],
        ];
        let signer_seeds = &[&vault_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from:      ctx.accounts.vault.to_account_info(),
                    to:        ctx.accounts.employer_usdc.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            task.reward_amount,
        )?;

        task.status = TaskStatus::Cancelled;
        msg!("Task #{} refunded — expired with no student", task.task_id);
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────
// ACCOUNTS
// ─────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeEscrowConfig<'info> {
    #[account(init, payer = authority, space = EscrowConfig::LEN, seeds = [ESCROW_CONFIG_SEED], bump)]
    pub escrow_config: Account<'info, EscrowConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: CreateTaskParams)]
pub struct CreateTask<'info> {
    #[account(
        init,
        payer = employer,
        space = Task::LEN,
        seeds = [TASK_SEED, &escrow_config.total_tasks.to_le_bytes()],
        bump
    )]
    pub task: Account<'info, Task>,

    #[account(
        init,
        payer = employer,
        seeds = [VAULT_SEED, &escrow_config.total_tasks.to_le_bytes()],
        bump,
        token::mint      = usdc_mint,
        token::authority = vault,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, seeds = [ESCROW_CONFIG_SEED], bump = escrow_config.bump)]
    pub escrow_config: Account<'info, EscrowConfig>,

    #[account(mut)]
    pub employer_usdc: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(mut)]
    pub employer: Signer<'info>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent:           Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(task_id: u64)]
pub struct AssignStudent<'info> {
    #[account(mut, seeds = [TASK_SEED, &task_id.to_le_bytes()], bump = task.bump)]
    pub task: Account<'info, Task>,

    #[account(seeds = [ESCROW_CONFIG_SEED], bump = escrow_config.bump, has_one = authority)]
    pub escrow_config: Account<'info, EscrowConfig>,

    /// CHECK: student wallet
    pub student: UncheckedAccount<'info>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SubmitTask<'info> {
    #[account(mut, seeds = [TASK_SEED, &task.task_id.to_le_bytes()], bump = task.bump)]
    pub task: Account<'info, Task>,

    pub student: Signer<'info>,
}

#[derive(Accounts)]
pub struct ConfirmCompletion<'info> {
    #[account(mut, seeds = [TASK_SEED, &task.task_id.to_le_bytes()], bump = task.bump)]
    pub task: Account<'info, Task>,

    #[account(mut, seeds = [VAULT_SEED, &task.task_id.to_le_bytes()], bump = task.vault_bump)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub student_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury_usdc: Account<'info, TokenAccount>,

    pub employer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AutoRelease<'info> {
    #[account(mut, seeds = [TASK_SEED, &task.task_id.to_le_bytes()], bump = task.bump)]
    pub task: Account<'info, Task>,

    #[account(mut, seeds = [VAULT_SEED, &task.task_id.to_le_bytes()], bump = task.vault_bump)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub student_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury_usdc: Account<'info, TokenAccount>,

    pub caller: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    #[account(mut, seeds = [TASK_SEED, &task.task_id.to_le_bytes()], bump = task.bump)]
    pub task: Account<'info, Task>,

    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut, seeds = [TASK_SEED, &task.task_id.to_le_bytes()], bump = task.bump)]
    pub task: Account<'info, Task>,

    #[account(mut, seeds = [VAULT_SEED, &task.task_id.to_le_bytes()], bump = task.vault_bump)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub student_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub employer_usdc: Account<'info, TokenAccount>,

    #[account(seeds = [ESCROW_CONFIG_SEED], bump = escrow_config.bump)]
    pub escrow_config: Account<'info, EscrowConfig>,

    /// Multisig must sign dispute resolution
    pub multisig: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundExpired<'info> {
    #[account(mut, seeds = [TASK_SEED, &task.task_id.to_le_bytes()], bump = task.bump)]
    pub task: Account<'info, Task>,

    #[account(mut, seeds = [VAULT_SEED, &task.task_id.to_le_bytes()], bump = task.vault_bump)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub employer_usdc: Account<'info, TokenAccount>,

    pub employer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ─────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────

#[account]
pub struct EscrowConfig {
    pub authority:   Pubkey,
    pub treasury:    Pubkey,
    pub multisig:    Pubkey,
    pub total_tasks: u64,
    pub paused:      bool,
    pub bump:        u8,
}
impl EscrowConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 1 + 1 + 32;
}

#[account]
pub struct Task {
    pub task_id:           u64,
    pub employer:          Pubkey,
    pub student:           Pubkey,
    pub reward_amount:     u64,
    pub platform_fee:      u64,
    pub status:            TaskStatus,
    pub required_sbt_tags: Vec<String>,
    pub min_dao_level:     u8,
    pub title:             String,
    pub description:       String,
    pub deadline:          i64,
    pub submission_hash:   [u8; 32],
    pub created_at:        i64,
    pub accepted_at:       i64,
    pub submitted_at:      i64,
    pub confirmed_at:      i64,
    pub dispute_opened_at: i64,
    pub vault_bump:        u8,
    pub bump:              u8,
}
impl Task {
    pub const LEN: usize = 8
        + 8 + 32 + 32 + 8 + 8 + 1
        + (4 + MAX_TAGS_LEN * (4 + MAX_TAG_LEN))
        + 1
        + (4 + MAX_TITLE_LEN)
        + (4 + MAX_DESC_LEN)
        + 8 + 32
        + 8 + 8 + 8 + 8 + 8
        + 1 + 1 + 64;
}

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskStatus {
    Open,
    InProgress,
    Submitted,
    Completed,
    Disputed,
    Resolved,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateTaskParams {
    pub title:             String,
    pub description:       String,
    pub required_sbt_tags: Vec<String>,
    pub min_dao_level:     u8,
    pub reward_amount:     u64,
    pub deadline:          i64,
}

// ─────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────

#[event] pub struct TaskCreated   { pub task_id: u64, pub employer: Pubkey, pub reward_amount: u64, pub deadline: i64, pub title: String }
#[event] pub struct TaskAssigned  { pub task_id: u64, pub student: Pubkey, pub accepted_at: i64 }
#[event] pub struct TaskSubmitted { pub task_id: u64, pub student: Pubkey, pub submission_hash: [u8; 32], pub submitted_at: i64 }
#[event] pub struct TaskCompleted { pub task_id: u64, pub student: Pubkey, pub employer: Pubkey, pub student_amount: u64, pub platform_fee: u64, pub confirmed_at: i64 }
#[event] pub struct AutoReleased  { pub task_id: u64, pub student: Pubkey, pub released_at: i64 }
#[event] pub struct DisputeOpened { pub task_id: u64, pub opened_by: Pubkey, pub opened_at: i64 }
#[event] pub struct DisputeResolved { pub task_id: u64, pub split_bps: u64, pub to_student: u64, pub to_employer: u64, pub resolved_at: i64 }

// ─────────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────────

#[error_code]
pub enum EscrowError {
    #[msg("Platform is paused")]
    Paused,
    #[msg("Invalid task status for this action")]
    InvalidStatus,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid reward amount")]
    InvalidAmount,
    #[msg("Deadline must be in the future")]
    InvalidDeadline,
    #[msg("Task has expired")]
    TaskExpired,
    #[msg("Task not yet expired")]
    TaskNotExpired,
    #[msg("Task ID mismatch")]
    TaskMismatch,
    #[msg("Auto-release requires 7 days after submission")]
    AutoReleaseNotReady,
    #[msg("Invalid dispute split (must be 0-10000 bps)")]
    InvalidSplit,
    #[msg("String exceeds maximum length")]
    StringTooLong,
    #[msg("Task already has an assigned student")]
    TaskHasStudent,
}
