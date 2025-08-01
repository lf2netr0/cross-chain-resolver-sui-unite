#[test_only]
module cross_chain_swap::simple_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin;
    use sui::sui::SUI;
    use sui::hash;
    use sui::clock::{Self, Clock};
    use sui::bcs;
    use std::vector;
    
    // Import our modules
    use cross_chain_swap::base_escrow::{Self, Immutables};
    use cross_chain_swap::timelock::{Self, Timelocks};
    use cross_chain_swap::escrow_src::{Self};
    use cross_chain_swap::escrow_dst::{Self};
    use cross_chain_swap::escrow_factory::{Self};
    use cross_chain_swap::order_pool::{Self};

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

    /// Generate test order hash (legacy - for base escrow tests)
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

    /// Compute orderHash for order pool testing (Sui-native compatible)
    /// This should match exactly with compute_sui_order_hash in order_pool.move
    fun compute_test_order_hash(
        hashlock: vector<u8>,
        maker: address,
        token: address,
        amount: u64,
        safety_deposit_amount: u64,
        timelocks_data: u256
    ): vector<u8> {
        // ✅ Use the same Sui-native structure as order_pool.move
        // Simple concatenation + keccak256 for efficiency
        
        let mut order_data = vector::empty<u8>();
        
        // Add all order components in fixed order (same as order_pool.move)
        order_data.append(hashlock);
        order_data.append(bcs::to_bytes(&maker));
        order_data.append(bcs::to_bytes(&token));
        order_data.append(bcs::to_bytes(&amount));
        order_data.append(bcs::to_bytes(&safety_deposit_amount));
        order_data.append(bcs::to_bytes(&timelocks_data));
        
        // Simple keccak256 hash - efficient and deterministic
        hash::keccak256(&order_data)
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
    fun test_factory_escrow_creation_with_immutable_keys() {
        let mut scenario = ts::begin(ALICE);
        
        ts::next_tx(&mut scenario, ALICE);
        {
            let ctx = ts::ctx(&mut scenario);
            let (mut factory, admin_cap, factory_cap) = escrow_factory::create_test_factory(ctx);
            let clock = clock::create_for_testing(ctx);
            
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
            
            // ✅ NEW: create_src_escrow now returns EscrowSrc<T> object
            let src_escrow = escrow_factory::create_src_escrow(
                &mut factory,
                &factory_cap,
                test_tokens,
                safety_deposit,
                immutables,
                &clock,
                ctx
            );

            let src_escrow_id = sui::object::id_to_address(&sui::object::id(&src_escrow));
            
            // ✅ NEW: Test escrow existence using immutables
            assert!(escrow_factory::escrow_exists(&factory, &immutables, true), 7);
            
            // ✅ NEW: Test escrow binding verification
            assert!(escrow_factory::verify_escrow_binding(&factory, src_escrow_id, &immutables, true), 8);
            
                         // ✅ NEW: Test escrow address retrieval using immutables
             let stored_address_opt = escrow_factory::get_escrow_address(&factory, &immutables, true);
             assert!(std::option::is_some(&stored_address_opt), 9);
             let stored_address = std::option::destroy_some(stored_address_opt);
             assert!(stored_address == src_escrow_id, 10);
            
            // Verify factory stats updated
            let (total_created, total_volume, active, _) = escrow_factory::get_stats(&factory);
            assert!(total_created == 1, 11);
            assert!(total_volume == MAKING_AMOUNT, 12);
            assert!(active == 1, 13);

            // Cleanup
            sui::transfer::public_transfer(src_escrow, ALICE);
            sui::transfer::public_transfer(admin_cap, ALICE);
            sui::transfer::public_transfer(factory_cap, ALICE);
            clock::destroy_for_testing(clock);
            escrow_factory::destroy_for_testing(factory);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_factory_secret_verification() {
        let mut scenario = ts::begin(ALICE);
        
        ts::next_tx(&mut scenario, ALICE);
        {
            let ctx = ts::ctx(&mut scenario);
            let (factory, admin_cap, factory_cap) = escrow_factory::create_test_factory(ctx);
            
            let immutables = create_test_immutables(
                generate_test_order_hash(),
                ALICE,
                BOB,
                @0x1,
                MAKING_AMOUNT,
                SRC_SAFETY_DEPOSIT,
            );

            // ✅ NEW: Test secret verification through factory
            let secret = SECRET;
            assert!(escrow_factory::verify_secret(&secret, &immutables), 14);
            
            // Test invalid secret
            let wrong_secret = b"wrong_secret";
            assert!(!escrow_factory::verify_secret(&wrong_secret, &immutables), 15);

            // Cleanup
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

        // ✅ UPDATED: Test compatibility through factory
        let mut scenario = ts::begin(ALICE);
        ts::next_tx(&mut scenario, ALICE);
        {
            let ctx = ts::ctx(&mut scenario);
            let (factory, admin_cap, factory_cap) = escrow_factory::create_test_factory(ctx);
            
            // Verify compatibility using factory function
            assert!(escrow_factory::validate_cross_chain_pair(&src_immutables, &dst_immutables), 16);
            
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

            assert!(!escrow_factory::validate_cross_chain_pair(&src_immutables, &incompatible_immutables), 17);
            
            // Cleanup
            sui::transfer::public_transfer(admin_cap, ALICE);
            sui::transfer::public_transfer(factory_cap, ALICE);
            escrow_factory::destroy_for_testing(factory);
        };
        ts::end(scenario);
    }

    // ========== OrderPool Tests ==========

    #[test]
    fun test_order_pool_creation() {
        let mut scenario = ts::begin(ALICE);
        
        ts::next_tx(&mut scenario, ALICE);
        {
            let ctx = ts::ctx(&mut scenario);
            let pool = order_pool::create_test_pool(ctx);
            
            // Verify initial pool stats
            let (total_created, total_volume, active, completed) = order_pool::get_pool_stats(&pool);
            assert!(total_created == 0, 18);
            assert!(total_volume == 0, 19);
            assert!(active == 0, 20);
            assert!(completed == 0, 21);
            
            // Transfer pool to ALICE to consume it properly
            sui::transfer::public_transfer(pool, ALICE);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_order_pool_order_lifecycle() {
        let mut scenario = ts::begin(ALICE);
        
        ts::next_tx(&mut scenario, ALICE);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut pool = order_pool::create_test_pool(ctx);
            let clock = clock::create_for_testing(ctx);
            
            let secret = SECRET;
            let hashlock = hash::keccak256(&secret);
            let timelocks = create_test_timelocks();
            let timelocks_data = timelock::get_data(&timelocks);
            let expiry = (clock::timestamp_ms(&clock) / 1000) + 3600; // 1 hour from now
            
            // ✅ Calculate correct orderHash using the same Fusion+ parameters as create_order
            // Must match the default values passed by create_order to create_fusion_order
            let order_hash = order_pool::compute_fusion_order_hash_public(
                hashlock,                   // hashlock
                0u256,                      // salt (default)
                0u256,                      // nonce (default)
                ALICE,                      // maker
                @0x1,                       // maker_asset (token)
                @0x0,                       // taker_asset (default unknown)
                MAKING_AMOUNT,              // making_amount (amount)
                0u64,                       // taking_amount (default unknown)
                SRC_SAFETY_DEPOSIT,         // safety_deposit_amount
                1u64,                       // src_chain_id (default)
                2u64,                       // dst_chain_id (default)
                SRC_SAFETY_DEPOSIT,         // src_safety_deposit (same as safety_deposit_amount)
                SRC_SAFETY_DEPOSIT,         // dst_safety_deposit (same as safety_deposit_amount)
                timelocks_data,             // timelocks_data
                false,                      // allow_partial_fills (default)
                false                       // allow_multiple_fills (default)
            );
            
            // Create test tokens and safety deposit
            let test_tokens = coin::mint_for_testing<TestToken>(MAKING_AMOUNT, ctx);
            let safety_deposit = coin::mint_for_testing<SUI>(SRC_SAFETY_DEPOSIT, ctx);
            
            // Create order in pool (no signature needed - user creates their own order)
            let _order_address = order_pool::create_order(
                &mut pool,
                test_tokens,
                safety_deposit,
                order_hash,
                hashlock,
                @0x1, // token address
                MAKING_AMOUNT,
                SRC_SAFETY_DEPOSIT,
                timelocks_data,
                expiry,
                &clock,
                ctx
            );
            
            // Verify order exists
            assert!(order_pool::order_exists(&pool, order_hash), 22);
            
            // Verify pool stats updated
            let (total_created, total_volume, active, completed) = order_pool::get_pool_stats(&pool);
            assert!(total_created == 1, 23);
            assert!(total_volume == MAKING_AMOUNT, 24);
            assert!(active == 1, 25);
            assert!(completed == 0, 26);
            
            // Get order details
            let (maker, amount, order_expiry, status) = order_pool::get_order_details_by_hash<TestToken>(&pool, order_hash);
            assert!(maker == ALICE, 27);
            assert!(amount == MAKING_AMOUNT, 28);
            assert!(order_expiry == expiry, 29);
            assert!(status == 0, 30); // ORDER_STATUS_ACTIVE
            
            // Transfer pool to ALICE to consume it properly
            sui::transfer::public_transfer(pool, ALICE);
            clock::destroy_for_testing(clock);
        };
        
        ts::end(scenario);
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
        assert!(src_withdrawal_time == (deployed_at as u64) + (SRC_WITHDRAWAL as u64), 31);
        assert!(src_public_withdrawal_time == (deployed_at as u64) + (SRC_PUBLIC_WITHDRAWAL as u64), 32);
        assert!(src_cancellation_time == (deployed_at as u64) + (SRC_CANCELLATION as u64), 33);
        assert!(src_public_cancellation_time == (deployed_at as u64) + (SRC_PUBLIC_CANCELLATION as u64), 34);
        assert!(dst_withdrawal_time == (deployed_at as u64) + (DST_WITHDRAWAL as u64), 35);
        assert!(dst_public_withdrawal_time == (deployed_at as u64) + (DST_PUBLIC_WITHDRAWAL as u64), 36);
        assert!(dst_cancellation_time == (deployed_at as u64) + (DST_CANCELLATION as u64), 37);

        // Verify logical order (corrected based on the actual values)
        // SRC_WITHDRAWAL = 120, DST_WITHDRAWAL = 300, so src happens first
        assert!(src_withdrawal_time < dst_withdrawal_time, 38); // src withdrawal happens first 
        assert!(src_withdrawal_time < src_public_withdrawal_time, 39);
        assert!(dst_withdrawal_time < src_public_withdrawal_time, 40);
        assert!(src_public_withdrawal_time < dst_public_withdrawal_time, 41);
        assert!(dst_public_withdrawal_time < dst_cancellation_time, 42);
        assert!(dst_cancellation_time < src_cancellation_time, 43);
        assert!(src_cancellation_time < src_public_cancellation_time, 44);
    }

    #[test]
    fun test_rescue_functionality() {
        let timelocks = create_test_timelocks();
        let rescue_delay = 604800u64; // 7 days
        let deployed_at = 1000u32;
        let updated_timelocks = timelock::set_deployed_at(timelocks, deployed_at);

        let rescue_start_time = timelock::rescue_start(&updated_timelocks, rescue_delay);
        assert!(rescue_start_time == (deployed_at as u64) + rescue_delay, 45);
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
            assert!(escrow_src::token_balance(&escrow) == MAKING_AMOUNT, 46);
            assert!(escrow_src::safety_balance(&escrow) == SRC_SAFETY_DEPOSIT, 47);
            assert!(escrow_src::rescue_delay(&escrow) == RESCUE_DELAY, 48);

            // Get immutables and verify
            let retrieved_immutables = escrow_src::immutables(&escrow);
            assert!(base_escrow::maker(&retrieved_immutables) == ALICE, 49);
            assert!(base_escrow::taker(&retrieved_immutables) == BOB, 50);

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
            assert!(escrow_dst::token_balance(&escrow) == TAKING_AMOUNT, 51);
            assert!(escrow_dst::safety_balance(&escrow) == DST_SAFETY_DEPOSIT, 52);
            assert!(escrow_dst::rescue_delay(&escrow) == RESCUE_DELAY, 53);

            // Get immutables and verify (participants should be swapped)
            let retrieved_immutables = escrow_dst::immutables(&escrow);
            assert!(base_escrow::maker(&retrieved_immutables) == BOB, 54);
            assert!(base_escrow::taker(&retrieved_immutables) == ALICE, 55);

            // Clean up by transferring to ALICE
            sui::transfer::public_transfer(escrow, ALICE);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_src_escrow_with_sui_token_and_safety_deposit() {
        let mut scenario = ts::begin(ALICE);
        
        ts::next_tx(&mut scenario, ALICE);
        {
            let ctx = ts::ctx(&mut scenario);
            // Create immutables where both token and safety deposit are SUI
            let immutables = create_test_immutables(
                generate_test_order_hash(),
                ALICE, // maker
                BOB,   // taker
                @0x2,  // SUI token address (using @0x2 to represent SUI)
                MAKING_AMOUNT, // amount of SUI tokens
                SRC_SAFETY_DEPOSIT, // SUI safety deposit
            );

            // Both token and safety deposit are SUI coins
            let sui_tokens = coin::mint_for_testing<SUI>(MAKING_AMOUNT, ctx);
            let safety_deposit = coin::mint_for_testing<SUI>(SRC_SAFETY_DEPOSIT, ctx);
            
            let escrow = escrow_src::new(
                sui_tokens,
                safety_deposit,
                immutables,
                RESCUE_DELAY,
                ctx
            );

            // Verify escrow properties
            // Token balance should be the main SUI amount
            assert!(escrow_src::token_balance(&escrow) == MAKING_AMOUNT, 56);
            // Safety balance should be the safety deposit amount
            assert!(escrow_src::safety_balance(&escrow) == SRC_SAFETY_DEPOSIT, 57);
            assert!(escrow_src::rescue_delay(&escrow) == RESCUE_DELAY, 58);

            // Get immutables and verify
            let retrieved_immutables = escrow_src::immutables(&escrow);
            assert!(base_escrow::maker(&retrieved_immutables) == ALICE, 59);
            assert!(base_escrow::taker(&retrieved_immutables) == BOB, 60);
            assert!(base_escrow::token(&retrieved_immutables) == @0x2, 61); // SUI token address
            assert!(base_escrow::amount(&retrieved_immutables) == MAKING_AMOUNT, 62);
            assert!(base_escrow::safety_deposit(&retrieved_immutables) == SRC_SAFETY_DEPOSIT, 63);

            // Verify total SUI locked in escrow (token + safety deposit)
            let total_sui_locked = escrow_src::token_balance(&escrow) + escrow_src::safety_balance(&escrow);
            assert!(total_sui_locked == MAKING_AMOUNT + SRC_SAFETY_DEPOSIT, 64);

            // Clean up by transferring to ALICE
            sui::transfer::public_transfer(escrow, ALICE);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_dst_escrow_with_sui_token_and_safety_deposit() {
        let mut scenario = ts::begin(BOB);
        
        ts::next_tx(&mut scenario, BOB);
        {
            let ctx = ts::ctx(&mut scenario);
            // For destination escrow with SUI, participants are swapped
            let immutables = create_test_immutables(
                generate_test_order_hash(),
                BOB,   // maker (swapped - BOB provides SUI on dst chain)
                ALICE, // taker (swapped - ALICE will receive SUI)
                @0x2,  // SUI token address (using @0x2 to represent SUI)
                TAKING_AMOUNT, // amount of SUI tokens
                DST_SAFETY_DEPOSIT, // SUI safety deposit
            );

            // Both token and safety deposit are SUI coins
            let sui_tokens = coin::mint_for_testing<SUI>(TAKING_AMOUNT, ctx);
            let safety_deposit = coin::mint_for_testing<SUI>(DST_SAFETY_DEPOSIT, ctx);
            
            let escrow = escrow_dst::new(
                sui_tokens,
                safety_deposit,
                immutables,
                RESCUE_DELAY,
                ctx
            );

            // Verify escrow properties
            // Token balance should be the main SUI amount
            assert!(escrow_dst::token_balance(&escrow) == TAKING_AMOUNT, 65);
            // Safety balance should be the safety deposit amount
            assert!(escrow_dst::safety_balance(&escrow) == DST_SAFETY_DEPOSIT, 66);
            assert!(escrow_dst::rescue_delay(&escrow) == RESCUE_DELAY, 67);

            // Get immutables and verify (participants should be swapped)
            let retrieved_immutables = escrow_dst::immutables(&escrow);
            assert!(base_escrow::maker(&retrieved_immutables) == BOB, 68);   // BOB is maker on dst
            assert!(base_escrow::taker(&retrieved_immutables) == ALICE, 69); // ALICE is taker on dst
            assert!(base_escrow::token(&retrieved_immutables) == @0x2, 70);  // SUI token address
            assert!(base_escrow::amount(&retrieved_immutables) == TAKING_AMOUNT, 71);
            assert!(base_escrow::safety_deposit(&retrieved_immutables) == DST_SAFETY_DEPOSIT, 72);

            // Verify total SUI locked in escrow (token + safety deposit)
            let total_sui_locked = escrow_dst::token_balance(&escrow) + escrow_dst::safety_balance(&escrow);
            assert!(total_sui_locked == TAKING_AMOUNT + DST_SAFETY_DEPOSIT, 73);

            // Clean up by transferring to BOB
            sui::transfer::public_transfer(escrow, BOB);
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
        assert!(std::vector::length(&sui_bytes) == 32, 74); // Sui addresses are 32 bytes
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
        assert!(hash1 == hash2, 75);
        
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
        assert!(hash1 != hash3, 76);
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
        assert!(true, 77);
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
        assert!(true, 78);
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