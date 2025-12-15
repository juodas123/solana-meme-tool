import type { NextApiRequest, NextApiResponse } from "next";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from 'bs58';
import { solanaConnection } from "@/lib/constant";
import { buy } from "@/base/transaction/transaction";

let globalPayer: Keypair | null = null;
let targetWalletAddress: PublicKey | null = null;
let isMonitoring = false;
let copyConfig: any = null;
let activePositions: Map<string, any> = new Map();

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const { 
            targetWallet, 
            privateKey,
            buyAmount = 0.3,
            takeProfitPercent = 100,
            stopLossPercent = 15,
            maxHoldMinutes = 10,
            enableTieredProfits = true
        } = req.body;
        
        if (!targetWallet || !privateKey) {
            return res.json({ error: "Missing required fields" });
        }

        // Initialize
        globalPayer = Keypair.fromSecretKey(bs58.decode(privateKey));
        targetWalletAddress = new PublicKey(targetWallet);
        
        copyConfig = {
            buyAmount,
            takeProfitPercent,
            stopLossPercent,
            maxHoldMinutes: maxHoldMinutes * 60 * 1000, // Convert to ms
            enableTieredProfits
        };

        console.log('🔄 Copy Trading Started');
        console.log('📍 Target Wallet:', targetWallet);
        console.log('💰 Your Wallet:', globalPayer.publicKey.toBase58());
        console.log('💵 Buy Amount:', buyAmount, 'SOL');

        // Start monitoring in background
        if (!isMonitoring) {
            isMonitoring = true;
            monitorTargetWallet().catch(err => {
                console.error('❌ Monitoring error:', err);
                isMonitoring = false;
            });
        }

        res.json({ result: true, message: "Copy trading started" });

    } catch (error) {
        console.error('Copy trade error:', error);
        res.json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}

async function monitorTargetWallet() {
    console.log('👀 Monitoring target wallet with WebSocket (real-time, <500ms)...');
    
    // WebSocket for real-time updates (much faster than polling)
    const ws = new (await import('ws')).default(process.env.NEXT_PUBLIC_MAIN_WSS || '');
    
    ws.on('open', () => {
        console.log('✅ WebSocket connected for real-time monitoring');
        
        // Subscribe to target wallet's account updates
        ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'accountSubscribe',
            params: [
                targetWalletAddress!.toString(),
                { encoding: 'jsonParsed', commitment: 'confirmed' }
            ]
        }));
        
        console.log('📡 Subscribed to wallet:', targetWalletAddress!.toString().slice(0, 8) + '...');
    });
    
    ws.on('message', async (data: any) => {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.method === 'accountNotification') {
                console.log('⚡ Activity detected! Analyzing...');
                
                // Get latest transaction immediately
                const signatures = await solanaConnection.getSignaturesForAddress(
                    targetWalletAddress!,
                    { limit: 1 }
                );
                
                if (signatures.length > 0) {
                    // Analyze within milliseconds
                    await analyzeTransaction(signatures[0].signature);
                }
            }
        } catch (error) {
            console.error('⚠️ WebSocket message error:', error);
        }
    });
    
    ws.on('error', (error: Error) => {
        console.error('❌ WebSocket error:', error);
        // Fallback to polling
        console.log('⚠️ Falling back to polling mode...');
        pollFallback();
    });
}

// Fallback polling if WebSocket fails
function pollFallback() {
    let lastSignature: string | null = null;
    
    const checkInterval = setInterval(async () => {
        try {
            const signatures = await solanaConnection.getSignaturesForAddress(
                targetWalletAddress!,
                { limit: 5, before: lastSignature || undefined }
            );
            
            if (signatures.length > 0) {
                lastSignature = signatures[0].signature;
                for (const sig of signatures) {
                    await analyzeTransaction(sig.signature);
                }
            }
        } catch (error) {
            console.error('⚠️ Polling check failed:', error);
        }
    }, 2000); // 2 second polling
}

