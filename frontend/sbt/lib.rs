use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3,
        CreateMetadataAccountsV3,
        Metadata,
        mpl_token_metadata::types::{DataV2, Creator},
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount, freeze_account, FreezeAccount},
};

declare_id!("FLtUaxwAwCNPdnsw9PRUfDgTvT3enZxGxMTNW5XurujW");

pub const PLATFORM_SEED:   &[u8] = b"skillstamp_platform";
pub const SBT_RECORD_SEED: &[u8] = b"sbt_record";
pub const ISSUER_SEED:     &[u8] = b"issuer";
pub const MAX_TAGS:        usize = 8;
pub const MAX_TAG_LEN:     usize = 32;
pub const MAX_TITLE_LEN:   usize = 64;
pub const MAX_ISSUER_LEN:  usize = 64;
pub const MAX_URI_LEN:     usize = 200;

#[program]
pub mod skillstamp_sbt {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        treasury: Pubkey,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.platform_config;
        cfg.authority    = ctx.accounts.authority.key();
        cfg.treasury     = treasury;
        cfg.total_issued = 0;
        cfg.paused       = false;
        cfg.bump         = ctx.bumps.platform_config;
        msg!("Skillstamp platform initialized");
        Ok(())
    }

    pub fn register_issuer(
        ctx: Context<RegisterIssuer>,
        issuer_name: String,
        issuer_type: IssuerType,
    ) -> Result<()> {
        require!(issuer_name.len() <= MAX_ISSUER_LEN, SkillstampError::StringTooLong);
        require!(!ctx.accounts.platform_config.paused, SkillstampError::PlatformPaused);

        let issuer = &mut ctx.accounts.issuer_record;
        issuer.authority    = ctx.accounts.issuer_authority.key();
        issuer.name         = issuer_name;
        issuer.issuer_type  = issuer_type;
        issuer.active       = true;
        issuer.total_issued = 0;
        issuer.bump         = ctx.bumps.issuer_record;

        msg!("Issuer registered: {}", issuer.name);
        Ok(())
    }

    pub fn mint_sbt(
        ctx: Context<MintSbt>,
        params: MintSbtParams,
    ) -> Result<()> {
        require!(!ctx.accounts.platform_config.paused, SkillstampError::PlatformPaused);
        require!(ctx.accounts.issuer_record.active, SkillstampError::IssuerNotActive);
        require!(params.title.len() <= MAX_TITLE_LEN, SkillstampError::StringTooLong);
        require!(params.metadata_uri.len() <= MAX_URI_LEN, SkillstampError::StringTooLong);
        require!(params.skill_tags.len() <= MAX_TAGS, SkillstampError::TooManyTags);
        require!(
            params.difficulty_level >= 1 && params.difficulty_level <= 5,
            SkillstampError::InvalidDifficulty
        );

        let bump = ctx.accounts.platform_config.bump;
        let platform_seeds: &[&[u8]] = &[PLATFORM_SEED, &[bump]];
        let signer_seeds = &[platform_seeds];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint:      ctx.accounts.mint.to_account_info(),
                    to:        ctx.accounts.student_ata.to_account_info(),
                    authority: ctx.accounts.platform_config.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;

        let creators = vec![Creator {
            address:  ctx.accounts.platform_config.key(),
            verified: true,
            share:    100,
        }];

        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                ctx.accounts.metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata:         ctx.accounts.metadata.to_account_info(),
                    mint:             ctx.accounts.mint.to_account_info(),
                    mint_authority:   ctx.accounts.platform_config.to_account_info(),
                    update_authority: ctx.accounts.platform_config.to_account_info(),
                    payer:            ctx.accounts.payer.to_account_info(),
                    system_program:   ctx.accounts.system_program.to_account_info(),
                    rent:             ctx.accounts.rent.to_account_info(),
                },
                signer_seeds,
            ),
            DataV2 {
                name:                    params.title.clone(),
                symbol:                  "SSTAMP".to_string(),
                uri:                     params.metadata_uri.clone(),
                seller_fee_basis_points: 0,
                creators:                Some(creators),
                collection:              None,
                uses:                    None,
            },
            true,
            true,
            None,
        )?;

        freeze_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                FreezeAccount {
                    account:   ctx.accounts.student_ata.to_account_info(),
                    mint:      ctx.accounts.mint.to_account_info(),
                    authority: ctx.accounts.platform_config.to_account_info(),
                },
                signer_seeds,
            ),
        )?;

        let record = &mut ctx.accounts.sbt_record;
        record.student_wallet   = ctx.accounts.student.key();
        record.mint             = ctx.accounts.mint.key();
        record.issuer           = ctx.accounts.issuer_record.key();
        record.issuer_type      = ctx.accounts.issuer_record.issuer_type.clone();
        record.challenge_id     = params.challenge_id;
        record.title            = params.title;
        record.skill_tags       = params.skill_tags;
        record.difficulty_level = params.difficulty_level;
        record.score            = params.score;
        record.issued_at        = Clock::get()?.unix_timestamp;
        record.metadata_uri     = params.metadata_uri;
        record.revoked          = false;
        record.revoke_reason    = None;
        record.bump             = ctx.bumps.sbt_record;

        ctx.accounts.platform_config.total_issued += 1;
        ctx.accounts.issuer_record.total_issued   += 1;

        emit!(SbtMinted {
            student:    ctx.accounts.student.key(),
            mint:       ctx.accounts.mint.key(),
            issuer:     ctx.accounts.issuer_record.key(),
            title:      record.title.clone(),
            skill_tags: record.skill_tags.clone(),
            difficulty: record.difficulty_level,
            score:      record.score,
            issued_at:  record.issued_at,
        });

        msg!("SBT minted: {} -> {}", record.title, ctx.accounts.student.key());
        Ok(())
    }

    pub fn revoke_sbt(
        ctx: Context<RevokeSbt>,
        reason: String,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.platform_config.authority,
            SkillstampError::Unauthorized
        );
        require!(!ctx.accounts.sbt_record.revoked, SkillstampError::AlreadyRevoked);

        ctx.accounts.sbt_record.revoked       = true;
        ctx.accounts.sbt_record.revoke_reason = Some(reason.clone());

        emit!(SbtRevoked {
            student:    ctx.accounts.sbt_record.student_wallet,
            mint:       ctx.accounts.sbt_record.mint,
            reason,
            revoked_at: Clock::get()?.unix_timestamp,
        });

        msg!("SBT revoked: {}", ctx.accounts.sbt_record.mint);
        Ok(())
    }

    pub fn set_issuer_active(
        ctx: Context<SetIssuerActive>,
        active: bool,
    ) -> Result<()> {
        ctx.accounts.issuer_record.active = active;
        msg!("Issuer {} active={}", ctx.accounts.issuer_record.name, active);
        Ok(())
    }

    pub fn set_platform_paused(
        ctx: Context<SetPlatformPaused>,
        paused: bool,
    ) -> Result<()> {
        ctx.accounts.platform_config.paused = paused;
        msg!("Platform paused={}", paused);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(init, payer = authority, space = PlatformConfig::LEN, seeds = [PLATFORM_SEED], bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(issuer_name: String)]
pub struct RegisterIssuer<'info> {
    #[account(init, payer = payer, space = IssuerRecord::LEN, seeds = [ISSUER_SEED, issuer_authority.key().as_ref()], bump)]
    pub issuer_record: Account<'info, IssuerRecord>,
    #[account(mut, seeds = [PLATFORM_SEED], bump = platform_config.bump, has_one = authority)]
    pub platform_config: Account<'info, PlatformConfig>,
    pub issuer_authority: SystemAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: MintSbtParams)]
