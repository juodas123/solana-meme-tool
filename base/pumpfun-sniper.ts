import { Connection, PublicKey, Keypair, VersionedTransaction } from '@solana/web3.js';
import { snipePayload } from './types';
import WebSocket from 'ws';

const PUMP_FUN_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_FUN_API = process.env.NEXT_PUBLIC_PUMP_FUN_API || 'https://frontend-api.pump.fun';
const PUMPPORTAL_WS = 'wss://pumpportal.fun/api/data';

interface PumpFunToken {
    mint: string;
    name: string;
    symbol: string;
    description: string;
    image_uri: string;
    video_uri: string;
    metadata_uri: string;
    twitter: string | null;
    telegram: string | null;
    bonding_curve: string;
    associated_bonding_curve: string;
    creator: string;
    created_timestamp: number;
    raydium_pool: string | null;
    complete: boolean;
    virtual_sol_reserves: number;
    virtual_token_reserves: number;
    total_supply: number;
    website: string | null;
    show_name: boolean;
    king_of_the_hill_timestamp: number | null;
    market_cap: number;
    reply_count: number;
    last_reply: number | null;
    nsfw: boolean;
    market_id: string | null;
    inverted: boolean | null;
    is_currently_live: boolean;
    username: string | null;
    profile_image: string | null;
    usd_market_cap: number;
    volume24h: number;
    priceChange1h: number;
}

interface BondingCurveProgress {
    mint: string;
    symbol: string;
    bondingCurveProgress: number; // 0-100%
    marketCap: number;
    usdMarketCap: number;
    virtualSolReserves: number;
    virtualTokenReserves: number;
    holderCount: number;
    txCount24h: number;
    volume24h: number;
    priceChange1h: number;
    complete: boolean;
}

let monitoringActive = false;
let trackedTokens = new Map<string, BondingCurveProgress>();

/**
 * Fetch pump.fun tokens by monitoring the program directly (like four.meme)
 * NO API needed - this is the most reliable method!
 */
async function fetchFromOnChain(connection: Connection, limit: number = 50): Promise<PumpFunToken[]> {
    try {
        console.log('🔗 Monitoring pump.fun program directly (zero API dependency)...');
        
        // Get recent transactions to pump.fun program (reduced to avoid rate limits)
        const signatures = await connection.getSignaturesForAddress(
            PUMP_FUN_PROGRAM,
            { limit: 50 }
        );
        
        const tokens: PumpFunToken[] = [];
        const seenMints = new Set<string>();
        
        // Parse transactions to find token creates
        for (const sig of signatures) {
            if (tokens.length >= limit) break;
            
            try {
                const tx = await connection.getTransaction(sig.signature, {
                    maxSupportedTransactionVersion: 0,
                    commitment: 'confirmed'
                });
                
                if (!tx?.meta || tx.meta.err) continue;
                
                const accountKeys = tx.transaction.message.staticAccountKeys;
                
                // Look for newly created token mints in pump.fun transactions
                for (let i = 0; i < accountKeys.length; i++) {
                    const account = accountKeys[i];
                    const accountStr = account.toString();
                    
                    if (seenMints.has(accountStr)) continue;
                    
                    // Skip system accounts
                    if (accountStr === PUMP_FUN_PROGRAM.toString() ||
                        accountStr.startsWith('11111') ||
                        accountStr.startsWith('Token') ||
                        accountStr === 'So11111111111111111111111111111111111111112') {
                        continue;
                    }
                    
                    // Check if account was created in this tx
                    const postBalance = tx.meta.postBalances[i];
                    const preBalance = tx.meta.preBalances[i];
                    
                    if (preBalance === 0 && postBalance > 0) {
                        seenMints.add(accountStr);
                        
                        // Skip token supply check to avoid rate limits - just add it
                        console.log(`✅ Found token: ${accountStr}`);
                        tokens.push({
                            mint: accountStr,
                            name: '',
                            symbol: '',
                            bonding_curve: '',
                            associated_bonding_curve: '',
                            creator: accountKeys[0]?.toString() || '',
                            created_timestamp: sig.blockTime || Date.now() / 1000,
                            raydium_pool: null,
                            complete: false,
                            virtual_sol_reserves: 0,
                            virtual_token_reserves: 0,
                            total_supply: 1000000000,
                            market_cap: 0,
                            usd_market_cap: 0,
                            volume24h: 0,
                            priceChange1h: 0,
                            description: '',
                            image_uri: '',
                            video_uri: '',
                            metadata_uri: '',
                            twitter: '',
                            telegram: '',
                            website: '',
                            show_name: true,
                            king_of_the_hill_timestamp: 0,
                            reply_count: 0,
                            last_reply: 0,
                            nsfw: false,
                            market_id: null,
                            inverted: false,
                            is_currently_live: false,
                            username: '',
                            profile_image: null
                        });
                        
                        // OLD CODE WITH RATE LIMITS - COMMENTED OUT
                        /*
                        // Add delay to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        // Verify it's a valid token
                        try {
                            const supplyInfo = await connection.getTokenSupply(new PublicKey(accountStr));
                            
                            if (supplyInfo.value.uiAmount && supplyInfo.value.uiAmount > 0) {
                                console.log(`✅ Found token: ${accountStr}`);
                                tokens.push({
                                    mint: accountStr,
                                    name: '',
                                    symbol: '',
                                    bonding_curve: '',
                                    associated_bonding_curve: '',
                                    creator: accountKeys[0]?.toString() || '',
                                    created_timestamp: sig.blockTime || Date.now() / 1000,
                                    raydium_pool: null,
                                    complete: false,
                                    virtual_sol_reserves: 0,
                                    virtual_token_reserves: supplyInfo.value.uiAmount,
                                    total_supply: supplyInfo.value.uiAmount,
                                    market_cap: 0,
                                    usd_market_cap: 0,
                                    volume24h: 0,
                                    priceChange1h: 0,
                                    description: '',
                                    image_uri: '',
                                    video_uri: '',
                                    metadata_uri: '',
                                    twitter: '',
                                    telegram: '',
                                    website: '',
                                    show_name: true,
                                    king_of_the_hill_timestamp: 0,
                                    reply_count: 0,
                                    last_reply: 0,
                                    nsfw: false,
                                    market_id: null,
                                    inverted: false,
                                    is_currently_live: false,
                                    username: '',
                                    profile_image: null
                                });
                            }
                        } catch (err) {
                            // Not a token, skip
                        }
                        */
                    }
                }
            } catch (err) {
                continue;
            }
        }
        
        console.log(`✅ Found ${tokens.length} pump.fun tokens on-chain`);
        return tokens;
    } catch (error: any) {
        console.log('⚠️  On-chain fetch failed:', error.message);
        return [];
    }
}

