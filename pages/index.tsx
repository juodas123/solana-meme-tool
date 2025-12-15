import { useEffect, useState } from "react";
import { useDisclosure, Textarea, Switch, Button } from "@heroui/react";
import { Input } from "@heroui/input";
import { FaUpload } from "react-icons/fa6";
import ImageUploading from 'react-images-uploading';
import Layout from "@/components/Layout/layout";
import PumpBundleModal from "@/components/PumpBundleModal";
import { isValidSolanaPrivateKey, toastError } from "@/lib/utils";
import { Keypair } from "@solana/web3.js";
import { FaExternalLinkAlt } from "react-icons/fa";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import axios from "axios";
import { useRouter } from "next/router";
import { useWalletContext } from "@/providers/wallet";
import { shortenAddress } from "@/base/utils";

export default function Home() {
  
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-4xl font-bold mb-4">Solana Meme Token Sniper</h1>
        <p className="text-xl mb-8">Welcome to your token sniper dashboard</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-6xl">
          <a href="/pumpfun-sniper" className="p-6 border rounded-lg hover:border-green-500 transition bg-gradient-to-br from-green-500/10 to-blue-500/10">
            <h2 className="text-2xl font-bold mb-2">🚀 Pump.fun Momentum</h2>
            <p>30-60% bonding curve scalper (RECOMMENDED)</p>
          </a>
          <a href="/sniper" className="p-6 border rounded-lg hover:border-green-500 transition">
            <h2 className="text-2xl font-bold mb-2">🎯 Raydium Sniper</h2>
            <p>Auto-snipe new Raydium launches</p>
          </a>
          <a href="/launch" className="p-6 border rounded-lg hover:border-green-500 transition">
            <h2 className="text-2xl font-bold mb-2">🚀 Launch</h2>
            <p>Create and launch pump.fun tokens</p>
          </a>
          <a href="/copy-trade" className="p-6 border rounded-lg hover:border-green-500 transition">
            <h2 className="text-2xl font-bold mb-2">📋 Copy Trade</h2>
            <p>Mirror wallet trades automatically</p>
          </a>
          <a href="/volume-boost" className="p-6 border rounded-lg hover:border-green-500 transition">
            <h2 className="text-2xl font-bold mb-2">📊 Volume Boost</h2>
            <p>Generate trading volume</p>
          </a>
          <a href="/wallet-check" className="p-6 border rounded-lg hover:border-green-500 transition">
            <h2 className="text-2xl font-bold mb-2">🔍 Wallet Check</h2>
            <p>Analyze wallet risk scores</p>
          </a>
          <a href="/limit-order" className="p-6 border rounded-lg hover:border-green-500 transition">
            <h2 className="text-2xl font-bold mb-2">⚖️ Limit Orders</h2>
            <p>Set buy/sell triggers</p>
          </a>
        </div>
      </div>
    </Layout>
  )
}
