#!/usr/bin/env node

require('dotenv/config')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Sui SDK imports
const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client')
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519')
const { Transaction } = require('@mysten/sui/transactions')

// Ethers.js imports
const { 
    Wallet: SignerWallet, 
    JsonRpcProvider, 
    ContractFactory,
    computeAddress
} = require('ethers')

// Contract artifacts
const factoryContract = require('../dist/contracts/TestEscrowFactory.sol/TestEscrowFactory.json')
const resolverContract = require('../dist/contracts/Resolver.sol/Resolver.json')

// Hardcoded config to avoid TypeScript dependency
const config = {
    chain: {
        destination: {
            chainId: 56, // BSC Chain ID
            url: 'http://localhost:8545', // Local fork
            limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
            wrappedNative: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
            ownerPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        }
    },
    accounts: {
        userKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        suiUserPk: 'AHLX+LXvk/AllRmmchLt6fn9EGHaXccSr92Kqu0vCUH8'
    }
}

// Real Sui client implementation (based on sui-client.ts)
class SuiCrossChainClient {
    constructor(privateKey, config) {
        this.config = config
        this.client = new SuiClient({ url: getFullnodeUrl(config.network) })
        
        // Handle both 32-byte and 33-byte keys
        const keyBuffer = Buffer.from(privateKey, 'base64')
        const secretKey = keyBuffer.length === 33 ? keyBuffer.slice(1) : keyBuffer
        
        if (secretKey.length !== 32) {
            throw new Error(`Invalid secret key length: expected 32 bytes, got ${secretKey.length}`)
        }
        
        this.keypair = Ed25519Keypair.fromSecretKey(secretKey)
    }
    
    get address() {
        return this.keypair.toSuiAddress()
    }
    
    async checkLocalnetReady() {
        try {
            if (this.config.network !== 'localnet') {
                // For testnet, check if we can connect
                const balance = await this.getBalance('0x2::sui::SUI')
                return true
            }

            // Check localnet connection
            const balance = await this.getBalance('0x2::sui::SUI')
            const balanceAmount = BigInt(balance)
            
            if (balanceAmount < 1000000000n) { // Less than 1 SUI
                console.log(`[SUI] Warning: Low balance (${balance}), may need to fund account`)
                console.log(`[SUI] Use: sui client faucet --address ${this.address}`)
            }
            
            return true
        } catch (error) {
            console.error(`[SUI] Network check failed:`, error.message)
            if (this.config.network === 'testnet') {
                console.log(`[SUI] Check internet connection for Sui testnet access`)
            } else {
                console.log(`[SUI] Make sure localnet is running: sui start`)
            }
            return false
        }
    }

    async getBalance(coinType = '0x2::sui::SUI') {
        const balance = await this.client.getBalance({
            owner: this.address,
            coinType,
        })
        return balance.totalBalance
    }
    
    // Read compiled modules helper
    readCompiledModules(modulesPath) {
        try {
            const files = execSync(`ls ${modulesPath}/*.mv`, { encoding: 'utf8' }).trim().split('\n')
            return files.map(file => {
                const content = fs.readFileSync(file.trim())
                return new Uint8Array(content)
            })
        } catch (error) {
            throw new Error(`Failed to read compiled modules: ${error.message}`)
        }
    }
    
    // Sign and execute transaction with gas budget
    async signAndExecuteWithGas(tx, gasBudget) {
        tx.setGasBudget(gasBudget)
        
        const gasCoins = await this.client.getCoins({
            owner: this.address,
            coinType: '0x2::sui::SUI',
        })
        
        console.log(`[SUI] Address ${this.address} has ${gasCoins.data.length} gas coins, total balance: ${await this.getBalance()}`)
        console.log(`[SUI] Gas budget set to: ${gasBudget} (${gasBudget / 1000000000} SUI)`)
        
        if (gasCoins.data.length > 0) {
            const sortedCoins = gasCoins.data.sort((a, b) => parseInt(b.balance) - parseInt(a.balance))
            tx.setGasPayment([{
                objectId: sortedCoins[0].coinObjectId,
                version: sortedCoins[0].version,
                digest: sortedCoins[0].digest
            }])
        }

        const result = await this.client.signAndExecuteTransaction({
            transaction: tx,
            signer: this.keypair,
            options: {
                showObjectChanges: true,
                showEffects: true,
                showEvents: true,
            },
        })

        if (result.effects?.status?.status !== 'success') {
            throw new Error(`Transaction failed: ${result.effects?.status?.error}`)
        }

        return result
    }
    
