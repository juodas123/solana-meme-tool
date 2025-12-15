import { toast } from 'react-toastify';
import bs58 from 'bs58';

export function toastSuccess(message: string) {
  toast.success(message);
}

export function toastError(message: string) {
  toast.error(message);
}

export function toastWarning(message: string) {
  toast.warning(message);
}

export function isValidSolanaPrivateKey(key: string): boolean {
  try {
    const decoded = bs58.decode(key);
    return decoded.length === 64;
  } catch {
    return false;
  }
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    const decoded = bs58.decode(address);
    return decoded.length === 32;
  } catch {
    return false;
  }
}

export function saveDataToFile(data: any, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function readJson(filename: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return reject('No file selected');
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

export function saveNewFile(data: string, filename: string) {
  const blob = new Blob([data], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatNumberAbbreviation(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

export async function fetchTopTraderWallets(tokenAddress: string): Promise<any[]> {
  // Placeholder - implement actual fetching logic
  return [];
}
