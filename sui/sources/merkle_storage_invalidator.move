module cross_chain_swap::merkle_storage_invalidator {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::hash;
    use std::vector;

    // Error codes
    const E_ALREADY_INVALIDATED: u64 = 1;
    const E_INVALID_PROOF: u64 = 2;
    const E_INVALID_INDEX: u64 = 3;

    /// Storage for tracking invalidated merkle nodes
    public struct MerkleInvalidator has key, store {
        id: UID,
        // Maps merkle root -> invalidated paths
        invalidated: Table<vector<u8>, Table<u64, bool>>,
    }

    /// Events
    public struct NodeInvalidated has copy, drop {
        merkle_root: vector<u8>,
        index: u64,
        hash: vector<u8>,
    }

    /// Initialize the merkle invalidator
    public fun new(ctx: &mut TxContext): MerkleInvalidator {
        MerkleInvalidator {
            id: object::new(ctx),
            invalidated: table::new(ctx),
        }
    }

    /// Invalidate a merkle node (used for partial fills)
    public fun invalidate(
        invalidator: &mut MerkleInvalidator,
        merkle_root: vector<u8>,
        proof: vector<vector<u8>>,
        index: u64,
        hash: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Verify the merkle proof
        assert!(verify_merkle_proof(&proof, &merkle_root, index, &hash), E_INVALID_PROOF);

        // Check if already invalidated
        if (!table::contains(&invalidator.invalidated, merkle_root)) {
            table::add(&mut invalidator.invalidated, merkle_root, table::new(ctx));
        };

        let root_table = table::borrow_mut(&mut invalidator.invalidated, merkle_root);
        assert!(!table::contains(root_table, index), E_ALREADY_INVALIDATED);

        // Mark as invalidated
        table::add(root_table, index, true);

        // Emit event
        sui::event::emit(NodeInvalidated {
            merkle_root,
            index,
            hash,
        });
    }

    /// Check if a node is invalidated
    public fun is_invalidated(
        invalidator: &MerkleInvalidator,
        merkle_root: &vector<u8>,
        index: u64
    ): bool {
        if (!table::contains(&invalidator.invalidated, *merkle_root)) {
            return false
        };

        let root_table = table::borrow(&invalidator.invalidated, *merkle_root);
        table::contains(root_table, index)
    }

    /// Verify merkle proof
    public fun verify_merkle_proof(
        proof: &vector<vector<u8>>,
        root: &vector<u8>,
        index: u64,
        leaf: &vector<u8>
    ): bool {
        let mut computed_hash = *leaf;
        let mut path = index;
        let proof_len = vector::length(proof);
        let mut i = 0;

        while (i < proof_len) {
            let proof_element = vector::borrow(proof, i);
            if (path % 2 == 0) {
                // Left side
                computed_hash = hash_pair(&computed_hash, proof_element);
            } else {
                // Right side  
                computed_hash = hash_pair(proof_element, &computed_hash);
            };
            path = path / 2;
            i = i + 1;
        };

        computed_hash == *root
    }

    /// Compute merkle root from leaves
    public fun compute_merkle_root(leaves: vector<vector<u8>>): vector<u8> {
        let len = vector::length(&leaves);
        assert!(len > 0, E_INVALID_INDEX);

        if (len == 1) {
            return *vector::borrow(&leaves, 0)
        };

        let mut current_level = leaves;
        
        while (vector::length(&current_level) > 1) {
            let mut next_level = vector::empty<vector<u8>>();
            let level_len = vector::length(&current_level);
            let mut i = 0;

            while (i < level_len) {
                if (i + 1 < level_len) {
                    let left = vector::borrow(&current_level, i);
                    let right = vector::borrow(&current_level, i + 1);
                    let parent = hash_pair(left, right);
                    vector::push_back(&mut next_level, parent);
                    i = i + 2;
                } else {
                    // Odd number of nodes, promote the last one
                    let last = *vector::borrow(&current_level, i);
                    vector::push_back(&mut next_level, last);
                    i = i + 1;
                };
            };

            current_level = next_level;
        };

        *vector::borrow(&current_level, 0)
    }

    /// Generate merkle proof for a given index
    public fun generate_merkle_proof(
        leaves: &vector<vector<u8>>,
        index: u64
    ): vector<vector<u8>> {
        let len = vector::length(leaves);
        assert!(index < len, E_INVALID_INDEX);

        let mut proof = vector::empty<vector<u8>>();
        let mut current_level = *leaves;
        let mut current_index = index;

        while (vector::length(&current_level) > 1) {
            let level_len = vector::length(&current_level);
            
            // Find sibling
            let sibling_index = if (current_index % 2 == 0) {
                // Current is left, sibling is right
                if (current_index + 1 < level_len) {
                    current_index + 1
                } else {
                    // No sibling (odd number of nodes)
                    current_index
                }
            } else {
                // Current is right, sibling is left
                current_index - 1
            };

            if (sibling_index < level_len && sibling_index != current_index) {
                let sibling = *vector::borrow(&current_level, sibling_index);
                vector::push_back(&mut proof, sibling);
            };

            // Build next level
            let mut next_level = vector::empty<vector<u8>>();
            let mut i = 0;

            while (i < level_len) {
                if (i + 1 < level_len) {
                    let left = vector::borrow(&current_level, i);
                    let right = vector::borrow(&current_level, i + 1);
                    let parent = hash_pair(left, right);
                    vector::push_back(&mut next_level, parent);
                    i = i + 2;
                } else {
                    let last = *vector::borrow(&current_level, i);
                    vector::push_back(&mut next_level, last);
                    i = i + 1;
                };
            };

            current_level = next_level;
            current_index = current_index / 2;
        };

        proof
    }

    /// Hash two nodes together (sorted order for consistency)
    fun hash_pair(a: &vector<u8>, b: &vector<u8>): vector<u8> {
        use std::vector;
        
        let mut combined = vector::empty<u8>();
        if (compare_bytes(a, b)) {
            // a <= b
            vector::append(&mut combined, *a);
            vector::append(&mut combined, *b);
        } else {
            // b < a
            vector::append(&mut combined, *b);
            vector::append(&mut combined, *a);
        };
        
        hash::keccak256(&combined)
    }

    /// Compare two byte vectors lexicographically
    fun compare_bytes(a: &vector<u8>, b: &vector<u8>): bool {
        let len_a = vector::length(a);
        let len_b = vector::length(b);
        let min_len = if (len_a < len_b) { len_a } else { len_b };
        
        let mut i = 0;
        while (i < min_len) {
            let byte_a = *vector::borrow(a, i);
            let byte_b = *vector::borrow(b, i);
            if (byte_a < byte_b) {
                return true
            } else if (byte_a > byte_b) {
                return false
            };
            i = i + 1;
        };
        
        // If all bytes are equal up to min_len, the shorter one is smaller
        len_a <= len_b
    }

    // Getter functions
    public fun uid(invalidator: &MerkleInvalidator): &UID {
        &invalidator.id
    }
} 