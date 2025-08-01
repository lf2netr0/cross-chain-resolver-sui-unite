// Note: Install @mysten/sui.js package first: pnpm install @mysten/sui.js

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { keccak256, toUtf8Bytes, concat, hexlify, zeroPadValue, toBeHex } from 'ethers';
import { bcs } from '@mysten/sui/bcs';

export interface SuiConfig {
    network: 'localnet' | 'devnet' | 'testnet' | 'mainnet';
    packageId?: string;
    factoryId?: string;
    capId?: string;
    merkleInvalidatorId?: string;
    poolId?: string; // OrderPool for resolver competition
}

// New Immutables structure matching the Move contract
export interface SuiImmutables {
    order_hash: number[];
    hashlock: number[];
    maker: string;
    taker: string;
    token: string;
    amount: string;
    safety_deposit: string;
    timelocks: SuiTimelocks;
}

export interface SuiTimelocks {
    data: bigint; // u256 packed timelock data
}

export class SuiCrossChainClient {
    public client: SuiClient;
    public keypair: Ed25519Keypair;
    public config: SuiConfig;

    constructor(privateKey: string, config: SuiConfig) {
        this.client = new SuiClient({ url: getFullnodeUrl(config.network) });
        
        // Handle both 32-byte and 33-byte keys (33-byte keys often have a version prefix)
        const keyBuffer = Buffer.from(privateKey, 'base64');
        const secretKey = keyBuffer.length === 33 ? keyBuffer.slice(1) : keyBuffer;
        
        if (secretKey.length !== 32) {
            throw new Error(`Invalid secret key length: expected 32 bytes, got ${secretKey.length}`);
        }
        
        this.keypair = Ed25519Keypair.fromSecretKey(secretKey);
        this.config = config;
    }

    // Publish Sui package (like deploying EVM contracts)
    async publishPackage(): Promise<string> {
        if (this.config.packageId) {
            console.log(`[SUI] Package already published: ${this.config.packageId}`);
            return this.config.packageId;
        }

        console.log(`[SUI] Publishing new package...`);
        
        try {
            // Build the package first
            const buildResult = execSync('sui move build', { 
                cwd: path.join(process.cwd(), 'sui'),
                stdio: 'pipe',
                encoding: 'utf8'
            });
            console.log(`[SUI] Package built successfully`);

            // Create transaction to publish
            const tx = new Transaction();
            const packagePath = path.join(process.cwd(), 'sui');
            
            // Read compiled modules
            const compiledModulesPath = path.join(packagePath, 'build', 'cross_chain_swap', 'bytecode_modules');
            const modules = this.readCompiledModules(compiledModulesPath);
            
            // Publish the package
            const [upgradeCap] = tx.publish({
                modules: modules.map(module => Array.from(module)),
                dependencies: [
                    '0x1', // std
                    '0x2', // sui
                ],
            });
            
            // Transfer upgrade capability to sender
            tx.transferObjects([upgradeCap], this.address);

            const result = await this.signAndExecuteWithGas(tx, 10000000000); // 10 SUI for publishing
            
            // Extract package ID from published event
            const publishEvent = result.events?.find(event => 
                event.type === 'publish'
            );
            
            if (publishEvent && publishEvent.parsedJson) {
                const packageId = (publishEvent.parsedJson as any).packageId;
                this.config.packageId = packageId;
                console.log(`[SUI] Package published successfully: ${packageId}`);
                return packageId;
            }

            // Fallback: look for created objects
            const created = result.objectChanges?.filter(change => change.type === 'published') || [];
            if (created.length > 0) {
                const packageId = (created[0] as any).packageId;
                this.config.packageId = packageId;
                console.log(`[SUI] Package published successfully: ${packageId}`);
                return packageId;
            }

            throw new Error('Could not extract package ID from publish result');

        } catch (error) {
            console.error(`[SUI] Package publish failed:`, error.message);
            throw error;
        }
    }

    // Find OrderPool shared object after package deployment
    async findOrderPool(): Promise<string | undefined> {
        if (!this.config.packageId) {
            throw new Error('Package ID not available')
        }

        console.log(`[SUI] Looking for OrderPool shared object...`)
        
        try {
            // Wait a bit for the objects to be indexed
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Since OrderPool is a shared object, we need to check the transaction that published the package
            // Look for the publish transaction first
            const publishTxs = await this.client.queryTransactionBlocks({
                filter: { FromAddress: this.address },
                options: { showEffects: true, showObjectChanges: true },
                limit: 20 // Increase limit to find publish transaction
            })

            for (const txData of publishTxs.data) {
                const tx = await this.client.getTransactionBlock({
                    digest: txData.digest,
                    options: { showEffects: true, showObjectChanges: true }
                })
                
                // Look for package publish and OrderPool creation in the same transaction
                const packagePublished = tx.objectChanges?.some(change => 
                    change.type === 'published' && 
                    (change as any).packageId === this.config.packageId
                )

                if (packagePublished) {
                    // In the same transaction, look for OrderPool creation
                    const createdObjects = tx.objectChanges?.filter(change => 
                        change.type === 'created' && 
                        change.objectType?.includes('order_pool::OrderPool')
                    ) || []

                    if (createdObjects.length > 0) {
                        const poolId = (createdObjects[0] as any).objectId
                        console.log(`[SUI] Found OrderPool created in publish transaction: ${poolId}`)
                        this.config.poolId = poolId
                        return poolId
                    }
                }
            }

            console.log(`[SUI] OrderPool not found in publish transaction, checking all recent transactions...`)
            
            // Alternative: Check all recent transactions for OrderPool creation
            const allTxs = await this.client.queryTransactionBlocks({
                filter: { FromAddress: this.address },
                options: { showEffects: true, showObjectChanges: true },
                limit: 30 // Increase limit
            })

            for (const txData of allTxs.data) {
                const tx = await this.client.getTransactionBlock({
                    digest: txData.digest,
                    options: { showEffects: true, showObjectChanges: true }
                })
                
                const createdObjects = tx.objectChanges?.filter(change => 
                    change.type === 'created' && 
                    change.objectType?.includes('order_pool::OrderPool')
                ) || []

                if (createdObjects.length > 0) {
                    const poolId = (createdObjects[0] as any).objectId
                    console.log(`[SUI] Found OrderPool in transaction: ${poolId}`)
                    this.config.poolId = poolId
                    return poolId
                }
            }

            console.log(`[SUI] OrderPool not available, falling back to direct escrow mode`)
            return undefined
            
        } catch (error) {
            console.log(`[SUI] Error finding OrderPool: ${error?.message}`)
            return undefined
        }
    }


