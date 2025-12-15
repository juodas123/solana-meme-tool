import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getSOLBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

export async function getSPLBalance(
  connection: Connection,
  tokenAddress: PublicKey,
  walletAddress: PublicKey
): Promise<number> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletAddress, {
      programId: TOKEN_PROGRAM_ID,
    });

    for (const account of tokenAccounts.value) {
      const mintAddress = account.account.data.parsed.info.mint;
      if (mintAddress === tokenAddress.toBase58()) {
        const balance = account.account.data.parsed.info.tokenAmount.uiAmount;
        return balance || 0;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

export function formatNumberAbbreviation(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}
