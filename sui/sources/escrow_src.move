module cross_chain_swap::escrow_src {
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::balance::{Self, Balance};
    use cross_chain_swap::base_escrow::{Self, Immutables};
    use cross_chain_swap::timelock::{Self};

    // Error codes - matching EVM contract
    const E_INVALID_CALLER: u64 = 1;
    const E_INVALID_SECRET: u64 = 2;
    const E_INVALID_TIME: u64 = 3;
    const E_RESCUE_TOO_EARLY: u64 = 4;

    /// Source escrow contract for cross-chain atomic swap
    /// Matches EVM EscrowSrc functionality exactly
    /// Initially lock funds and then unlock them with verification of the secret presented
    public struct EscrowSrc<phantom T> has key, store {
        id: UID,
        tokens: Balance<T>,           // The tokens being escrowed
        safety_deposit: Balance<SUI>, // Safety deposit from maker
        immutables: Immutables,       // Immutable parameters matching EVM
        rescue_delay: u64,            // Delay before funds can be rescued
    }

    /// Create new source escrow (matching EVM constructor pattern)
    public fun new<T>(
        tokens: Coin<T>,
        safety_deposit: Coin<SUI>,
        immutables: Immutables,
        rescue_delay: u64,
        ctx: &mut TxContext
    ): EscrowSrc<T> {
        EscrowSrc {
            id: object::new(ctx),
            tokens: coin::into_balance(tokens),
            safety_deposit: coin::into_balance(safety_deposit),
            immutables,
            rescue_delay,
        }
    }

    /// Private withdrawal - only taker can withdraw with secret during private period
    /// Matches EVM EscrowSrc.withdraw exactly
    /// Time interval: private withdrawal period only
    public fun withdraw<T>(
        escrow: EscrowSrc<T>,
        secret: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate caller is taker (matching EVM onlyTaker modifier)
        base_escrow::validate_taker(tx_context::sender(ctx), &escrow.immutables);
        
        // Validate time constraints (matching EVM modifiers)
        let current_time = clock::timestamp_ms(clock) / 1000;
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let src_withdrawal_time = timelock::get(&timelocks, timelock::src_withdrawal());
        let src_cancellation_time = timelock::get(&timelocks, timelock::src_cancellation());
        
        base_escrow::validate_after(current_time, src_withdrawal_time);
        base_escrow::validate_before(current_time, src_cancellation_time);
        
        withdraw_internal(escrow, secret, tx_context::sender(ctx), ctx);
    }

    /// Private withdrawal to specific target - only taker can withdraw
    /// Matches EVM EscrowSrc.withdrawTo exactly
    public fun withdraw_to<T>(
        escrow: EscrowSrc<T>,
        secret: vector<u8>,
        target: address,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate caller is taker (matching EVM onlyTaker modifier)
        base_escrow::validate_taker(tx_context::sender(ctx), &escrow.immutables);
        
        // Validate time constraints (matching EVM modifiers)
        let current_time = clock::timestamp_ms(clock) / 1000;
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let src_withdrawal_time = timelock::get(&timelocks, timelock::src_withdrawal());
        let src_cancellation_time = timelock::get(&timelocks, timelock::src_cancellation());
        
        base_escrow::validate_after(current_time, src_withdrawal_time);
        base_escrow::validate_before(current_time, src_cancellation_time);
        
        withdraw_internal(escrow, secret, target, ctx);
    }

    /// Public withdrawal - anyone can withdraw with secret during public period
    /// Matches EVM EscrowSrc.publicWithdraw exactly
    public fun public_withdraw<T>(
        escrow: EscrowSrc<T>,
        secret: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate time constraints (matching EVM modifiers)
        let current_time = clock::timestamp_ms(clock) / 1000;
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let src_public_withdrawal_time = timelock::get(&timelocks, timelock::src_public_withdrawal());
        let src_cancellation_time = timelock::get(&timelocks, timelock::src_cancellation());
        
        base_escrow::validate_after(current_time, src_public_withdrawal_time);
        base_escrow::validate_before(current_time, src_cancellation_time);
        
        withdraw_internal(escrow, secret, tx_context::sender(ctx), ctx);
    }

    /// Public withdrawal to specific target - anyone can withdraw with secret
    /// Matches EVM EscrowSrc.publicWithdrawTo exactly  
    public fun public_withdraw_to<T>(
        escrow: EscrowSrc<T>,
        secret: vector<u8>,
        target: address,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate time constraints (matching EVM modifiers)
        let current_time = clock::timestamp_ms(clock) / 1000;
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let src_public_withdrawal_time = timelock::get(&timelocks, timelock::src_public_withdrawal());
        let src_cancellation_time = timelock::get(&timelocks, timelock::src_cancellation());
        
        base_escrow::validate_after(current_time, src_public_withdrawal_time);
        base_escrow::validate_before(current_time, src_cancellation_time);
        
        withdraw_internal(escrow, secret, target, ctx);
    }

    /// Private cancellation - only maker can cancel during private cancellation period
    /// Matches EVM EscrowSrc.cancel exactly
    public fun cancel<T>(
        escrow: EscrowSrc<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate caller is maker (matching EVM onlyMaker modifier)
        base_escrow::validate_maker(tx_context::sender(ctx), &escrow.immutables);
        
        // Validate time constraints (matching EVM modifiers)
        let current_time = clock::timestamp_ms(clock) / 1000;
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let src_cancellation_time = timelock::get(&timelocks, timelock::src_cancellation());
        
        base_escrow::validate_after(current_time, src_cancellation_time);
        
        cancel_internal(escrow, ctx);
    }

    /// Public cancellation - anyone can cancel during public cancellation period
    /// Matches EVM EscrowSrc.publicCancel exactly
    public fun public_cancel<T>(
        escrow: EscrowSrc<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate time constraints (matching EVM modifiers)
        let current_time = clock::timestamp_ms(clock) / 1000;
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let src_public_cancellation_time = timelock::get(&timelocks, timelock::src_public_cancellation());
        
        base_escrow::validate_after(current_time, src_public_cancellation_time);
        
        cancel_internal(escrow, ctx);
    }

    /// Rescue funds after rescue delay has passed
    /// Matches EVM EscrowSrc.rescueFunds exactly
    public fun rescue_funds<T>(
        escrow: &mut EscrowSrc<T>,
        token: address,  // Token address to rescue (for compatibility with EVM)
        amount: u64,     // Amount to rescue
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate rescue time (matching EVM rescue logic)
        timelock::check_rescue_time(&base_escrow::timelocks(&escrow.immutables), escrow.rescue_delay, clock);
        
        let escrow_id = object::uid_to_address(&escrow.id);
        let caller = tx_context::sender(ctx);
        
        // Rescue the specified amount of tokens
        if (amount > 0 && balance::value(&escrow.tokens) >= amount) {
            let rescued_tokens = balance::split(&mut escrow.tokens, amount);
            let rescued_coin = coin::from_balance(rescued_tokens, ctx);
            transfer::public_transfer(rescued_coin, caller);
            
            // Emit rescue event (matching EVM FundsRescued event)
            base_escrow::emit_rescue(escrow_id, token, amount);
        };
        
        // Also rescue safety deposit if requested (token = @0x0 for SUI)
        let safety_amount = balance::value(&escrow.safety_deposit);
        if (token == @0x0 && safety_amount > 0) {
            let rescued_safety = balance::split(&mut escrow.safety_deposit, safety_amount);
            let rescued_coin = coin::from_balance(rescued_safety, ctx);
            transfer::public_transfer(rescued_coin, caller);
            
            base_escrow::emit_rescue(escrow_id, @0x0, safety_amount);
        };
    }

    // ========== Internal Helper Functions ==========

    /// Internal withdrawal helper - implements core withdrawal logic
    fun withdraw_internal<T>(
        escrow: EscrowSrc<T>,
        secret: vector<u8>,
        target: address,
        ctx: &mut TxContext
    ) {
        // Validate secret against hashlock (matching EVM onlyValidSecret modifier)
        base_escrow::validate_secret(&secret, &escrow.immutables);
        
        let EscrowSrc {
            id,
            tokens,
            safety_deposit,
            immutables: _,
            rescue_delay: _,
        } = escrow;

        let escrow_id = object::uid_to_address(&id);
        
        // Transfer tokens to target (taker gets the tokens)
        let tokens_coin = coin::from_balance(tokens, ctx);
        transfer::public_transfer(tokens_coin, target);
        
        // Safety deposit goes to the caller (incentive for withdrawal)
        let safety_coin = coin::from_balance(safety_deposit, ctx);
        transfer::public_transfer(safety_coin, tx_context::sender(ctx));

        // Emit withdrawal event (matching EVM Withdrawal event)
        base_escrow::emit_withdrawal(escrow_id, secret);

        object::delete(id);
    }

    /// Internal cancellation helper - implements core cancellation logic
    fun cancel_internal<T>(
        escrow: EscrowSrc<T>,
        ctx: &mut TxContext
    ) {
        let EscrowSrc {
            id,
            tokens,
            safety_deposit,
            immutables,
            rescue_delay: _,
        } = escrow;

        let escrow_id = object::uid_to_address(&id);
        let maker = base_escrow::maker(&immutables);
        
        // Return tokens to maker
        let tokens_coin = coin::from_balance(tokens, ctx);
        transfer::public_transfer(tokens_coin, maker);
        
        // Safety deposit goes to caller (incentive for cancellation)
        let safety_coin = coin::from_balance(safety_deposit, ctx);
        transfer::public_transfer(safety_coin, tx_context::sender(ctx));

        // Emit cancellation event (matching EVM EscrowCancelled event)
        base_escrow::emit_cancellation(escrow_id);

        object::delete(id);
    }

    // ========== Getter Functions ==========

    /// Get immutables
    public fun immutables<T>(escrow: &EscrowSrc<T>): Immutables {
        escrow.immutables
    }

    /// Get token balance value
    public fun token_balance<T>(escrow: &EscrowSrc<T>): u64 {
        balance::value(&escrow.tokens)
    }

    /// Get safety deposit balance value
    public fun safety_balance<T>(escrow: &EscrowSrc<T>): u64 {
        balance::value(&escrow.safety_deposit)
    }

    /// Get rescue delay
    public fun rescue_delay<T>(escrow: &EscrowSrc<T>): u64 {
        escrow.rescue_delay
    }

    // ========== Cross-Chain Compatibility Functions ==========

    /// Verify compatibility with destination escrow for cross-chain swap
    public fun verify_cross_chain_compatibility<T>(
        src_escrow: &EscrowSrc<T>,
        dst_immutables: &Immutables
    ): bool {
        base_escrow::verify_cross_chain_compatibility(&src_escrow.immutables, dst_immutables)
    }

    /// Get all relevant addresses for this escrow
    public fun get_addresses<T>(escrow: &EscrowSrc<T>): (address, address) {
        let maker = base_escrow::maker(&escrow.immutables);
        let taker = base_escrow::taker(&escrow.immutables);
        (maker, taker)
    }

    /// Check if escrow can be withdrawn at current time
    public fun can_withdraw<T>(escrow: &EscrowSrc<T>, clock: &Clock): bool {
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let current_time = clock::timestamp_ms(clock) / 1000;
        let withdrawal_time = timelock::get(&timelocks, timelock::src_withdrawal());
        let cancellation_time = timelock::get(&timelocks, timelock::src_cancellation());
        
        current_time >= withdrawal_time && current_time < cancellation_time
    }

    /// Check if escrow can be cancelled at current time
    public fun can_cancel<T>(escrow: &EscrowSrc<T>, clock: &Clock): bool {
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let current_time = clock::timestamp_ms(clock) / 1000;
        let cancellation_time = timelock::get(&timelocks, timelock::src_cancellation());
        
        current_time >= cancellation_time
    }

    /// Check if rescue is available
    public fun can_rescue<T>(escrow: &EscrowSrc<T>, clock: &Clock): bool {
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let current_time = clock::timestamp_ms(clock) / 1000;
        let rescue_time = timelock::rescue_start(&timelocks, escrow.rescue_delay);
        
        current_time >= rescue_time
    }
} 