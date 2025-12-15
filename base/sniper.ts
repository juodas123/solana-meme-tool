import { CommitmentLevel, SubscribeRequest } from "@triton-one/yellowstone-grpc";
import { LIQUIDITY_STATE_LAYOUT_V4, MARKET_STATE_LAYOUT_V3, Token, TokenAmount } from "@raydium-io/raydium-sdk";
import { PublicKey, Keypair } from "@solana/web3.js";
import { bufferRing } from "./openbook";
import { buy, checkValidation, init } from "./transaction/transaction";
import base58 from "bs58";
import { createPoolKeys } from "./liquidity";
import { client } from "./config";
import { snipePayload } from "./types";

let latestBlockHash: string = "";
let globalPayer: Keypair | null = null;

export async function streamNewTokens(payload: snipePayload): Promise<boolean> {
    console.log('🚀 Starting token stream monitor...');
    console.log('👀 Watching for new Raydium pools with your filters');
    console.log('⚠️ Note: gRPC requires paid Triton/Helius plan - falling back to RPC polling');
    
    // RPC polling fallback (works with free Helius)
    return streamWithRpcPolling(payload);
    
    /* gRPC version (requires paid plan):
    try {
        const stream = await client.subscribe();
        
        // Create subscription request for Raydium program accounts
        const request: SubscribeRequest = {
            accounts: {
                raydium: {
                    account: [],
                    owner: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"], // Raydium AMM program
                    filters: []
                }
            },
            slots: {},
            transactions: {},
            transactionsStatus: {},
            blocks: {},
            blocksMeta: {},
            entry: {},
            accountsDataSlice: [],
            commitment: CommitmentLevel.CONFIRMED,
            ping: undefined
        };

        // Send subscription request
        await new Promise<void>((resolve, reject) => {
            stream.write(request, (err: null | undefined) => {
                if (err === null || err === undefined) {
                    console.log('✅ Subscribed to Raydium program updates');
                    resolve();
                } else {
                    console.error('❌ Subscription failed:', err);
                    reject(err);
                }
            });
        }).catch((reason) => {
            console.error(reason);
            throw reason;
        });

        // Process incoming events
        return new Promise<boolean>((resolve, reject) => {
            let processed = 0;
            
            stream.on("data", async (data) => {
                try {
                    if (data.blockMeta) {
                        latestBlockHash = data.blockMeta.blockhash;
                    }

                    if (data.account) {
                        processed++;
                        console.log(`📦 Account update #${processed}`);
                        
                        // TODO: Parse LIQUIDITY_STATE_LAYOUT_V4
                        // TODO: Check if new pool
                        // TODO: Validate against filters (min/max liquidity, pool supply)
                        // TODO: Call buy() if passes all checks
                        
                        console.log('⚠️ Detection logic not fully implemented');
                        console.log('ℹ️  Monitoring in simulation mode...');
                    }
                } catch (error) {
                    console.error('Error processing update:', error);
                }
            });

            stream.on("error", (error) => {
                console.error('❌ Stream error:', error);
                reject(error);
            });

            stream.on("end", () => {
                console.log('Stream ended');
                resolve(true);
            });

            // Keep stream alive
            console.log('✅ Sniper is now monitoring for new tokens...');
            console.log('⚠️ NOTE: Full buy logic not implemented - running in simulation mode');
        });
    } catch (error) {
        console.error('❌ Failed to start stream:', error);
        throw error;
    }
    */
}