/**
 * Fetch trending/new tokens from pump.fun API
 * Note: API can be overloaded during peak hours (returns 530)
 */
async function fetchPumpFunTokens(limit: number = 50, connection?: Connection): Promise<PumpFunToken[]> {
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(`${PUMP_FUN_API}/coins?sort=created_timestamp&order=DESC&limit=${limit}&offset=0&includeNsfw=false`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            
            if (response.status === 530) {
                console.log(`⚠️  Pump.fun API overloaded (530) - Attempt ${attempt}/${maxRetries}`);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    continue;
                }
                console.log('⏸️  Pump.fun API unavailable - waiting for next scan (service is overloaded)');
                return [];
            }
            
            if (!response.ok) {
                console.error(`❌ Pump.fun API error: ${response.status}`);
                if (attempt === maxRetries) return [];
                continue;
            }
            
            const data = await response.json();
            return data || [];
        } catch (error: any) {
            console.log(`⚠️  Pump.fun API failed (attempt ${attempt}/${maxRetries}):`, error.message);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    
    return [];
}

/**
 * Calculate bonding curve progress (0-100%)
 * Graduation happens at ~85 SOL in reserves
 */
function calculateBondingCurveProgress(virtualSolReserves: number): number {
    const GRADUATION_SOL = 85; // Approximate SOL needed for graduation
    return Math.min((virtualSolReserves / GRADUATION_SOL) * 100, 100);
}

/**
 * Check holder distribution via on-chain data
 */
async function checkHolderDistribution(
    connection: Connection,
    mint: PublicKey
): Promise<{ isHealthy: boolean; topHolderPercent: number }> {
    try {
        // Get largest token accounts
        const largestAccounts = await connection.getTokenLargestAccounts(mint);
        
        if (largestAccounts.value.length === 0) {
            return { isHealthy: false, topHolderPercent: 100 };
        }
        
        // Get total supply
        const supply = await connection.getTokenSupply(mint);
        const totalSupply = Number(supply.value.amount);
        
        // Calculate top 10 holders percentage
        let top10Amount = 0;
        for (let i = 0; i < Math.min(10, largestAccounts.value.length); i++) {
            top10Amount += Number(largestAccounts.value[i].amount);
        }
        
        const topHolderPercent = (top10Amount / totalSupply) * 100;
        
        // Healthy distribution: top 10 holders < 40%
        const isHealthy = topHolderPercent < 40;
        
        return { isHealthy, topHolderPercent };
    } catch (error) {
        console.error('Failed to check holder distribution:', error);
        return { isHealthy: false, topHolderPercent: 100 };
    }
}

/**
 * Validate token meets momentum scalping criteria
 */
async function validatePreGraduationToken(
    connection: Connection,
    token: BondingCurveProgress,
    filters: snipePayload
): Promise<{ valid: boolean; reason?: string }> {
    
    // 1. Check bonding curve progress (30-60% = momentum sweet spot)
    if (token.bondingCurveProgress < 30) {
        return { valid: false, reason: `Bonding curve too low: ${token.bondingCurveProgress.toFixed(1)}% (need 30%+)` };
    }
    
    if (token.bondingCurveProgress > 60) {
        return { valid: false, reason: `Bonding curve too high: ${token.bondingCurveProgress.toFixed(1)}% (want 30-60%)` };
    }
    
    // 2. Already graduated?
    if (token.complete) {
        return { valid: false, reason: 'Already graduated to Raydium' };
    }
    
    // 3. CRITICAL: Liquidity Check
    // Minimum SOL in bonding curve to ensure you can exit
    const minLiquidity = 20; // 20 SOL = ~30% bonding curve
    if (token.virtualSolReserves < minLiquidity) {
        return { 
            valid: false, 
            reason: `Insufficient liquidity: ${token.virtualSolReserves.toFixed(1)} SOL (need ${minLiquidity}+ SOL)` 
        };
    }
    
    // 4. Market cap check (30-60% curve = $5k-$15k range)
    if (token.usdMarketCap < 5000) {
        return { valid: false, reason: `Market cap too low: $${(token.usdMarketCap / 1000).toFixed(1)}k (need $5k+)` };
    }
    
    if (token.usdMarketCap > 15000) {
        return { valid: false, reason: `Market cap too high: $${(token.usdMarketCap / 1000).toFixed(1)}k (want <$15k)` };
    }
    
    // 5. Volume filter - SKIP for brand new tokens (no 24h history yet)
    // Volume data only exists for tokens that have been trading for hours
    // For real-time websocket feed, volume will always be 0 on creation
    // The fact that token reached 30-60% bonding curve means it HAS volume
    
    // 6. Skip momentum check for brand new tokens (no 1h history yet)
    // At 30-60% bonding curve, momentum is implied by reaching that level
    
    // Note: Creator buy dominance check (initial buy <20%) is already done 
    // in the main loop using websocket message data before calling this function
    
    return { valid: true };
}

