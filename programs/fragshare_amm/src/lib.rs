use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer, Token, TokenAccount};

declare_id!("FRGAmmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

pub const FEE_BPS: u64 = 30; // 0.3%

#[program]
pub mod fragshare_amm {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        property_id: u64,
        oracle_price_inr: u64,
        initial_fracs: u64,
        initial_usdc: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.property_id = property_id;
        pool.reserve_fracs = initial_fracs;
        pool.reserve_usdc = initial_usdc;
        pool.oracle_price_inr = oracle_price_inr;
        pool.fee_numerator = FEE_BPS;
        pool.fee_denominator = 10000;
        pool.bump = ctx.bumps.pool;
        
        // Transfer initial liquidity from admin to pool accounts
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.admin_frac_ata.to_account_info(),
                    to: ctx.accounts.pool_frac_ata.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            initial_fracs,
        )?;
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.admin_usdc_ata.to_account_info(),
                    to: ctx.accounts.pool_usdc_ata.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            initial_usdc,
        )?;

        Ok(())
    }

    pub fn swap_usdc_for_fracs(
        ctx: Context<Swap>,
        usdc_amount_in: u64,
        min_fracs_out: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        
        // Yield-Adjusted Constant Product: (R_frac) * (R_usdc) = K
        let fee = usdc_amount_in * pool.fee_numerator / pool.fee_denominator;
        let usdc_amount_in_with_fee = usdc_amount_in - fee;
        
        let numerator = usdc_amount_in_with_fee
            .checked_mul(pool.reserve_fracs)
            .ok_or(AmmError::Overflow)?;
        let denominator = pool.reserve_usdc
            .checked_add(usdc_amount_in_with_fee)
            .ok_or(AmmError::Overflow)?;
            
        let fracs_out = numerator.checked_div(denominator).ok_or(AmmError::Overflow)?;
        
        require!(fracs_out >= min_fracs_out, AmmError::SlippageExceeded);
        
        // Update state
        pool.reserve_usdc += usdc_amount_in;
        pool.reserve_fracs -= fracs_out;
        
        // Transfer USDC from user
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc_ata.to_account_info(),
                    to: ctx.accounts.pool_usdc_ata.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            usdc_amount_in,
        )?;
        
        // Transfer Fracs to user (requires pool signer)
        let pid = pool.property_id.to_le_bytes();
        let seeds = &[b"amm", pid.as_ref(), &[pool.bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_frac_ata.to_account_info(),
                    to: ctx.accounts.user_frac_ata.to_account_info(),
                    authority: pool.to_account_info(),
                },
                &[seeds],
            ),
            fracs_out,
        )?;
        
        emit!(SwapEvent {
            user: ctx.accounts.user.key(),
            amount_in: usdc_amount_in,
            amount_out: fracs_out,
            is_buy: true
        });

        Ok(())
    }
}

#[account]
pub struct AmmPool {
    pub property_id: u64,
    pub reserve_fracs: u64,
    pub reserve_usdc: u64,
    pub oracle_price_inr: u64,
    pub fee_numerator: u64,
    pub fee_denominator: u64,
    pub bump: u8,
}
impl AmmPool {
    pub const SIZE: usize = 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[derive(Accounts)]
#[instruction(property_id: u64)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init, 
        payer = admin, 
        space = AmmPool::SIZE, 
        seeds = [b"amm", property_id.to_le_bytes().as_ref()], 
        bump
    )]
    pub pool: Account<'info, AmmPool>,
    
    #[account(mut)]
    pub admin_frac_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_frac_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub admin_usdc_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_usdc_ata: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut, 
        seeds = [b"amm", pool.property_id.to_le_bytes().as_ref()], 
        bump = pool.bump
    )]
    pub pool: Account<'info, AmmPool>,
    
    #[account(mut)]
    pub user_usdc_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_usdc_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_frac_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_frac_ata: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[event]
pub struct SwapEvent {
    pub user: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub is_buy: bool,
}

#[error_code]
pub enum AmmError {
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Math Overflow")]
    Overflow,
}