    private readCompiledModules(modulesPath: string): Uint8Array[] {
        try {
            const files = execSync(`ls ${modulesPath}/*.mv`, { encoding: 'utf8' }).trim().split('\n');
            return files.map(file => {
                const content = readFileSync(file.trim());
                return new Uint8Array(content);
            });
        } catch (error) {
            throw new Error(`Failed to read compiled modules: ${error.message}`);
        }
    }

    get address(): string {
        return this.keypair.toSuiAddress();
    }

    // Check if localnet is running and has gas
    async checkLocalnetReady(): Promise<boolean> {
        try {
            if (this.config.network !== 'localnet') {
                return true; // Skip check for non-localnet
            }

            // Check if we can connect and get balance
            const balance = await this.getBalance('0x2::sui::SUI');
            const balanceAmount = BigInt(balance);
            
            if (balanceAmount < 1000000000n) { // Less than 1 SUI
                console.log(`[SUI] Warning: Low balance (${balance}), may need to fund account`);
                console.log(`[SUI] Use: sui client faucet --address ${this.address}`);
            }
            
            return true;
        } catch (error) {
            console.error(`[SUI] Localnet check failed:`, error.message);
            console.log(`[SUI] Make sure localnet is running: sui start`);
            console.log(`[SUI] Then fund your account: sui client faucet --address ${this.address}`);
            return false;
        }
    }

    async getBalance(coinType: string = '0x2::sui::SUI'): Promise<string> {
        const balance = await this.client.getBalance({
            owner: this.address,
            coinType,
        });
        return balance.totalBalance;
    }

    async getCoins(coinType: string = '0x2::sui::SUI', amount?: bigint): Promise<string[]> {
        const coins = await this.client.getCoins({
            owner: this.address,
            coinType,
        });

        if (amount) {
            // Select coins that sum up to the required amount
            let totalValue = 0n;
            const selectedCoins: string[] = [];
            
            for (const coin of coins.data) {
                selectedCoins.push(coin.coinObjectId);
                totalValue += BigInt(coin.balance);
                if (totalValue >= amount) break;
            }
            
            if (totalValue < amount) {
                throw new Error(`Insufficient balance. Required: ${amount}, Available: ${totalValue}`);
            }
            
            return selectedCoins;
        }

        return coins.data.map(coin => coin.coinObjectId);
    }

    // Create test timelocks - helper function
    createTestTimelocks(): SuiTimelocks {
        // For testing, use simple packed timelock data
        // In production, this would use proper bit packing like EVM TimelocksLib
        return {
            data: "0" // Simplified for testing
        };
    }

    // Convert hex string to number array for Move calls
    public hexToNumberArray(hex: string): number[] {
        // Remove 0x prefix if present
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        // Convert to bytes
        const bytes: number[] = [];
        for (let i = 0; i < cleanHex.length; i += 2) {
            bytes.push(parseInt(cleanHex.substr(i, 2), 16));
        }
        return bytes;
    }


    // Generate real timelock data based on current time
    generateTimelocks(
        srcWithdrawal: number = 10,      // 10s after deployment
        srcPublicWithdrawal: number = 120, // 120s after deployment  
        srcCancellation: number = 300,   // 300s after deployment (5 minutes)
        srcPublicCancellation: number = 400, // 400s after deployment
        dstWithdrawal: number = 10,      // 10s after deployment
        dstPublicWithdrawal: number = 100, // 100s after deployment
        dstCancellation: number = 300    // 300s after deployment (5 minutes)
    ): SuiTimelocks {
        const currentTime = Math.floor(Date.now() / 1000)
        const deployedAt = currentTime
        
        // Pack timelock data according to the Move contract structure
        const timelocksData = (BigInt(deployedAt) << BigInt(224)) |
                              BigInt(srcWithdrawal) |
                              (BigInt(srcPublicWithdrawal) << BigInt(32)) |
                              (BigInt(srcCancellation) << BigInt(64)) |
                              (BigInt(srcPublicCancellation) << BigInt(96)) |
                              (BigInt(dstWithdrawal) << BigInt(128)) |
                              (BigInt(dstPublicWithdrawal) << BigInt(160)) |
                              (BigInt(dstCancellation) << BigInt(192))
        
        return { data: timelocksData }
    }

    // Create Immutables structure for Sui
    createSuiImmutables(
        orderHash: string,
        hashlock: string,
        maker: string,
        taker: string,
        token: string,
        amount: string,
        safetyDeposit: string
    ): SuiImmutables {
        return {
            order_hash: this.hexToNumberArray(orderHash),
            hashlock: this.hexToNumberArray(hashlock),
            maker,
            taker,
            token,
            amount,
            safety_deposit: safetyDeposit,
            timelocks: this.generateTimelocks() // Use proper timelock generation
        };
    }

