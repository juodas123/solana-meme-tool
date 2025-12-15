import type { NextApiRequest, NextApiResponse } from 'next';
import { startPreGraduationSniper, stopPreGraduationSniper } from '@/base/pumpfun-sniper';
import { solanaConnection } from '@/lib/constant';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

let isRunning = false;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const {
      action,
      amount,
      minLiquidity,
      maxLiquidity,
      poolSupply,
      slippage,
      strategyMode,
      enablePortfolioMode,
      enableVolumeFilter,
      takeProfitPercent,
      stopLossPercent
    } = req.body;

    if (action === 'start') {
      if (isRunning) {
        return res.status(400).json({ error: 'Pre-graduation sniper already running' });
      }

      // Get private key from server environment variable (NEVER from client)
      const privateKey = process.env.TRADING_PRIVATE_KEY;
      
      if (!privateKey || privateKey === 'YOUR_PRIVATE_KEY_HERE') {
        return res.status(400).json({ 
          error: 'TRADING_PRIVATE_KEY not configured in .env file' 
        });
      }

      try {
        const secretKey = bs58.decode(privateKey);
        const payer = Keypair.fromSecretKey(secretKey);

        const payload = {
          amount: parseFloat(amount) || 0.1,
          slippage: parseFloat(slippage) || 25,
          minLiquidity: parseFloat(minLiquidity) || 5,
          maxLiquidity: parseFloat(maxLiquidity) || 50000,
          poolSupply: parseFloat(poolSupply) || 5,
          strategyMode: strategyMode || 'aggressive',
          enablePortfolioMode: enablePortfolioMode || false,
          enableVolumeFilter: enableVolumeFilter || false,
          takeProfitPercent: parseFloat(takeProfitPercent) || 100,
          stopLossPercent: parseFloat(stopLossPercent) || 20,
          privateKey,
          tipAmount: 0,
          isSetMev: 0
        };

        // Start the sniper in background
        startPreGraduationSniper(solanaConnection, payer, payload);
        
        isRunning = true;

        res.status(200).json({ 
          success: true, 
          message: 'Pre-graduation sniper started!' 
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }

    } else if (action === 'stop') {
      stopPreGraduationSniper();
      isRunning = false;
      res.status(200).json({ success: true, message: 'Pre-graduation sniper stopped' });

    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
