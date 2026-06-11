use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount};

declare_id!("FRUPLendXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

pub const MAX_LTV_BPS: u64 = 6000;
pub const LIQ_THRESHOLD_BPS: u64 = 8000;
pub const STABILITY_FEE_BPS: u64 = 500;
pub const LIQ_PENALTY_BPS: u64 = 1500;
pub const AUCTION_DISCOUNT_BPS_PER_MIN: u64 = 50;

#[program]
pub mod fragshare_lending {
    use super::*;

    pub fn open_position(
        ctx: Context<OpenPosition>,
        fraction_amount: u64,
        mint_amount: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.lending_pool;
        let pos = &mut ctx.accounts.position;
        let collateral_value = fraction_amount
            .checked_mul(pool.price_per_fraction_inr)
            .ok_or(LendingError::Overflow)?;
        
        let max_mint = collateral_value
            .checked_mul(MAX_LTV_BPS)
            .ok_or(LendingError::Overflow)?
            .checked_div(10000)
            .ok_or(LendingError::Overflow)?;
            
        require!(mint_amount <= max_mint, LendingError::ExceedsMaxLTV);
        
        pos.owner = ctx.accounts.owner.key();
        pos.property_id = pool.property_id;
        pos.collateral_fracs = fraction_amount;
        pos.debt_frup = mint_amount;
        pos.opened_at = Clock::get()?.unix_timestamp;
        pos.last_accrual = pos.opened_at;
        pos.is_liquidatable = false;
        pos.bump = ctx.bumps.position;
        
        pool.total_collateral += fraction_amount;
        pool.total_debt_frup += mint_amount;
        
        let pid = pool.property_id.to_le_bytes();
        let seeds = &[b"pool" as &[u8], pid.as_ref(), &[pool.bump]];
        
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.frup_mint.to_account_info(),
                    to: ctx.accounts.owner_frup_ata.to_account_info(),
                    authority: pool.to_account_info(),
                },
                &[seeds],
            ),
            mint_amount,
        )?;
        
        emit!(PositionOpened {
            owner: pos.owner,
            frup_minted: mint_amount,
            ltv_bps: mint_amount * 10000 / collateral_value
        });
        Ok(())
    }

    pub fn accrue_fee(ctx: Context<AccrueFee>) -> Result<()> {
        let pos = &mut ctx.accounts.position;
        let now = Clock::get()?.unix_timestamp;
        let secs = (now - pos.last_accrual) as u64;
        let fee = pos
            .debt_frup
            .checked_mul(STABILITY_FEE_BPS)
            .ok_or(LendingError::Overflow)?
            .checked_mul(secs)
            .ok_or(LendingError::Overflow)?
            .checked_div(31_536_000 * 10000)
            .ok_or(LendingError::Overflow)?;
            
        pos.debt_frup += fee;
        pos.last_accrual = now;
        Ok(())
    }

    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        let pos = &mut ctx.accounts.position;
        let pool = &mut ctx.accounts.lending_pool;
        require!(amount <= pos.debt_frup, LendingError::OverRepay);
        
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.frup_mint.to_account_info(),
                    from: ctx.accounts.owner_frup_ata.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;
        
        pos.debt_frup -= amount;
        pool.total_debt_frup -= amount;
        
        if pos.debt_frup == 0 {
            pool.total_collateral -= pos.collateral_fracs;
            emit!(PositionClosed { owner: pos.owner });
        }
        Ok(())
    }

    pub fn flag_liquidation(ctx: Context<FlagLiquidation>) -> Result<()> {
        let pos = &mut ctx.accounts.position;
        let pool = &ctx.accounts.lending_pool;
        
        let cv = pos
            .collateral_fracs
            .checked_mul(pool.price_per_fraction_inr)
            .ok_or(LendingError::Overflow)?;
        let ltv = pos
            .debt_frup
            .checked_mul(10000)
            .ok_or(LendingError::Overflow)?
            .checked_div(cv)
            .ok_or(LendingError::Overflow)?;
            
        require!(ltv > LIQ_THRESHOLD_BPS, LendingError::HealthyPosition);
        
        pos.is_liquidatable = true;
        pos.auction_start = Clock::get()?.unix_timestamp;
        
        emit!(LiquidationFlagged {
            owner: pos.owner,
            ltv_bps: ltv
        });
        Ok(())
    }

    pub fn liquidate(ctx: Context<Liquidate>, max_bid_inr: u64) -> Result<()> {
        let pos = &mut ctx.accounts.position;
        let pool = &mut ctx.accounts.lending_pool;
        require!(pos.is_liquidatable, LendingError::NotLiquidatable);
        
        let mins = ((Clock::get()?.unix_timestamp - pos.auction_start) as u64) / 60;
        let cv = pos
            .collateral_fracs
            .checked_mul(pool.price_per_fraction_inr)
            .ok_or(LendingError::Overflow)?;
            
        let discount = (mins * AUCTION_DISCOUNT_BPS_PER_MIN).min(5000);
        let auction_price = cv - cv * discount / 10000;
        
        require!(max_bid_inr >= auction_price, LendingError::BidTooLow);
        
        pool.total_collateral -= pos.collateral_fracs;
        pool.total_debt_frup -= pos.debt_frup;
        pos.debt_frup = 0;
        pos.collateral_fracs = 0;
        
        emit!(Liquidated {
            liquidator: ctx.accounts.liquidator.key(),
            price: auction_price
        });
        Ok(())
    }
}

