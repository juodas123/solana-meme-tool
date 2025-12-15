import { useState } from "react";
import axios from "axios";
import { Input, useDisclosure, Textarea, Switch, Button } from "@heroui/react";

import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import Layout from "@/components/Layout/layout";
import { DateValue, parseAbsoluteToLocal } from "@internationalized/date";
import { isValidSolanaAddress, isValidSolanaPrivateKey, toastError, toastSuccess } from "@/lib/utils";

export default function Home() {

  const anchorWallet = useAnchorWallet();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);

  // target wallet publickey
  const [targetWallet, setTargetWallet] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  
  // Copy trade settings
  const [buyAmount, setBuyAmount] = useState("0.3");
  const [takeProfitPercent, setTakeProfitPercent] = useState(100);
  const [stopLossPercent, setStopLossPercent] = useState(15);
  const [maxHoldMinutes, setMaxHoldMinutes] = useState(10);
  const [enableTieredProfits, setEnableTieredProfits] = useState(true);

  const handleStartCopyTrade = async () => {
    if (!isValidSolanaAddress(targetWallet)) {
      toastError("Invalid target wallet address");
      return;
    }
    
    if (!isValidSolanaPrivateKey(privateKey)) {
      toastError("Invalid private key");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("/api/copy", {
        targetWallet,
        privateKey,
        buyAmount: parseFloat(buyAmount),
        takeProfitPercent,
        stopLossPercent,
        maxHoldMinutes,
        enableTieredProfits
      });

      if (response.data.result) {
        toastSuccess("Copy trading started!");
      } else {
        toastError("Failed to start copy trading");
      }
    } catch (error) {
      toastError("Error starting copy trade");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">📋 Copy Trade</h1>
        <p className="mb-6 text-gray-400">Mirror wallet trades automatically - follow alpha traders</p>
        
        <div className="space-y-4 bg-gray-800 p-6 rounded-lg">
          <div>
            <label className="block mb-2">Target Wallet Address (wallet to copy)</label>
            <Input
              type="text"
              placeholder="Enter Solana wallet address to mirror"
              value={targetWallet}
              onChange={(e) => setTargetWallet(e.target.value)}
              fullWidth
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 Find alpha wallets on gmgn.ai, dexscreener, or bullx.io
            </p>
          </div>

          <div>
            <label className="block mb-2">Your Private Key</label>
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
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="0.3"
              />
              <p className="text-xs text-gray-500 mt-1">How much to spend per copy</p>
            </div>

            <div>
              <label className="block mb-2">Take Profit (%)</label>
              <Input
                type="number"
                value={takeProfitPercent}
                onChange={(e) => setTakeProfitPercent(parseFloat(e.target.value))}
                placeholder="100"
              />
              <p className="text-xs text-gray-500 mt-1">100 = sell at 2x profit</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Stop Loss (%)</label>
              <Input
                type="number"
                value={stopLossPercent}
                onChange={(e) => setStopLossPercent(parseFloat(e.target.value))}
                placeholder="15"
              />
              <p className="text-xs text-gray-500 mt-1">15 = sell at -15% loss</p>
            </div>

            <div>
              <label className="block mb-2">Max Hold Time (minutes)</label>
              <Input
                type="number"
                value={maxHoldMinutes}
                onChange={(e) => setMaxHoldMinutes(parseFloat(e.target.value))}
                placeholder="10"
              />
              <p className="text-xs text-gray-500 mt-1">Force exit after this time</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              isSelected={enableTieredProfits}
              onValueChange={setEnableTieredProfits}
            />
            <label>🎯 Enable Tiered Profits (50%@1.5x, 30%@2x, 20%@5x)</label>
          </div>

          <Button
            color="primary"
            size="lg"
            fullWidth
            onClick={handleStartCopyTrade}
            isLoading={loading}
            disabled={loading}
          >
            {loading ? "Starting..." : "Start Copy Trading"}
          </Button>

          <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded">
            <p className="text-blue-400 text-sm">
              💡 <strong>How it works:</strong> When the target wallet buys a token, you automatically buy too. 
              You exit based on YOUR profit targets (usually earlier than them for safer profits).
            </p>
          </div>

          <div className="mt-2 p-4 bg-yellow-900/20 border border-yellow-700 rounded">
            <p className="text-yellow-500 text-sm">
              ⚠️ <strong>Warning:</strong> Copy trading follows another trader's decisions. Make sure to monitor and only copy trusted wallets with good track records.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
