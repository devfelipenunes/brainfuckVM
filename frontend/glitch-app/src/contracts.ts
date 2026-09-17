import { Contract, type JsonRpcSigner } from 'ethers'

const GLITCH_ABI = [
  'function getPlayerTokens(address player) view returns (uint256[])',
  'function tokenTape(uint256 tokenId) view returns (bytes)',
  'function isDead(uint256 tokenId) view returns (bool)',
  'function breachNode() payable returns (uint256)',
  'function swipe(uint256 tokenId, bytes brainfuckProgram)',
  'function authorizedDevs(address) view returns (bool)',
  'function devGateEnabled() view returns (bool)',
  'function getDailyStatus(uint256 tokenId) view returns (uint256 used, uint256 remaining, uint256 max, uint256 day)',
]

export function getGlitchContract(signer: JsonRpcSigner) {
  const address = import.meta.env.VITE_GLITCH_MANAGER_ADDRESS
  if (!address) {
    throw new Error('Missing VITE_GLITCH_MANAGER_ADDRESS')
  }
  return new Contract(address, GLITCH_ABI, signer)
}