pub struct MintSbt<'info> {
    #[account(
        init, payer = payer, space = SbtRecord::LEN,
        seeds = [SBT_RECORD_SEED, student.key().as_ref(), &params.challenge_id.to_le_bytes()],
        bump
    )]
    pub sbt_record: Box<Account<'info, SbtRecord>>,
    #[account(init, payer = payer, mint::decimals = 0, mint::authority = platform_config, mint::freeze_authority = platform_config)]
    pub mint: Box<Account<'info, Mint>>,
    #[account(init_if_needed, payer = payer, associated_token::mint = mint, associated_token::authority = student)]
    pub student_ata: Box<Account<'info, TokenAccount>>,
    /// CHECK: Metaplex metadata PDA
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    #[account(mut, seeds = [PLATFORM_SEED], bump = platform_config.bump)]
    pub platform_config: Box<Account<'info, PlatformConfig>>,
    #[account(mut, seeds = [ISSUER_SEED, issuer_record.authority.as_ref()], bump = issuer_record.bump)]
    pub issuer_record: Box<Account<'info, IssuerRecord>>,
    /// CHECK: student wallet
    pub student: UncheckedAccount<'info>,
    pub issuer_signer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RevokeSbt<'info> {
    #[account(mut)]
    pub sbt_record: Account<'info, SbtRecord>,
    #[account(seeds = [PLATFORM_SEED], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetIssuerActive<'info> {
    #[account(mut)]
    pub issuer_record: Account<'info, IssuerRecord>,
    #[account(seeds = [PLATFORM_SEED], bump = platform_config.bump, has_one = authority)]
    pub platform_config: Account<'info, PlatformConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPlatformPaused<'info> {
    #[account(mut, seeds = [PLATFORM_SEED], bump = platform_config.bump, has_one = authority)]
    pub platform_config: Account<'info, PlatformConfig>,
    pub authority: Signer<'info>,
}

