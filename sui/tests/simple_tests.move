#[test_only]
module cross_chain_swap::simple_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin;
    use sui::sui::SUI;
    use sui::hash;
    
    // Import our modules
    use cross_chain_swap::base_escrow::{Self, Immutables};
    use cross_chain_swap::timelock::{Self, Timelocks};
    use cross_chain_swap::escrow_src::{Self};
    use cross_chain_swap::escrow_dst::{Self};
    use cross_chain_swap::escrow_factory::{Self};

    // ========== Test Constants ==========
    
    // Test users
    const ALICE: address = @0xa11ce;
    const BOB: address = @0xb0b;
    const CHARLIE: address = @0xcc;
    
    // Test amounts
    const MAKING_AMOUNT: u64 = 300_000_000_000;
    const TAKING_AMOUNT: u64 = 500_000_000_000;
    const SRC_SAFETY_DEPOSIT: u64 = 30_000_000_000;
    const DST_SAFETY_DEPOSIT: u64 = 50_000_000_000;
    const RESCUE_DELAY: u64 = 604800; // 7 days
    
    // Test secrets
    const SECRET: vector<u8> = b"secret";
    
    // Timelock periods (in seconds)
    const SRC_WITHDRAWAL: u32 = 120;
    const SRC_PUBLIC_WITHDRAWAL: u32 = 500;
    const SRC_CANCELLATION: u32 = 1020;
    const SRC_PUBLIC_CANCELLATION: u32 = 1530;
    const DST_WITHDRAWAL: u32 = 300;
    const DST_PUBLIC_WITHDRAWAL: u32 = 540;
    const DST_CANCELLATION: u32 = 900;

    // Mock token type
    public struct TestToken has drop {}

    // ========== Helper Functions ==========

    /// Create test timelocks
    fun create_test_timelocks(): Timelocks {
        timelock::new(
            SRC_WITHDRAWAL,
            SRC_PUBLIC_WITHDRAWAL,
            SRC_CANCELLATION,
            SRC_PUBLIC_CANCELLATION,
            DST_WITHDRAWAL,
            DST_PUBLIC_WITHDRAWAL,
            DST_CANCELLATION,
            0 // deployed_at will be set when escrow is created
        )
    }

    /// Create test immutables
    fun create_test_immutables(
        order_hash: vector<u8>,
        maker: address,
        taker: address,
        token: address,
        amount: u64,
        safety_deposit: u64,
    ): Immutables {
        let secret = SECRET;
        let hashlock = hash::keccak256(&secret);
        let timelocks = create_test_timelocks();
        
        base_escrow::new_immutables(
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

    /// Generate test order hash
    fun generate_test_order_hash(): vector<u8> {
        base_escrow::generate_order_hash(
            ALICE,
            BOB,
            @0x1, // src_token
            @0x2, // dst_token
            MAKING_AMOUNT,
            TAKING_AMOUNT,
            12345 // salt
        )
    }

    // ========== Factory Tests ==========

    #[test]
    fun test_factory_creation() {
        let mut scenario = ts::begin(ALICE);
        
        ts::next_tx(&mut scenario, ALICE);
        {
            let ctx = ts::ctx(&mut scenario);
            let (factory, admin_cap, factory_cap) = escrow_factory::create_test_factory(ctx);
            
            // Verify factory configuration
            assert!(escrow_factory::get_admin(&factory) == ALICE, 0);
            let (src_delay, dst_delay) = escrow_factory::get_rescue_delays(&factory);
            assert!(src_delay == RESCUE_DELAY, 1);
            assert!(dst_delay == RESCUE_DELAY, 2);
            
            // Verify initial stats
            let (total_created, total_volume, active, cross_chain) = escrow_factory::get_stats(&factory);
            assert!(total_created == 0, 3);
            assert!(total_volume == 0, 4);
            assert!(active == 0, 5);
            assert!(cross_chain == 0, 6);
            
            // Cleanup - transfer objects to sender instead of deleting
            sui::transfer::public_transfer(admin_cap, ALICE);
            sui::transfer::public_transfer(factory_cap, ALICE);
            escrow_factory::destroy_for_testing(factory);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_cross_chain_compatibility_validation() {
        let order_hash = generate_test_order_hash();
        let secret = SECRET;
        let hashlock = hash::keccak256(&secret);
        let timelocks = create_test_timelocks();

        // Create source immutables
        let src_immutables = base_escrow::new_immutables(
            order_hash,
            hashlock,
            ALICE, // maker
            BOB,   // taker
            @0x1,  // src_token
            MAKING_AMOUNT,
            SRC_SAFETY_DEPOSIT,
            timelocks,
        );

        // Create destination immutables (participants swapped for cross-chain)
        let dst_immutables = base_escrow::new_immutables(
            order_hash,
            hashlock,
            BOB,   // maker (swapped)
            ALICE, // taker (swapped)
            @0x2,  // dst_token
            TAKING_AMOUNT,
            DST_SAFETY_DEPOSIT,
            timelocks,
        );

        // Verify compatibility
        assert!(base_escrow::verify_cross_chain_compatibility(&src_immutables, &dst_immutables), 7);
        
        // Test incompatible immutables (different order hash)
        let different_order_hash = b"different_order";
        let incompatible_immutables = base_escrow::new_immutables(
            different_order_hash,
            hashlock,
            BOB,
            ALICE,
            @0x2,
            TAKING_AMOUNT,
            DST_SAFETY_DEPOSIT,
            timelocks,
        );

        assert!(!base_escrow::verify_cross_chain_compatibility(&src_immutables, &incompatible_immutables), 8);
    }

    // ========== Timelock Tests ==========

    #[test]
    fun test_timelock_stages() {
        let timelocks = create_test_timelocks();
        let deployed_at = 1000u32;
        let updated_timelocks = timelock::set_deployed_at(timelocks, deployed_at);

        // Test all stages
        let src_withdrawal_time = timelock::get(&updated_timelocks, timelock::src_withdrawal());
        let src_public_withdrawal_time = timelock::get(&updated_timelocks, timelock::src_public_withdrawal());
        let src_cancellation_time = timelock::get(&updated_timelocks, timelock::src_cancellation());
        let src_public_cancellation_time = timelock::get(&updated_timelocks, timelock::src_public_cancellation());
        let dst_withdrawal_time = timelock::get(&updated_timelocks, timelock::dst_withdrawal());
        let dst_public_withdrawal_time = timelock::get(&updated_timelocks, timelock::dst_public_withdrawal());
        let dst_cancellation_time = timelock::get(&updated_timelocks, timelock::dst_cancellation());

        // Verify timing progression
        assert!(src_withdrawal_time == (deployed_at as u64) + (SRC_WITHDRAWAL as u64), 9);
        assert!(src_public_withdrawal_time == (deployed_at as u64) + (SRC_PUBLIC_WITHDRAWAL as u64), 10);
        assert!(src_cancellation_time == (deployed_at as u64) + (SRC_CANCELLATION as u64), 11);
        assert!(src_public_cancellation_time == (deployed_at as u64) + (SRC_PUBLIC_CANCELLATION as u64), 12);
        assert!(dst_withdrawal_time == (deployed_at as u64) + (DST_WITHDRAWAL as u64), 13);
        assert!(dst_public_withdrawal_time == (deployed_at as u64) + (DST_PUBLIC_WITHDRAWAL as u64), 14);
        assert!(dst_cancellation_time == (deployed_at as u64) + (DST_CANCELLATION as u64), 15);

        // Verify logical order (corrected based on the actual values)
        // SRC_WITHDRAWAL = 120, DST_WITHDRAWAL = 300, so src happens first
        assert!(src_withdrawal_time < dst_withdrawal_time, 16); // src withdrawal happens first 
        assert!(src_withdrawal_time < src_public_withdrawal_time, 17);
        assert!(dst_withdrawal_time < src_public_withdrawal_time, 18);
        assert!(src_public_withdrawal_time < dst_public_withdrawal_time, 19);
        assert!(dst_public_withdrawal_time < dst_cancellation_time, 20);
        assert!(dst_cancellation_time < src_cancellation_time, 21);
        assert!(src_cancellation_time < src_public_cancellation_time, 22);
    }

    #[test]
    fun test_rescue_functionality() {
        let timelocks = create_test_timelocks();
        let rescue_delay = 604800u64; // 7 days
        let deployed_at = 1000u32;
        let updated_timelocks = timelock::set_deployed_at(timelocks, deployed_at);

        let rescue_start_time = timelock::rescue_start(&updated_timelocks, rescue_delay);
        assert!(rescue_start_time == (deployed_at as u64) + rescue_delay, 22);
    }

    // ========== Source Escrow Tests ==========

    #[test]
    fun test_src_escrow_creation() {
        let mut scenario = ts::begin(ALICE);
        
        ts::next_tx(&mut scenario, ALICE);
        {
            let ctx = ts::ctx(&mut scenario);
            let immutables = create_test_immutables(
                generate_test_order_hash(),
                ALICE, // maker
                BOB,   // taker
                @0x1,  // token
                MAKING_AMOUNT,
                SRC_SAFETY_DEPOSIT,
            );

            let test_tokens = coin::mint_for_testing<TestToken>(MAKING_AMOUNT, ctx);
            let safety_deposit = coin::mint_for_testing<SUI>(SRC_SAFETY_DEPOSIT, ctx);
            
            let escrow = escrow_src::new(
                test_tokens,
                safety_deposit,
                immutables,
                RESCUE_DELAY,
                ctx
            );

            // Verify escrow properties
            assert!(escrow_src::token_balance(&escrow) == MAKING_AMOUNT, 23);
            assert!(escrow_src::safety_balance(&escrow) == SRC_SAFETY_DEPOSIT, 24);
            assert!(escrow_src::rescue_delay(&escrow) == RESCUE_DELAY, 25);

            // Get immutables and verify
            let retrieved_immutables = escrow_src::immutables(&escrow);
            assert!(base_escrow::maker(&retrieved_immutables) == ALICE, 26);
            assert!(base_escrow::taker(&retrieved_immutables) == BOB, 27);

            // Clean up by transferring to ALICE
            sui::transfer::public_transfer(escrow, ALICE);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_dst_escrow_creation() {
        let mut scenario = ts::begin(ALICE);
        
        ts::next_tx(&mut scenario, ALICE);
        {
            let ctx = ts::ctx(&mut scenario);
            // For destination escrow, participants are swapped
            let immutables = create_test_immutables(
                generate_test_order_hash(),
                BOB,   // maker (swapped)
                ALICE, // taker (swapped) 
                @0x2,
                TAKING_AMOUNT,
                DST_SAFETY_DEPOSIT,
            );

            let test_tokens = coin::mint_for_testing<TestToken>(TAKING_AMOUNT, ctx);
            let safety_deposit = coin::mint_for_testing<SUI>(DST_SAFETY_DEPOSIT, ctx);
            
            let escrow = escrow_dst::new(
                test_tokens,
                safety_deposit,
                immutables,
                RESCUE_DELAY,
                ctx
            );

            // Verify escrow properties
            assert!(escrow_dst::token_balance(&escrow) == TAKING_AMOUNT, 28);
            assert!(escrow_dst::safety_balance(&escrow) == DST_SAFETY_DEPOSIT, 29);
            assert!(escrow_dst::rescue_delay(&escrow) == RESCUE_DELAY, 30);

            // Get immutables and verify (participants should be swapped)
            let retrieved_immutables = escrow_dst::immutables(&escrow);
            assert!(base_escrow::maker(&retrieved_immutables) == BOB, 31);
            assert!(base_escrow::taker(&retrieved_immutables) == ALICE, 32);

            // Clean up by transferring to ALICE
            sui::transfer::public_transfer(escrow, ALICE);
        };
        
        ts::end(scenario);
    }

    // ========== Utility Tests ==========

    #[test]
    fun test_address_helpers() {
        // Test EVM address conversion
        let evm_addr = x"742d35Cc5C1C4b1c2B7c6E5a12345678901234ab"; // 20 bytes
        let _sui_format = base_escrow::evm_address_to_sui_format(evm_addr);
        
        // Test Sui address to bytes
        let sui_bytes = base_escrow::sui_address_to_bytes(ALICE);
        assert!(std::vector::length(&sui_bytes) == 32, 33); // Sui addresses are 32 bytes
    }

    #[test]
    fun test_immutables_hash() {
        let immutables = create_test_immutables(
            generate_test_order_hash(),
            ALICE,
            BOB,
            @0x1,
            MAKING_AMOUNT,
            SRC_SAFETY_DEPOSIT,
        );

        let hash1 = base_escrow::hash_immutables(&immutables);
        let hash2 = base_escrow::hash_immutables(&immutables);
        
        // Same immutables should produce same hash
        assert!(hash1 == hash2, 34);
        
        // Different immutables should produce different hash
        let different_order_hash = b"different_order";
        let different_immutables = create_test_immutables(
            different_order_hash,
            ALICE,
            BOB,
            @0x1,
            MAKING_AMOUNT,
            SRC_SAFETY_DEPOSIT,
        );
        let hash3 = base_escrow::hash_immutables(&different_immutables);
        assert!(hash1 != hash3, 35);
    }

    #[test]
    fun test_secret_validation() {
        let secret = SECRET;
        let hashlock = hash::keccak256(&secret);
        let timelocks = create_test_timelocks();

        let immutables = base_escrow::new_immutables(
            generate_test_order_hash(),
            hashlock,
            ALICE,
            BOB,
            @0x1,
            MAKING_AMOUNT,
            SRC_SAFETY_DEPOSIT,
            timelocks,
        );

        // Valid secret should pass validation
        base_escrow::validate_secret(&secret, &immutables);

        // This test passes if no abort occurs
        assert!(true, 36);
    }

    #[test]
    #[expected_failure(abort_code = cross_chain_swap::base_escrow::E_INVALID_SECRET, location = cross_chain_swap::base_escrow)]
    fun test_invalid_secret_validation() {
        let secret = SECRET;
        let hashlock = hash::keccak256(&secret);
        let timelocks = create_test_timelocks();

        let immutables = base_escrow::new_immutables(
            generate_test_order_hash(),
            hashlock,
            ALICE,
            BOB,
            @0x1,
            MAKING_AMOUNT,
            SRC_SAFETY_DEPOSIT,
            timelocks,
        );

        // Invalid secret should fail validation
        let wrong_secret = b"wrong_secret";
        base_escrow::validate_secret(&wrong_secret, &immutables);
    }

    #[test]
    fun test_caller_validation() {
        let immutables = create_test_immutables(
            generate_test_order_hash(),
            ALICE, // maker
            BOB,   // taker
            @0x1,
            MAKING_AMOUNT,
            SRC_SAFETY_DEPOSIT,
        );

        // Valid taker should pass validation
        base_escrow::validate_taker(BOB, &immutables);
        
        // Valid maker should pass validation
        base_escrow::validate_maker(ALICE, &immutables);

        // This test passes if no abort occurs
        assert!(true, 37);
    }

    #[test]
    #[expected_failure(abort_code = cross_chain_swap::base_escrow::E_INVALID_CALLER, location = cross_chain_swap::base_escrow)]
    fun test_invalid_taker_validation() {
        let immutables = create_test_immutables(
            generate_test_order_hash(),
            ALICE, // maker
            BOB,   // taker
            @0x1,
            MAKING_AMOUNT,
            SRC_SAFETY_DEPOSIT,
        );

        // Invalid taker should fail validation
        base_escrow::validate_taker(CHARLIE, &immutables);
    }

    #[test]
    #[expected_failure(abort_code = cross_chain_swap::base_escrow::E_INVALID_CALLER, location = cross_chain_swap::base_escrow)]
    fun test_invalid_maker_validation() {
        let immutables = create_test_immutables(
            generate_test_order_hash(),
            ALICE, // maker
            BOB,   // taker
            @0x1,
            MAKING_AMOUNT,
            SRC_SAFETY_DEPOSIT,
        );

        // Invalid maker should fail validation
        base_escrow::validate_maker(CHARLIE, &immutables);
    }
} 