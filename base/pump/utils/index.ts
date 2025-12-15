import { PublicKey, Connection } from '@solana/web3.js';

export async function filterHoldersWithTokens(
  connection: Connection,
  tokenAddress: PublicKey,
  holders: PublicKey[]
): Promise<PublicKey[]> {
  // Filter holders that have tokens
  const filtered: PublicKey[] = [];
  for (const holder of holders) {
    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(holder, {
        mint: tokenAddress,
      });
      if (tokenAccounts.value.length > 0) {
        filtered.push(holder);
      }
    } catch (error) {
      // Skip on error
    }
  }
  return filtered;
}

export function estimateHoldingPercent(
  amount: bigint,
  totalSupply: bigint
): number {
  if (totalSupply === 0n) return 0;
  return Number((amount * 10000n) / totalSupply) / 100;
}