#[account]
pub struct PlatformConfig {
    pub authority:    Pubkey,
    pub treasury:     Pubkey,
    pub total_issued: u64,
    pub paused:       bool,
    pub bump:         u8,
}
impl PlatformConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 1 + 64;
}

#[account]
pub struct IssuerRecord {
    pub authority:    Pubkey,
    pub name:         String,
    pub issuer_type:  IssuerType,
    pub active:       bool,
    pub total_issued: u64,
    pub bump:         u8,
}
impl IssuerRecord {
    pub const LEN: usize = 8 + 32 + (4 + MAX_ISSUER_LEN) + 1 + 1 + 8 + 1 + 32;
}

#[account]
pub struct SbtRecord {
    pub student_wallet:   Pubkey,
    pub mint:             Pubkey,
    pub issuer:           Pubkey,
    pub issuer_type:      IssuerType,
    pub challenge_id:     u64,
    pub title:            String,
    pub skill_tags:       Vec<String>,
    pub difficulty_level: u8,
    pub score:            u8,
    pub issued_at:        i64,
    pub metadata_uri:     String,
    pub revoked:          bool,
    pub revoke_reason:    Option<String>,
    pub bump:             u8,
}
impl SbtRecord {
    pub const LEN: usize = 8
        + 32 + 32 + 32 + 1 + 8
        + (4 + MAX_TITLE_LEN)
        + (4 + MAX_TAGS * (4 + MAX_TAG_LEN))
        + 1 + 1 + 8
        + (4 + MAX_URI_LEN)
        + 1 + (1 + 4 + 128)
        + 1 + 64;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum IssuerType {
    Platform,
    Academic,
    Employer,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintSbtParams {
    pub challenge_id:     u64,
    pub title:            String,
    pub skill_tags:       Vec<String>,
    pub difficulty_level: u8,
    pub score:            u8,
    pub metadata_uri:     String,
}

#[event]
pub struct SbtMinted {
    pub student:    Pubkey,
    pub mint:       Pubkey,
    pub issuer:     Pubkey,
    pub title:      String,
    pub skill_tags: Vec<String>,
    pub difficulty: u8,
    pub score:      u8,
    pub issued_at:  i64,
}

#[event]
pub struct SbtRevoked {
    pub student:    Pubkey,
    pub mint:       Pubkey,
    pub reason:     String,
    pub revoked_at: i64,
}

#[error_code]
pub enum SkillstampError {
    #[msg("Platform is paused")]
    PlatformPaused,
    #[msg("Issuer is not active")]
    IssuerNotActive,
    #[msg("SBT already issued for this challenge")]
    SbtAlreadyIssued,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("String exceeds maximum length")]
    StringTooLong,
    #[msg("Too many skill tags (max 8)")]
    TooManyTags,
    #[msg("Invalid difficulty level (must be 1-5)")]
    InvalidDifficulty,
    #[msg("SBT already revoked")]
    AlreadyRevoked,
}