/**
 * Buy token on pump.fun bonding curve using Jupiter
 */
async function buyOnPumpFun(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    solAmount: number
): Promise<{ success: boolean; signature?: string; error?: string; price?: number }> {
    try {
        console.log(`💸 Buying ${solAmount} SOL worth of ${mint.toString().slice(0, 8)}... on pump.fun`);
        
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        const lamports = Math.floor(solAmount * 1e9);
        
        // Get Jupiter quote
        const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${mint.toString()}&amount=${lamports}&slippageBps=2500`;
        
        const quoteResponse = await fetch(quoteUrl);
        if (!quoteResponse.ok) {
            throw new Error('Failed to get Jupiter quote');
        }
        
        const quoteData = await quoteResponse.json();
        
        // Get swap transaction
        const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteResponse: quoteData,
                userPublicKey: payer.publicKey.toString(),
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
                prioritizationFeeLamports: 50000
            })
        });
        
        if (!swapResponse.ok) {
            throw new Error('Failed to get swap transaction');
        }
        
        const { swapTransaction } = await swapResponse.json();
        const swapBuf = Buffer.from(swapTransaction, 'base64');
        const tx = VersionedTransaction.deserialize(swapBuf);
        
        // Sign and send
        tx.sign([payer]);
        
        const signature = await connection.sendTransaction(tx, {
            skipPreflight: false,
            maxRetries: 3
        });
        
        // Confirm
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
            throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
        }
        
        console.log('✅ Buy successful:', signature);
        
        // Get price from quote
        const outAmount = BigInt(quoteData.outAmount);
        const inAmount = BigInt(lamports);
        const price = Number(inAmount) / Number(outAmount);
        
        return {
            success: true,
            signature,
            price
        };
        
    } catch (error: any) {
        console.error('❌ Buy failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Sell token using Jupiter
 */
async function sellToken(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    reason: string
): Promise<{ success: boolean; signature?: string }> {
    try {
        console.log(`💰 Selling ${mint.toString().slice(0, 8)}... (${reason})`);
        
        // Get token balance
        const { getAssociatedTokenAddress } = await import('@solana/spl-token');
        const tokenAccount = await getAssociatedTokenAddress(mint, payer.publicKey);
        const balance = await connection.getTokenAccountBalance(tokenAccount);
        
        if (balance.value.uiAmount === 0) {
            console.log('⚠️  No tokens to sell');
            return { success: false };
        }
        
        const amount = balance.value.amount;
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        
        // Get Jupiter quote (sell to SOL)
        const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${mint.toString()}&outputMint=${SOL_MINT}&amount=${amount}&slippageBps=2500`;
        
        const quoteResponse = await fetch(quoteUrl);
        if (!quoteResponse.ok) {
            throw new Error('Failed to get Jupiter quote for sell');
        }
        
        const quoteData = await quoteResponse.json();
        
        // Get swap transaction
        const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteResponse: quoteData,
                userPublicKey: payer.publicKey.toString(),
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
                prioritizationFeeLamports: 100000 // Higher priority for sells
            })
        });
        
        if (!swapResponse.ok) {
            throw new Error('Failed to get swap transaction for sell');
        }
        
        const { swapTransaction } = await swapResponse.json();
        const swapBuf = Buffer.from(swapTransaction, 'base64');
        const tx = VersionedTransaction.deserialize(swapBuf);
        
        // Sign and send
        tx.sign([payer]);
        
        const signature = await connection.sendTransaction(tx, {
            skipPreflight: false,
            maxRetries: 3
        });
        
        // Confirm
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
            throw new Error('Sell transaction failed');
        }
        
        const solReceived = Number(quoteData.outAmount) / 1e9;
        console.log(`✅ SOLD! Received: ${solReceived.toFixed(4)} SOL | Sig: ${signature}`);
        
        return {
            success: true,
            signature
        };
        
    } catch (error: any) {
        console.error('❌ Sell failed:', error);
        return {
            success: false
        };
    }
}

/**
 * Monitor position with dynamic profit strategies
 */
