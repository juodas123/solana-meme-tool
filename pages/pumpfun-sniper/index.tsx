import { useState } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout/layout';
import { Input, Button, Switch } from '@heroui/react';
import { toastError, toastSuccess } from '@/lib/utils';

export default function PumpFunSniper() {
  const [amount, setAmount] = useState("0.1");
  const [slippage, setSlippage] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // Filters
  const [enableVolumeFilter, setEnableVolumeFilter] = useState(false);
  
  // Sell configuration
  const [takeProfitPercent, setTakeProfitPercent] = useState(50); // 1.5x profit
  const [stopLossPercent, setStopLossPercent] = useState(20);
  
  // Portfolio mode
  const [enablePortfolioMode, setEnablePortfolioMode] = useState(false);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post('/api/pumpfun-sniper', {
        action: 'start',
        amount,
        slippage,
        enableVolumeFilter,
        takeProfitPercent,
        stopLossPercent,
        enablePortfolioMode
      });

      if (response.data.success) {
        setIsRunning(true);
        toastSuccess('✅ Pump.fun Pre-Graduation Sniper Started!');
      }
    } catch (error: any) {
      toastError('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post('/api/pumpfun-sniper', {
        action: 'stop'
      });

      if (response.data.success) {
        setIsRunning(false);
        toastSuccess('🛑 Pump.fun Sniper Stopped');
      }
    } catch (error: any) {
      toastError('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">🚀 Pump.fun Momentum Scalper</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Buy tokens at 30-60% bonding curve with proven momentum, exit at 85-90% before graduation crowd
            </p>
          </div>

          {/* Strategy Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2">📊 Momentum Scalping Strategy:</h3>
            <ul className="text-sm space-y-1">
              <li>✅ Targets 30-60% bonding curve ($20k-$40k MC)</li>
              <li>✅ Requires proven momentum: +10% price increase</li>
              <li>✅ Checks holder distribution (&lt;35% top 10 holders)</li>
              <li>✅ Exits at 85-90% bonding curve (before graduation)</li>
              <li>✅ Target: 2-3x profit in 5-15 minutes</li>
            </ul>
          </div>

          {/* Configuration Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
            
            {/* Security Notice */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                    🔒 Secure Configuration
                  </h3>
                  <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                    <p>Private key is stored in <code className="bg-green-100 dark:bg-green-900 px-1 rounded">.env</code> file (server-side only, never transmitted to browser)</p>
                    <p className="mt-1">Set <code className="bg-green-100 dark:bg-green-900 px-1 rounded">TRADING_PRIVATE_KEY</code> in your <code className="bg-green-100 dark:bg-green-900 px-1 rounded">.env</code> file</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Buy Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2">Buy Amount (SOL)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">Start VERY small for testing (0.01 SOL = ~$2)</p>
              </div>

              <div>
                <label className="block mb-2">Slippage (%)</label>
                <Input
                  type="number"
                  value={slippage.toString()}
                  onChange={(e) => setSlippage(parseInt(e.target.value) || 25)}
                  placeholder="25"
                />
                <p className="text-xs text-gray-500 mt-1">Higher slippage = faster execution</p>
              </div>
            </div>

            {/* Profit Targets */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2">Take Profit (%)</label>
                <Input
                  type="number"
                  value={takeProfitPercent.toString()}
                  onChange={(e) => setTakeProfitPercent(parseInt(e.target.value) || 50)}
                  placeholder="50"
                />
                <p className="text-xs text-gray-500 mt-1">Target 100-150% (2-2.5x) for momentum plays</p>
              </div>

              <div>
                <label className="block mb-2">Stop Loss (%)</label>
                <Input
                  type="number"
                  value={stopLossPercent.toString()}
                  onChange={(e) => setStopLossPercent(parseInt(e.target.value) || 20)}
                  placeholder="20"
                />
                <p className="text-xs text-gray-500 mt-1">Max loss if graduation fails</p>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Advanced Options</h3>
              
              <div className="space-y-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableVolumeFilter}
                    onChange={(e) => setEnableVolumeFilter(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span>Enable Volume Filter (min $10k volume)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enablePortfolioMode}
                    onChange={(e) => setEnablePortfolioMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span>Portfolio Mode (hold multiple positions)</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleStart}
                disabled={isLoading || isRunning}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isLoading ? 'Starting...' : isRunning ? '✅ Running' : '🚀 Start Sniper'}
              </Button>

              {isRunning && (
                <Button
                  onClick={handleStop}
                  disabled={isLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {isLoading ? 'Stopping...' : '🛑 Stop Sniper'}
                </Button>
              )}
            </div>

            {isRunning && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 text-center">
                <p className="text-green-700 dark:text-green-300 font-semibold">
                  ✅ Sniper Active - Check server console for detections
                </p>
              </div>
            )}

          </div>

          {/* Tips */}
          <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h3 className="font-semibold mb-2">💡 Momentum Scalping Tips:</h3>
            <ul className="text-sm space-y-1">
              <li>• Start with 0.01 SOL to test the strategy</li>
              <li>• Best time: High activity hours (9am-5pm EST)</li>
              <li>• This strategy catches tokens BEFORE graduation hype</li>
              <li>• Higher win rate (40-50%) than ultra-early sniping</li>
              <li>• Exits before graduation = less competition</li>
              <li>• Watch for 8+ txs/min = strong momentum signal</li>
            </ul>
          </div>

        </div>
      </div>
    </Layout>
  );
}
