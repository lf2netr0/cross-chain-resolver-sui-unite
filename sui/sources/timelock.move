module cross_chain_swap::timelock {
    use sui::clock::{Self, Clock};

    // Error codes
    const E_INVALID_TIME: u64 = 1;
    const E_INVALID_STAGE: u64 = 2;

    // Stage constants matching Solidity TimelocksLib::Stage enum
    const STAGE_SRC_WITHDRAWAL: u8 = 0;
    const STAGE_SRC_PUBLIC_WITHDRAWAL: u8 = 1; 
    const STAGE_SRC_CANCELLATION: u8 = 2;
    const STAGE_SRC_PUBLIC_CANCELLATION: u8 = 3;
    const STAGE_DST_WITHDRAWAL: u8 = 4;
    const STAGE_DST_PUBLIC_WITHDRAWAL: u8 = 5;
    const STAGE_DST_CANCELLATION: u8 = 6;

    // Bitmasks and offsets for packed timelocks
    const DEPLOYED_AT_MASK: u256 = 0xffffffff00000000000000000000000000000000000000000000000000000000;
    const DEPLOYED_AT_OFFSET: u8 = 224;
    const STAGE_OFFSET: u8 = 32;

    /// Compact representation of all timelocks
    public struct Timelocks has copy, drop, store {
        data: u256
    }

    /// Create new timelocks with deployment timestamp
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
        let data = ((deployed_at as u256) << DEPLOYED_AT_OFFSET) |
                   ((src_withdrawal as u256) << (0 * STAGE_OFFSET)) |
                   ((src_public_withdrawal as u256) << (1 * STAGE_OFFSET)) |
                   ((src_cancellation as u256) << (2 * STAGE_OFFSET)) |
                   ((src_public_cancellation as u256) << (3 * STAGE_OFFSET)) |
                   ((dst_withdrawal as u256) << (4 * STAGE_OFFSET)) |
                   ((dst_public_withdrawal as u256) << (5 * STAGE_OFFSET)) |
                   ((dst_cancellation as u256) << (6 * STAGE_OFFSET));
        
        Timelocks { data }
    }

    /// Set deployment timestamp
    public fun set_deployed_at(timelocks: &mut Timelocks, deployed_at: u32) {
        let mask_inv = 0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        let cleared = timelocks.data & mask_inv;
        timelocks.data = cleared | (((deployed_at as u256) << DEPLOYED_AT_OFFSET));
    }

    /// Get timelock value for specific stage
    public fun get(timelocks: &Timelocks, stage: u8): u64 {
        assert!(stage <= STAGE_DST_CANCELLATION, E_INVALID_STAGE);
        
        let deployed_at = (timelocks.data >> DEPLOYED_AT_OFFSET) as u64;
        let stage_offset = (stage * STAGE_OFFSET);
        let stage_value = ((timelocks.data >> stage_offset) & 0xffffffff) as u64;
        
        deployed_at + stage_value
    }

    /// Get rescue start time
    public fun rescue_start(timelocks: &Timelocks, rescue_delay: u64): u64 {
        let deployed_at = (timelocks.data >> DEPLOYED_AT_OFFSET) as u64;
        deployed_at + rescue_delay
    }

    /// Check if current time is after the specified timelock
    public fun check_after(timelocks: &Timelocks, stage: u8, clock: &Clock) {
        let required_time = get(timelocks, stage);
        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds
        assert!(current_time >= required_time, E_INVALID_TIME);
    }

    /// Check if current time is before the specified timelock
    public fun check_before(timelocks: &Timelocks, stage: u8, clock: &Clock) {
        let required_time = get(timelocks, stage);
        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds
        assert!(current_time < required_time, E_INVALID_TIME);
    }

    // Stage constants for public access
    public fun src_withdrawal(): u8 { STAGE_SRC_WITHDRAWAL }
    public fun src_public_withdrawal(): u8 { STAGE_SRC_PUBLIC_WITHDRAWAL }
    public fun src_cancellation(): u8 { STAGE_SRC_CANCELLATION }
    public fun src_public_cancellation(): u8 { STAGE_SRC_PUBLIC_CANCELLATION }
    public fun dst_withdrawal(): u8 { STAGE_DST_WITHDRAWAL }
    public fun dst_public_withdrawal(): u8 { STAGE_DST_PUBLIC_WITHDRAWAL }
    public fun dst_cancellation(): u8 { STAGE_DST_CANCELLATION }
} 