async function streamWithRpcPolling(payload: snipePayload): Promise<boolean> {
    console.log('📡 Using RPC polling mode');
    
    // Initialize global payer
    await init(payload);
    const bs58 = (await import('bs58')).default;
    globalPayer = Keypair.fromSecretKey(bs58.decode(payload.privateKey));
    
    const portfolioMode = payload.enablePortfolioMode || false;
    const maxPositions = payload.maxPositions || 3;
    
    if (portfolioMode) {
        console.log(`💼 Portfolio mode: Hold up to ${maxPositions} tokens simultaneously`);
    } else {
        console.log('🎯 Sequential mode: Will buy 1 token, sell it, then find next');
    }
    console.log('🔍 Monitoring: Raydium + Pumpswap');
    
    // Log enabled strategies
    if (payload.enableAdaptiveSizing) console.log('📊 Adaptive position sizing: ENABLED');
    if (payload.enableTieredProfits) console.log('🎯 Tiered profit taking: ENABLED');
    if (payload.enableVolumeFilter) console.log('📈 Volume momentum filter: ENABLED');
    if (payload.enableSmartStopLoss) console.log('🛡️ Smart stop loss: ENABLED');
    if (payload.enableAntiRug) console.log('🔒 Anti-rug filters: ENABLED');
    
    const RAYDIUM_V4 = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
    const PUMPSWAP_PROGRAM = new PublicKey("PSWAPrqx6NcmirL8GigCeYew482kXWHUvSJHaunAyTY");
    const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
    
    let lastRaydiumSig: string | null = null;
    let lastPumpswapSig: string | null = null;
    let checkCount = 0;
    let activePositions: any[] = []; // For portfolio mode
    let isHoldingToken = false; // For sequential mode
    let currentPosition: any = null; // For sequential mode
    
    const checkForNewPools = async () => {
        // Check position limits
        if (portfolioMode) {
            if (activePositions.length >= maxPositions) {
                console.log(`⏸️ Max positions reached (${activePositions.length}/${maxPositions})`);
                return;
            }
        } else {
            // Sequential mode - skip if already holding
            if (isHoldingToken) {
                console.log('⏸️ Holding token, monitoring position...');
                return;
            }
        }
        
        try {
            checkCount++;
            console.log(`🔍 Check #${checkCount} - Scanning...`);
            
            const connection = (await import('@/lib/constant')).solanaConnection;
            
            // Check only Raydium and Pumpswap (safer, less rug pulls)
            // Use 'until' to get NEW transactions since last check
            const [raydiumSigs, pumpswapSigs] = await Promise.all([
                connection.getSignaturesForAddress(RAYDIUM_V4, {
                    limit: 20,  // Reduced to avoid rate limits
                    until: lastRaydiumSig || undefined
                }),
                connection.getSignaturesForAddress(PUMPSWAP_PROGRAM, {
                    limit: 20,  // Reduced to avoid rate limits
                    until: lastPumpswapSig || undefined
                })
            ]);
            
            // Update last seen signatures for next check
            if (raydiumSigs.length > 0) lastRaydiumSig = raydiumSigs[0].signature;
            if (pumpswapSigs.length > 0) lastPumpswapSig = pumpswapSigs[0].signature;
            
            const totalFound = raydiumSigs.length + pumpswapSigs.length;
            if (totalFound > 0) {
                console.log(`📦 Found ${raydiumSigs.length} Raydium + ${pumpswapSigs.length} Pumpswap txs`);
                
                // Parse Raydium transactions
                for (const sig of raydiumSigs) {
                    if (isHoldingToken) break; // Stop if we bought something
                    
                    try {
                        const tx = await connection.getTransaction(sig.signature, {
                            maxSupportedTransactionVersion: 0,
                            commitment: 'confirmed'
                        });
                        
                        if (!tx || !tx.meta) continue;
                        
                        // Check if transaction involves Raydium program
                        const accountKeys = tx.transaction.message.staticAccountKeys || 
                                          tx.transaction.message.getAccountKeys().staticAccountKeys;
                        
                        let involvesRaydium = false;
                        for (const key of accountKeys) {
                            if (key.toString() === RAYDIUM_V4.toString()) {
                                involvesRaydium = true;
                                break;
                            }
                        }
                        
                        if (!involvesRaydium) continue;
                        
                        // Check if this is a pool CREATION (Initialize2 instruction)
                        const instructions = tx.transaction.message.compiledInstructions || [];
                        let isPoolCreation = false;
                        let newTokenMint: PublicKey | null = null;
                        
                        for (const ix of instructions) {
                            const programIdIndex = ix.programIdIndex;
                            if (accountKeys[programIdIndex]?.toString() !== RAYDIUM_V4.toString()) continue;
                            
                            // Check instruction discriminator
                            const data = typeof ix.data === 'string' ? Buffer.from(ix.data, 'base64') : Buffer.from(ix.data);
                            if (data.length > 0 && data[0] === 1) { // Initialize2 = discriminator 1
                                isPoolCreation = true;
                                
                                // Extract base mint (non-SOL token) from accounts
                                // In Raydium Initialize2, baseMint is typically at account index 8
                                if (ix.accountKeyIndexes && ix.accountKeyIndexes.length > 8) {
                                    const baseMintKey = accountKeys[ix.accountKeyIndexes[8]];
                                    if (baseMintKey && baseMintKey.toString() !== SOL_MINT.toString()) {
                                        newTokenMint = baseMintKey;
                                    }
                                }
                                break;
                            }
                        }
                        
                        if (!isPoolCreation || !newTokenMint) {
                            continue; // Skip non-creation transactions silently to reduce spam
                        }
                        
                        console.log('🆕 New Raydium pool detected:', newTokenMint.toString().slice(0, 8) + '...');
                        
                        // Get token info and validate
                        const poolInfo = await validateNewToken(connection, newTokenMint, payload);
                        
                        if (poolInfo.isValid) {
                            console.log('✅ Token passed filters!');
                            console.log('💰 Liquidity:', poolInfo.liquiditySOL, 'SOL');
                            console.log('📊 Pool supply:', poolInfo.poolSupplyPercent, '%');
                            
                            // ADVANCED STRATEGY CHECKS
                            
                            // Anti-rug check
                            const antiRugPassed = await checkAntiRug(connection, newTokenMint, payload);
                            if (!antiRugPassed) continue;
                            
                            // Volume momentum check (skip if poolAddress not available)
                            if (poolInfo.poolAddress) {
                                const volumePassed = await checkVolumeMomentum(
                                    connection, 
                                    newTokenMint, 
                                    poolInfo.poolAddress, 
                                    payload
                                );
                                if (!volumePassed) continue;
                            }
                            
                            // Calculate adaptive buy amount
                            const buyAmount = calculateAdaptiveBuyAmount(
                                poolInfo.liquiditySOL || payload.amount,
                                payload.amount,
                                payload.enableAdaptiveSizing || false
                            );
                            
                            console.log(`💵 Buy amount: ${buyAmount.toFixed(3)} SOL (base: ${payload.amount})`);
                            
                            // BUY THE TOKEN
                            console.log('🚀 BUYING TOKEN NOW...');
                            if (!portfolioMode) isHoldingToken = true;
                            
                            const buyResult = await buy(
                                connection,
                                globalPayer!,
                                newTokenMint,
                                buyAmount
                            );
                            
                            if (buyResult.success) {
                                console.log('✅ BUY SUCCESSFUL!');
                                console.log('📝 Signature:', buyResult.signature);
                                
                                const newPosition = {
                                    mint: newTokenMint,
                                    buyPrice: buyResult.price,
                                    buyTime: Date.now(),
                                    amount: buyResult.amount,
                                    peakPrice: buyResult.price,
                                    poolInfo: poolInfo
                                };
                                
                                if (portfolioMode) {
                                    activePositions.push(newPosition);
                                    console.log(`💼 Added to portfolio (${activePositions.length}/${maxPositions})`);
                                    
                                    // Monitor independently
                                    monitorPositionForSell(connection, newPosition, payload).then(() => {
                                        activePositions = activePositions.filter(p => !p.mint.equals(newPosition.mint));
                                        console.log(`✅ Position closed! Portfolio: ${activePositions.length}/${maxPositions}`);
                                    });
                                } else {
                                    currentPosition = newPosition;
                                    
                                    // Sequential mode
                                    monitorPositionForSell(connection, currentPosition, payload).then(() => {
                                        console.log('✅ SOLD! Looking for next token...');
                                        isHoldingToken = false;
                                        currentPosition = null;
                                    });
                                }
                            } else {
                                console.log('❌ Buy failed:', buyResult.error);
                                if (!portfolioMode) isHoldingToken = false;
                            }
                            
                            if (!portfolioMode) break; // Sequential: stop after buying
                        } else {
                            console.log('❌ Token rejected:', poolInfo.reason);
                        }
                        
                    } catch (error) {
                        // Skip errors silently
                    }
                }
                
                // Parse Pumpswap transactions (if not already bought)
                if (!isHoldingToken) {
                    for (const sig of pumpswapSigs) {
                        if (isHoldingToken) break;
                        
                        try {
                            const tx = await connection.getTransaction(sig.signature, {
                                maxSupportedTransactionVersion: 0,
                                commitment: 'confirmed'
                            });
                            
                            if (!tx || !tx.meta) continue;
                            
                            // Check if this transaction involves the Pumpswap program
                            const accountKeys = tx.transaction.message.staticAccountKeys;
                            const hasPumpswap = accountKeys.some(key => key.equals(PUMPSWAP_PROGRAM));
                            
                            if (!hasPumpswap) continue;
                            
                            // Find new token mints (tokens that appeared in postBalances but not preBalances)
                            const preBalances = tx.meta.preTokenBalances || [];
                            const postBalances = tx.meta.postTokenBalances || [];
                            
                            for (const post of postBalances) {
                                if (post.mint === SOL_MINT.toString()) continue;
                                
                                const existedBefore = preBalances.some(pre => pre.mint === post.mint);
                                if (existedBefore) continue;
                                
                                const tokenMint = new PublicKey(post.mint);
                                console.log('🚀 New Pumpswap token:', tokenMint.toString().slice(0, 8) + '...');
                                
                                // Validate the pool has actual liquidity
                                const poolInfo = await validateNewToken(connection, tokenMint, payload);
                                if (!poolInfo) {
                                    console.log('❌ Pool validation failed');
                                    continue;
                                }
                                
                                console.log('✅ Valid pool! Buying...');
                                isHoldingToken = true;
                                
                                const buyResult = await buy(
                                    connection,
                                    globalPayer!,
                                    tokenMint,
                                    payload.amount
                                );
                                
                                if (buyResult.success) {
                                    console.log('✅ PUMPSWAP BUY SUCCESS!');
                                    currentPosition = {
                                        mint: tokenMint,
                                        buyPrice: buyResult.price,
                                        buyTime: Date.now(),
                                        amount: buyResult.amount
                                    };
                                    
                                    monitorPositionForSell(connection, currentPosition, payload).then(() => {
                                        console.log('✅ SOLD! Looking for next...');
                                        isHoldingToken = false;
                                        currentPosition = null;
                                    });
                                } else {
                                    console.log('❌ Pumpswap buy failed');
                                    isHoldingToken = false;
                                }
                                
                                break;
                            }
                            
                        } catch (error) {
                            // Skip errors
                        }
                    }
                }
            } else {
                console.log('💤 No new activity');
            }
        } catch (error) {
            console.error('Error checking for pools:', error);
        }
    };
    
    // Initial check
    await checkForNewPools();
    
    // Set up polling interval - 15 seconds to avoid rate limits
    const intervalId = setInterval(checkForNewPools, 15000);
    
    console.log('✅ Sniper monitoring active (RPC polling mode)');
    console.log('⏳ Polling every 15 seconds to avoid rate limits');
    
    // Keep running (in production, you'd want a stop mechanism)
    return new Promise<boolean>((resolve) => {
        // Never resolves - keeps running until process killed
        // In a real app, you'd have a stop button that clears the interval
    });
}

