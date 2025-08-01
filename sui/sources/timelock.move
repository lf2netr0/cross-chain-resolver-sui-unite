module cross_chain_swap::timelock {
    use sui::clock::{Self, Clock};

    // Error codes
    const E_INVALID_TIME: u64 = 1;
    const E_INVALID_STAGE: u64 = 2;

    // Stage constants matching EVM TimelocksLib::Stage enum exactly
    const STAGE_SRC_WITHDRAWAL: u8 = 0;
    const STAGE_SRC_PUBLIC_WITHDRAWAL: u8 = 1; 
    const STAGE_SRC_CANCELLATION: u8 = 2;
    const STAGE_SRC_PUBLIC_CANCELLATION: u8 = 3;
    const STAGE_DST_WITHDRAWAL: u8 = 4;
    const STAGE_DST_PUBLIC_WITHDRAWAL: u8 = 5;
    const STAGE_DST_CANCELLATION: u8 = 6;

    // Bitmasks and offsets matching EVM TimelocksLib exactly
    const DEPLOYED_AT_MASK: u256 = 0xffffffff00000000000000000000000000000000000000000000000000000000;
    const DEPLOYED_AT_OFFSET: u8 = 224;
    const STAGE_BIT_SIZE: u8 = 32;

    /// Timelocks type matching EVM implementation exactly
    /// Stores timelocks in a compact uint256 format
    public struct Timelocks has copy, drop, store {
        data: u256
    }

    /// Stage enum matching EVM TimelocksLib::Stage
    public struct Stage has copy, drop, store {
        value: u8
    }

    // ========== Stage Constructors (matching EVM enum) ==========

    public fun src_withdrawal(): Stage {
        Stage { value: STAGE_SRC_WITHDRAWAL }
    }

    public fun src_public_withdrawal(): Stage {
        Stage { value: STAGE_SRC_PUBLIC_WITHDRAWAL }
    }

    public fun src_cancellation(): Stage {
        Stage { value: STAGE_SRC_CANCELLATION }
    }

    public fun src_public_cancellation(): Stage {
        Stage { value: STAGE_SRC_PUBLIC_CANCELLATION }
    }

    public fun dst_withdrawal(): Stage {
        Stage { value: STAGE_DST_WITHDRAWAL }
    }

    public fun dst_public_withdrawal(): Stage {
        Stage { value: STAGE_DST_PUBLIC_WITHDRAWAL }
    }

    public fun dst_cancellation(): Stage {
        Stage { value: STAGE_DST_CANCELLATION }
    }

    // ========== Core Functions (matching EVM TimelocksLib) ==========

    /// Create new timelocks with all timing parameters
    /// Parameters are relative seconds from deployment time
    public fun new(
        src_withdrawal: u32,
        src_public_withdrawal: u32, 
        src_cancellation: u32,
        src_public_cancellation: u32,
        dst_withdrawal: u32,
        dst_public_withdrawal: u32,
        dst_cancellation: u32,
        deployed_at: u32
    ): Timelocks {
        let data = ((deployed_at as u256) << (DEPLOYED_AT_OFFSET as u8)) |
                   ((src_withdrawal as u256) << (0 * STAGE_BIT_SIZE as u8)) |
                   ((src_public_withdrawal as u256) << (1 * STAGE_BIT_SIZE as u8)) |
                   ((src_cancellation as u256) << (2 * STAGE_BIT_SIZE as u8)) |
                   ((src_public_cancellation as u256) << (3 * STAGE_BIT_SIZE as u8)) |
                   ((dst_withdrawal as u256) << (4 * STAGE_BIT_SIZE as u8)) |
                   ((dst_public_withdrawal as u256) << (5 * STAGE_BIT_SIZE as u8)) |
                   ((dst_cancellation as u256) << (6 * STAGE_BIT_SIZE as u8));
        
        Timelocks { data }
    }

    /// Set deployment timestamp (matching EVM setDeployedAt)
    public fun set_deployed_at(timelocks: Timelocks, deployed_at: u32): Timelocks {
        let inverse_mask = 0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        let cleared_data = timelocks.data & inverse_mask;
        let new_deployed_at = (deployed_at as u256) << (DEPLOYED_AT_OFFSET as u8);
        
        Timelocks { 
            data: cleared_data | new_deployed_at 
        }
    }

    /// Get timelock value for specific stage (matching EVM get function)
    /// Returns the absolute timestamp when the stage becomes active
    public fun get(timelocks: &Timelocks, stage: Stage): u64 {
        let data = timelocks.data;
        let bit_shift = (stage.value as u8) * STAGE_BIT_SIZE;
        let deployed_at = (data >> (DEPLOYED_AT_OFFSET as u8)) as u64;
        let relative_time = ((data >> (bit_shift as u8)) & 0xffffffff) as u64;
        
        deployed_at + relative_time
    }

    /// Get rescue start time (matching EVM rescueStart function)
    public fun rescue_start(timelocks: &Timelocks, rescue_delay: u64): u64 {
        let deployed_at = (timelocks.data >> (DEPLOYED_AT_OFFSET as u8)) as u64;
        deployed_at + rescue_delay
    }

    /// Get deployment timestamp
    public fun deployed_at(timelocks: &Timelocks): u64 {
        (timelocks.data >> (DEPLOYED_AT_OFFSET as u8)) as u64
    }

    // ========== Validation Functions ==========

    /// Check if current time is after specified stage time
    public fun check_after(timelocks: &Timelocks, stage: Stage, clock: &Clock) {
        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds
        let required_time = get(timelocks, stage);
        assert!(current_time >= required_time, E_INVALID_TIME);
    }

    /// Check if current time is before specified stage time
    public fun check_before(timelocks: &Timelocks, stage: Stage, clock: &Clock) {
        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds
        let required_time = get(timelocks, stage);
        assert!(current_time < required_time, E_INVALID_TIME);
    }

    /// Check if rescue period has started
    public fun check_rescue_time(timelocks: &Timelocks, rescue_delay: u64, clock: &Clock) {
        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds
        let rescue_time = rescue_start(timelocks, rescue_delay);
        assert!(current_time >= rescue_time, E_INVALID_TIME);
    }

    // ========== Utility Functions ==========

    /// Create default timelocks for testing
    #[test_only]
    public fun new_for_testing(): Timelocks {
        new(
            3600,   // src_withdrawal: 1 hour
            7200,   // src_public_withdrawal: 2 hours  
            10800,  // src_cancellation: 3 hours
            14400,  // src_public_cancellation: 4 hours
            1800,   // dst_withdrawal: 30 minutes
            3600,   // dst_public_withdrawal: 1 hour
            5400,   // dst_cancellation: 1.5 hours
            0       // deployed_at: will be set when deployed
        )
    }

    /// Create timelocks with current timestamp as deployment time
    public fun new_with_current_time(
        src_withdrawal: u32,
        src_public_withdrawal: u32, 
        src_cancellation: u32,
        src_public_cancellation: u32,
        dst_withdrawal: u32,
        dst_public_withdrawal: u32,
        dst_cancellation: u32,
        clock: &Clock
    ): Timelocks {
        let current_time = (clock::timestamp_ms(clock) / 1000) as u32;
        
        new(
            src_withdrawal,
            src_public_withdrawal,
            src_cancellation,
            src_public_cancellation,
            dst_withdrawal,
            dst_public_withdrawal,
            dst_cancellation,
            current_time
        )
    }

    /// Get all stage times for debugging
    #[test_only]
    public fun get_all_stages(timelocks: &Timelocks): (u64, u64, u64, u64, u64, u64, u64) {
        (
            get(timelocks, src_withdrawal()),
            get(timelocks, src_public_withdrawal()),
            get(timelocks, src_cancellation()),
            get(timelocks, src_public_cancellation()),
            get(timelocks, dst_withdrawal()),
            get(timelocks, dst_public_withdrawal()),
            get(timelocks, dst_cancellation())
        )
    }

    /// Check if stage value is valid
    public fun is_valid_stage(stage: &Stage): bool {
        stage.value <= STAGE_DST_CANCELLATION
    }

    /// Convert stage to u8 for external use
    public fun stage_to_u8(stage: &Stage): u8 {
        stage.value
    }

    /// Create timelocks from raw data (for TypeScript integration)
    public fun from_data(data: u256): Timelocks {
        Timelocks { data }
    }

    /// Get raw data from timelocks (for testing and integration)
    public fun get_data(timelocks: &Timelocks): u256 {
        timelocks.data
    }
} 