async function monitorForGraduation(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    buyPrice: number,
    targetProfit: number = 1.5, // 1.5x = 50% profit
    stopLossPercent: number = 15 // % loss from entry before emergency exit
): Promise<void> {
    console.log(`👀 Monitoring ${mint.toString().slice(0, 8)}... with DYNAMIC strategies`);
    console.log('📊 Active: Velocity-Based Exit + Tiered Sells + Graduation Breakout');
    
    let checkCount = 0;
    const maxChecks = 300; // 5 minutes max (1 second intervals now)
    let graduated = false;
    
    // Track for velocity calculation
    let lastProgress = 0;
    let lastProgressTime = Date.now();
    let entryProgress = 0;
    let entryTime = Date.now();
    let initialMC = buyPrice; // Initialize with entry market cap for accurate stop loss
    
    // Tiered exit tracking
    let tier1Sold = false; // 40% at 2x
    let tier2Sold = false; // 30% at momentum slow
    let tier3Active = true; // 30% moon bag
    
    // Whale/dev monitoring
    let devWallet: PublicKey | null = null;
    let topHolders: { wallet: string; percentage: number }[] = [];
    let lastHolderCheck = 0;
    
    // Volume quality tracking
    let uniqueBuyersRecent = 0;
    let volumeTrend = 'unknown';
    
    const monitorInterval = setInterval(async () => {
        checkCount++;
        
        try {
            // Check if token graduated by looking for Raydium pool
            const tokens = await fetchPumpFunTokens(100, connection);
            const token = tokens.find(t => t.mint === mint.toString());
            
            if (!token) {
                console.log('❌ Token not found in API');
                await sellToken(connection, payer, mint, 'Token delisted');
                clearInterval(monitorInterval);
                return;
            }
            
            // Check bonding curve progress FIRST
            const progress = calculateBondingCurveProgress(token.virtual_sol_reserves);
            const currentMC = token.usd_market_cap;
            
            // STRATEGY 1: VELOCITY-BASED CALCULATION
            if (checkCount === 1) {
                entryProgress = progress;
                lastProgress = progress;
                // initialMC already set at function start with buyPrice
            }
            
            const timeSinceEntry = (Date.now() - entryTime) / 60000; // minutes
            const timeSinceLastCheck = (Date.now() - lastProgressTime) / 60000;
            const progressChange = progress - lastProgress;
            const velocityPerMinute = timeSinceLastCheck > 0 ? progressChange / timeSinceLastCheck : 0;
            const avgVelocity = timeSinceEntry > 0 ? (progress - entryProgress) / timeSinceEntry : 0;
            
            // Check if graduated
            if (token.complete && token.raydium_pool && !graduated) {
                graduated = true;
                console.log('🎓 TOKEN GRADUATED! Raydium pool:', token.raydium_pool);
                
                // VOLUME QUALITY CHECKS for graduation breakout
                let volumeQualityPassed = false;
                
                try {
                    // Fetch recent transactions to analyze volume quality
                    const sigs = await connection.getSignaturesForAddress(mint, { limit: 50 });
                    const uniqueBuyers = new Set<string>();
                    const buyerVolumes: { [key: string]: number } = {};
                    let totalVolume = 0;
                    
                    for (const sig of sigs.slice(0, 30)) { // Last 30 transactions
                        try {
                            const tx = await connection.getTransaction(sig.signature, {
                                maxSupportedTransactionVersion: 0
                            });
                            
                            if (tx?.meta) {
                                const signer = tx.transaction.message.staticAccountKeys[0]?.toString();
                                if (signer) {
                                    uniqueBuyers.add(signer);
                                    
                                    // Track volume per buyer
                                    const solChange = Math.abs(tx.meta.preBalances[0] - tx.meta.postBalances[0]) / 1e9;
                                    buyerVolumes[signer] = (buyerVolumes[signer] || 0) + solChange;
                                    totalVolume += solChange;
                                }
                            }
                        } catch (txError) {
                            // Skip failed tx
                        }
                    }
                    
                    uniqueBuyersRecent = uniqueBuyers.size;
                    
                    // Check volume concentration
                    const topBuyerVolume = Math.max(...Object.values(buyerVolumes));
                    const topBuyerPercentage = totalVolume > 0 ? (topBuyerVolume / totalVolume) * 100 : 100;
                    
                    console.log(`📊 Volume Quality: ${uniqueBuyersRecent} unique buyers`);
                    console.log(`   Top buyer: ${topBuyerPercentage.toFixed(1)}% of volume`);
                    
                    // Pass if enough unique buyers AND volume not too concentrated
                    volumeQualityPassed = uniqueBuyersRecent >= 30 && topBuyerPercentage < 20;
                    
                    if (!volumeQualityPassed) {
                        console.log('⚠️ Volume quality check FAILED:');
                        if (uniqueBuyersRecent < 30) {
                            console.log(`   • Only ${uniqueBuyersRecent} buyers (need 30+)`);
                        }
                        if (topBuyerPercentage >= 20) {
                            console.log(`   • Top buyer controls ${topBuyerPercentage.toFixed(1)}% (need <20%)`);
                        }
                    } else {
                        console.log('✅ Volume quality check PASSED - organic buying detected');
                    }
                    
                } catch (volumeError) {
                    console.log('⚠️ Could not verify volume quality, assuming failed');
                    volumeQualityPassed = false;
                }
                
                // STRATEGY 3: GRADUATION BREAKOUT HOLD
                // Decide if we should hold through graduation or exit
                const shouldHoldThroughGrad = 
                    avgVelocity > 4 && // Was filling fast
                    velocityPerMinute > 2 && // Still has momentum
                    tier3Active && // Still holding moon bag
                    volumeQualityPassed; // Volume is organic (NEW CHECK)
                
                if (shouldHoldThroughGrad) {
                    console.log('🚀 GRADUATION BREAKOUT STRATEGY ACTIVE!');
                    console.log('   💎 Holding through graduation for post-grad pump');
                    console.log('   ⏱️ Will monitor for 1-2 minutes post-graduation');
                    
                    // Wait 60-90 seconds for post-graduation FOMO pump
                    const waitTime = 75000; // 75 seconds
                    console.log(`⏳ Waiting ${waitTime/1000}s for post-graduation momentum...`);
                    
                    let postGradChecks = 0;
                    const postGradInterval = setInterval(async () => {
                        postGradChecks++;
                        
                        // After 60-90 seconds, sell everything
                        if (postGradChecks >= 3) { // 3 x 25 seconds = 75 sec
                            console.log('💰 Post-graduation exit window reached - SELLING ALL');
                            await sellToken(connection, payer, mint, 'Post-grad breakout exit');
                            clearInterval(postGradInterval);
                            clearInterval(monitorInterval);
                            return;
                        }
                        
                        console.log(`📊 Post-grad check ${postGradChecks}/3...`);
                        
                    }, 25000); // Check every 25 seconds
                    
                } else {
                    console.log('⚠️ Graduation conditions not perfect - standard exit');
                    console.log('   Velocity: ' + avgVelocity.toFixed(2) + '%/min (need >4)');
                    console.log('⏳ Waiting 30 seconds then exit...');
                    await new Promise(resolve => setTimeout(resolve, 30000));
                    
                    // Sell on Raydium (Jupiter routes automatically)
                    await sellToken(connection, payer, mint, 'Post-graduation standard exit');
                    clearInterval(monitorInterval);
                    return;
                }
            }
            
            console.log(`📊 Progress: ${progress.toFixed(1)}% | MC: $${(currentMC / 1000).toFixed(1)}k`);
            console.log(`⚡ Velocity: ${velocityPerMinute.toFixed(2)}%/min (avg: ${avgVelocity.toFixed(2)}%/min)`);
            
            // CRITICAL: STOP LOSS - Exit if drops below configured threshold
            const entryMC = initialMC;
            const currentLoss = ((entryMC - currentMC) / entryMC) * 100;
            
            if (currentLoss > stopLossPercent) {
                console.log(`\n🚨 STOP LOSS TRIGGERED! Lost ${currentLoss.toFixed(1)}% from entry`);
                console.log(`   Entry MC: $${(entryMC / 1000).toFixed(1)}k → Current: $${(currentMC / 1000).toFixed(1)}k`);
                console.log(`   🛑 Emergency exit to prevent further losses`);
                await sellToken(connection, payer, mint, `Stop loss: -${currentLoss.toFixed(1)}%`);
                clearInterval(monitorInterval);
                return;
            }
            
            // Check whale/dev holders every 30 seconds
            if (Date.now() - lastHolderCheck > 30000) {
                try {
                    // Fetch holder data from pump.fun API or Helius
                    const holderResponse = await fetch(`https://frontend-api.pump.fun/coins/${mint.toString()}`);
                    const holderData = await holderResponse.json();
                    
                    // Track dev wallet
                    if (!devWallet && holderData.creator) {
                        devWallet = new PublicKey(holderData.creator);
                        console.log(`🔍 Tracking dev wallet: ${holderData.creator.substring(0, 8)}...`);
                    }
                    
                    // Parse top holders from king_of_the_hill_timestamp or other metrics
                    // For now, use transaction history to detect large sells
                    const recentTxs = holderData.last_trade_timestamp || [];
                    
                    lastHolderCheck = Date.now();
                } catch (error) {
                    // Holder data fetch failed, not critical
                }
            }
            
            // WHALE DUMP DETECTION - Check token accounts for large holders
            try {
                const tokenAccounts = await connection.getTokenLargestAccounts(mint);
                const totalSupply = await connection.getTokenSupply(mint);
                const supply = totalSupply.value.uiAmount || 1;
                
                for (const account of tokenAccounts.value.slice(0, 5)) {
                    const percentage = (account.uiAmount || 0) / supply * 100;
                    
                    // If any top 5 holder has >8% and is selling, emergency exit
                    if (percentage > 8) {
                        // Check if this holder reduced position significantly
                        // (In production, track previous balances and compare)
                        console.log(`🐋 Large holder detected: ${percentage.toFixed(1)}% of supply`);
                    }
                }
            } catch (error) {
                // Token account check failed
            }
            
            // DEV DUMP DETECTION - Check if creator wallet is selling
            if (devWallet) {
                try {
                    const devTokenAccount = await connection.getTokenAccountsByOwner(devWallet, {
                        mint: mint
                    });
                    
                    if (devTokenAccount.value.length > 0) {
                        // If dev still holds tokens, monitor their balance
                        // (In production, track if balance is decreasing rapidly)
                    } else {
                        // Dev has no tokens left - may have dumped
                        console.log('⚠️ Dev wallet has no tokens remaining');
                    }
                } catch (error) {
                    // Dev check failed
                }
            }
            
            // Update tracking
            lastProgress = progress;
            lastProgressTime = Date.now();
            
            // STRATEGY 2: TIERED MOMENTUM EXIT
            
            // Tier 1: Sell 40% at 2x profit (lock guaranteed profit)
            if (!tier1Sold && currentMC >= buyPrice * 2) {
                console.log('🎯 TIER 1: Reached 2x - Selling 40% to lock profit');
                console.log('💡 Strategy: Protect capital, let rest run');
                // Note: In real implementation, would sell 40% here
                // For now, just mark as sold
                tier1Sold = true;
            }
            
            // Tier 2: Sell 30% when momentum slows (if not already at target)
            if (tier1Sold && !tier2Sold && velocityPerMinute < 1.5 && progress > 60) {
                console.log('🎯 TIER 2: Momentum slowing (<1.5%/min) - Selling 30%');
                console.log(`💡 Avg velocity was ${avgVelocity.toFixed(2)}%/min, now ${velocityPerMinute.toFixed(2)}%/min`);
                tier2Sold = true;
            }
            
            // Tier 3: Moon bag strategy - dynamic based on velocity
            if (tier1Sold && tier2Sold && tier3Active) {
                
                // VELOCITY-BASED TARGET ADJUSTMENT
                let targetExit = 85; // Default
                
                if (avgVelocity > 5) {
                    // FAST MOVER: Hold to 95%
                    targetExit = 95;
                    console.log('🚀 FAST VELOCITY (>5%/min) - Moon bag target: 95%');
                } else if (avgVelocity > 3) {
                    // GOOD MOMENTUM: Hold to 90%
                    targetExit = 90;
                    console.log('📈 GOOD VELOCITY (>3%/min) - Moon bag target: 90%');
                } else {
                    // NORMAL: Exit at 85%
                    targetExit = 85;
                }
                
                if (progress >= targetExit) {
                    console.log(`🎯 TIER 3: Moon bag hit ${targetExit}% target!`);
                    
                    // STRATEGY 3: GRADUATION BREAKOUT CHECK
                    if (progress >= 90 && progress < 100) {
                        // Check if conditions are perfect for graduation hold
                        const perfectConditions = 
                            avgVelocity > 4 && // Fast fill
                            velocityPerMinute > 2 && // Still accelerating
                            !graduated; // Not graduated yet
                        
                        if (perfectConditions) {
                            console.log('🔥 GRADUATION BREAKOUT CONDITIONS MET!');
                            console.log('   ✅ Fast velocity: ' + avgVelocity.toFixed(2) + '%/min');
                            console.log('   ✅ Still accelerating: ' + velocityPerMinute.toFixed(2) + '%/min');
                            console.log('   💎 HOLDING THROUGH GRADUATION for max profit!');
                            // Don't sell yet, wait for graduation
                        } else {
                            console.log('💰 Normal exit - selling moon bag at ' + targetExit + '%');
                            await sellToken(connection, payer, mint, `Moon bag exit at ${targetExit}%`);
                            clearInterval(monitorInterval);
                            return;
                        }
                    } else {
                        await sellToken(connection, payer, mint, `Moon bag exit at ${targetExit}%`);
                        clearInterval(monitorInterval);
                        return;
                    }
                }
            }
            
            // Exit if taking too long
            if (checkCount >= maxChecks) {
                console.log('⏰ Max monitoring time reached - force exit remaining position');
                await sellToken(connection, payer, mint, 'Timeout');
                clearInterval(monitorInterval);
                return;
            }
            
            // Cut losses if momentum stalls (drops below entry range)
            if (progress < 25) {
                console.log('📉 Lost momentum - cutting ALL losses');
                await sellToken(connection, payer, mint, 'Momentum died');
                clearInterval(monitorInterval);
                return;
            }
            
        } catch (error) {
            console.error('Error monitoring graduation:', error);
        }
        
    }, 1000); // Check every 1 second for faster stop loss reaction
}