interface PoolInfo {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    liquiditySOL: number;
    poolSupplyPercent: number;
    poolAddress: PublicKey;
}

async function parseRaydiumTransaction(
    tx: any,
    connection: any
): Promise<PoolInfo | null> {
    try {
        if (!tx || !tx.transaction) return null;
        
        // Handle both legacy and versioned transactions
        const message = tx.transaction.message;
        const instructions = message.compiledInstructions || message.instructions;
        
        // Get account keys - handle different formats
        let accountKeys: PublicKey[] = [];
        if (message.accountKeys) {
            accountKeys = message.accountKeys;
        } else if (message.staticAccountKeys) {
            accountKeys = message.staticAccountKeys;
        } else if (tx.transaction.message.getAccountKeys) {
            accountKeys = tx.transaction.message.getAccountKeys().keySegments().flat();
        }
        
        if (!Array.isArray(accountKeys) || accountKeys.length === 0) {
            return null;
        }
        
        const RAYDIUM_V4 = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
        
        for (const ix of instructions) {
            // Check if this is a Raydium instruction
            const programIdIndex = typeof ix.programIdIndex === 'number' ? ix.programIdIndex : -1;
            if (programIdIndex === -1 || programIdIndex >= accountKeys.length) continue;
            
            const programId = accountKeys[programIdIndex];
            const programIdStr = typeof programId === 'string' ? programId : programId.toString();
            
            if (programIdStr !== RAYDIUM_V4) {
                continue;
            }
            
            // Decode instruction data
            const data = Buffer.from(ix.data, 'base64');
            const discriminator = data[0];
            
            // Initialize2 instruction has discriminator 1
            if (discriminator === 1) {
                // Extract pool account (typically first account)
                const poolAddress = accountKeys[ix.accounts[4]];
                
                // Get pool account data
                const poolAccount = await connection.getAccountInfo(poolAddress);
                if (!poolAccount) return null;
                
                // Parse pool state using Raydium layout
                const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(poolAccount.data);
                
                const baseMint = poolState.baseMint;
                const quoteMint = poolState.quoteMint;
                const baseVault = poolState.baseVault;
                const quoteVault = poolState.quoteVault;
                
                // Get token balances
                const baseBalance = await connection.getTokenAccountBalance(baseVault);
                const quoteBalance = await connection.getTokenAccountBalance(quoteVault);
                
                // Assuming quote is SOL (wrapped SOL)
                const liquiditySOL = parseFloat(quoteBalance.value.uiAmount || 0);
                
                // Calculate pool supply percentage
                const baseSupply = parseFloat(baseBalance.value.uiAmount || 0);
                const baseMintInfo = await connection.getParsedAccountInfo(baseMint);
                const totalSupply = baseMintInfo.value?.data?.parsed?.info?.supply || 1;
                const poolSupplyPercent = (baseSupply / (totalSupply / Math.pow(10, baseBalance.value.decimals))) * 100;
                
                return {
                    baseMint: new PublicKey(baseMint),
                    quoteMint: new PublicKey(quoteMint),
                    liquiditySOL,
                    poolSupplyPercent,
                    poolAddress: new PublicKey(poolAddress)
                };
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error parsing transaction:', error);
        return null;
    }
}

function validatePoolFilters(pool: PoolInfo, filters: snipePayload): boolean {
    console.log('🔎 Validating filters...');
    
    // Check min liquidity
    if (pool.liquiditySOL < filters.minLiquidity) {
        console.log(`❌ Liquidity too low: ${pool.liquiditySOL} < ${filters.minLiquidity}`);
        return false;
    }
    
    // Check max liquidity
    if (pool.liquiditySOL > filters.maxLiquidity) {
        console.log(`❌ Liquidity too high: ${pool.liquiditySOL} > ${filters.maxLiquidity}`);
        return false;
    }
    
    // Check pool supply percentage
    if (filters.poolSupply > 0 && pool.poolSupplyPercent < filters.poolSupply) {
        console.log(`❌ Pool supply too low: ${pool.poolSupplyPercent}% < ${filters.poolSupply}%`);
        return false;
    }
    
    console.log('✅ All filters passed!');
    return true;
}

interface ValidationResult {
    isValid: boolean;
    reason?: string;
    liquiditySOL?: number;
    poolSupplyPercent?: number;
    poolAddress?: PublicKey;
}

async function validateNewToken(
    connection: any,
    tokenMint: PublicKey,
    filters: snipePayload
): Promise<ValidationResult> {
    try {
        const { LIQUIDITY_STATE_LAYOUT_V4 } = await import('@raydium-io/raydium-sdk');
        const RAYDIUM_V4 = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
        const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
        
        // Find Raydium pools for this token
        const programAccounts = await connection.getProgramAccounts(RAYDIUM_V4, {
            filters: [
                { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
                {
                    memcmp: {
                        offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint'),
                        bytes: tokenMint.toBase58()
                    }
                }
            ]
        });
        
        if (programAccounts.length === 0) {
            return { isValid: false, reason: 'No Raydium pool found' };
        }
        
        // Parse first pool
        const poolAccount = programAccounts[0];
        const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(poolAccount.account.data);
        
        // Get SOL vault balance (quote vault)
        const quoteVault = poolState.quoteVault;
        const vaultBalance = await connection.getTokenAccountBalance(quoteVault);
        const liquiditySOL = parseFloat(vaultBalance.value.uiAmount || 0);
        
        // Get token info for supply check
        const mintInfo = await connection.getParsedAccountInfo(tokenMint);
        const supply = mintInfo.value?.data?.parsed?.info?.supply || 0;
        const decimals = mintInfo.value?.data?.parsed?.info?.decimals || 9;
        const totalSupply = supply / Math.pow(10, decimals);
        
        // Get pool token balance
        const baseVault = poolState.baseVault;
        const poolTokenBalance = await connection.getTokenAccountBalance(baseVault);
        const poolTokens = parseFloat(poolTokenBalance.value.uiAmount || 0);
        
        const poolSupplyPercent = totalSupply > 0 ? (poolTokens / totalSupply) * 100 : 0;
        
        // Validate filters
        if (liquiditySOL < filters.minLiquidity) {
            return {
                isValid: false,
                reason: `Liquidity ${liquiditySOL.toFixed(2)} < ${filters.minLiquidity} SOL`,
                liquiditySOL,
                poolSupplyPercent
            };
        }
        
        if (liquiditySOL > filters.maxLiquidity) {
            return {
                isValid: false,
                reason: `Liquidity ${liquiditySOL.toFixed(2)} > ${filters.maxLiquidity} SOL`,
                liquiditySOL,
                poolSupplyPercent
            };
        }
        
        if (poolSupplyPercent < filters.poolSupply) {
            return {
                isValid: false,
                reason: `Pool supply ${poolSupplyPercent.toFixed(1)}% < ${filters.poolSupply}%`,
                liquiditySOL,
                poolSupplyPercent
            };
        }
        
        return {
            isValid: true,
            liquiditySOL,
            poolSupplyPercent,
            poolAddress: programAccounts[0].pubkey
        };
        
    } catch (error) {
        return { isValid: false, reason: 'Validation error: ' + error };
    }
}

async function monitorPositionForSell(
    connection: any,
    position: any,
    config: snipePayload
): Promise<void> {
    const takeProfitMultiplier = 1 + (config.takeProfitPercent || 100) / 100; // Default 2x
    const stopLossMultiplier = 1 - (config.stopLossPercent || 20) / 100; // Default 0.8x (-20%)
    const maxHoldMs = (config.maxHoldTimeMinutes || 60) * 60 * 1000;
    
    const useTieredProfits = config.enableTieredProfits || false;
    const useSmartStopLoss = config.enableSmartStopLoss || false;
    
    console.log('📊 Monitoring position for sell...');
    if (useTieredProfits) {
        console.log('🎯 Tiered: 50%@1.5x, 30%@2x, 20%@5x+');
    } else {
        console.log(`🎯 Target: ${takeProfitMultiplier}x`);
    }
    console.log(`🛑 Stop: ${stopLossMultiplier}x${useSmartStopLoss ? ' (smart trailing)' : ''} | ⏰ Max: ${config.maxHoldTimeMinutes || 60}min`);
    
    const CHECK_INTERVAL = 5000;
    const MAX_HOLD_TIME = maxHoldMs;
    const STOP_LOSS = stopLossMultiplier;
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    let peakPrice = position.buyPrice;
    let currentStopLoss = STOP_LOSS;
    let soldPercentages = { p50: false, p30: false, p20: false }; // Track tiered sells
    
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const checkPrice = async () => {
            try {
                const elapsed = Date.now() - startTime;
                
                if (elapsed > MAX_HOLD_TIME) {
                    console.log('⏰ Max hold time - selling');
                    await sell(connection, globalPayer!, position.mint);
                    resolve();
                    return;
                }
                
                // Get current price from Jupiter quote API
                try {
                    const quoteResponse = await fetch(
                        `https://quote-api.jup.ag/v6/quote?inputMint=${position.mint.toString()}&outputMint=${SOL_MINT}&amount=1000000&slippageBps=50`
                    );
                    const quoteData = await quoteResponse.json();
                    
                    if (quoteData.outAmount) {
                        const currentPrice = parseFloat(quoteData.outAmount) / 1000000;
                        const priceChange = currentPrice / position.buyPrice;
                        const profitPercent = ((priceChange - 1) * 100).toFixed(1);
                        
                        console.log(`💹 ${priceChange.toFixed(3)}x (${profitPercent}%)`);
                        
                        // Update peak price for smart trailing
                        if (currentPrice > peakPrice) {
                            peakPrice = currentPrice;
                            
                            // Smart stop loss: lock in profits as price rises
                            if (useSmartStopLoss) {
                                if (priceChange >= 1.6) {
                                    currentStopLoss = 1.2; // Lock 20% profit
                                } else if (priceChange >= 1.3) {
                                    currentStopLoss = 1.0; // Move to breakeven
                                }
                            }
                        }
                        
                        // TIERED PROFIT TAKING
                        if (useTieredProfits) {
                            if (priceChange >= 5.0 && !soldPercentages.p20) {
                                console.log('🌙 5X! Selling moon bag (20%)');
                                await sellTiered(connection, globalPayer!, position.mint, currentPrice, position.buyPrice, position.amount);
                                soldPercentages.p20 = true;
                            } else if (priceChange >= 2.0 && !soldPercentages.p30) {
                                console.log('🎯 2X! Selling 30%');
                                await sellTiered(connection, globalPayer!, position.mint, currentPrice, position.buyPrice, position.amount);
                                soldPercentages.p30 = true;
                            } else if (priceChange >= 1.5 && !soldPercentages.p50) {
                                console.log('📈 1.5X! Selling 50%');
                                await sellTiered(connection, globalPayer!, position.mint, currentPrice, position.buyPrice, position.amount);
                                soldPercentages.p50 = true;
                            }
                            
                            // Exit if all tiers sold or stop loss hit
                            if (soldPercentages.p50 && soldPercentages.p30 && soldPercentages.p20) {
                                console.log('✅ All profit tiers sold!');
                                resolve();
                                return;
                            }
                        } else {
                            // Standard take profit
                            if (priceChange >= takeProfitMultiplier) {
                                console.log(`🎯 TAKE PROFIT! ${priceChange.toFixed(2)}x`);
                                await sell(connection, globalPayer!, position.mint);
                                resolve();
                                return;
                            }
                        }
                        
                        // Check stop loss (works for both modes)
                        const dropFromPeak = currentPrice / peakPrice;
                        if (priceChange <= currentStopLoss || (useSmartStopLoss && dropFromPeak <= 0.85)) {
                            console.log(`🛑 STOP LOSS! ${priceChange.toFixed(2)}x (peak: ${(peakPrice/position.buyPrice).toFixed(2)}x)`);
                            await sell(connection, globalPayer!, position.mint);
                            resolve();
                            return;
                        }
                    }
                } catch (priceError) {
                    console.log('⚠️ Price check failed, retrying...');
                }
                
                setTimeout(checkPrice, CHECK_INTERVAL);
                
            } catch (error) {
                console.error('Price check error:', error);
                setTimeout(checkPrice, CHECK_INTERVAL);
            }
        };
        
        checkPrice();
    });
}

async function sell(
    connection: any,
    payer: Keypair,
    tokenMint: PublicKey
): Promise<void> {
    try {
        console.log('💰 SELLING token:', tokenMint.toString().slice(0, 8) + '...');
        
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        
        // Get token balance
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(payer.publicKey, {
            mint: tokenMint
        });
        
        if (tokenAccounts.value.length === 0) {
            console.log('❌ No tokens to sell');
            return;
        }
        
        const tokenAmount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.amount;
        
        // Get Jupiter quote
        const quoteResponse = await fetch(
            `https://quote-api.jup.ag/v6/quote?inputMint=${tokenMint.toString()}&outputMint=${SOL_MINT}&amount=${tokenAmount}&slippageBps=500`
        );
        const quoteData = await quoteResponse.json();
        
        if (!quoteData.outAmount) {
            console.log('❌ No sell route found');
            return;
        }
        
        // Get swap transaction
        const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteResponse: quoteData,
                userPublicKey: payer.publicKey.toString(),
                wrapAndUnwrapSol: true
            })
        });
        
        const { swapTransaction } = await swapResponse.json();
        
        // Execute swap
        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        const transaction = (await import('@solana/web3.js')).VersionedTransaction.deserialize(swapTransactionBuf);
        transaction.sign([payer]);
        
        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature);
        
        console.log('✅ SOLD! Signature:', signature.slice(0, 8) + '...');
        
    } catch (error) {
        console.error('❌ Sell failed:', error);
    }
}

