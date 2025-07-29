module cross_chain_swap::escrow_dst {
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

    /// Destination escrow contract for cross-chain atomic swap
    /// Matches EVM EscrowDst functionality exactly
    /// Initially lock funds and then unlock them with verification of the secret presented
    public struct EscrowDst<phantom T> has key, store {
        id: UID,
        tokens: Balance<T>,           // The tokens being escrowed
        safety_deposit: Balance<SUI>, // Safety deposit from taker  
        immutables: Immutables,       // Immutable parameters matching EVM
        rescue_delay: u64,            // Delay before funds can be rescued
    }

    /// Create new destination escrow (matching EVM constructor pattern)
    public fun new<T>(
        tokens: Coin<T>,
        safety_deposit: Coin<SUI>,
        immutables: Immutables,
        rescue_delay: u64,
        ctx: &mut TxContext
    ): EscrowDst<T> {
        EscrowDst {
            id: object::new(ctx),
            tokens: coin::into_balance(tokens),
            safety_deposit: coin::into_balance(safety_deposit),
            immutables,
            rescue_delay,
        }
    }

    /// Private withdrawal - only taker can withdraw with secret during private period
    /// Matches EVM EscrowDst.withdraw exactly
    /// Time interval: private withdrawal period only
    public fun withdraw<T>(
        escrow: EscrowDst<T>,
        secret: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate caller is taker (matching EVM onlyTaker modifier)
        base_escrow::validate_taker(tx_context::sender(ctx), &escrow.immutables);
        
        // Validate time constraints (matching EVM modifiers)
        let current_time = clock::timestamp_ms(clock) / 1000;
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let dst_withdrawal_time = timelock::get(&timelocks, timelock::dst_withdrawal());
        let dst_cancellation_time = timelock::get(&timelocks, timelock::dst_cancellation());
        
        base_escrow::validate_after(current_time, dst_withdrawal_time);
        base_escrow::validate_before(current_time, dst_cancellation_time);
        
        withdraw_internal(escrow, secret, ctx);
    }

    /// Public withdrawal - anyone can withdraw with secret during public period
    /// Matches EVM EscrowDst.publicWithdraw exactly
    public fun public_withdraw<T>(
        escrow: EscrowDst<T>,
        secret: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate time constraints (matching EVM modifiers)
        let current_time = clock::timestamp_ms(clock) / 1000;
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let dst_public_withdrawal_time = timelock::get(&timelocks, timelock::dst_public_withdrawal());
        let dst_cancellation_time = timelock::get(&timelocks, timelock::dst_cancellation());
        
        base_escrow::validate_after(current_time, dst_public_withdrawal_time);
        base_escrow::validate_before(current_time, dst_cancellation_time);
        
        withdraw_internal(escrow, secret, ctx);
    }

    /// Private cancellation - only maker can cancel during private cancellation period
    /// Matches EVM EscrowDst.cancel exactly
    /// Note: In destination chain, maker initiates the cancellation
    public fun cancel<T>(
        escrow: EscrowDst<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate caller is maker (matching EVM onlyMaker modifier)
        base_escrow::validate_maker(tx_context::sender(ctx), &escrow.immutables);
        
        // Validate time constraints (matching EVM modifiers)
        let current_time = clock::timestamp_ms(clock) / 1000;
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let dst_cancellation_time = timelock::get(&timelocks, timelock::dst_cancellation());
        
        base_escrow::validate_after(current_time, dst_cancellation_time);
        
        cancel_internal(escrow, ctx);
    }

    /// Rescue funds after rescue delay has passed
    /// Matches EVM EscrowDst.rescueFunds exactly
    public fun rescue_funds<T>(
        escrow: &mut EscrowDst<T>,
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
    /// In destination chain, maker gets the tokens (different from source chain)
    fun withdraw_internal<T>(
        escrow: EscrowDst<T>,
        secret: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Validate secret against hashlock (matching EVM onlyValidSecret modifier)
        base_escrow::validate_secret(&secret, &escrow.immutables);
        
        let EscrowDst {
            id,
            tokens,
            safety_deposit,
            immutables,
            rescue_delay: _,
        } = escrow;

        let escrow_id = object::uid_to_address(&id);
        let maker = base_escrow::maker(&immutables);
        
        // Transfer tokens to maker (in destination chain, maker receives the tokens)
        let tokens_coin = coin::from_balance(tokens, ctx);
        transfer::public_transfer(tokens_coin, maker);
        
        // Safety deposit goes to the caller (incentive for withdrawal)
        let safety_coin = coin::from_balance(safety_deposit, ctx);
        transfer::public_transfer(safety_coin, tx_context::sender(ctx));

        // Emit withdrawal event (matching EVM Withdrawal event)
        base_escrow::emit_withdrawal(escrow_id, secret);

        object::delete(id);
    }

    /// Internal cancellation helper - implements core cancellation logic
    /// In destination chain, tokens go back to taker, safety deposit to caller
    fun cancel_internal<T>(
        escrow: EscrowDst<T>,
        ctx: &mut TxContext
    ) {
        let EscrowDst {
            id,
            tokens,
            safety_deposit,
            immutables,
            rescue_delay: _,
        } = escrow;

        let escrow_id = object::uid_to_address(&id);
        let taker = base_escrow::taker(&immutables);
        
        // Return tokens to taker (in destination chain, taker provided the tokens)
        let tokens_coin = coin::from_balance(tokens, ctx);
        transfer::public_transfer(tokens_coin, taker);
        
        // Safety deposit goes to caller (incentive for cancellation)
        let safety_coin = coin::from_balance(safety_deposit, ctx);
        transfer::public_transfer(safety_coin, tx_context::sender(ctx));

        // Emit cancellation event (matching EVM EscrowCancelled event)
        base_escrow::emit_cancellation(escrow_id);

        object::delete(id);
    }

    // ========== Getter Functions ==========

    /// Get immutables
    public fun immutables<T>(escrow: &EscrowDst<T>): Immutables {
        escrow.immutables
    }

    /// Get token balance value
    public fun token_balance<T>(escrow: &EscrowDst<T>): u64 {
        balance::value(&escrow.tokens)
    }

    /// Get safety deposit balance value
    public fun safety_balance<T>(escrow: &EscrowDst<T>): u64 {
        balance::value(&escrow.safety_deposit)
    }

    /// Get rescue delay
    public fun rescue_delay<T>(escrow: &EscrowDst<T>): u64 {
        escrow.rescue_delay
    }

    // ========== Cross-Chain Compatibility Functions ==========

    /// Verify compatibility with source escrow for cross-chain swap
    public fun verify_cross_chain_compatibility<T>(
        dst_escrow: &EscrowDst<T>,
        src_immutables: &Immutables
    ): bool {
        base_escrow::verify_cross_chain_compatibility(src_immutables, &dst_escrow.immutables)
    }

    /// Get all relevant addresses for this escrow
    public fun get_addresses<T>(escrow: &EscrowDst<T>): (address, address) {
        let maker = base_escrow::maker(&escrow.immutables);
        let taker = base_escrow::taker(&escrow.immutables);
        (maker, taker)
    }

    /// Check if escrow can be withdrawn at current time
    public fun can_withdraw<T>(escrow: &EscrowDst<T>, clock: &Clock): bool {
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let current_time = clock::timestamp_ms(clock) / 1000;
        let withdrawal_time = timelock::get(&timelocks, timelock::dst_withdrawal());
        let cancellation_time = timelock::get(&timelocks, timelock::dst_cancellation());
        
        current_time >= withdrawal_time && current_time < cancellation_time
    }

    /// Check if escrow can be cancelled at current time
    public fun can_cancel<T>(escrow: &EscrowDst<T>, clock: &Clock): bool {
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let current_time = clock::timestamp_ms(clock) / 1000;
        let cancellation_time = timelock::get(&timelocks, timelock::dst_cancellation());
        
        current_time >= cancellation_time
    }

    /// Check if rescue is available
    public fun can_rescue<T>(escrow: &EscrowDst<T>, clock: &Clock): bool {
        let timelocks = base_escrow::timelocks(&escrow.immutables);
        let current_time = clock::timestamp_ms(clock) / 1000;
        let rescue_time = timelock::rescue_start(&timelocks, escrow.rescue_delay);
        
        current_time >= rescue_time
    }

    /// Check if this destination escrow is compatible with specific source chain
    /// This helps validate cross-chain swap pairs
    public fun validate_src_compatibility<T>(
        dst_escrow: &EscrowDst<T>,
        src_immutables: &Immutables
    ): bool {
        // Check order hash match (same swap order)
        let dst_order = base_escrow::order_hash(&dst_escrow.immutables);
        let src_order = base_escrow::order_hash(src_immutables);
        if (dst_order != src_order) return false;
        
        // Check hashlock match (same secret required)
        let dst_hashlock = base_escrow::hashlock(&dst_escrow.immutables);
        let src_hashlock = base_escrow::hashlock(src_immutables);
        if (dst_hashlock != src_hashlock) return false;
        
        // Check participants are properly swapped for cross-chain
        let dst_maker = base_escrow::maker(&dst_escrow.immutables);
        let dst_taker = base_escrow::taker(&dst_escrow.immutables);
        let src_maker = base_escrow::maker(src_immutables);
        let src_taker = base_escrow::taker(src_immutables);
        
        // For cross-chain compatibility: dst maker should be src taker, dst taker should be src maker
        (dst_maker == src_taker) && (dst_taker == src_maker)
    }
} 