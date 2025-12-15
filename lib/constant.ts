import { Connection } from "@solana/web3.js";

// RPC Configuration
export const MAIN_RPC = process.env.NEXT_PUBLIC_MAIN_RPC || "";
export const MAIN_WSS = process.env.NEXT_PUBLIC_MAIN_WSS || "";
export const MAIN_GRPC = process.env.NEXT_PUBLIC_GRPC || "";
export const MAIN_GRPC_TOKEN = process.env.NEXT_PUBLIC_GRPC_TOKEN || "";

// API Keys
export const PUBLIC_BIRD_EYE_API = process.env.NEXT_PUBLIC_BIRD_EYE_API || "";
export const BIRD_EYE_API = process.env.NEXT_PUBLIC_BIRD_EYE_API || "";
export const ASTRALANE_KEY = process.env.NEXT_PUBLIC_ASTRALANE_KEY || "";
export const ASTRALANE_FEE = 0.0001;
export const JUPITER_PUBLIC_API = "https://quote-api.jup.ag/v6";

// Jito Configuration
export const JITO_UUID = process.env.NEXT_PUBLIC_JITO_UUID || "";
export const JITO_FEE = 0.0001;

// Database
export const MONGODB_URL = process.env.NEXT_PUBLIC_MONGODB_URL || "";
export const REDIS_URI = process.env.NEXT_PUBLIC_REDIS_URI || "";

// Solana Connection
export const commitmentType = "confirmed";
export const solanaConnection = new Connection(MAIN_RPC, commitmentType as any);

// Token Configuration
export const BASE_MINT_ADDRESS = "So11111111111111111111111111111111111111112"; // WSOL

// Sniper Configuration
export const AMOUNT_TO_WSOL = parseFloat(process.env.AMOUNT_TO_WSOL || "0.002");
export const MAX_RETRY = parseInt(process.env.MAX_RETRY || "10");
export const IS_JITO = process.env.IS_JITO === "true";
export const CHUNK_SIZE = 8;

// Validation Flags
export const CHECK_IF_MINT_IS_RENOUNCED = process.env.CHECK_IF_MINT_IS_RENOUNCED === "true";
export const CHECK_IF_MINT_IS_MUTABLE = process.env.CHECK_IF_MINT_IS_MUTABLE === "true";
export const CHECK_IF_MINT_IS_BURNED = process.env.CHECK_IF_MINT_IS_BURNED === "true";
export const WAIT_UNTIL_LP_IS_BURNT = process.env.WAIT_UNTIL_LP_IS_BURNT === "true";
export const LP_BURN_WAIT_TIME = parseInt(process.env.LP_BURN_WAIT_TIME || "900");
export const FREEZE_AUTHORITY = process.env.FREEZE_AUTHORITY === "true";

// Wallet Risk Scoring Buckets
export const HOURLY_BUCKETS = [
  { min: 0, max: 1, risk: 30 },
  { min: 1, max: 5, risk: 20 },
  { min: 5, max: 10, risk: 10 },
  { min: 10, max: Infinity, risk: 0 },
];

export const DAILY_BUCKETS = [
  { min: 0, max: 5, risk: 30 },
  { min: 5, max: 20, risk: 20 },
  { min: 20, max: 50, risk: 10 },
  { min: 50, max: Infinity, risk: 0 },
];

export const FAILURE_RATE_BUCKETS = [
  { min: 0, max: 0.1, risk: 0 },
  { min: 0.1, max: 0.3, risk: 10 },
  { min: 0.3, max: 0.5, risk: 20 },
  { min: 0.5, max: Infinity, risk: 30 },
];

export const UNIQUE_TO_ADDRESS_BUCKETS = [
  { min: 0, max: 2, risk: 30 },
  { min: 2, max: 5, risk: 20 },
  { min: 5, max: 10, risk: 10 },
  { min: 10, max: Infinity, risk: 0 },
];

export const FEE_BUCKETS = [
  { min: 0, max: 0.0001, risk: 0 },
  { min: 0.0001, max: 0.001, risk: 10 },
  { min: 0.001, max: 0.01, risk: 20 },
  { min: 0.01, max: Infinity, risk: 30 },
];

export const TX_AMOUNT_BUCKETS = [
  { min: 0, max: 0.1, risk: 30 },
  { min: 0.1, max: 1, risk: 20 },
  { min: 1, max: 10, risk: 10 },
  { min: 10, max: Infinity, risk: 0 },
];

// Scam addresses blacklist
export const scamAddresses = new Set<string>([
  // Add known scam addresses here
]);