    async publishPackage() {
        if (this.config.packageId) {
            console.log(`[SUI] Package already published: ${this.config.packageId}`)
            return this.config.packageId
        }

        console.log(`[SUI] Publishing new package...`)
        
        try {
            // Build the package first
            const buildResult = execSync('sui move build', { 
                cwd: path.join(process.cwd(), 'sui'),
                stdio: 'pipe',
                encoding: 'utf8'
            })
            console.log(`[SUI] Package built successfully`)

            // Create transaction to publish
            const tx = new Transaction()
            const packagePath = path.join(process.cwd(), 'sui')
            
            // Read compiled modules
            const compiledModulesPath = path.join(packagePath, 'build', 'cross_chain_swap', 'bytecode_modules')
            const modules = this.readCompiledModules(compiledModulesPath)
            
            // Publish the package
            const [upgradeCap] = tx.publish({
                modules: modules.map(module => Array.from(module)),
                dependencies: [
                    '0x1', // std
                    '0x2', // sui
                ],
            })
            
            // Transfer upgrade capability to sender
            tx.transferObjects([upgradeCap], this.address)

            const result = await this.signAndExecuteWithGas(tx, 2000000000) // 2 SUI for publishing
            
            // Extract package ID from published event
            const publishEvent = result.events?.find(event => 
                event.type === 'publish'
            )
            
            if (publishEvent && publishEvent.parsedJson) {
                const packageId = publishEvent.parsedJson.packageId
                this.config.packageId = packageId
                console.log(`[SUI] Package published successfully: ${packageId}`)
                return packageId
            }

            // Fallback: look for created objects
            const created = result.objectChanges?.filter(change => change.type === 'published') || []
            if (created.length > 0) {
                const packageId = created[0].packageId
                this.config.packageId = packageId
                console.log(`[SUI] Package published successfully: ${packageId}`)
                return packageId
            }

            throw new Error('Could not extract package ID from publish result')

        } catch (error) {
            console.error(`[SUI] Package publish failed:`, error.message)
            throw error
        }
    }
    
    async initFactory(srcRescueDelay, dstRescueDelay) {
        // Ensure package is published first
        if (!this.config.packageId) {
            await this.publishPackage()
        }

        try {
            // Wait a bit for the init function to complete and objects to be indexed
            console.log(`[SUI] Waiting for init function to complete...`)
            await new Promise(resolve => setTimeout(resolve, 3000))

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
            })

            console.log(`[SUI] Found ${capObjects.data.length} capability objects`)