// ============= ADVANCED STRATEGY HELPERS =============

/**
 * Calculate adaptive position size based on pool liquidity
 */
function calculateAdaptiveBuyAmount(liquidity: number, baseAmount: number, enabled: boolean): number {
    if (!enabled) return baseAmount;
    
    if (liquidity >= 50) {
        return baseAmount * 1.4; // 140% for high liquidity
    } else if (liquidity >= 10) {
        return baseAmount * 0.8; // 80% for medium liquidity
    } else {
        return baseAmount * 0.4; // 40% for low liquidity
    }
}

/**
 * Calculate dynamic slippage based on pool liquidity
 */
function calculateDynamicSlippage(liquidity: number, baseSlippage: number, enabled: boolean): number {
    if (!enabled) return baseSlippage;
    
    if (liquidity >= 50) {
        return Math.max(10, baseSlippage - 15); // Lower slippage for high liquidity
    } else if (liquidity >= 10) {
        return baseSlippage; // Normal slippage
    } else {
        return Math.min(50, baseSlippage + 15); // Higher slippage for low liquidity
    }
}

/**
 * Check if token has suspicious holder concentration (anti-rug)
 */
async function checkAntiRug(
    connection: any,
    tokenMint: PublicKey,
    config: snipePayload
): Promise<boolean> {
    if (!config.enableAntiRug) return true;
    
    try {
        // Check mint authority (should be renounced)
        const mintInfo = await connection.getParsedAccountInfo(tokenMint);
        if (mintInfo.value?.data?.parsed?.info?.mintAuthority) {
            console.log('⚠️ Mint authority not renounced - SKIP');
            return false;
        }
        
        // Check freeze authority (should be disabled)
        if (mintInfo.value?.data?.parsed?.info?.freezeAuthority) {
            console.log('⚠️ Freeze authority enabled - SKIP');
            return false;
        }
        
        // Get top holders
        const largestAccounts = await connection.getTokenLargestAccounts(tokenMint);
        const totalSupply = mintInfo.value?.data?.parsed?.info?.supply || 0;
        
        if (totalSupply === 0) return true;
        
        // Calculate top 10 holders percentage
        const top10Amount = largestAccounts.value
            .slice(0, 10)
            .reduce((sum: number, acc: any) => sum + parseInt(acc.amount), 0);
        
        const top10Percent = (top10Amount / totalSupply) * 100;
        const maxPercent = config.maxTopHolderPercent || 60;
        
        if (top10Percent > maxPercent) {
            console.log(`⚠️ Top 10 holders own ${top10Percent.toFixed(1)}% (max ${maxPercent}%) - SKIP`);
            return false;
        }
        
        console.log(`✅ Anti-rug passed: Top 10 = ${top10Percent.toFixed(1)}%`);
        return true;
        
    } catch (error) {
        console.log('⚠️ Anti-rug check failed, allowing trade');
        return true;
    }
}

