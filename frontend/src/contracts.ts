export const MONAD_TESTNET = {
  chainId: '0x279F', // 10143
  chainName: 'Monad Testnet',
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  blockExplorerUrls: ['https://testnet.monadexplorer.com'],
};

// ABI for BrainfuckVM
export const VM_ABI = [
  'function execute(bytes calldata program, bytes calldata input, uint256 maxSteps) pure returns (bytes memory)',
  'function run(bytes calldata program, bytes calldata input, uint256 maxSteps) returns (bytes memory)',
  'function tapeSize() view returns (uint256)',
  'event ProgramExecuted(bytes32 indexed programHash, address indexed caller, bytes output)',
];

// ABI for CartridgeRegistry
export const REGISTRY_ABI = [
  'function loadCartridge(bytes calldata program, string calldata name) returns (uint256)',
  'function loadCartridge(bytes calldata program, string calldata name, bytes calldata defaultState) returns (uint256)',
  'function play(uint256 cartridgeId, bytes calldata input, uint256 maxSteps) returns (bytes memory)',
  'function playWithState(uint256 cartridgeId, bytes calldata action, uint256 maxSteps) returns (bytes memory)',
  'function initState(uint256 cartridgeId)',
  'function initState(uint256 cartridgeId, bytes calldata state)',
  'function getCartridge(uint256 cartridgeId) view returns (bytes memory program, string memory name, address creator, uint256 playCount)',
  'function getPlayerState(uint256 cartridgeId, address player) view returns (bytes memory)',
  'function hasState(uint256 cartridgeId, address player) view returns (bool)',
  'function cartridgeCount() view returns (uint256)',
  'event CartridgeLoaded(uint256 indexed cartridgeId, address indexed creator, string name)',
  'event GamePlayed(uint256 indexed cartridgeId, address indexed player, bytes output)',
];

// Contract addresses (loaded from .env via Vite)
export const CONTRACTS = {
  VM: (import.meta.env.VITE_VM_ADDRESS as string) || '0xd73cde0e190fb480bca34c02253156e2072c97dc',
  REGISTRY: (import.meta.env.VITE_REGISTRY_ADDRESS as string) || '0x0adda254b0fdace9a51cc863be034dc60a6a156b',
};