#[account]
pub struct LendingPool {
    pub property_id: u64,
    pub price_per_fraction_inr: u64,
    pub price_oracle: Pubkey,
    pub total_collateral: u64,
    pub total_debt_frup: u64,
    pub frup_mint: Pubkey,
    pub bump: u8,
}
impl LendingPool {
    pub const SIZE: usize = 8 + 8 + 8 + 32 + 8 + 8 + 32 + 1;
}

#[account]
pub struct Position {
    pub owner: Pubkey,
    pub property_id: u64,
    pub collateral_fracs: u64,
    pub debt_frup: u64,
    pub opened_at: i64,
    pub last_accrual: i64,
    pub is_liquidatable: bool,
    pub auction_start: i64,
    pub bump: u8,
}
impl Position {
    pub const SIZE: usize = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 1;
}

#[derive(Accounts)]
#[instruction(fraction_amount: u64, mint_amount: u64)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        mut, 
        seeds = [b"pool", lending_pool.property_id.to_le_bytes().as_ref()], 
        bump = lending_pool.bump
    )]
    pub lending_pool: Account<'info, LendingPool>,
    
    #[account(
        init, 
        payer = owner, 
        space = Position::SIZE, 
        seeds = [b"pos", owner.key().as_ref(), lending_pool.property_id.to_le_bytes().as_ref()], 
        bump
    )]
    pub position: Account<'info, Position>,
    
    #[account(mut)]
    pub frup_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub owner_frup_ata: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AccrueFee<'info> {
    #[account(mut)]
    pub position: Account<'info, Position>,
}

#[derive(Accounts)]
pub struct Repay<'info> {
    pub owner: Signer<'info>,
    #[account(mut)]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub lending_pool: Account<'info, LendingPool>,
    #[account(mut)]
    pub frup_mint: Account<'info, Mint>,
    #[account(mut)]
    pub owner_frup_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FlagLiquidation<'info> {
    #[account(mut)]
    pub position: Account<'info, Position>,
    pub lending_pool: Account<'info, LendingPool>,
}

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,
    #[account(mut)]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub lending_pool: Account<'info, LendingPool>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct PositionOpened {
    pub owner: Pubkey,
    pub frup_minted: u64,
    pub ltv_bps: u64,
}

#[event]
pub struct PositionClosed {
    pub owner: Pubkey,
}

#[event]
pub struct LiquidationFlagged {
    pub owner: Pubkey,
    pub ltv_bps: u64,
}

#[event]
pub struct Liquidated {
    pub liquidator: Pubkey,
    pub price: u64,
}

#[error_code]
pub enum LendingError {
    #[msg("Exceeds max LTV")]
    ExceedsMaxLTV,
    #[msg("Over-repayment")]
    OverRepay,
    #[msg("Position healthy")]
    HealthyPosition,
    #[msg("Not liquidatable")]
    NotLiquidatable,
    #[msg("Bid too low")]
    BidTooLow,
    #[msg("Overflow")]
    Overflow,
}
