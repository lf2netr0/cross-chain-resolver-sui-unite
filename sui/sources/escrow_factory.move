module cross_chain_swap::escrow_factory {
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::dynamic_field as df;
    use sui::event;
    use sui::balance::{Self, Balance};
    use cross_chain_swap::base_escrow::{Self, Immutables};
    use cross_chain_swap::escrow_src::{Self};
    use cross_chain_swap::escrow_dst::{Self};
    use cross_chain_swap::timelock::{Self};

    // ========== One-Time Witness ==========
    public struct ESCROW_FACTORY has drop {}

    // ========== Error Codes ==========
    const E_ESCROW_EXISTS: u64 = 1;
    const E_FACTORY_MISMATCH: u64 = 2;
    const E_ESCROW_TYPE_MISMATCH: u64 = 3;
    const E_UNAUTHORIZED: u64 = 4;
    const E_INVALID_IMMUTABLES: u64 = 5;

    // ========== Capabilities ==========
    
    /// Global factory configuration (singleton)
    public struct Factory has key, store {
        id: UID,
        src_rescue_delay: u64,
        dst_rescue_delay: u64,
        admin: address,
    }

    /// Administrative capability
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Factory operation capability  
    public struct FactoryCap has key, store {
        id: UID,
        factory_id: address,
    }

    // ========== Dynamic Field Keys ==========
    
    public struct EscrowKey has copy, drop, store {
        order_hash: vector<u8>,
        is_src: bool,
    }

    public struct StatsKey has copy, drop, store {}

    public struct Stats has store {
        total_escrows_created: u64,
        total_volume: u64,
        active_escrows: u64,
        cross_chain_swaps: u64,
    }

    // ========== Events ==========
    
    public struct FactoryCreated has copy, drop {
        factory_id: address,
        admin: address,
    }

    public struct EscrowCreated has copy, drop {
        escrow_id: address,
        factory_id: address,
        order_hash: vector<u8>,
        is_src: bool,
        maker: address,
        taker: address,
        token_amount: u64,
        safety_amount: u64,
    }

    public struct CrossChainSwapInitiated has copy, drop {
        src_escrow_id: address,
        dst_escrow_id: address,
        order_hash: vector<u8>,
        maker: address,
        taker: address,
        src_token_amount: u64,
        dst_token_amount: u64,
    }

    // ========== Initialization ==========

    /// Initialize factory (called once via OTW)
    fun init(_otw: ESCROW_FACTORY, ctx: &mut TxContext) {
        let mut factory = Factory {
            id: object::new(ctx),
            src_rescue_delay: 86400, // 1 day default
            dst_rescue_delay: 86400, // 1 day default
            admin: tx_context::sender(ctx),
        };

        let factory_id = object::uid_to_address(&factory.id);

        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };

        // Create factory capability
        let factory_cap = FactoryCap {
            id: object::new(ctx),
            factory_id,
        };

        // Initialize stats
        let stats = Stats {
            total_escrows_created: 0,
            total_volume: 0,
            active_escrows: 0,
            cross_chain_swaps: 0,
        };
        df::add(&mut factory.id, StatsKey {}, stats);

        // Emit factory creation event
        event::emit(FactoryCreated {
            factory_id,
            admin: tx_context::sender(ctx),
        });

        // Transfer capabilities to creator
        transfer::public_transfer(admin_cap, tx_context::sender(ctx));
        transfer::public_transfer(factory_cap, tx_context::sender(ctx));
        
        // Share the factory
        transfer::public_share_object(factory);
    }

    // ========== Simplified Escrow Creation ==========
    
    /// Create source escrow for cross-chain swap
    /// This creates the escrow on the source chain (where tokens are initially locked)
    public fun create_src_escrow<T>(
        factory: &mut Factory,
        cap: &FactoryCap,
        tokens: Coin<T>,
        safety_deposit: Coin<SUI>,
        immutables: Immutables,
        clock: &Clock,
        ctx: &mut TxContext
    ): address {
        // Verify factory capability
        assert!(cap.factory_id == object::uid_to_address(&factory.id), E_FACTORY_MISMATCH);
        
        // Validate immutables hash to ensure consistency
        let order_hash = base_escrow::order_hash(&immutables);
        
        let escrow_key = EscrowKey { order_hash, is_src: true };
        assert!(!df::exists_(&factory.id, escrow_key), E_ESCROW_EXISTS);

        // Set deployment timestamp in timelocks
        let current_time = (clock::timestamp_ms(clock) / 1000) as u32;
        let updated_timelocks = timelock::set_deployed_at(base_escrow::timelocks(&immutables), current_time);
        let updated_immutables = base_escrow::new_immutables(
            base_escrow::order_hash(&immutables),
            base_escrow::hashlock(&immutables),
            base_escrow::maker(&immutables),
            base_escrow::taker(&immutables),
            base_escrow::token(&immutables),
            base_escrow::amount(&immutables),
            base_escrow::safety_deposit(&immutables),
            updated_timelocks,
        );

        // Create the source escrow
        let escrow = escrow_src::new(
            tokens,
            safety_deposit,
            updated_immutables,
            factory.src_rescue_delay,
            ctx
        );

        let escrow_id = object::id(&escrow);
        let escrow_address = object::id_to_address(&escrow_id);

        // Store escrow reference
        df::add(&mut factory.id, escrow_key, escrow_address);

        // Update stats
        let stats = df::borrow_mut<StatsKey, Stats>(&mut factory.id, StatsKey {});
        stats.total_escrows_created = stats.total_escrows_created + 1;
        stats.total_volume = stats.total_volume + base_escrow::amount(&updated_immutables);
        stats.active_escrows = stats.active_escrows + 1;

        // Emit creation event
        event::emit(EscrowCreated {
            escrow_id: escrow_address,
            factory_id: object::uid_to_address(&factory.id),
            order_hash,
            is_src: true,
            maker: base_escrow::maker(&updated_immutables),
            taker: base_escrow::taker(&updated_immutables),
            token_amount: base_escrow::amount(&updated_immutables),
            safety_amount: base_escrow::safety_deposit(&updated_immutables),
        });

        // Transfer escrow to its own address for access
        transfer::public_transfer(escrow, escrow_address);
        escrow_address
    }

    /// Create destination escrow for cross-chain swap
    /// This creates the escrow on the destination chain (where tokens will be received)
    public fun create_dst_escrow<T>(
        factory: &mut Factory,
        cap: &FactoryCap,
        tokens: Coin<T>,
        safety_deposit: Coin<SUI>,
        immutables: Immutables,
        clock: &Clock,
        ctx: &mut TxContext
    ): address {
        // Verify factory capability
        assert!(cap.factory_id == object::uid_to_address(&factory.id), E_FACTORY_MISMATCH);
        
        // Validate immutables hash to ensure consistency
        let order_hash = base_escrow::order_hash(&immutables);
        
        let escrow_key = EscrowKey { order_hash, is_src: false };
        assert!(!df::exists_(&factory.id, escrow_key), E_ESCROW_EXISTS);

        // Set deployment timestamp in timelocks
        let current_time = (clock::timestamp_ms(clock) / 1000) as u32;
        let updated_timelocks = timelock::set_deployed_at(base_escrow::timelocks(&immutables), current_time);
        let updated_immutables = base_escrow::new_immutables(
            base_escrow::order_hash(&immutables),
            base_escrow::hashlock(&immutables),
            base_escrow::maker(&immutables),
            base_escrow::taker(&immutables),
            base_escrow::token(&immutables),
            base_escrow::amount(&immutables),
            base_escrow::safety_deposit(&immutables),
            updated_timelocks,
        );

        // Create the destination escrow
        let escrow = escrow_dst::new(
            tokens,
            safety_deposit,
            updated_immutables,
            factory.dst_rescue_delay,
            ctx
        );

        let escrow_id = object::id(&escrow);
        let escrow_address = object::id_to_address(&escrow_id);

        // Store escrow reference
        df::add(&mut factory.id, escrow_key, escrow_address);

        // Update stats
        let stats = df::borrow_mut<StatsKey, Stats>(&mut factory.id, StatsKey {});
        stats.total_escrows_created = stats.total_escrows_created + 1;
        stats.total_volume = stats.total_volume + base_escrow::amount(&updated_immutables);
        stats.active_escrows = stats.active_escrows + 1;

        // Emit creation event
        event::emit(EscrowCreated {
            escrow_id: escrow_address,
            factory_id: object::uid_to_address(&factory.id),
            order_hash,
            is_src: false,
            maker: base_escrow::maker(&updated_immutables),
            taker: base_escrow::taker(&updated_immutables),
            token_amount: base_escrow::amount(&updated_immutables),
            safety_amount: base_escrow::safety_deposit(&updated_immutables),
        });

        // Transfer escrow to its own address for access
        transfer::public_transfer(escrow, escrow_address);
        escrow_address
    }

    /// Initiate cross-chain swap by creating both source and destination escrows
    /// This is a convenience function for atomic cross-chain swap setup
    public fun initiate_cross_chain_swap<TSrc, TDst>(
        factory: &mut Factory,
        cap: &FactoryCap,
        src_tokens: Coin<TSrc>,
        src_safety: Coin<SUI>,
        dst_tokens: Coin<TDst>,
        dst_safety: Coin<SUI>,
        src_immutables: Immutables,
        dst_immutables: Immutables,
        clock: &Clock,
        ctx: &mut TxContext
    ): (address, address) {
        // Verify that the immutables represent a valid cross-chain swap pair
        assert!(base_escrow::verify_cross_chain_compatibility(&src_immutables, &dst_immutables), E_INVALID_IMMUTABLES);

        // Create source escrow
        let src_escrow_id = create_src_escrow(
            factory,
            cap,
            src_tokens,
            src_safety,
            src_immutables,
            clock,
            ctx
        );

        // Create destination escrow
        let dst_escrow_id = create_dst_escrow(
            factory,
            cap,
            dst_tokens,
            dst_safety,
            dst_immutables,
            clock,
            ctx
        );

        // Update cross-chain swap counter
        let stats = df::borrow_mut<StatsKey, Stats>(&mut factory.id, StatsKey {});
        stats.cross_chain_swaps = stats.cross_chain_swaps + 1;

        // Emit cross-chain swap event
        event::emit(CrossChainSwapInitiated {
            src_escrow_id,
            dst_escrow_id,
            order_hash: base_escrow::order_hash(&src_immutables),
            maker: base_escrow::maker(&src_immutables),
            taker: base_escrow::taker(&src_immutables),
            src_token_amount: base_escrow::amount(&src_immutables),
            dst_token_amount: base_escrow::amount(&dst_immutables),
        });

        (src_escrow_id, dst_escrow_id)
    }

    // ========== Admin Functions ==========

    /// Update rescue delays (admin only)
    public fun update_rescue_delays(
        factory: &mut Factory,
        _admin_cap: &AdminCap,
        src_rescue_delay: u64,
        dst_rescue_delay: u64,
    ) {
        factory.src_rescue_delay = src_rescue_delay;
        factory.dst_rescue_delay = dst_rescue_delay;
    }

    /// Mint additional factory capability (admin only)
    public fun mint_factory_cap(
        factory: &Factory,
        _admin_cap: &AdminCap,
        ctx: &mut TxContext
    ): FactoryCap {
        FactoryCap {
            id: object::new(ctx),
            factory_id: object::uid_to_address(&factory.id),
        }
    }

    // ========== Query Functions ==========

    /// Get escrow address by order hash and type
    public fun get_escrow_address(
        factory: &Factory,
        order_hash: vector<u8>,
        is_src: bool
    ): Option<address> {
        let escrow_key = EscrowKey { order_hash, is_src };
        if (df::exists_(&factory.id, escrow_key)) {
            option::some(*df::borrow<EscrowKey, address>(&factory.id, escrow_key))
        } else {
            option::none()
        }
    }

    /// Get factory statistics
    public fun get_stats(factory: &Factory): (u64, u64, u64, u64) {
        let stats = df::borrow<StatsKey, Stats>(&factory.id, StatsKey {});
        (stats.total_escrows_created, stats.total_volume, stats.active_escrows, stats.cross_chain_swaps)
    }

    /// Check if escrow exists
    public fun escrow_exists(
        factory: &Factory,
        order_hash: vector<u8>,
        is_src: bool
    ): bool {
        let escrow_key = EscrowKey { order_hash, is_src };
        df::exists_(&factory.id, escrow_key)
    }

    /// Get factory rescue delays
    public fun get_rescue_delays(factory: &Factory): (u64, u64) {
        (factory.src_rescue_delay, factory.dst_rescue_delay)
    }

    /// Get factory admin address
    public fun get_admin(factory: &Factory): address {
        factory.admin
    }

    /// Get factory ID
    public fun get_factory_id(factory: &Factory): address {
        object::uid_to_address(&factory.id)
    }

    // ========== Package-only Functions ==========
    
    /// Remove escrow reference after completion (package-only for cleanup)
    public(package) fun remove_escrow_reference(
        factory: &mut Factory,
        order_hash: vector<u8>,
        is_src: bool,
    ) {
        let escrow_key = EscrowKey { order_hash, is_src };
        if (df::exists_(&factory.id, escrow_key)) {
            df::remove<EscrowKey, address>(&mut factory.id, escrow_key);
            
            let stats = df::borrow_mut<StatsKey, Stats>(&mut factory.id, StatsKey {});
            if (stats.active_escrows > 0) {
                stats.active_escrows = stats.active_escrows - 1;
            };
        };
    }

    // ========== Helper Functions ==========

    /// Validate that two immutables are compatible for cross-chain swap
    public fun validate_cross_chain_pair(
        src_immutables: &Immutables,
        dst_immutables: &Immutables
    ): bool {
        base_escrow::verify_cross_chain_compatibility(src_immutables, dst_immutables)
    }

    /// Generate order hash for cross-chain swap
    public fun generate_cross_chain_order_hash(
        maker: address,
        taker: address,
        src_token: address,
        dst_token: address,
        src_amount: u64,
        dst_amount: u64,
        salt: u64
    ): vector<u8> {
        base_escrow::generate_order_hash(
            maker,
            taker,
            src_token,
            dst_token,
            src_amount,
            dst_amount,
            salt
        )
    }

    // ========== Test Helper Functions ==========

    #[test_only]
    public fun create_test_factory(ctx: &mut TxContext): (Factory, AdminCap, FactoryCap) {
        let mut factory = Factory {
            id: object::new(ctx),
            src_rescue_delay: 604800, // 7 days
            dst_rescue_delay: 604800, // 7 days  
            admin: tx_context::sender(ctx),
        };

        let factory_id = object::uid_to_address(&factory.id);

        let admin_cap = AdminCap {
            id: object::new(ctx),
        };

        let factory_cap = FactoryCap {
            id: object::new(ctx),
            factory_id,
        };

        // Initialize stats
        let stats = Stats {
            total_escrows_created: 0,
            total_volume: 0,
            active_escrows: 0,
            cross_chain_swaps: 0,
        };
        df::add(&mut factory.id, StatsKey {}, stats);

        (factory, admin_cap, factory_cap)
    }

    #[test_only]
    public fun destroy_for_testing(factory: Factory) {
        let Factory { id, src_rescue_delay: _, dst_rescue_delay: _, admin: _ } = factory;
        object::delete(id);
    }
} 