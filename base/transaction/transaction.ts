import { Keypair, Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { snipePayload } from '../types';
import bs58 from 'bs58';
import { solanaConnection, IS_JITO } from '@/lib/constant';
import { jitoBundle } from '../pump/jitoBundle';

let globalPayer: Keypair | null = null;
let globalPayload: snipePayload | null = null;
const activePositions: Map<string, any> = new Map();

export async function init(payload: snipePayload): Promise<void> {
  try {
    // Decode private key and store for later use
    const secretKey = bs58.decode(payload.privateKey);
    globalPayer = Keypair.fromSecretKey(secretKey);
    globalPayload = payload;
    
    console.log('✅ Sniper initialized with wallet:', globalPayer.publicKey.toString());
    console.log('💰 Buy amount:', payload.amount, 'SOL');
    console.log('📊 Filters:', {
      minLiquidity: payload.minLiquidity,
      maxLiquidity: payload.maxLiquidity,
      slippage: payload.slippage + '%',
      poolSupply: payload.poolSupply + '%'
    });
    console.log('🛡️ MEV Protection:', payload.isSetMev ? 'Enabled (Tip: ' + payload.tipAmount + ' SOL)' : 'Disabled');
  } catch (error) {
    console.error('❌ Failed to initialize sniper:', error);
    throw error;
  }
}

export async function buy(
  connection: Connection,
  payer: Keypair,
  tokenAddress: PublicKey,
  amount: number
): Promise<any> {
  try {
    console.log('🎯 Buying token:', tokenAddress.toString().slice(0, 8) + '...');
    console.log('💵 Amount:', amount, 'SOL');
    
    const { ComputeBudgetProgram, VersionedTransaction } = await import('@solana/web3.js');
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const amountLamports = Math.floor(amount * 1e9);
    
    // Get Jupiter quote
    const quoteResponse = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${tokenAddress.toString()}&amount=${amountLamports}&slippageBps=2500`
    );
    const quoteData = await quoteResponse.json();
    
    if (!quoteData.outAmount) {
      return { success: false, error: 'No route found' };
    }
    
    console.log('📊 Quote received, getting swap transaction...');
    
    // Get swap transaction
    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: payer.publicKey.toString(),
        wrapAndUnwrapSol: true,
        computeUnitPriceMicroLamports: 50000
      })
    });
    
    const { swapTransaction } = await swapResponse.json();
    
    // Execute swap
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    transaction.sign([payer]);
    
    let signature: string;
    
    // Use Jito bundle for MEV protection and faster execution
    if (IS_JITO && globalPayload?.isSetMev) {
      console.log('📤 Sending via Jito bundle (MEV protected, same-block landing)...');
      const bundleResult = await jitoBundle([transaction], payer, true);
      
      if (bundleResult.confirmed) {
        signature = bundleResult.jitoTxsignature;
        console.log('✅ Jito bundle confirmed! Bundle ID:', bundleResult.bundleId);
      } else {
        console.log('⚠️ Jito bundle failed, falling back to regular RPC...');
        signature = await connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: true,
          maxRetries: 2
        });
        await connection.confirmTransaction(signature, 'confirmed');
      }
    } else {
      console.log('📤 Sending via regular RPC...');
      signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true,
        maxRetries: 2
      });
      
      console.log('⏳ Confirming...');
      await connection.confirmTransaction(signature, 'confirmed');
    }
    
    // Calculate effective price
    const tokensReceived = parseFloat(quoteData.outAmount);
    const price = amountLamports / tokensReceived;
    
    console.log('✅ BUY SUCCESS!');
    console.log('📝 Signature:', signature.slice(0, 8) + '...');
    console.log('🪙 Tokens:', (tokensReceived / 1e9).toFixed(2));
    
    return {
      success: true,
      signature,
      price,
      amount: tokensReceived
    };
    
  } catch (error) {
    console.error('❌ Buy failed:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

export async function checkValidation(
  connection: Connection,
  tokenAddress: PublicKey,
  config: any
): Promise<boolean> {
  // Implement validation checks
  return true;
}

export async function sell(
  connection: Connection,
  payer: Keypair,
  tokenAddress: PublicKey,
  amount: number,
  reason: string
): Promise<string> {
  try {
    console.log('💰 Attempting to sell token:', tokenAddress.toString());
    console.log('📊 Reason:', reason);
    console.log('🔢 Amount:', amount);
    
    // Use Jupiter for selling (most reliable)
    const { getSellTxWithJupiter } = await import('../swapOnlyAmm');
    
    const signature = await getSellTxWithJupiter(payer, tokenAddress, amount);
    
    if (signature) {
      console.log('✅ Sell successful!');
      console.log('📝 Signature:', signature);
      
      // Remove from active positions
      activePositions.delete(tokenAddress.toString());
      
      return signature;
    } else {
      throw new Error('Failed to get sell transaction');
    }
  } catch (error) {
    console.error('❌ Sell failed:', error);
    throw error;
  }
}

export function trackPosition(tokenAddress: string, buyPrice: number, amount: number, signature: string) {
  const position = {
    tokenAddress,
    buyPrice,
    peakPrice: buyPrice,
    buyTime: Date.now(),
    amount,
    signature
  };
  
  activePositions.set(tokenAddress, position);
  console.log('📊 Position tracked:', {
    token: tokenAddress,
    buyPrice,
    amount
  });
  
  // Start monitoring this position
  startPositionMonitoring(tokenAddress);
}

async function startPositionMonitoring(tokenAddress: string) {
  if (!globalPayload || !globalPayer) return;
  
  const position = activePositions.get(tokenAddress);
  if (!position) return;
  
  const config = globalPayload;
  const checkInterval = 10000; // Check every 10 seconds
  
  const monitor = setInterval(async () => {
    try {
      const pos = activePositions.get(tokenAddress);
      if (!pos) {
        clearInterval(monitor);
        return;
      }
      
      // Get current price (simplified - in production use real price feed)
      const currentPrice = await getCurrentTokenPrice(tokenAddress);
      
      if (!currentPrice) return;
      
      // Update peak price for trailing stop
      if (currentPrice > pos.peakPrice) {
        pos.peakPrice = currentPrice;
      }
      
      const profitPercent = ((currentPrice - pos.buyPrice) / pos.buyPrice) * 100;
      const drawdownPercent = ((pos.peakPrice - currentPrice) / pos.peakPrice) * 100;
      const holdTimeMinutes = (Date.now() - pos.buyTime) / 60000;
      
      console.log('📊 Position Update:', {
        token: tokenAddress.slice(0, 8) + '...',
        profit: profitPercent.toFixed(2) + '%',
        drawdown: drawdownPercent.toFixed(2) + '%',
        holdTime: holdTimeMinutes.toFixed(1) + 'min'
      });
      
      let shouldSell = false;
      let sellReason = '';
      
      // Check take profit
      if (config.takeProfitPercent && profitPercent >= config.takeProfitPercent) {
        shouldSell = true;
        sellReason = `Take Profit Hit: ${profitPercent.toFixed(2)}% (target: ${config.takeProfitPercent}%)`;
      }
      
      // Check stop loss
      if (config.stopLossPercent && profitPercent <= -config.stopLossPercent) {
        shouldSell = true;
        sellReason = `Stop Loss Hit: ${profitPercent.toFixed(2)}% (limit: -${config.stopLossPercent}%)`;
      }
      
      // Check trailing stop
      if (config.trailingStopPercent && drawdownPercent >= config.trailingStopPercent) {
        shouldSell = true;
        sellReason = `Trailing Stop Hit: ${drawdownPercent.toFixed(2)}% from peak (limit: ${config.trailingStopPercent}%)`;
      }
      
      // Check max hold time
      if (config.maxHoldTimeMinutes && holdTimeMinutes >= config.maxHoldTimeMinutes) {
        shouldSell = true;
        sellReason = `Max Hold Time: ${holdTimeMinutes.toFixed(1)}min (limit: ${config.maxHoldTimeMinutes}min)`;
      }
      
      if (shouldSell) {
        console.log('🚨 SELL TRIGGER:', sellReason);
        clearInterval(monitor);
        
        // Execute sell
        await sell(
          solanaConnection,
          globalPayer!,
          new PublicKey(tokenAddress),
          pos.amount,
          sellReason
        );
      }
      
    } catch (error) {
      console.error('Error monitoring position:', error);
    }
  }, checkInterval);
}

async function getCurrentTokenPrice(tokenAddress: string): Promise<number | null> {
  try {
    // In production, use BirdEye API or Jupiter price feed
    // For now, simulate price checking
    const { BIRD_EYE_API } = await import('@/lib/constant');
    
    // TODO: Implement real price fetching
    // const response = await fetch(`https://public-api.birdeye.so/public/price?address=${tokenAddress}`, {
    //   headers: { 'X-API-KEY': BIRD_EYE_API }
    // });
    // const data = await response.json();
    // return data.data.value;
    
    console.log('⚠️ Price checking not implemented - simulation mode');
    return null;
  } catch (error) {
    console.error('Error fetching price:', error);
    return null;
  }
}