            // If no capabilities found, try a few more times with delays
            let retries = 0
            while (capObjects.data.length === 0 && retries < 3) {
                console.log(`[SUI] Retrying capability query (attempt ${retries + 1}/3)...`)
                await new Promise(resolve => setTimeout(resolve, 2000))
                
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
                })
                
                console.log(`[SUI] Found ${capObjects.data.length} capability objects on retry`)
                retries++
            }

            if (capObjects.data.length > 0) {
                // Get the factory ID from the capability
                const capData = capObjects.data[0].data?.content
                const factoryId = capData?.fields?.factory_id
                
                if (factoryId) {
                    console.log(`[SUI] Found factory: ${factoryId}`)
                    return {
                        factoryId: factoryId,
                        capId: capObjects.data[0].data?.objectId || '',
                    }
                }
            }

            // Fallback: scan recent transactions for factory creation events
            console.log(`[SUI] Trying fallback: scanning for FactoryCreated events...`)
            const events = await this.client.queryEvents({
                query: {
                    MoveEventType: `${this.config.packageId}::escrow_factory::FactoryCreated`
                },
                limit: 10,
                order: 'descending'
            })

            console.log(`[SUI] Found ${events.data.length} factory creation events`)
            
            if (events.data.length > 0) {
                const eventData = events.data[0].parsedJson
                const factoryId = eventData.factory_id
                
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
                })

                console.log(`[SUI] Found ${allCaps.data.length} capabilities in fallback search`)

                if (allCaps.data.length > 0) {
                    console.log(`[SUI] Using capability from fallback search: ${factoryId}`)
                    return {
                        factoryId: factoryId,
                        capId: allCaps.data[0].data?.objectId || '',
                    }
                }
            }

            throw new Error('No factory found after package deployment and retries')

        } catch (error) {
            console.error(`[SUI] Factory initialization failed:`, error.message)
            throw error
        }
    }
    
    async findOrderPool() {
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
                    change.packageId === this.config.packageId
                )

                if (packagePublished) {
                    // In the same transaction, look for OrderPool creation
                    const createdObjects = tx.objectChanges?.filter(change => 
                        change.type === 'created' && 
                        change.objectType?.includes('order_pool::OrderPool')
                    ) || []

                    if (createdObjects.length > 0) {
                        const poolId = createdObjects[0].objectId
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
                    const poolId = createdObjects[0].objectId
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
}

// Test keys (same as in tests)
const resolverPk = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
const suiResolverPk = 'AMibztYzaXNAxKhSwzgEeDNlQ0R15rdNn+NiAs09WjSw'

// BSC 部署函數 (參考 cross-chain-sui.spec.ts)
async function initBscChain(cnf) {
    const { provider } = await getProvider(cnf)
    const deployer = new SignerWallet(cnf.ownerPrivateKey, provider)

    console.log(`[BSC] Deploying with account: ${deployer.address}`)

    // deploy EscrowFactory
    const escrowFactory = await deploy(
        factoryContract,
        [
            cnf.limitOrderProtocol,
            cnf.wrappedNative,
            '0x0000000000000000000000000000000000000000', // Address.fromBigInt(0n)
            deployer.address,
            60 * 30, // src rescue delay (30 min)
            60 * 30  // dst rescue delay (30 min)
        ],
        provider,
        deployer
    )
    console.log(`[BSC] ✅ Escrow factory deployed to: ${escrowFactory}`)

    // deploy Resolver contract
    const resolver = await deploy(
        resolverContract,
        [
            escrowFactory,
            cnf.limitOrderProtocol,
            computeAddress(resolverPk)
        ],
        provider,
        deployer
    )
    console.log(`[BSC] ✅ Resolver deployed to: ${resolver}`)

    return { 
        provider, 
        escrowFactory, 
        resolver,
        limitOrderProtocol: cnf.limitOrderProtocol,
        wrappedNative: cnf.wrappedNative
    }
}

// 提供者函數 (參考 cross-chain-sui.spec.ts)
async function getProvider(cnf) {
    // 對於本地開發，直接連接到本地 fork node
    if (cnf.url === 'http://localhost:8545') {
        const provider = new JsonRpcProvider(cnf.url, cnf.chainId, {
            cacheTimeout: -1,
            staticNetwork: true
        })
        
        console.log(`[BSC] Connecting to local fork: ${cnf.url} (Chain ID: ${cnf.chainId})`)
        
        return { provider }
    }
    
    // 原始遠程連接邏輯
    const provider = new JsonRpcProvider(cnf.url, cnf.chainId, {
        cacheTimeout: -1,
        staticNetwork: true
    })
    
    console.log(`[BSC] Connecting to: ${cnf.url} (Chain ID: ${cnf.chainId})`)
    
    return { provider }
}

// 部署函數 (參考 cross-chain-sui.spec.ts)
async function deploy(json, params, provider, deployer) {
    console.log(`[BSC] Deploying contract with params:`, params.map(p => p.toString()))
    
    const factory = new ContractFactory(json.abi, json.bytecode, deployer)
    const deployed = await factory.deploy(...params)
    await deployed.waitForDeployment()
    
    const address = await deployed.getAddress()
    console.log(`[BSC] Contract deployed to: ${address}`)
    
    return address
}

// 完全參考 beforeAll 的代碼來部署所有合約
async function deployAllContracts() {
    console.log('🚀 Deploying all contracts (BSC + Sui)...')
    console.log('📋 Using exact same logic as cross-chain-sui.spec.ts beforeAll')
    
    try {
        // ============ BSC 部署 ============
        console.log('\n💰 Deploying BSC contracts...')
        
        // Initialize BSC chain (deploys new contracts each time)
        const bscChain = await initBscChain(config.chain.destination)
        
        console.log(`✅ BSC EscrowFactory deployed: ${bscChain.escrowFactory}`)
        console.log(`✅ BSC Resolver deployed: ${bscChain.resolver}`)
        console.log(`✅ BSC LimitOrderProtocol: ${bscChain.limitOrderProtocol}`)
        console.log(`✅ BSC WrappedNative: ${bscChain.wrappedNative}`)
        
        // ============ Sui 部署 ============ 
        console.log('\n🌊 Deploying Sui contracts...')
        
        // Initialize Sui configuration for testnet (same as tests)
        const suiConfig = {
            network: 'testnet',
        }
        
        // Use test resolver key (same as in tests)
        const suiResolver = new SuiCrossChainClient(suiResolverPk, suiConfig)
        
        console.log(`✅ Sui resolver address: ${suiResolver.address}`)
        
        // Setup Sui side (check testnet, publish package and initialize factory)
        // 與 cross-chain-sui.spec.ts beforeAll 完全相同的邏輯
        console.log(`[DEPLOY] Checking Sui testnet...`)
        const testnetReady = await suiResolver.checkLocalnetReady() // 這個方法實際上會檢查配置的網絡
        
        if (!testnetReady) {
            console.log('⚠️ Sui testnet not accessible')
            throw new Error('Sui testnet not ready')
        }
        console.log(`[DEPLOY] ✅ Sui testnet is ready`)

        console.log(`[DEPLOY] Publishing Sui package...`)
        const packageId = await suiResolver.publishPackage()
        console.log(`[DEPLOY] ✅ Published package: ${packageId}`)

        console.log(`[DEPLOY] Initializing factory...`)
        const { factoryId, capId } = await suiResolver.initFactory(
            60 * 30, // 30 min rescue delay (same as test)
            60 * 30
        )
        
        console.log(`[DEPLOY] ✅ Factory initialized: ${factoryId}`)
        console.log(`[DEPLOY] ✅ Cap created: ${capId}`)

        console.log(`[DEPLOY] Initializing OrderPool...`)
        // Initialize OrderPool for resolver competition (完全相同的邏輯)
        let poolId
        try {
            // OrderPool is automatically created via the package's init function during deployment
            // Find the actual OrderPool shared object
            console.log(`[DEPLOY] 📡 Querying for OrderPool shared object...`)

            poolId = await suiResolver.findOrderPool()

            if (poolId) {
                console.log(`[DEPLOY] ✅ OrderPool found with ID: ${poolId}`)
                console.log(`[DEPLOY] 🏊 Ready for resolver competition mechanism`)
            } else {
                console.log(`[DEPLOY] ⚠️ OrderPool not found, will use direct escrow method`)
                poolId = undefined
            }
        } catch (error) {
            console.log(`[DEPLOY] ⚠️ OrderPool setup failed, will use direct escrow method`)
            console.log(`[DEPLOY] Error: ${error?.message}`)
            poolId = undefined
        }
        
        console.log(`[DEPLOY] ✅ Sui setup complete - Package: ${packageId}, Factory: ${factoryId}`)

        if (poolId) {
            console.log(`[DEPLOY] 🏊 OrderPool ready for resolver competition: ${poolId}`)
        } else {
            console.log(`[DEPLOY] 🎯 Using direct escrow method (OrderPool not available)`)
        }
        
        // ============ 保存配置 ============
        const deploymentConfig = {
            timestamp: new Date().toISOString(),
            bsc: {
                network: 'localhost:8545',
                chainId: 56, // BSC Chain ID (fork)
                escrowFactory: bscChain.escrowFactory,
                resolver: bscChain.resolver,
                limitOrderProtocol: bscChain.limitOrderProtocol,
                wrappedNative: bscChain.wrappedNative,
                provider: 'http://localhost:8545'
            },
            sui: {
                network: 'testnet',
                rpcUrl: 'https://fullnode.testnet.sui.io',
                packageId: packageId,
                factoryId: factoryId,
                capId: capId,
                poolId: poolId || null,
                resolverAddress: suiResolver.address
            },
            accounts: {
                bscResolver: resolverPk,
                suiResolver: suiResolverPk,
                bscUser: config.accounts.userKey || process.env.BSC_USER_PK,
                suiUser: config.accounts.suiUserPk || process.env.SUI_USER_PK
            },
            deploymentType: 'full'
        }
        
        // 保存到文件
        const configPath = path.join(__dirname, 'deployment-config.json')
        fs.writeFileSync(configPath, JSON.stringify(deploymentConfig, null, 2))
        
        console.log('\n💾 Deployment configuration saved to demo/deployment-config.json')
        
        // ============ 總結 ============
        console.log('\n🎉 All contracts deployed successfully!')
        console.log('\n📋 Summary:')
        console.log('BSC Contracts:')
        console.log(`  📍 EscrowFactory: ${bscChain.escrowFactory}`)
        console.log(`  📍 Resolver: ${bscChain.resolver}`)
        console.log(`  📍 LimitOrderProtocol: ${bscChain.limitOrderProtocol}`)
        console.log(`  📍 WrappedNative: ${bscChain.wrappedNative}`)
        
        console.log('Sui Contracts:')
        console.log(`  📍 Package: ${packageId}`)
        console.log(`  📍 Factory: ${factoryId}`)
        console.log(`  📍 Cap: ${capId}`)
        console.log(`  📍 OrderPool: ${poolId || 'Not available'}`)
        console.log(`  📍 Resolver: ${suiResolver.address}`)
        
        console.log('\n🚀 Next steps:')
        console.log('1. Contracts are ready for testing')
        console.log('2. Run tests: pnpm test --testNamePattern="should demonstrate complete Fusion"')
        console.log('3. Or start UI demo with these contracts')
        
        return {
            bsc: bscChain,
            sui: {
                network: 'testnet',
                packageId,
                factoryId,
                capId,
                poolId,
                resolverAddress: suiResolver.address
            },
            success: true
        }
        
    } catch (error) {
        console.error('❌ Deployment failed:', error)
        console.log('\n🔧 Troubleshooting:')
        console.log('1. Make sure BSC fork is running: anvil --fork-url https://bsc-dataseed1.binance.org --port 8545')
        console.log('2. Check your internet connection for Sui testnet access')
        console.log('3. Make sure Sui testnet funds are available in resolver account')
        console.log('4. Verify that both services are accessible')
        
        return {
            success: false,
            error: error.message
        }
    }
}

// 如果直接執行這個腳本
if (require.main === module) {
    deployAllContracts().then(result => {
        if (result.success) {
            console.log('\n✅ Deployment completed successfully!')
            process.exit(0)
        } else {
            console.log('\n❌ Deployment failed!')
            process.exit(1)
        }
    }).catch(error => {
        console.error('💥 Script failed:', error)
        process.exit(1)
    })
}

module.exports = { deployAllContracts }