    // Factory operations - get factory from package deployment
    async initFactory(srcRescueDelay: number, dstRescueDelay: number): Promise<{factoryId: string, capId: string}> {
        // Ensure package is published first
        if (!this.config.packageId) {
            await this.publishPackage();
        }

        try {
            // Wait a bit for the init function to complete and objects to be indexed
            console.log(`[SUI] Waiting for init function to complete...`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Query for FactoryCap objects (created during init)
            let capObjects = await this.client.getOwnedObjects({
                owner: this.address,
                filter: {
                    MatchAll: [
                        {
                            StructType: `${this.config.packageId}::escrow_factory::FactoryCap`
                        }
                    ]
                },
                options: {
                    showContent: true,
                    showType: true,
                }
            });

            console.log(`[SUI] Found ${capObjects.data.length} capability objects`);

            // If no capabilities found, try a few more times with delays
            let retries = 0;
            while (capObjects.data.length === 0 && retries < 3) {
                console.log(`[SUI] Retrying capability query (attempt ${retries + 1}/3)...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                capObjects = await this.client.getOwnedObjects({
                    owner: this.address,
                    filter: {
                        MatchAll: [
                            {
                                StructType: `${this.config.packageId}::escrow_factory::FactoryCap`
                            }
                        ]
                    },
                    options: {
                        showContent: true,
                        showType: true,
                    }
                });
                
                console.log(`[SUI] Found ${capObjects.data.length} capability objects on retry`);
                retries++;
            }

            if (capObjects.data.length > 0) {
                // Get the factory ID from the capability
                const capData = capObjects.data[0].data?.content as any;
                const factoryId = capData?.fields?.factory_id;
                
                if (factoryId) {
                    console.log(`[SUI] Found factory: ${factoryId}`);
                    return {
                        factoryId: factoryId,
                        capId: capObjects.data[0].data?.objectId || '',
                    };
                }
            }

            // Fallback: scan recent transactions for factory creation events
            console.log(`[SUI] Trying fallback: scanning for FactoryCreated events...`);
            const events = await this.client.queryEvents({
                query: {
                    MoveEventType: `${this.config.packageId}::escrow_factory::FactoryCreated`
                },
                limit: 10,
                order: 'descending'
            });

            console.log(`[SUI] Found ${events.data.length} factory creation events`);
            
            if (events.data.length > 0) {
                const eventData = events.data[0].parsedJson as any;
                const factoryId = eventData.factory_id;
                
                // Find the corresponding capability
                const allCaps = await this.client.getOwnedObjects({
                    owner: this.address,
                    filter: {
                        MatchAll: [
                            {
                                StructType: `${this.config.packageId}::escrow_factory::FactoryCap`
                            }
                        ]
                    },
                    options: {
                        showContent: true,
                        showType: true,
                    }
                });

                console.log(`[SUI] Found ${allCaps.data.length} capabilities in fallback search`);

                if (allCaps.data.length > 0) {
                    console.log(`[SUI] Using capability from fallback search: ${factoryId}`);
                    return {
                        factoryId: factoryId,
                        capId: allCaps.data[0].data?.objectId || '',
                    };
                }
            }

            throw new Error('No factory found after package deployment and retries');

        } catch (error) {
            console.error(`[SUI] Factory initialization failed:`, error.message);
            throw error;
        }
    }

    // Source escrow operations using simplified coin allocation
    async createSrcEscrow<T>(
        factoryId: string,
        capId: string,
        tokenAmount: string,
        safetyAmount: string,
        immutables: SuiImmutables,
        coinType: string = '0x2::sui::SUI'
    ): Promise<string> {
        const tx = new Transaction();

        // Simplified coin allocation using tx.gas split
        const coins = tx.splitCoins(tx.gas, [
            tx.pure.u64(tokenAmount),
            tx.pure.u64(safetyAmount)
        ]);
        const escrowObject = tx.moveCall({
            target: `${this.config.packageId}::escrow_factory::create_src_escrow_with_fields`,
            typeArguments: [coinType],
            arguments: [
                tx.object(factoryId),
                tx.object(capId),
                coins[0],
                coins[1],
                // Pass immutables as individual fields
                tx.pure.vector('u8', immutables.order_hash),
                tx.pure.vector('u8', immutables.hashlock),
                tx.pure.address(immutables.maker),
                tx.pure.address(immutables.taker),
                tx.pure.address(immutables.token),
                tx.pure.u64(immutables.amount),
                tx.pure.u64(immutables.safety_deposit),
                tx.pure.u256(immutables.timelocks.data),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        // Transfer the escrow object to the caller to avoid UnusedValueWithoutDrop error
        tx.transferObjects([escrowObject], tx.pure.address(this.address));

        const result = await this.signAndExecuteWithGas(tx, 100000000); // 0.1 SUI gas budget
        return this.extractEscrowId(result);
    }

    // Destination escrow operations using simplified coin allocation
    async createDstEscrow<T>(
        factoryId: string,
        capId: string,
        tokenAmount: string,
        safetyAmount: string,
        immutables: SuiImmutables,
        coinType: string = '0x2::sui::SUI'
    ): Promise<string> {
        const tx = new Transaction();

        // Simplified coin allocation using tx.gas split
        const [tokenCoin, safetyDepositCoin] = tx.splitCoins(tx.gas, [
            tx.pure.u64(tokenAmount),
            tx.pure.u64(safetyAmount)
        ]);

        const escrowObject = tx.moveCall({
            target: `${this.config.packageId}::escrow_factory::create_dst_escrow_with_fields`,
            typeArguments: [coinType],
            arguments: [
                tx.object(factoryId),
                tx.object(capId),
                tokenCoin,
                safetyDepositCoin,
                // Pass immutables as individual fields
                tx.pure.vector('u8', immutables.order_hash),
                tx.pure.vector('u8', immutables.hashlock),
                tx.pure.address(immutables.maker),
                tx.pure.address(immutables.taker),
                tx.pure.address(immutables.token),
                tx.pure.u64(immutables.amount),
                tx.pure.u64(immutables.safety_deposit),
                tx.pure.u256(immutables.timelocks.data),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        // Transfer the escrow object to the caller to avoid UnusedValueWithoutDrop error
        tx.transferObjects([escrowObject], tx.pure.address(this.address));

        const result = await this.signAndExecuteWithGas(tx, 100000000); // 0.1 SUI gas budget
        return this.extractEscrowId(result);
    }


    // Withdraw operations using new API
    async withdrawSrc<T>(
        escrowId: string,
        secret: string,
        coinType: string = '0x2::sui::SUI'
    ): Promise<any> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.config.packageId}::escrow_src::withdraw`,
            typeArguments: [coinType],
            arguments: [
                tx.object(escrowId),
                tx.pure.vector('u8', this.hexToNumberArray(secret)),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        return await this.signAndExecute(tx);
    }

    async withdrawDst<T>(
        escrowId: string,
        secret: string,
        coinType: string = '0x2::sui::SUI'
    ): Promise<any> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.config.packageId}::escrow_dst::withdraw`,
            typeArguments: [coinType],
            arguments: [
                tx.object(escrowId),
                tx.pure.vector('u8', this.hexToNumberArray(secret)),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        return await this.signAndExecute(tx);
    }

    // Enhanced withdraw operations using factory verification (recommended)
    async withdrawSrcWithFactoryVerification<T>(
        factoryId: string,
        escrowId: string,
        secret: string,
        immutables: SuiImmutables,
        coinType: string = '0x2::sui::SUI'
    ): Promise<any> {
        const tx = new Transaction();

        // Step 1: Verify escrow binding with factory
        const verifyBinding = tx.moveCall({
            target: `${this.config.packageId}::escrow_factory::verify_escrow_binding`,
            arguments: [
                tx.object(factoryId),
                tx.pure.address(escrowId),
                tx.pure.vector('u8', immutables.order_hash),
                tx.pure.bool(true), // is_src = true
            ],
        });

        // Step 2: Verify secret matches hashlock
        const verifySecret = tx.moveCall({
            target: `${this.config.packageId}::escrow_factory::verify_secret`,
            arguments: [
                tx.pure.vector('u8', this.hexToNumberArray(secret)),
                // Construct immutables inline for verification
                tx.moveCall({
                    target: `${this.config.packageId}::base_escrow::new_immutables`,
                    arguments: [
                        tx.pure.vector('u8', immutables.order_hash),
                        tx.pure.vector('u8', immutables.hashlock),
                        tx.pure.address(immutables.maker),
                        tx.pure.address(immutables.taker),
                        tx.pure.address(immutables.token),
                        tx.pure.u64(immutables.amount),
                        tx.pure.u64(immutables.safety_deposit),
                        tx.moveCall({
                            target: `${this.config.packageId}::timelock::from_data`,
                            arguments: [tx.pure.u256(immutables.timelocks.data)],
                        }),
                    ],
                }),
            ],
        });

        // Step 3: Assert verifications passed
        tx.moveCall({
            target: '0x1::debug::assert_eq',
            arguments: [verifyBinding, tx.pure.bool(true)],
        });
        tx.moveCall({
            target: '0x1::debug::assert_eq',
            arguments: [verifySecret, tx.pure.bool(true)],
        });

        // Step 4: Perform actual withdrawal
        tx.moveCall({
            target: `${this.config.packageId}::escrow_src::withdraw`,
            typeArguments: [coinType],
            arguments: [
                tx.object(escrowId),
                tx.pure.vector('u8', this.hexToNumberArray(secret)),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        return await this.signAndExecute(tx);
    }

    async withdrawDstWithFactoryVerification<T>(
        factoryId: string,
        escrowId: string,
        secret: string,
        immutables: SuiImmutables,
        coinType: string = '0x2::sui::SUI'
    ): Promise<any> {
        const tx = new Transaction();

        // Step 1: Verify escrow binding with factory
        const verifyBinding = tx.moveCall({
            target: `${this.config.packageId}::escrow_factory::verify_escrow_binding`,
            arguments: [
                tx.object(factoryId),
                tx.pure.address(escrowId),
                tx.pure.vector('u8', immutables.order_hash),
                tx.pure.bool(false), // is_src = false
            ],
        });

        // Step 2: Verify secret matches hashlock
        const verifySecret = tx.moveCall({
            target: `${this.config.packageId}::escrow_factory::verify_secret`,
            arguments: [
                tx.pure.vector('u8', this.hexToNumberArray(secret)),
                // Construct immutables inline for verification
                tx.moveCall({
                    target: `${this.config.packageId}::base_escrow::new_immutables`,
                    arguments: [
                        tx.pure.vector('u8', immutables.order_hash),
                        tx.pure.vector('u8', immutables.hashlock),
                        tx.pure.address(immutables.maker),
                        tx.pure.address(immutables.taker),
                        tx.pure.address(immutables.token),
                        tx.pure.u64(immutables.amount),
                        tx.pure.u64(immutables.safety_deposit),
                        tx.moveCall({
                            target: `${this.config.packageId}::timelock::from_data`,
                            arguments: [tx.pure.u256(immutables.timelocks.data)],
                        }),
                    ],
                }),
            ],
        });

        // Step 3: Assert verifications passed
        tx.moveCall({
            target: '0x1::debug::assert_eq',
            arguments: [verifyBinding, tx.pure.bool(true)],
        });
        tx.moveCall({
            target: '0x1::debug::assert_eq',
            arguments: [verifySecret, tx.pure.bool(true)],
        });

        // Step 4: Perform actual withdrawal
        tx.moveCall({
            target: `${this.config.packageId}::escrow_dst::withdraw`,
            typeArguments: [coinType],
            arguments: [
                tx.object(escrowId),
                tx.pure.vector('u8', this.hexToNumberArray(secret)),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        return await this.signAndExecute(tx);
    }

    // Cancel operations using new API
    async cancelSrc<T>(
        escrowId: string,
        coinType: string = '0x2::sui::SUI'
    ): Promise<any> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.config.packageId}::escrow_src::cancel`,
            typeArguments: [coinType],
            arguments: [
                tx.object(escrowId),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        return await this.signAndExecute(tx);
    }

    async cancelDst<T>(
        escrowId: string,
        coinType: string = '0x2::sui::SUI'
    ): Promise<any> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.config.packageId}::escrow_dst::cancel`,
            typeArguments: [coinType],
            arguments: [
                tx.object(escrowId),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        return await this.signAndExecute(tx);
    }

    // Utility functions
    private async signAndExecute(tx: Transaction) {
        return this.signAndExecuteWithGas(tx, 100000000); // 0.1 SUI (default)
    }

    private async signAndExecuteWithGas(tx: Transaction, gasBudget: number) {
        // Set gas budget for the transaction
        tx.setGasBudget(gasBudget);
        
        // Get gas coins for the transaction
        const gasCoins = await this.client.getCoins({
            owner: this.address,
            coinType: '0x2::sui::SUI',
        });
        
        console.log(`[SUI] Address ${this.address} has ${gasCoins.data.length} gas coins, total balance: ${await this.getBalance()}`);
        console.log(`[SUI] Gas budget set to: ${gasBudget} (${gasBudget / 1000000000} SUI)`);
        
        // Use only 1 gas coin to avoid conflicts with escrow coins
        if (gasCoins.data.length > 0) {
            // Use the largest coin for gas to ensure we have enough
            const sortedCoins = gasCoins.data.sort((a, b) => parseInt(b.balance) - parseInt(a.balance));
            tx.setGasPayment([{
                objectId: sortedCoins[0].coinObjectId,
                version: sortedCoins[0].version,
                digest: sortedCoins[0].digest
            }]);
        }

        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: this.keypair,
            options: {
                showObjectChanges: true,
                showEffects: true,
                showEvents: true,
            },
        });

        if (result.effects?.status?.status !== 'success') {
            throw new Error(`Transaction failed: ${result.effects?.status?.error}`);
        }

        return result;
    }

    private extractEscrowId(result: any): string {
        const events = result.events || [];
        const createEvent = events.find(event => 
            event.type.includes('SrcEscrowCreated') || event.type.includes('DstEscrowCreated')
        );
        
        if (createEvent && createEvent.parsedJson) {
            return (createEvent.parsedJson as any).escrow_id;
        }

        // Fallback: look for created objects
        const created = result.objectChanges?.filter(change => change.type === 'created') || [];
        const escrowObj = created.find(obj => 
            obj.objectType?.includes('EscrowSrc') || obj.objectType?.includes('EscrowDst')
        );
        
        if (escrowObj) {
            return escrowObj.objectId;
        }

        throw new Error('Could not extract escrow ID from transaction result');
    }

    private extractOrderHash(result: any): string {
        const events = result.events || [];
        const orderCreatedEvent = events.find(event => 
            event.type.includes('OrderCreated')
        );
        
        if (orderCreatedEvent && orderCreatedEvent.parsedJson) {
            const orderHash = (orderCreatedEvent.parsedJson as any).order_hash;
            // Convert from array format to hex string if needed
            if (Array.isArray(orderHash)) {
                return '0x' + orderHash.map(b => b.toString(16).padStart(2, '0')).join('');
            }
            return orderHash;
        }

        throw new Error('Could not extract order hash from transaction result - OrderCreated event not found');
    }

    // Event monitoring with updated event types
    async waitForEvent(eventType: string, escrowId?: string, timeout: number = 30000): Promise<any> {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const events = await this.client.queryEvents({
                query: { MoveEventType: eventType },
                limit: 10,
                order: 'descending',
            });

            for (const event of events.data) {
                if (escrowId && event.parsedJson) {
                    const eventData = event.parsedJson as any;
                    if (eventData.escrow_id === escrowId) {
                        return eventData;
                    }
                } else if (!escrowId) {
                    return event.parsedJson;
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        throw new Error(`Event ${eventType} not found within timeout`);
    }

    // ========== OrderPool Operations ==========

    /// Allocate coins for order creation (split tokens and safety deposit)
    private async allocateCoins(
        tokenAmount: string,
        safetyAmount: string,
        coinType: string = '0x2::sui::SUI'
    ): Promise<{ coins: [any, any] }> {
        const gasCoins = await this.client.getCoins({ owner: this.address, coinType });
        const sortedCoins = gasCoins.data.sort((a, b) => Number(b.balance) - Number(a.balance));
        
        if (sortedCoins.length < 2) {
            throw new Error('Insufficient coins for operation');
        }

        // Calculate total needed
        const totalNeeded = BigInt(tokenAmount) + BigInt(safetyAmount);
        
        // Find a coin with sufficient balance
        let mainCoin = sortedCoins[1]; // Skip gas coin at index 0
        for (let i = 1; i < sortedCoins.length; i++) {
            if (BigInt(sortedCoins[i].balance) >= totalNeeded) {
                mainCoin = sortedCoins[i];
                break;
            }
        }
        
        // Check if we have enough balance
        if (BigInt(mainCoin.balance) < totalNeeded) {
            throw new Error(`Insufficient balance: needed ${totalNeeded.toString()}, have ${mainCoin.balance}`);
        }
        
        return {
            coins: [mainCoin.coinObjectId, null] // Return coin ID for splitting
        };
    }

    /// Create complete Fusion+ order in pool (all 1inch SDK parameters)
    async createFusionOrderInPool<T>(
        poolId: string,
        tokenAmount: string,
        safetyAmount: string,
        // Core order identification
        orderHash: string,
        hashlock: string,
        salt: bigint,
        nonce: bigint,
        // Assets and amounts
        makerAsset: string,
        takerAsset: string,
        makingAmount: bigint,
        takingAmount: bigint,
        safetyDepositAmount: bigint,
        // Cross-chain information
        srcChainId: number,
        dstChainId: number,
        srcSafetyDeposit: bigint,
        dstSafetyDeposit: bigint,
        // Time constraints
        timelocks: SuiTimelocks,
        // Order options
        allowPartialFills: boolean,
        allowMultipleFills: boolean,
        expiry: number,
        coinType: string = '0x2::sui::SUI'
    ): Promise<string> {
        console.log(`[DEBUG] Creating Fusion+ order with complete parameters:`)
        console.log(`[DEBUG] - orderHash: ${orderHash}`)
        console.log(`[DEBUG] - salt: ${salt}`)
        console.log(`[DEBUG] - nonce: ${nonce}`)
        console.log(`[DEBUG] - makerAsset: ${makerAsset}`)
        console.log(`[DEBUG] - takerAsset: ${takerAsset}`)
        console.log(`[DEBUG] - makingAmount: ${makingAmount}`)
        console.log(`[DEBUG] - takingAmount: ${takingAmount}`)
        console.log(`[DEBUG] - srcChainId: ${srcChainId}`)
        console.log(`[DEBUG] - dstChainId: ${dstChainId}`)
        
        // Validate Fusion+ orderHash with all parameters
        const recalculatedHash = SuiCrossChainClient.computeFusionOrderHash(
            hashlock,
            salt,
            nonce,
            this.address,
            makerAsset,
            takerAsset,
            makingAmount,
            takingAmount,
            safetyDepositAmount,
            BigInt(srcChainId),
            BigInt(dstChainId),
            srcSafetyDeposit,
            dstSafetyDeposit,
            timelocks.data,
            allowPartialFills,
            allowMultipleFills
        )

        console.log(`[DEBUG] - recalculatedHash: ${recalculatedHash}`)
        console.log(`[DEBUG] - Hash match: ${orderHash === recalculatedHash}`)

        if (orderHash !== recalculatedHash) {
            throw new Error(`Fusion+ orderHash mismatch: expected ${orderHash}, got ${recalculatedHash}`)
        }

        const tx = new Transaction()

        // Split coins for order creation
        const { coins } = await this.allocateCoins(tokenAmount, safetyAmount, coinType)
        const [tokenCoin, safetyDepositCoin] = tx.splitCoins(tx.object(coins[0]), [
            tx.pure.u64(tokenAmount),
            tx.pure.u64(safetyAmount)
        ])

        tx.moveCall({
            target: `${this.config.packageId}::order_pool::create_fusion_order`,
            typeArguments: [coinType],
            arguments: [
                tx.object(poolId),
                tokenCoin, // tokens
                safetyDepositCoin, // safety deposit
                // Core order identification
                tx.pure.vector('u8', this.hexToNumberArray(orderHash)),
                tx.pure.vector('u8', this.hexToNumberArray(hashlock)),
                tx.pure.u256(salt),
                tx.pure.u256(nonce),
                // Assets and amounts
                tx.pure.address(makerAsset),
                tx.pure.address(takerAsset),
                tx.pure.u64(makingAmount),
                tx.pure.u64(takingAmount),
                tx.pure.u64(safetyDepositAmount),
                // Cross-chain information
                tx.pure.u64(srcChainId),
                tx.pure.u64(dstChainId),
                tx.pure.u64(srcSafetyDeposit),
                tx.pure.u64(dstSafetyDeposit),
                // Time constraints
                tx.pure.u256(timelocks.data),
                // Order options
                tx.pure.bool(allowPartialFills),
                tx.pure.bool(allowMultipleFills),
                tx.pure.u64(expiry),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        })

        const result = await this.signAndExecuteWithGas(tx, 200000000) // 0.2 SUI gas budget for complex transaction
        console.log(`[DEBUG] createFusionOrderInPool transaction result:`, {
            digest: result.digest,
            effects: result.effects,
            gasUsed: result.effects?.gasUsed
        })

        // Extract the orderHash from the OrderCreated event to confirm successful creation
        return this.extractOrderHash(result)
    }

    /// Create order in pool for resolver competition
    async createOrderInPool<T>(
        poolId: string,
        tokenAmount: string,
        safetyAmount: string,
        orderHash: string,
        hashlock: string,
        token: string,
        timelocks: SuiImmutables['timelocks'],
        expiry: number,
        coinType: string = '0x2::sui::SUI'
    ): Promise<string> {
        const tx = new Transaction();

        // Get coins for token and safety deposit
        const gasCoins = await this.client.getCoins({ owner: this.address, coinType: '0x2::sui::SUI' });
        const sortedCoins = gasCoins.data.sort((a, b) => Number(b.balance) - Number(a.balance));
        
        console.log(`[DEBUG] Available coins before transaction:`, sortedCoins.map(c => ({ id: c.coinObjectId, balance: c.balance })));
        
        if (sortedCoins.length < 2) {
            throw new Error('Insufficient coins for operation');
        }

        // Calculate total needed
        const totalNeeded = BigInt(tokenAmount) + BigInt(safetyAmount);
        
        // Find a coin with sufficient balance or merge coins if needed
        let mainCoin = sortedCoins[1];
        for (let i = 1; i < sortedCoins.length; i++) {
            if (BigInt(sortedCoins[i].balance) >= totalNeeded) {
                mainCoin = sortedCoins[i];
                break;
            }
        }
        
        // If no single coin is sufficient, merge two coins
        if (BigInt(mainCoin.balance) < totalNeeded && sortedCoins.length > 2) {
            console.log(`[DEBUG] No single coin sufficient, merging coins...`);
            const secondCoin = sortedCoins[2];
            const mergedBalance = BigInt(mainCoin.balance) + BigInt(secondCoin.balance);
            
            if (mergedBalance >= totalNeeded) {
                // Merge the coins
                tx.mergeCoins(tx.object(mainCoin.coinObjectId), [tx.object(secondCoin.coinObjectId)]);
                console.log(`[DEBUG] Merged coins: ${mainCoin.balance} + ${secondCoin.balance} = ${mergedBalance.toString()}`);
            }
        }
        
        console.log(`[DEBUG] Using coin for split:`, { id: mainCoin.coinObjectId, balance: mainCoin.balance, needed: totalNeeded.toString() });
        
        // Final check - this should now pass after merging
        if (BigInt(mainCoin.balance) < totalNeeded && sortedCoins.length <= 2) {
            throw new Error(`Insufficient balance even after merging: needed ${totalNeeded.toString()}, have ${mainCoin.balance}`);
        }
        const [tokenCoin, safetyDepositCoin] = tx.splitCoins(tx.object(mainCoin.coinObjectId), [
            tx.pure.u64(tokenAmount),
            tx.pure.u64(safetyAmount)
        ]);

        // Debug: Log all parameters for hash comparison
        console.log(`[DEBUG] createOrderInPool parameters for hash validation:`);
        console.log(`[DEBUG] - orderHash (provided): ${orderHash}`);
        console.log(`[DEBUG] - hashlock: ${hashlock}`);
        console.log(`[DEBUG] - maker (this.address): ${this.address}`);
        console.log(`[DEBUG] - token: ${token}`);
        console.log(`[DEBUG] - tokenAmount: ${tokenAmount}`);
        console.log(`[DEBUG] - safetyAmount: ${safetyAmount}`);
        console.log(`[DEBUG] - timelocks.data: ${timelocks.data.toString()}`);
        
        // Recalculate hash using Fusion+ parameters (same defaults as create_order uses)
        const recalculatedHash = SuiCrossChainClient.computeFusionOrderHash(
            hashlock,
            0n,                     // salt (default)
            0n,                     // nonce (default)
            this.address,           // maker
            token,                  // maker_asset
            '0x0000000000000000000000000000000000000000000000000000000000000000', // taker_asset (default @0x0)
            BigInt(tokenAmount),    // making_amount
            0n,                     // taking_amount (default)
            BigInt(safetyAmount),   // safety_deposit_amount
            1n,                     // src_chain_id (default)
            2n,                     // dst_chain_id (default)
            BigInt(safetyAmount),   // src_safety_deposit (same as safety_deposit_amount)
            BigInt(safetyAmount),   // dst_safety_deposit (same as safety_deposit_amount)
            timelocks.data,         // timelocks_data
            false,                  // allow_partial_fills (default)
            false                   // allow_multiple_fills (default)
        );
        console.log(`[DEBUG] - recalculatedHash: ${recalculatedHash}`);
        console.log(`[DEBUG] - Hash match: ${orderHash === recalculatedHash}`);

        tx.moveCall({
            target: `${this.config.packageId}::order_pool::create_order`,
            typeArguments: [coinType],
            arguments: [
                tx.object(poolId),
                tokenCoin,
                safetyDepositCoin,
                tx.pure.vector('u8', this.hexToNumberArray(orderHash)),
                tx.pure.vector('u8', this.hexToNumberArray(hashlock)),
                tx.pure.address(token),
                tx.pure.u64(tokenAmount),
                tx.pure.u64(safetyAmount),
                tx.pure.u256(timelocks.data),
                tx.pure.u64(expiry),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        const result = await this.signAndExecute(tx);
        console.log(`[DEBUG] createOrderInPool transaction result:`, {
            digest: result.digest,
            effects: result.effects?.status,
            gasUsed: result.effects?.gasUsed
        });
        
        // Check coins after transaction
        const gasCoinsAfter = await this.client.getCoins({ owner: this.address, coinType: '0x2::sui::SUI' });
        const sortedCoinsAfter = gasCoinsAfter.data.sort((a, b) => Number(b.balance) - Number(a.balance));
        console.log(`[DEBUG] Available coins after transaction:`, sortedCoinsAfter.map(c => ({ id: c.coinObjectId, balance: c.balance })));
        
        // Extract the orderHash from the OrderCreated event to confirm successful creation
        return this.extractOrderHash(result);
    }

    /// Cancel order in pool (user can get refund)
    async cancelOrderInPool<T>(
        poolId: string,
        orderHash: string,
        coinType: string = '0x2::sui::SUI'
    ): Promise<any> {
        const tx = new Transaction();

        tx.moveCall({
            target: `${this.config.packageId}::order_pool::cancel_order`,
            typeArguments: [coinType],
            arguments: [
                tx.object(poolId),
                tx.pure.vector('u8', this.hexToNumberArray(orderHash)),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        return await this.signAndExecute(tx);
    }

    /// Resolver takes order and creates srcEscrow
    async takeOrderAndCreateEscrow<T>(
        poolId: string,
        orderHash: string,
        factoryId: string,
        capId: string,
        resolverAddress: string,
        coinType: string = '0x2::sui::SUI'
    ): Promise<string> {
        const tx = new Transaction();

        const srcEscrowId = tx.moveCall({
            target: `${this.config.packageId}::order_pool::take_order_and_create_escrow`,
            typeArguments: [coinType],
            arguments: [
                tx.object(poolId),
                tx.pure.vector('u8', this.hexToNumberArray(orderHash)),
                tx.object(factoryId),
                tx.object(capId),
                tx.pure.address(resolverAddress),
                tx.sharedObjectRef({
                    objectId: '0x6',
                    initialSharedVersion: 1,
                    mutable: false,
                }),
            ],
        });

        const result = await this.signAndExecute(tx);
        return this.extractEscrowId(result);
    }

    /// Check if order exists in pool
    async orderExistsInPool(poolId: string, orderHash: string): Promise<boolean> {
        try {
            const tx = new Transaction();
            
            const result = tx.moveCall({
                target: `${this.config.packageId}::order_pool::order_exists`,
                arguments: [
                    tx.object(poolId),
                    tx.pure.vector('u8', this.hexToNumberArray(orderHash)),
                ],
            });

            const response = await this.client.devInspectTransactionBlock({
                transactionBlock: tx,
                sender: this.address,
            });

            // Check if the transaction was successful
            if (response.effects?.status?.status !== 'success') {
                console.log(`[DEBUG] orderExistsInPool transaction failed:`, response.effects?.status?.error);
                return false;
            }

            // Parse the result more robustly
            const returnValues = response.results?.[0]?.returnValues;
            if (!returnValues || returnValues.length === 0) {
                console.log(`[DEBUG] No return values found`);
                return false;
            }

            const returnValue = returnValues[0] as [number[], string] | undefined;
            
            // The structure is [[value], 'type'], so we need returnValue[0][0]
            const exists = returnValue?.[0]?.[0] === 1;
            console.log(`[DEBUG] Order exists: ${exists}`);
            return exists;
        } catch (error) {
            console.log(`[DEBUG] orderExistsInPool error:`, error);
            return false;
        }
    }

    /// Get pool statistics
    async getPoolStats(poolId: string): Promise<{
        totalOrdersCreated: number,
        totalVolume: number,
        activeOrders: number,
        completedOrders: number
    }> {
        const tx = new Transaction();
        
        tx.moveCall({
            target: `${this.config.packageId}::order_pool::get_pool_stats`,
            arguments: [tx.object(poolId)],
        });

        const response = await this.client.devInspectTransactionBlock({
            transactionBlock: tx,
            sender: this.address,
        });

        // Parse the result (tuple returns 4 separate values)
        const returnValues = response.results?.[0]?.returnValues;
        
        if (!returnValues || returnValues.length < 4) {
            console.log(`[DEBUG] Insufficient return values for pool stats:`, returnValues?.length);
            return {
                totalOrdersCreated: 0,
                totalVolume: 0,
                activeOrders: 0,
                completedOrders: 0
            };
        }

        // Each tuple element comes as separate return value: [data_array, type]
        const totalOrdersCreated = Number((returnValues[0] as [number[], string])?.[0]?.[0] || 0);
        const totalVolume = Number((returnValues[1] as [number[], string])?.[0]?.[0] || 0);
        const activeOrders = Number((returnValues[2] as [number[], string])?.[0]?.[0] || 0);
        const completedOrders = Number((returnValues[3] as [number[], string])?.[0]?.[0] || 0);
        
        const result = {
            totalOrdersCreated,
            totalVolume,
            activeOrders,
            completedOrders
        };
        
        console.log(`[DEBUG] Correctly parsed pool stats:`, result);
        return result;
    }

    // ===== Sui-native OrderHash Computation =====

    /**
     * Compute Sui-native orderHash that matches the Move contract implementation
     * This uses BCS encoding to match exactly with compute_sui_order_hash in order_pool.move
     * 
     * Format: keccak256(hashlock || bcs(maker) || bcs(token) || bcs(amount) || bcs(safety_deposit) || bcs(timelocks))
     */
    static computeSuiOrderHash(
        hashlock: string, // hex string like "0x1234..."
        maker: string,    // address like "0x1234..."
        token: string,    // address like "0x1234..."
        amount: bigint,
        safetyDepositAmount: bigint,
        timelocksData: bigint
    ): string {
        // Convert hashlock to bytes (raw bytes, not BCS encoded as it's already a vector<u8>)
        const hashlockBytes = new Uint8Array(
            hashlock.startsWith('0x') ? 
            Buffer.from(hashlock.slice(2), 'hex') : 
            Buffer.from(hashlock, 'hex')
        );
        
        // Use BCS encoding for all other parameters (exactly like Move contract)
        const makerBytes = bcs.Address.serialize(maker).toBytes();
        const tokenBytes = bcs.Address.serialize(token).toBytes();
        const amountBytes = bcs.u64().serialize(amount).toBytes();
        const safetyDepositBytes = bcs.u64().serialize(safetyDepositAmount).toBytes();
        const timelocksBytes = bcs.u256().serialize(timelocksData).toBytes();

        // Concatenate all components in the same order as Move contract
        const orderData = new Uint8Array([
            ...hashlockBytes,
            ...makerBytes,
            ...tokenBytes,
            ...amountBytes,
            ...safetyDepositBytes,
            ...timelocksBytes
        ]);

        // Compute keccak256 hash (convert Uint8Array to hex string first)
        return keccak256('0x' + Buffer.from(orderData).toString('hex'));
    }

    /**
     * Compute complete Fusion+ orderHash that matches the Move contract implementation
     * This includes all parameters from 1inch CrossChainOrder structure
     */
    static computeFusionOrderHash(
        // Core order identification
        hashlock: string,
        salt: bigint,
        nonce: bigint,
        // Participants and assets
        maker: string,
        makerAsset: string,
        takerAsset: string,
        // Amounts
        makingAmount: bigint,
        takingAmount: bigint,
        safetyDepositAmount: bigint,
        // Cross-chain information
        srcChainId: bigint,
        dstChainId: bigint,
        srcSafetyDeposit: bigint,
        dstSafetyDeposit: bigint,
        // Time constraints
        timelocksData: bigint,
        // Order options
        allowPartialFills: boolean,
        allowMultipleFills: boolean
    ): string {
        console.log(`[DEBUG] Computing Fusion+ orderHash with all parameters`)
        
        // Convert hashlock to bytes (raw bytes, not BCS encoded)
        const hashlockBytes = new Uint8Array(
            hashlock.startsWith('0x') ? 
            Buffer.from(hashlock.slice(2), 'hex') : 
            Buffer.from(hashlock, 'hex')
        );
        
        // Use BCS encoding for all parameters to match Move's bcs::to_bytes exactly
        const saltBytes = bcs.u256().serialize(salt).toBytes();
        const nonceBytes = bcs.u256().serialize(nonce).toBytes();
        const makerBytes = bcs.Address.serialize(maker).toBytes();
        const makerAssetBytes = bcs.Address.serialize(makerAsset).toBytes();
        const takerAssetBytes = bcs.Address.serialize(takerAsset).toBytes();
        const makingAmountBytes = bcs.u64().serialize(makingAmount).toBytes();
        const takingAmountBytes = bcs.u64().serialize(takingAmount).toBytes();
        const safetyDepositBytes = bcs.u64().serialize(safetyDepositAmount).toBytes();
        const srcChainIdBytes = bcs.u64().serialize(srcChainId).toBytes();
        const dstChainIdBytes = bcs.u64().serialize(dstChainId).toBytes();
        const srcSafetyDepositBytes = bcs.u64().serialize(srcSafetyDeposit).toBytes();
        const dstSafetyDepositBytes = bcs.u64().serialize(dstSafetyDeposit).toBytes();
        const timelocksBytes = bcs.u256().serialize(timelocksData).toBytes();
        const allowPartialFillsBytes = bcs.bool().serialize(allowPartialFills).toBytes();
        const allowMultipleFillsBytes = bcs.bool().serialize(allowMultipleFills).toBytes();

        // Concatenate all components in the same order as Move contract
        const orderData = new Uint8Array([
            // Core order identification
            ...hashlockBytes,
            ...saltBytes,
            ...nonceBytes,
            // Participants and assets
            ...makerBytes,
            ...makerAssetBytes,
            ...takerAssetBytes,
            // Amounts
            ...makingAmountBytes,
            ...takingAmountBytes,
            ...safetyDepositBytes,
            // Cross-chain information
            ...srcChainIdBytes,
            ...dstChainIdBytes,
            ...srcSafetyDepositBytes,
            ...dstSafetyDepositBytes,
            // Time constraints
            ...timelocksBytes,
            // Order options
            ...allowPartialFillsBytes,
            ...allowMultipleFillsBytes
        ]);
        
        // Compute keccak256 hash (convert Uint8Array to hex string first)
        const hash = keccak256('0x' + Buffer.from(orderData).toString('hex'));
        console.log(`[DEBUG] Complete Fusion+ orderHash: ${hash}`)
        return hash;
    }

    /**
     * Helper function to compute orderHash with current user as maker
     */
    computeOrderHash(
        hashlock: string,
        token: string,
        amount: bigint,
        safetyDepositAmount: bigint,
        timelocksData: bigint
    ): string {
        return SuiCrossChainClient.computeSuiOrderHash(
            hashlock,
            this.address,
            token,
            amount,
            safetyDepositAmount,
            timelocksData
        );
    }
} 