/**
 * Check volume/activity momentum (requires recent swap data)
 */
async function checkVolumeMomentum(
    connection: any,
    tokenMint: PublicKey,
    poolAddress: PublicKey,
    config: snipePayload
): Promise<boolean> {
    if (!config.enableVolumeFilter) return true;
    
    try {
        // Get recent signatures for the pool (last 1 minute)
        const signatures = await connection.getSignaturesForAddress(poolAddress, {
            limit: 100
        });
        
        const oneMinuteAgo = Date.now() / 1000 - 60;
        const recentSwaps = signatures.filter((sig: any) => sig.blockTime && sig.blockTime > oneMinuteAgo);
        
        const minSwaps = config.minSwapsPerMinute || 50;
        
        if (recentSwaps.length < minSwaps) {
            console.log(`⚠️ Low activity: ${recentSwaps.length} swaps/min (need ${minSwaps}) - SKIP`);
            return false;
        }
        
        console.log(`✅ High activity: ${recentSwaps.length} swaps/min`);
        return true;
        
    } catch (error) {
        console.log('⚠️ Volume check failed, allowing trade');
        return true;
    }
}

/**
 * Sell token in tiered chunks for better profit taking
 */
async function sellTiered(
    connection: any,
    payer: Keypair,
    tokenMint: PublicKey,
    currentPrice: number,
    buyPrice: number,
    totalAmount: string
): Promise<void> {
    try {
        const priceMultiplier = currentPrice / buyPrice;
        const totalTokens = parseInt(totalAmount);
        
        let sellAmount = 0;
        let sellPercent = 0;
        
        // Determine which tier to sell
        if (priceMultiplier >= 5.0) {
            // Moon shot! Sell 100% (or 20% moon bag portion)
            sellAmount = Math.floor(totalTokens * 0.2); // Sell the moon bag
            sellPercent = 20;
            console.log('🌙 5X+ HIT! Selling moon bag (20%)');
        } else if (priceMultiplier >= 2.0) {
            // 2x target - sell 30%
            sellAmount = Math.floor(totalTokens * 0.3);
            sellPercent = 30;
            console.log('🎯 2X HIT! Selling 30%');
        } else if (priceMultiplier >= 1.5) {
            // 1.5x partial profit - sell 50%
            sellAmount = Math.floor(totalTokens * 0.5);
            sellPercent = 50;
            console.log('📈 1.5X HIT! Selling 50%');
        } else {
            // Below 1.5x, don't sell (wait or hit stop loss)
            return;
        }
        
        if (sellAmount === 0) return;
        
        // Execute partial sell via Jupiter
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        
        const quoteResponse = await fetch(
            `https://quote-api.jup.ag/v6/quote?inputMint=${tokenMint.toString()}&outputMint=${SOL_MINT}&amount=${sellAmount}&slippageBps=500`
        );
        const quoteData = await quoteResponse.json();
        
        if (!quoteData.outAmount) {
            console.log('❌ No sell route for partial sell');
            return;
        }
        
        const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteResponse: quoteData,
                userPublicKey: payer.publicKey.toString(),
                wrapAndUnwrapSol: true
            })
        });
        
        const { swapTransaction } = await swapResponse.json();
        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        const transaction = (await import('@solana/web3.js')).VersionedTransaction.deserialize(swapTransactionBuf);
        transaction.sign([payer]);
        
        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature);
        
        console.log(`✅ SOLD ${sellPercent}%! Sig: ${signature.slice(0, 8)}...`);
        
    } catch (error) {
        console.error('❌ Tiered sell failed:', error);
    }
}
