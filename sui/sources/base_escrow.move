module cross_chain_swap::base_escrow {
    use sui::hash;
    use sui::event;
    use cross_chain_swap::timelock::{Self, Timelocks};
    use std::bcs;

    // Error codes - matching EVM contract
    const E_INVALID_CALLER: u64 = 1;
    const E_INVALID_SECRET: u64 = 2;
    const E_INVALID_IMMUTABLES: u64 = 3;
    const E_INVALID_TIME: u64 = 4;

    /// Immutables structure matching EVM BaseEscrow exactly
    /// This ensures compatibility between EVM and Sui implementations
    public struct Immutables has copy, drop, store {
        order_hash: vector<u8>,           // bytes32 orderHash in EVM
        hashlock: vector<u8>,             // bytes32 hashlock in EVM  
        maker: address,                   // Address maker in EVM
        taker: address,                   // Address taker in EVM
        token: address,                   // Address token in EVM
        amount: u64,                      // uint256 amount in EVM
        safety_deposit: u64,              // uint256 safetyDeposit in EVM
        timelocks: Timelocks,             // Timelocks timelocks in EVM
    }

    // ========== Events - matching EVM events ==========

    /// Emitted on escrow cancellation (matches EVM EscrowCancelled)
    public struct EscrowCancelled has copy, drop {
        escrow_id: address,
    }

    /// Emitted when funds are rescued (matches EVM FundsRescued)
    public struct FundsRescued has copy, drop {
        escrow_id: address,
        token: address,
        amount: u64,
    }

    /// Emitted on successful withdrawal (matches EVM Withdrawal)
    public struct Withdrawal has copy, drop {
        escrow_id: address,
        secret: vector<u8>,
    }

    // ========== Core Functions ==========

    /// Create new immutables matching EVM structure
    public fun new_immutables(
        order_hash: vector<u8>,
        hashlock: vector<u8>,
        maker: address,
        taker: address,
        token: address,
        amount: u64,
        safety_deposit: u64,
        timelocks: Timelocks,
    ): Immutables {
        Immutables {
            order_hash,
            hashlock,
            maker,
            taker,
            token,
            amount,
            safety_deposit,
            timelocks,
        }
    }

    /// Hash immutables for verification (matching EVM ImmutablesLib.hash)
    public fun hash_immutables(immutables: &Immutables): vector<u8> {
        let serialized = bcs::to_bytes(immutables);
        hash::keccak256(&serialized)
    }

    // ========== Validation Functions (matching EVM modifiers) ==========

    /// Validate caller is taker (matching EVM onlyTaker modifier)
    public fun validate_taker(caller: address, immutables: &Immutables) {
        assert!(caller == immutables.taker, E_INVALID_CALLER);
    }

    /// Validate caller is maker (used in cancellation)
    public fun validate_maker(caller: address, immutables: &Immutables) {
        assert!(caller == immutables.maker, E_INVALID_CALLER);
    }

    /// Validate secret against hashlock (matching EVM onlyValidSecret modifier)
    public fun validate_secret(secret: &vector<u8>, immutables: &Immutables) {
        let computed_hash = hash::keccak256(secret);
        assert!(computed_hash == immutables.hashlock, E_INVALID_SECRET);
    }

    /// Validate time constraint - after specific time (matching EVM onlyAfter modifier)
    public fun validate_after(current_timestamp: u64, required_timestamp: u64) {
        assert!(current_timestamp >= required_timestamp, E_INVALID_TIME);
    }

    /// Validate time constraint - before specific time (matching EVM onlyBefore modifier)  
    public fun validate_before(current_timestamp: u64, required_timestamp: u64) {
        assert!(current_timestamp < required_timestamp, E_INVALID_TIME);
    }

    // ========== Getter Functions ==========

    public fun order_hash(immutables: &Immutables): vector<u8> {
        immutables.order_hash
    }

    public fun hashlock(immutables: &Immutables): vector<u8> {
        immutables.hashlock
    }

    public fun maker(immutables: &Immutables): address {
        immutables.maker
    }

    public fun taker(immutables: &Immutables): address {
        immutables.taker
    }

    public fun token(immutables: &Immutables): address {
        immutables.token
    }

    public fun amount(immutables: &Immutables): u64 {
        immutables.amount
    }

    public fun safety_deposit(immutables: &Immutables): u64 {
        immutables.safety_deposit
    }

    public fun timelocks(immutables: &Immutables): Timelocks {
        immutables.timelocks
    }

    // ========== Event Emission Functions ==========

    /// Emit withdrawal event (matching EVM Withdrawal event)
    public fun emit_withdrawal(escrow_id: address, secret: vector<u8>) {
        event::emit(Withdrawal {
            escrow_id,
            secret,
        });
    }

    /// Emit cancellation event (matching EVM EscrowCancelled event)
    public fun emit_cancellation(escrow_id: address) {
        event::emit(EscrowCancelled {
            escrow_id,
        });
    }

    /// Emit rescue event (matching EVM FundsRescued event)
    public fun emit_rescue(escrow_id: address, token: address, amount: u64) {
        event::emit(FundsRescued {
            escrow_id,
            token,
            amount,
        });
    }

    // ========== Cross-Chain Compatibility Functions ==========

    /// Check if two immutables represent a valid cross-chain swap pair
    /// The key insight: for EVM-Sui swaps, the participants are swapped
    /// EVM src: maker locks tokens for taker
    /// Sui dst: taker locks tokens for maker  
    public fun verify_cross_chain_compatibility(
        evm_immutables: &Immutables,
        sui_immutables: &Immutables
    ): bool {
        // Order hash must match (same swap order)
        let order_match = evm_immutables.order_hash == sui_immutables.order_hash;
        
        // Hashlock must match (same secret)
        let hashlock_match = evm_immutables.hashlock == sui_immutables.hashlock;
        
        // Participants must be properly swapped for cross-chain
        // EVM maker should be Sui taker, EVM taker should be Sui maker
        let participant_match = (evm_immutables.maker == sui_immutables.taker) &&
                               (evm_immutables.taker == sui_immutables.maker);
        
        order_match && hashlock_match && participant_match
    }

    /// Generate order hash for cross-chain compatibility
    /// This should match the order hash generation on EVM side
    public fun generate_order_hash(
        maker: address,
        taker: address,
        src_token: address,
        dst_token: address,
        src_amount: u64,
        dst_amount: u64,
        salt: u64
    ): vector<u8> {
        let mut data = vector::empty<u8>();
        vector::append(&mut data, bcs::to_bytes(&maker));
        vector::append(&mut data, bcs::to_bytes(&taker));
        vector::append(&mut data, bcs::to_bytes(&src_token));
        vector::append(&mut data, bcs::to_bytes(&dst_token));
        vector::append(&mut data, bcs::to_bytes(&src_amount));
        vector::append(&mut data, bcs::to_bytes(&dst_amount));
        vector::append(&mut data, bcs::to_bytes(&salt));
        
        hash::keccak256(&data)
    }

    /// Convert Sui address to bytes for cross-chain usage
    public fun sui_address_to_bytes(addr: address): vector<u8> {
        bcs::to_bytes(&addr)
    }

    /// Convert EVM address (20 bytes) to Sui address format for internal use
    /// Note: This is for compatibility, actual cross-chain resolution happens off-chain
    public fun evm_address_to_sui_format(evm_addr: vector<u8>): address {
        // Pad EVM address (20 bytes) to Sui address (32 bytes)
        assert!(vector::length(&evm_addr) == 20, E_INVALID_CALLER);
        
        let mut padded = vector::empty<u8>();
        let mut i = 0;
        // Add 12 zero bytes prefix
        while (i < 12) {
            vector::push_back(&mut padded, 0u8);
            i = i + 1;
        };
        // Add the 20 EVM address bytes
        vector::append(&mut padded, evm_addr);
        
        // Convert to address (this is a placeholder - real implementation would use proper conversion)
        @0x0 // In practice, this would need proper address conversion
    }

    // ========== Test Helper Functions ==========

    #[test_only]
    public fun create_test_immutables(
        order_hash: vector<u8>,
        secret: vector<u8>,
        maker: address,
        taker: address,
        token: address,
        amount: u64,
        safety_deposit: u64,
    ): Immutables {
        let hashlock = hash::keccak256(&secret);
        let timelocks = timelock::new_for_testing();
        
        new_immutables(
            order_hash,
            hashlock,
            maker,
            taker,
            token,
            amount,
            safety_deposit,
            timelocks,
        )
    }
} 