import { useState, useEffect } from "react";
import {
  Input,
  useDisclosure,
  Switch,
  Button,
  Checkbox,
  CheckboxGroup,
  Tooltip
} from "@heroui/react";
import axios from "axios";
import Layout from "@/components/Layout/layout";
import { isValidSolanaPrivateKey, toastError, toastSuccess } from "@/lib/utils";

interface IInput {
  wallet: string;
  amount: number;
}

export default function Home() {
  const [amount, setAmount] = useState("0.1"); // Small test amount
  const [slippage, setSlippage] = useState(25);
  const [tipAmount, setTipAmount] = useState("0.0001");
  const [isSetMev, setIsSetMev] = useState(false);
  const [minLiquidity, setMinLiquidity] = useState(5); // Lower to find more tokens
  const [maxLiquidity, setMaxLiquidity] = useState(50000);
  const [poolSupply, setPoolSupply] = useState(5); // 5% minimum - catches most launches
  const [privateKey, setPrivateKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Sell configuration - optimized for 2x trades
  const [takeProfitPercent, setTakeProfitPercent] = useState(100); // 2x profit
  const [stopLossPercent, setStopLossPercent] = useState(20); // -20% max loss
  const [trailingStopPercent, setTrailingStopPercent] = useState(15); // 15% trailing
  const [maxHoldTimeMinutes, setMaxHoldTimeMinutes] = useState(5); // 5 min quick exits
  
  // Advanced strategies - TESTING MODE (1 token at a time)
  const [enablePortfolioMode, setEnablePortfolioMode] = useState(false); // OFF for testing
  const [maxPositions, setMaxPositions] = useState(1); // Only 1 position
  const [enableAdaptiveSizing, setEnableAdaptiveSizing] = useState(false); // Keep buys consistent
  const [enableTieredProfits, setEnableTieredProfits] = useState(true); // Still use tiered profits
  const [enableVolumeFilter, setEnableVolumeFilter] = useState(false); // OFF to find more tokens
  const [minSwapsPerMinute, setMinSwapsPerMinute] = useState(20); // Lower requirement
  const [enableSmartStopLoss, setEnableSmartStopLoss] = useState(true); // Keep protection
  const [enableAntiRug, setEnableAntiRug] = useState(true); // Keep safety
  const [maxTopHolderPercent, setMaxTopHolderPercent] = useState(70); // More lenient

  const handleStartSniper = async () => {
    if (!isValidSolanaPrivateKey(privateKey)) {
      toastError("Invalid Solana private key");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post("/api/sniper", {
        payload: {
          privateKey,
          amount: parseFloat(amount),
          slippage,
          tipAmount: parseFloat(tipAmount),
          isSetMev,
          minLiquidity,
          maxLiquidity,
          poolSupply,
          takeProfitPercent,
          stopLossPercent,
          trailingStopPercent,
          maxHoldTimeMinutes,
          // Advanced strategies
          enablePortfolioMode,
          maxPositions,
          enableAdaptiveSizing,
          enableTieredProfits,
          enableVolumeFilter,
          minSwapsPerMinute,
          enableSmartStopLoss,
          enableAntiRug,
          maxTopHolderPercent
        }
      });
      
      if (response.data.result) {
        toastSuccess("Sniper started successfully!");
      } else {
        toastError("Failed to start sniper");
      }
    } catch (error) {
      toastError("Error starting sniper");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">🎯 Token Sniper</h1>
        <p className="mb-6 text-gray-400">Auto-snipe new Raydium token launches with MEV protection</p>
        
        <div className="space-y-4 bg-gray-800 p-6 rounded-lg">
          <div>
            <label className="block mb-2">Private Key</label>
            <Input
              type="password"
              placeholder="Enter your wallet private key"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              fullWidth
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Buy Amount (SOL)</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.001"
              />
            </div>

            <div>
              <label className="block mb-2">Slippage (%)</label>
              <Input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value))}
                placeholder="0.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Min Liquidity (SOL)</label>
              <Input
                type="number"
                value={minLiquidity}
                onChange={(e) => setMinLiquidity(parseFloat(e.target.value))}
                placeholder="5000"
              />
              <p className="text-xs text-gray-500 mt-1">Recommended: 5000+ SOL for legitimate launches</p>
            </div>

            <div>
              <label className="block mb-2">Max Liquidity (SOL)</label>
              <Input
                type="number"
                value={maxLiquidity}
                onChange={(e) => setMaxLiquidity(parseFloat(e.target.value))}
                placeholder="100000"
              />
              <p className="text-xs text-gray-500 mt-1">Recommended: 100K SOL to catch early launches</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Pool Supply (%)</label>
              <Input
                type="number"
                value={poolSupply}
                onChange={(e) => setPoolSupply(parseFloat(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4 mt-4">
            <h3 className="text-xl font-bold mb-3">🚀 Advanced Strategies ($1k/day optimized)</h3>
            
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <Switch isSelected={enablePortfolioMode} onValueChange={setEnablePortfolioMode} />
                  <label className="ml-2">💼 Portfolio Mode (hold multiple tokens)</label>
                </div>
                {enablePortfolioMode && (
                  <Input
                    type="number"
                    value={maxPositions}
                    onChange={(e) => setMaxPositions(parseFloat(e.target.value))}
                    className="w-20"
                    size="sm"
                  />
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Switch isSelected={enableTieredProfits} onValueChange={setEnableTieredProfits} />
                <label>🎯 Tiered Profit Taking (50%@1.5x, 30%@2x, 20%@5x)</label>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch isSelected={enableAdaptiveSizing} onValueChange={setEnableAdaptiveSizing} />
                <label>📊 Adaptive Position Sizing (based on liquidity)</label>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch isSelected={enableSmartStopLoss} onValueChange={setEnableSmartStopLoss} />
                <label>🛡️ Smart Stop Loss (lock profits as price rises)</label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Switch isSelected={enableVolumeFilter} onValueChange={setEnableVolumeFilter} />
                  <label className="ml-2">📈 Volume Filter (only high-activity tokens)</label>
                </div>
                {enableVolumeFilter && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={minSwapsPerMinute}
                      onChange={(e) => setMinSwapsPerMinute(parseFloat(e.target.value))}
                      className="w-20"
                      size="sm"
                    />
                    <span className="text-xs text-gray-400">swaps/min</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Switch isSelected={enableAntiRug} onValueChange={setEnableAntiRug} />
                  <label className="ml-2">🔒 Anti-Rug Protection (check mint, holders)</label>
                </div>
                {enableAntiRug && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={maxTopHolderPercent}
                      onChange={(e) => setMaxTopHolderPercent(parseFloat(e.target.value))}
                      className="w-20"
                      size="sm"
                    />
                    <span className="text-xs text-gray-400">% max</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4 mt-4">
            <h3 className="text-xl font-bold mb-3">💰 Sell Configuration</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2">Take Profit (%)</label>
                <Input
                  type="number"
                  value={takeProfitPercent}
                  onChange={(e) => setTakeProfitPercent(parseFloat(e.target.value))}
                  placeholder="100"
                />
                <p className="text-xs text-gray-500 mt-1">100 = sell at 2x (100% profit)</p>
              </div>

              <div>
                <label className="block mb-2">Stop Loss (%)</label>
                <Input
                  type="number"
                  value={stopLossPercent}
                  onChange={(e) => setStopLossPercent(parseFloat(e.target.value))}
                  placeholder="50"
                />
                <p className="text-xs text-gray-500 mt-1">50 = sell at -50% loss</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block mb-2">Trailing Stop (%)</label>
                <Input
                  type="number"
                  value={trailingStopPercent}
                  onChange={(e) => setTrailingStopPercent(parseFloat(e.target.value))}
                  placeholder="20"
                />
                <p className="text-xs text-gray-500 mt-1">20 = sell if drops 20% from peak</p>
              </div>

              <div>
                <label className="block mb-2">Max Hold Time (minutes)</label>
                <Input
                  type="number"
                  value={maxHoldTimeMinutes}
                  onChange={(e) => setMaxHoldTimeMinutes(parseFloat(e.target.value))}
                  placeholder="60"
                />
                <p className="text-xs text-gray-500 mt-1">60 = force sell after 1 hour</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              isSelected={isSetMev}
              onValueChange={setIsSetMev}
            />
            <label>Enable MEV Protection (Jito)</label>
          </div>

          {isSetMev && (
            <div>
              <label className="block mb-2">Jito Tip Amount (SOL)</label>
              <Input
                type="number"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="0.0001"
              />
            </div>
          )}

          <Button
            color="primary"
            size="lg"
            fullWidth
            onClick={handleStartSniper}
            isLoading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? "Starting..." : "Start Sniping"}
          </Button>

          <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded">
            <p className="text-yellow-500 text-sm">
              ⚠️ <strong>Warning:</strong> Sniping involves risk. Only use funds you can afford to lose. Test with small amounts first.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
