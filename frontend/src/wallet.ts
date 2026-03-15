import { ethers } from 'ethers';
import { MONAD_TESTNET, LOCALHOST_NET, REGISTRY_ABI, CONTRACTS } from './contracts';

export type NetworkType = 'monad' | 'localhost';
let currentNetworkType: NetworkType = 'monad';

export function setNetworkType(net: NetworkType) {
  currentNetworkType = net;
}

export function getNetworkType(): NetworkType {
  return currentNetworkType;
}

export type GameId = 'tamagotchi' | 'gameoflife' | 'diceroller';

export interface WalletState {
  connected: boolean;
  address: string;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
}

let walletState: WalletState = {
  connected: false,
  address: '',
  provider: null,
  signer: null,
};

let onWalletChange: ((state: WalletState) => void) | null = null;

export function onWalletStateChange(cb: (state: WalletState) => void) {
  onWalletChange = cb;
}

export function getWalletState(): WalletState {
  return walletState;
}

export function getProvider() {
  return walletState.provider;
}

export async function connectWallet(): Promise<WalletState> {
  if (!(window as any).ethereum) {
    throw new Error('MetaMask not found. Please install MetaMask.');
  }

  const provider = new ethers.BrowserProvider((window as any).ethereum);

  // Request accounts
  await provider.send('eth_requestAccounts', []);

  const targetNetwork = currentNetworkType === 'monad' ? MONAD_TESTNET : LOCALHOST_NET;

  // Try to switch to target network
  try {
    await provider.send('wallet_switchEthereumChain', [
      { chainId: targetNetwork.chainId },
    ]);
  } catch (err: any) {
    if (err.code === 4902) {
      await provider.send('wallet_addEthereumChain', [targetNetwork]);
    }
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  walletState = { connected: true, address, provider, signer };
  onWalletChange?.(walletState);
  return walletState;
}

export function getRegistryContract(): ethers.Contract | null {
  const address = currentNetworkType === 'monad' ? CONTRACTS.REGISTRY : CONTRACTS.REGISTRY_LOCAL;
  if (!walletState.signer || address === '0x0000000000000000000000000000000000000000') {
    return null;
  }
  return new ethers.Contract(address, REGISTRY_ABI, walletState.signer);
}

// Log system
let logEntries: { text: string; type: string; time: string }[] = [];
let onLogChange: (() => void) | null = null;

export function onLogUpdate(cb: () => void) { onLogChange = cb; }

export function addLog(text: string, type: 'info' | 'success' | 'error' = 'info') {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  logEntries.push({ text, type, time });
  if (logEntries.length > 50) logEntries.shift();
  onLogChange?.();
}

export function getLogs() { return logEntries; }