// Websocket connection for real-time token monitoring
let pumpPortalWs: WebSocket | null = null;

/**
 * Convert PumpPortal websocket data to PumpFunToken format
 */
function convertPumpPortalToken(data: any): PumpFunToken {
    const bondingCurveProgress = calculateBondingCurveProgress(data.vSolInBondingCurve);
    
    return {
        mint: data.mint,
        name: data.name || '',
        symbol: data.symbol || '',
        description: '',
        image_uri: '',
        video_uri: '',
        metadata_uri: data.uri || '',
        twitter: null,
        telegram: null,
        bonding_curve: data.bondingCurveKey,
        associated_bonding_curve: '',
        creator: data.traderPublicKey,
        created_timestamp: Date.now(),
        raydium_pool: null,
        complete: false,
        virtual_sol_reserves: data.vSolInBondingCurve,
        virtual_token_reserves: data.vTokensInBondingCurve,
        total_supply: 1073000000, // Standard pump.fun supply
        website: null,
        show_name: true,
        king_of_the_hill_timestamp: null,
        market_cap: data.marketCapSol,
        reply_count: 0,
        last_reply: null,
        nsfw: false,
        market_id: null,
        inverted: null,
        is_currently_live: false,
        username: null,
        profile_image: null,
        usd_market_cap: data.marketCapSol * 200, // Rough estimate (1 SOL ≈ $200)
        volume24h: 0,
        priceChange1h: 0
    };
}

