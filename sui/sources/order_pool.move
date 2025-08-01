module cross_chain_swap::order_pool {
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::dynamic_field as df;
    use sui::event;
    use sui::balance::{Self, Balance};
    use sui::hash::{Self};
    use sui::bcs::{Self};  
    use sui::ecdsa_k1::{Self};
    use sui::ed25519::{Self};
    use std::vector;
    use cross_chain_swap::base_escrow::{Self, Immutables};
    use cross_chain_swap::timelock::{Self};

    // ========== Error Codes ==========
    const E_ORDER_NOT_FOUND: u64 = 1;
    const E_ORDER_ALREADY_EXISTS: u64 = 2;
    const E_UNAUTHORIZED: u64 = 3;
    const E_ORDER_EXPIRED: u64 = 4;
    const E_ORDER_ALREADY_TAKEN: u64 = 5;
    const E_INVALID_SIGNATURE: u64 = 6;
    const E_INSUFFICIENT_FUNDS: u64 = 7;
    const E_ORDER_CANCELLED: u64 = 8;
    const E_INVALID_WHITELIST: u64 = 9;
    const E_HASH_MISMATCH: u64 = 10;

    // ========== Structs ==========

    /// Global order pool for managing pending cross-chain swap orders
    public struct OrderPool has key, store {
        id: UID,
        total_orders: u64,
        active_orders: u64,
        total_volume: u64,
    }

    /// Individual order stored in the pool
    public struct PendingOrder<phantom T> has key, store {
        id: UID,
        order_hash: vector<u8>,
        maker: address,
        tokens: Balance<T>,
        safety_deposit: Balance<SUI>,
        immutables_template: OrderImmutables, // Complete order information
        expiry: u64,
        status: u8, // 0: Active, 1: Taken, 2: Cancelled
        created_at: u64,
    }

    /// Complete order information (Fusion+ compatible)
    public struct OrderImmutables has copy, drop, store {
        // Core order identification
        order_hash: vector<u8>,
        hashlock: vector<u8>,
        salt: u256,
        nonce: u256,
        
        // Participants and assets
        maker: address,
        taker: address, // Will be filled by resolver
        maker_asset: address, // Source token
        taker_asset: address, // Destination token
        
        // Amounts
        making_amount: u64, // Amount maker provides
        taking_amount: u64, // Amount maker wants
        safety_deposit: u64,
        
        // Cross-chain information
        src_chain_id: u64,
        dst_chain_id: u64,
        src_safety_deposit: u64,
        dst_safety_deposit: u64,
        
        // Time constraints
        timelocks_data: u256,
        
        // Order options
        allow_partial_fills: bool,
        allow_multiple_fills: bool,
    }
    
    /// Auction configuration for competitive resolution
    public struct AuctionConfig has copy, drop, store {
        initial_rate_bump: u64, // Initial rate in basis points
        duration: u64, // Auction duration in seconds
        start_time: u64, // When auction starts
        resolving_start_time: u64, // When resolving can begin
    }
    
    /// Whitelist entry for allowed resolvers
    public struct WhitelistEntry has copy, drop, store {
        resolver: address,
        allow_from: u64, // Timestamp when this resolver can participate
    }

    /// Resolver bid for competing on orders
    public struct ResolverBid has copy, drop, store {
        resolver: address,
        bid_rate: u64, // Rate in basis points (e.g., 100 = 1%)
        expiry: u64,
        signature: vector<u8>,
    }

    // ========== Order Status Constants ==========
    const ORDER_STATUS_ACTIVE: u8 = 0;
    const ORDER_STATUS_TAKEN: u8 = 1;
    const ORDER_STATUS_CANCELLED: u8 = 2;

    // ========== Dynamic Field Keys ==========
    
    public struct OrderKey has copy, drop, store {
        order_hash: vector<u8>,
    }

    public struct BidsKey has copy, drop, store {
        order_hash: vector<u8>,
    }

    public struct StatsKey has copy, drop, store {}

    public struct PoolStats has store {
        total_orders_created: u64,
        total_volume: u64,
        active_orders: u64,
        completed_orders: u64,
    }

    // ========== Events ==========

    public struct OrderCreated has copy, drop {
        order_hash: vector<u8>,
        maker: address,
        token: address,
        amount: u64,
        expiry: u64,
        pool_id: address,
    }

    public struct OrderTaken has copy, drop {
        order_hash: vector<u8>,
        maker: address,
        taker: address,
        resolver: address,
        src_escrow_id: address,
    }

    public struct OrderCancelled has copy, drop {
        order_hash: vector<u8>,
        maker: address,
        refunded_amount: u64,
    }

    public struct ResolverBidPlaced has copy, drop {
        order_hash: vector<u8>,
        resolver: address,
        bid_rate: u64,
        expiry: u64,
    }

    // ========== Initialization ==========

    /// Initialize order pool
    fun init(ctx: &mut TxContext) {
        let mut pool = OrderPool {
            id: object::new(ctx),
            total_orders: 0,
            active_orders: 0,
            total_volume: 0,
        };

        // Initialize stats
        let stats = PoolStats {
            total_orders_created: 0,
            total_volume: 0,
            active_orders: 0,
            completed_orders: 0,
        };
        df::add(&mut pool.id, StatsKey {}, stats);

        // Share the pool
        transfer::public_share_object(pool);
    }

    // ========== User Functions ==========

    /// Create a simplified order for backward compatibility (deprecated)
    /// Use create_fusion_order for full Fusion+ functionality
    public fun create_order<T>(
        pool: &mut OrderPool,
        tokens: Coin<T>,
        safety_deposit: Coin<SUI>,
        order_hash: vector<u8>,
        hashlock: vector<u8>,
        token: address,
        amount: u64,
        safety_deposit_amount: u64,
        timelocks_data: u256,
        expiry: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): address {
        // Convert to full Fusion+ order with default values
        create_fusion_order<T>(
            pool,
            tokens,
            safety_deposit,
            order_hash,
            hashlock,
            0u256, // salt
            0u256, // nonce
            token, // maker_asset
            @0x0, // taker_asset (unknown)
            amount, // making_amount
            0u64, // taking_amount (unknown)
            safety_deposit_amount,
            1u64, // src_chain_id (default)
            2u64, // dst_chain_id (default)
            safety_deposit_amount, // src_safety_deposit
            safety_deposit_amount, // dst_safety_deposit
            timelocks_data,
            false, // allow_partial_fills
            false, // allow_multiple_fills
            expiry,
            clock,
            ctx
        )
    }

    /// Create a complete Fusion+ order with all necessary information
    /// This allows users to create orders that resolvers can compete for
    /// Validates orderHash consistency with SDK
    public fun create_fusion_order<T>(
        pool: &mut OrderPool,
        tokens: Coin<T>,
        safety_deposit: Coin<SUI>,
        // Core order identification
        order_hash: vector<u8>,
        hashlock: vector<u8>,
        salt: u256,
        nonce: u256,
        // Assets and amounts
        maker_asset: address,
        taker_asset: address,
        making_amount: u64,
        taking_amount: u64,
        safety_deposit_amount: u64,
        // Cross-chain information
        src_chain_id: u64,
        dst_chain_id: u64,
        src_safety_deposit: u64,
        dst_safety_deposit: u64,
        // Time constraints
        timelocks_data: u256,
        // Order options
        allow_partial_fills: bool,
        allow_multiple_fills: bool,
        expiry: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): address {
        let current_time = (clock::timestamp_ms(clock) / 1000);
        assert!(expiry > current_time, E_ORDER_EXPIRED);
        
        let order_key = OrderKey { order_hash };
        assert!(!df::exists_(&pool.id, order_key), E_ORDER_ALREADY_EXISTS);

        let maker = tx_context::sender(ctx);

        // ✅ Validate orderHash consistency with complete Fusion+ parameters
        validate_fusion_order_hash_consistency(
            order_hash,
            // Core order identification
            hashlock,
            salt,
            nonce,
            // Participants and assets
            maker,
            maker_asset,
            taker_asset,
            // Amounts
            making_amount,
            taking_amount,
            safety_deposit_amount,
            // Cross-chain information
            src_chain_id,
            dst_chain_id,
            src_safety_deposit,
            dst_safety_deposit,
            // Time constraints
            timelocks_data,
            // Auction configuration
            // Order options
            allow_partial_fills,
            allow_multiple_fills
        );

        // Create complete order immutables
        let immutables_template = OrderImmutables {
            order_hash,
            hashlock,
            salt,
            nonce,
            maker,
            taker: @0x0, // Will be filled by resolver
            maker_asset,
            taker_asset,
            making_amount,
            taking_amount,
            safety_deposit: safety_deposit_amount,
            src_chain_id,
            dst_chain_id,
            src_safety_deposit,
            dst_safety_deposit,
            timelocks_data,
            allow_partial_fills,
            allow_multiple_fills,
        };
        

        // Create pending order with complete information
        let mut pending_order = PendingOrder<T> {
            id: object::new(ctx),
            order_hash,
            maker,
            tokens: coin::into_balance(tokens),
            safety_deposit: coin::into_balance(safety_deposit),
            immutables_template,
            expiry,
            status: ORDER_STATUS_ACTIVE,
            created_at: current_time,
        };

        let order_id = object::id(&pending_order);
        let order_address = object::id_to_address(&order_id);

        // Store order in pool (not shared, owned by pool)
        df::add(&mut pool.id, order_key, pending_order);

        // Update stats
        let stats = df::borrow_mut<StatsKey, PoolStats>(&mut pool.id, StatsKey {});
        stats.total_orders_created = stats.total_orders_created + 1;
        stats.total_volume = stats.total_volume + making_amount;
        stats.active_orders = stats.active_orders + 1;

        pool.total_orders = pool.total_orders + 1;
        pool.active_orders = pool.active_orders + 1;
        pool.total_volume = pool.total_volume + making_amount;

        // Emit creation event
        event::emit(OrderCreated {
            order_hash,
            maker,
            token: maker_asset,
            amount: making_amount,
            expiry,
            pool_id: object::uid_to_address(&pool.id),
        });

        order_address
    }

    /// Cancel order and refund tokens to maker
    /// Only the maker can cancel their own order
    public fun cancel_order<T>(
        pool: &mut OrderPool,
        order_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let order_key = OrderKey { order_hash };
        assert!(df::exists_(&pool.id, order_key), E_ORDER_NOT_FOUND);
        
        // Remove order from pool to own it
        let order: PendingOrder<T> = df::remove(&mut pool.id, order_key);
        
        assert!(order.maker == tx_context::sender(ctx), E_UNAUTHORIZED);
        assert!(order.status == ORDER_STATUS_ACTIVE, E_ORDER_CANCELLED);

        // Update order status
        let PendingOrder {
            id,
            order_hash: _,
            maker,
            tokens,
            safety_deposit,
            immutables_template: _,
            expiry: _,
            status: _,
            created_at: _,
        } = order;

        let refunded_amount = balance::value(&tokens);

        // Refund tokens to maker
        let tokens_coin = coin::from_balance(tokens, ctx);
        let safety_coin = coin::from_balance(safety_deposit, ctx);
        transfer::public_transfer(tokens_coin, maker);
        transfer::public_transfer(safety_coin, maker);

        // Order already removed from pool above when we got it

        // Update stats
        let stats = df::borrow_mut<StatsKey, PoolStats>(&mut pool.id, StatsKey {});
        stats.active_orders = stats.active_orders - 1;

        pool.active_orders = pool.active_orders - 1;

        // Emit cancellation event
        event::emit(OrderCancelled {
            order_hash,
            maker,
            refunded_amount,
        });

        object::delete(id);
    }

    // ========== Resolver Functions ==========

    /// Resolver takes an order and creates srcEscrow
    /// This function integrates with escrow_factory to create the actual escrow
    public fun take_order_and_create_escrow<T>(
        pool: &mut OrderPool,
        order_hash: vector<u8>,
        factory: &mut cross_chain_swap::escrow_factory::Factory,
        factory_cap: &cross_chain_swap::escrow_factory::FactoryCap,
        resolver_address: address,
        clock: &Clock,
        ctx: &mut TxContext
    ): address {
        let order_key = OrderKey { order_hash };
        assert!(df::exists_(&pool.id, order_key), E_ORDER_NOT_FOUND);
        
        // Remove order from pool to own it
        let order: PendingOrder<T> = df::remove(&mut pool.id, order_key);
        
        assert!(order.status == ORDER_STATUS_ACTIVE, E_ORDER_ALREADY_TAKEN);
        
        let current_time = (clock::timestamp_ms(clock) / 1000);
        assert!(current_time < order.expiry, E_ORDER_EXPIRED);

        let maker = order.maker;

        // Destructure order
        let PendingOrder {
            id,
            order_hash: _,
            maker: _,
            tokens,
            safety_deposit,
            immutables_template,
            expiry: _,
            status: _,
            created_at: _,
        } = order;

        // Create full immutables with resolver as taker
        let timelocks = timelock::from_data(immutables_template.timelocks_data);
        let full_immutables = base_escrow::new_immutables(
            immutables_template.order_hash,
            immutables_template.hashlock,
            immutables_template.maker,
            resolver_address, // Resolver becomes the taker
            immutables_template.maker_asset,
            immutables_template.making_amount,
            immutables_template.safety_deposit,
            timelocks,
        );

        // Convert balances back to coins for escrow creation
        let tokens_coin = coin::from_balance(tokens, ctx);
        let safety_coin = coin::from_balance(safety_deposit, ctx);

        // Create srcEscrow through factory
        let src_escrow = cross_chain_swap::escrow_factory::create_src_escrow(
            factory,
            factory_cap,
            tokens_coin,
            safety_coin,
            full_immutables,
            clock,
            ctx
        );
        let src_escrow_address = object::id_to_address(&object::id(&src_escrow));
        
        // Transfer src_escrow to resolver (who created it and funded it)
        transfer::public_transfer(src_escrow, resolver_address);

        
        // Order already removed from pool above when we got it

        // Update stats
        let stats = df::borrow_mut<StatsKey, PoolStats>(&mut pool.id, StatsKey {});
        stats.active_orders = stats.active_orders - 1;
        stats.completed_orders = stats.completed_orders + 1;

        pool.active_orders = pool.active_orders - 1;

        // Emit order taken event
        event::emit(OrderTaken {
            order_hash,
            maker,
            taker: resolver_address,
            resolver: resolver_address,
            src_escrow_id: src_escrow_address,
        });

        object::delete(id);
        src_escrow_address
    }

    // ========== Query Functions ==========

    /// Check if order exists in pool
    public fun order_exists(
        pool: &OrderPool,
        order_hash: vector<u8>
    ): bool {
        let order_key = OrderKey { order_hash };
        df::exists_(&pool.id, order_key)
    }

    /// Get order details by hash (read-only access)
    public fun get_order_details_by_hash<T>(
        pool: &OrderPool,
        order_hash: vector<u8>
    ): (address, u64, u64, u8) {
        let order_key = OrderKey { order_hash };
        assert!(df::exists_(&pool.id, order_key), E_ORDER_NOT_FOUND);
        let order = df::borrow<OrderKey, PendingOrder<T>>(&pool.id, order_key);
        (
            order.maker,
            balance::value(&order.tokens),
            order.expiry,
            order.status
        )
    }

    /// Get pool statistics
    public fun get_pool_stats(pool: &OrderPool): (u64, u64, u64, u64) {
        let stats = df::borrow<StatsKey, PoolStats>(&pool.id, StatsKey {});
        (stats.total_orders_created, stats.total_volume, stats.active_orders, stats.completed_orders)
    }

    /// Get order details
    public fun get_order_details<T>(order: &PendingOrder<T>): (vector<u8>, address, u64, u64, u8) {
        (
            order.order_hash,
            order.maker,
            balance::value(&order.tokens),
            order.expiry,
            order.status
        )
    }


    // ========== Validation Functions ==========



    /// Validate orderHash consistency with complete Fusion+ parameters
    fun validate_fusion_order_hash_consistency(
        provided_order_hash: vector<u8>,
        // Core order identification
        hashlock: vector<u8>,
        salt: u256,
        nonce: u256,
        // Participants and assets
        maker: address,
        maker_asset: address,
        taker_asset: address,
        // Amounts
        making_amount: u64,
        taking_amount: u64,
        safety_deposit_amount: u64,
        // Cross-chain information
        src_chain_id: u64,
        dst_chain_id: u64,
        src_safety_deposit: u64,
        dst_safety_deposit: u64,
        // Time constraints
        timelocks_data: u256,
        // Order options
        allow_partial_fills: bool,
        allow_multiple_fills: bool
    ) {
        // ✅ Compute orderHash using complete Fusion+ parameters
        let computed_order_hash = compute_fusion_order_hash(
            hashlock,
            salt,
            nonce,
            maker,
            maker_asset,
            taker_asset,
            making_amount,
            taking_amount,
            safety_deposit_amount,
            src_chain_id,
            dst_chain_id,
            src_safety_deposit,
            dst_safety_deposit,
            timelocks_data,
            allow_partial_fills,
            allow_multiple_fills
        );

        // ✅ Verify provided orderHash matches complete Fusion+ hash
        assert!(provided_order_hash == computed_order_hash, E_INVALID_SIGNATURE);
    }

    /// Compute Sui-native orderHash optimized for cross-chain swaps (backward compatible)
    /// Simple, efficient, and deterministic hash generation
    fun compute_sui_order_hash(
        hashlock: vector<u8>,
        maker: address,
        token: address,
        amount: u64,
        safety_deposit_amount: u64,
        timelocks_data: u256
    ): vector<u8> {
        // ✅ Sui-native orderHash: Simple concatenation + keccak256
        // Format: keccak256(hashlock || maker || token || amount || safety_deposit || timelocks)
        
        let mut order_data = vector::empty<u8>();
        
        // Add all order components in fixed order
        order_data.append(hashlock);
        order_data.append(bcs::to_bytes(&maker));
        order_data.append(bcs::to_bytes(&token));
        order_data.append(bcs::to_bytes(&amount));
        order_data.append(bcs::to_bytes(&safety_deposit_amount));
        order_data.append(bcs::to_bytes(&timelocks_data));
        
        // Simple keccak256 hash - efficient and deterministic
        hash::keccak256(&order_data)
    }

    /// Compute complete Fusion+ orderHash with all parameters
    /// Compatible with 1inch CrossChainOrder structure
    fun compute_fusion_order_hash(
        // Core order identification
        hashlock: vector<u8>,
        salt: u256,
        nonce: u256,
        // Participants and assets
        maker: address,
        maker_asset: address,
        taker_asset: address,
        // Amounts
        making_amount: u64,
        taking_amount: u64,
        safety_deposit_amount: u64,
        // Cross-chain information
        src_chain_id: u64,
        dst_chain_id: u64,
        src_safety_deposit: u64,
        dst_safety_deposit: u64,
        // Time constraints
        timelocks_data: u256,
        // Order options
        allow_partial_fills: bool,
        allow_multiple_fills: bool
    ): vector<u8> {
        // ✅ Complete Fusion+ orderHash: All parameters included
        // Format: keccak256(all_fusion_parameters_concatenated)
        
        let mut order_data = vector::empty<u8>();
        
        // Core order identification
        order_data.append(hashlock);
        order_data.append(bcs::to_bytes(&salt));
        order_data.append(bcs::to_bytes(&nonce));
        
        // Participants and assets
        order_data.append(bcs::to_bytes(&maker));
        order_data.append(bcs::to_bytes(&maker_asset));
        order_data.append(bcs::to_bytes(&taker_asset));
        
        // Amounts
        order_data.append(bcs::to_bytes(&making_amount));
        order_data.append(bcs::to_bytes(&taking_amount));
        order_data.append(bcs::to_bytes(&safety_deposit_amount));
        
        // Cross-chain information
        order_data.append(bcs::to_bytes(&src_chain_id));
        order_data.append(bcs::to_bytes(&dst_chain_id));
        order_data.append(bcs::to_bytes(&src_safety_deposit));
        order_data.append(bcs::to_bytes(&dst_safety_deposit));
        
        // Time constraints
        order_data.append(bcs::to_bytes(&timelocks_data));
        
        // Order options
        order_data.append(bcs::to_bytes(&allow_partial_fills));
        order_data.append(bcs::to_bytes(&allow_multiple_fills));
        
        // Complete keccak256 hash with all Fusion+ parameters
        hash::keccak256(&order_data)
    }

    /// Public helper function for computing orderHash (accessible to other modules)
    public fun compute_order_hash(
        hashlock: vector<u8>,
        maker: address,
        token: address,
        amount: u64,
        safety_deposit_amount: u64,
        timelocks_data: u256
    ): vector<u8> {
        compute_sui_order_hash(
            hashlock,
            maker, 
            token,
            amount,
            safety_deposit_amount,
            timelocks_data
        )
    }

    /// Public helper function for computing complete Fusion+ orderHash
    public fun compute_fusion_order_hash_public(
        // Core order identification
        hashlock: vector<u8>,
        salt: u256,
        nonce: u256,
        // Participants and assets
        maker: address,
        maker_asset: address,
        taker_asset: address,
        // Amounts
        making_amount: u64,
        taking_amount: u64,
        safety_deposit_amount: u64,
        // Cross-chain information
        src_chain_id: u64,
        dst_chain_id: u64,
        src_safety_deposit: u64,
        dst_safety_deposit: u64,
        // Time constraints
        timelocks_data: u256,
        // Order options
        allow_partial_fills: bool,
        allow_multiple_fills: bool
    ): vector<u8> {
        compute_fusion_order_hash(
            hashlock,
            salt,
            nonce,
            maker,
            maker_asset,
            taker_asset,
            making_amount,
            taking_amount,
            safety_deposit_amount,
            src_chain_id,
            dst_chain_id,
            src_safety_deposit,
            dst_safety_deposit,
            timelocks_data,
            allow_partial_fills,
            allow_multiple_fills
        )
    }

    // ========== Test Helper Functions ==========

    #[test_only]
    public fun create_test_pool(ctx: &mut TxContext): OrderPool {
        let mut pool = OrderPool {
            id: object::new(ctx),
            total_orders: 0,
            active_orders: 0,
            total_volume: 0,
        };

        // Initialize stats for testing
        let stats = PoolStats {
            total_orders_created: 0,
            total_volume: 0,
            active_orders: 0,
            completed_orders: 0,
        };
        df::add(&mut pool.id, StatsKey {}, stats);

        pool
    }
} 