async function analyzeTransaction(signature: string) {
    try {
        const tx = await solanaConnection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
        });
        
        if (!tx || !tx.meta) return;
        
        // Look for token purchases (new tokens appearing in post balances)
        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];
        
        for (const post of postBalances) {
            // Check if this is target wallet's account
            const isTargetAccount = tx.transaction.message.accountKeys.some(
                key => key.pubkey.equals(targetWalletAddress!)
            );
            
            if (!isTargetAccount) continue;
            
            // Check if token is new (not in pre balances)
            const existedBefore = preBalances.some(pre => pre.mint === post.mint);
            if (existedBefore || !post.mint) continue;
            
            // Skip if already copied this token
            if (activePositions.has(post.mint)) continue;
            
            const tokenMint = new PublicKey(post.mint);
            console.log('🎯 Target wallet bought:', tokenMint.toString().slice(0, 8) + '...');
            console.log('💸 Copying their buy...');
            
            // Copy their buy
            const buyResult = await buy(
                solanaConnection,
                globalPayer!,
                tokenMint,
                copyConfig.buyAmount
            );
            
            if (buyResult.success) {
                console.log('✅ Copy buy successful!');
                
                const position = {
                    mint: tokenMint,
                    buyPrice: buyResult.price,
                    buyTime: Date.now(),
                    amount: buyResult.amount
                };
                
                activePositions.set(post.mint, position);
                
                // Monitor for sell
                monitorCopyPosition(position);
            } else {
                console.log('❌ Copy buy failed');
            }
            
            break; // One token per transaction check
        }
        
    } catch (error) {
        // Silent fail on transaction analysis
    }
}

async function monitorCopyPosition(position: any) {
    // Similar to sniper's monitorPositionForSell but with copy trade config
    console.log('📊 Monitoring copied position...');
    
    const checkInterval = setInterval(async () => {
        try {
            const elapsed = Date.now() - position.buyTime;
            
            if (elapsed > copyConfig.maxHoldMinutes) {
                console.log('⏰ Max hold time reached - selling');
                await sellPosition(position);
                clearInterval(checkInterval);
                activePositions.delete(position.mint.toString());
                return;
            }
            
            // Get current price from Jupiter
            const quoteResponse = await fetch(
                `https://quote-api.jup.ag/v6/quote?inputMint=${position.mint.toString()}&outputMint=So11111111111111111111111111111111111111112&amount=1000000&slippageBps=50`
            );
            const quoteData = await quoteResponse.json();
            
            if (quoteData.outAmount) {
                const currentPrice = parseFloat(quoteData.outAmount) / 1000000;
                const priceChange = currentPrice / position.buyPrice;
                
                console.log(`💹 Copy position: ${priceChange.toFixed(3)}x`);
                
                const takeProfitMultiplier = 1 + copyConfig.takeProfitPercent / 100;
                const stopLossMultiplier = 1 - copyConfig.stopLossPercent / 100;
                
                if (priceChange >= takeProfitMultiplier) {
                    console.log(`🎯 TAKE PROFIT! ${priceChange.toFixed(2)}x`);
                    await sellPosition(position);
                    clearInterval(checkInterval);
                    activePositions.delete(position.mint.toString());
                    return;
                }
                
                if (priceChange <= stopLossMultiplier) {
                    console.log(`🛑 STOP LOSS! ${priceChange.toFixed(2)}x`);
                    await sellPosition(position);
                    clearInterval(checkInterval);
                    activePositions.delete(position.mint.toString());
                    return;
                }
            }
            
        } catch (error) {
            console.error('Position check error:', error);
        }
    }, 5000);
}

async function sellPosition(position: any) {
    try {
        console.log('💰 Selling copied position...');
        
        const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(
            globalPayer!.publicKey,
            { mint: position.mint }
        );
        
        if (tokenAccounts.value.length === 0) {
            console.log('❌ No tokens to sell');
            return;
        }
        
        const tokenAmount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.amount;
        
        const quoteResponse = await fetch(
            `https://quote-api.jup.ag/v6/quote?inputMint=${position.mint.toString()}&outputMint=So11111111111111111111111111111111111111112&amount=${tokenAmount}&slippageBps=500`
        );
        const quoteData = await quoteResponse.json();
        
        if (!quoteData.outAmount) {
            console.log('❌ No sell route found');
            return;
        }
        
        const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteResponse: quoteData,
                userPublicKey: globalPayer!.publicKey.toString(),
                wrapAndUnwrapSol: true
            })
        });
        
        const { swapTransaction } = await swapResponse.json();
        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        const transaction = (await import('@solana/web3.js')).VersionedTransaction.deserialize(swapTransactionBuf);
        transaction.sign([globalPayer!]);
        
        const signature = await solanaConnection.sendRawTransaction(transaction.serialize());
        await solanaConnection.confirmTransaction(signature);
        
        console.log('✅ SOLD! Signature:', signature.slice(0, 8) + '...');
        
    } catch (error) {
        console.error('❌ Sell failed:', error);
    }
}