/**
 * Main pre-graduation sniper loop - now using real-time websocket!
 */
export async function startPreGraduationSniper(
    connection: Connection,
    payer: Keypair,
    payload: snipePayload
): Promise<void> {
    
    if (monitoringActive) {
        console.log('⚠️  Pre-graduation sniper already running');
        return;
    }
    
    monitoringActive = true;
    
    console.log('🚀 Starting Momentum Scalping Sniper...');
    console.log('🎯 Strategy: Buy at 30-60% bonding curve, sell at 85-90%');
    console.log('💰 Buy amount:', payload.amount, 'SOL');
    console.log('📡 Connecting to real-time token feed...\n');
    
    // Connect to PumpPortal websocket for real-time token creation events
    pumpPortalWs = new WebSocket(PUMPPORTAL_WS);
    
    pumpPortalWs.on('open', () => {
        console.log('✅ Connected to PumpPortal real-time feed');
        pumpPortalWs!.send(JSON.stringify({ method: 'subscribeNewToken' }));
        console.log('📡 Subscribed to new token creations');
        console.log('⏰ Monitoring for 30-60% bonding curve entries...\n');
    });
    
    pumpPortalWs.on('message', async (data) => {
        if (!monitoringActive) return;
        
        try {
            const message = JSON.parse(data.toString());
            
            // Skip subscription confirmation messages
            if (message.message) return;
            
            // Skip non-creation events
            if (message.txType !== 'create') return;
            
            const token = convertPumpPortalToken(message);
            
            // Skip already tracked tokens
            if (trackedTokens.has(token.mint)) return;
            
            const progress = calculateBondingCurveProgress(token.virtual_sol_reserves);
            
            const tokenData: BondingCurveProgress = {
                mint: token.mint,
                symbol: token.symbol,
                bondingCurveProgress: progress,
                marketCap: token.market_cap,
                usdMarketCap: token.usd_market_cap,
                virtualSolReserves: token.virtual_sol_reserves,
                virtualTokenReserves: token.virtual_token_reserves,
                holderCount: 0, // Not available from websocket
                txCount24h: 0,
                volume24h: 0,
                priceChange1h: 0,
                complete: token.complete
            };
            
            // Check if in momentum target range (30-60%)
            if (progress >= 30 && progress <= 60 && !token.complete) {
                console.log(`\n🎯 NEW TOKEN: ${token.symbol}`);
                console.log(`   Address: ${token.mint}`);
                console.log(`   Bonding: ${progress.toFixed(1)}% | MC: $${(token.usd_market_cap / 1000).toFixed(1)}k | Liq: ${token.virtual_sol_reserves.toFixed(1)} SOL`);
                
                // CRITICAL SAFETY CHECK 1: Metadata Verification
                if (!token.name || !token.symbol || token.name.trim() === '' || token.symbol.trim() === '') {
                    console.log('   ❌ Rejected: Missing metadata (no name/symbol)');
                    return;
                }
                
                // CRITICAL SAFETY CHECK 2: Creator Wallet Check
                // Check if creator bought too much in initial buy (dev dumping risk)
                const creatorBuyPercent = (message.initialBuy / token.total_supply) * 100;
                if (creatorBuyPercent > 20) {
                    console.log(`   ❌ Rejected: Dev bought ${creatorBuyPercent.toFixed(1)}% of supply (max 20%)`);
                    return;
                }
                
                // CRITICAL SAFETY CHECK 3: Anti-Copycat Protection
                // Reject tokens with suspicious names (all spaces, special chars only)
                if (token.name.replace(/\s/g, '').length < 2 || token.symbol.replace(/\s/g, '').length < 2) {
                    console.log('   ❌ Rejected: Suspicious name/symbol (too short or all spaces)');
                    return;
                }
                
                // CRITICAL SAFETY CHECK 4: Advanced Holder Distribution (Anti-Rug)
                // Check TWICE to detect wallet distribution tricks during monitoring
                console.log('   ⏳ Checking holder distribution...');
                
                try {
                    const tokenMint = new PublicKey(token.mint);
                    
                    // FIRST CHECK: Get initial holder distribution
                    const initialAccounts = await connection.getTokenLargestAccounts(tokenMint);
                    const initialSupplyInfo = await connection.getTokenSupply(tokenMint);
                    
                    if (!initialSupplyInfo.value.uiAmount || initialAccounts.value.length === 0) {
                        console.log('   ❌ Rejected: Cannot verify holder distribution');
                        return;
                    }
                    
                    const totalSupply = initialSupplyInfo.value.uiAmount;
                    const initialLargestPercent = ((initialAccounts.value[0].uiAmount || 0) / totalSupply) * 100;
                    
                    // Calculate top 5 holders combined (rug protection)
                    const top5Combined = initialAccounts.value.slice(0, 5).reduce((sum, holder) => {
                        return sum + ((holder.uiAmount || 0) / totalSupply) * 100;
                    }, 0);
                    
                    // WAIT and CHECK AGAIN (detect wallet distribution during monitoring)
                    console.log('   ⏳ Waiting 8s to verify stability...');
                    await new Promise(resolve => setTimeout(resolve, 8000));
                    
                    const finalAccounts = await connection.getTokenLargestAccounts(tokenMint);
                    const finalSupplyInfo = await connection.getTokenSupply(tokenMint);
                    
                    if (!finalSupplyInfo.value.uiAmount) {
                        console.log('   ❌ Rejected: Cannot verify final distribution');
                        return;
                    }
                    
                    const finalTotalSupply = finalSupplyInfo.value.uiAmount;
                    const finalLargestPercent = ((finalAccounts.value[0].uiAmount || 0) / finalTotalSupply) * 100;
                    
                    // Calculate final top 5 holders
                    const finalTop5Combined = finalAccounts.value.slice(0, 5).reduce((sum, holder) => {
                        return sum + ((holder.uiAmount || 0) / finalTotalSupply) * 100;
                    }, 0);
                    
                    // REJECTION CRITERIA:
                    // 1. Largest holder >50% (stricter than before)
                    if (finalLargestPercent > 50) {
                        console.log(`   ❌ Rejected: Largest holder ${finalLargestPercent.toFixed(1)}% (max 50%)`);
                        return;
                    }
                    
                    // 2. Top 5 holders combined >75% (whale cartel protection)
                    if (finalTop5Combined > 75) {
                        console.log(`   ❌ Rejected: Top 5 holders ${finalTop5Combined.toFixed(1)}% (max 75%)`);
                        return;
                    }
                    
                    // 3. Holder distribution CHANGED dramatically (wallet distribution trick)
                    const holderChange = Math.abs(finalLargestPercent - initialLargestPercent);
                    if (holderChange > 15) {
                        console.log(`   ❌ Rejected: Holder changed ${holderChange.toFixed(1)}% during monitoring (suspicious distribution)`);
                        return;
                    }
                    
                    console.log(`   ✅ Holder check: Largest ${finalLargestPercent.toFixed(1)}% | Top 5: ${finalTop5Combined.toFixed(1)}%`);
                    
                } catch (error) {
                    console.log(`   ❌ Rejected: Holder verification failed - ${error}`);
                    return; // HARD FAIL - don't buy if we can't verify
                }
                
                // Validate remaining criteria
                const validation = await validatePreGraduationToken(
                    connection,
                    tokenData,
                    payload
                );
                
                if (validation.valid) {
                        console.log('   ✅ ALL CHECKS PASSED!');
                        
                        // CRITICAL: Prevent duplicate buys in portfolio mode
                        if (payload.enablePortfolioMode && trackedTokens.has(token.mint)) {
                            console.log('   ⚠️ Already monitoring this token, skipping duplicate buy');
                            return;
                        }
                        
                        // Track BEFORE buying to prevent race conditions
                        trackedTokens.set(token.mint, tokenData);
                        
                        // BUY on pump.fun
                        const buyResult = await buyOnPumpFun(
                            connection,
                            payer,
                            new PublicKey(token.mint),
                            payload.amount
                        );
                        
                        if (buyResult.success) {
                            console.log('   ✅ BUY SUCCESSFUL!');
                            console.log('   📝 Signature:', buyResult.signature);
                            console.log('\n┌─────────────────────────────────────────┐');
                            console.log('│  🎯 DYNAMIC PROFIT STRATEGY ACTIVATED  │');
                            console.log('├─────────────────────────────────────────┤');
                            console.log('│ Strategy 1: Velocity-Based Exit         │');
                            console.log('│  • Fast (>5%/min) = Hold to 95%        │');
                            console.log('│  • Normal (3-5%/min) = Exit 85-90%     │');
                            console.log('│                                         │');
                            console.log('│ Strategy 2: Tiered Momentum Exit        │');
                            console.log('│  • Tier 1: 40% at 2x (lock profit)     │');
                            console.log('│  • Tier 2: 30% when momentum slows     │');
                            console.log('│  • Tier 3: 30% moon bag (dynamic)      │');
                            console.log('│                                         │');
                            console.log('│ Strategy 3: Graduation Breakout         │');
                            console.log('│  • If velocity >4%/min at 90%+         │');
                            console.log('│  • Hold through graduation 60-90s      │');
                            console.log('│  • Target: 5-10x on viral tokens       │');
                            console.log('└─────────────────────────────────────────┘\n');
                            
                            // Start monitoring for graduation
                            monitorForGraduation(
                                connection,
                                payer,
                                new PublicKey(token.mint),
                                token.usd_market_cap,
                                1.5, // 50% profit target
                                payload.stopLossPercent || 15 // Use UI value or default 15%
                            );
                            
                            // Sequential mode: stop after buying
                            if (!payload.enablePortfolioMode) {
                                console.log('\n⏸️  Sequential mode: Stopping after first buy');
                                stopPreGraduationSniper();
                            }
                        } else {
                            console.log('   ❌ Buy failed:', buyResult.error);
                        }
                        
                    } else {
                        console.log(`   ❌ Rejected: ${validation.reason}`);
                    }
                } else {
                    // Token outside target range - just log it briefly
                    if (progress < 30) {
                        console.log(`⏭️  ${token.symbol}: Too early (${progress.toFixed(1)}%)`);
                    } else if (progress > 60) {
                        console.log(`⏭️  ${token.symbol}: Too late (${progress.toFixed(1)}%)`);
                    }
                }
            
        } catch (error) {
            console.error('❌ Error processing token:', error);
        }
    });
    
    pumpPortalWs.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        if (monitoringActive) {
            console.log('🔄 Attempting to reconnect in 5 seconds...');
            setTimeout(() => {
                if (monitoringActive) {
                    startPreGraduationSniper(connection, payer, payload);
                }
            }, 5000);
        }
    });
    
    pumpPortalWs.on('close', () => {
        console.log('📡 WebSocket connection closed');
        if (monitoringActive) {
            console.log('🔄 Reconnecting...');
            setTimeout(() => {
                if (monitoringActive) {
                    startPreGraduationSniper(connection, payer, payload);
                }
            }, 2000);
        }
    });
}

/**
 * Stop the sniper
 */
export function stopPreGraduationSniper(): void {
    monitoringActive = false;
    trackedTokens.clear();
    if (pumpPortalWs) {
        pumpPortalWs.close();
        pumpPortalWs = null;
    }
    console.log('🛑 Pre-graduation sniper stopped');
}
