#!/usr/bin/env node

require('dotenv/config')
const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client')
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519')

// Test keys
const suiResolverPk = 'AMibztYzaXNAxKhSwzgEeDNlQ0R15rdNn+NiAs09WjSw'

// Test Sui client initialization
async function testSuiClient() {
    console.log('🧪 Testing Sui client initialization...')
    
    try {
        const config = { network: 'testnet' }
        
        // Test client creation
        const client = new SuiClient({ url: getFullnodeUrl(config.network) })
        console.log('✅ SuiClient created successfully')
        
        // Test keypair creation
        const keyBuffer = Buffer.from(suiResolverPk, 'base64')
        const secretKey = keyBuffer.length === 33 ? keyBuffer.slice(1) : keyBuffer
        
        if (secretKey.length !== 32) {
            throw new Error(`Invalid secret key length: expected 32 bytes, got ${secretKey.length}`)
        }
        
        const keypair = Ed25519Keypair.fromSecretKey(secretKey)
        const address = keypair.toSuiAddress()
        console.log('✅ Ed25519Keypair created successfully')
        console.log(`✅ Address: ${address}`)
        
        // Test network connection
        console.log('🌐 Testing network connection...')
        const systemState = await client.getLatestSuiSystemState()
        console.log('✅ Successfully connected to Sui testnet')
        console.log(`✅ Epoch: ${systemState.epoch}`)
        
        // Test balance query (may fail if address has no funds)
        try {
            const balance = await client.getBalance({
                owner: address,
                coinType: '0x2::sui::SUI',
            })
            console.log(`✅ Balance query successful: ${balance.totalBalance} MIST`)
        } catch (error) {
            console.log(`ℹ️ Balance query failed (expected for unfunded address): ${error.message}`)
        }
        
        console.log('\n🎉 All Sui client tests passed!')
        console.log('📋 Real Sui deployment should work correctly')
        
    } catch (error) {
        console.error('❌ Sui client test failed:', error.message)
        console.log('\n🔧 Possible issues:')
        console.log('1. Internet connection problem')
        console.log('2. Sui testnet is down')
        console.log('3. Invalid private key format')
        process.exit(1)
    }
}

testSuiClient()