export const MONAD_TESTNET = {
  chainId: '0x279F', // 10143
  chainName: 'Monad Testnet',
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  blockExplorerUrls: ['https://testnet.monadexplorer.com'],
};

export const LOCALHOST_NET = {
  chainId: '0x7A69', // 31337
  chainName: 'Localhost',
  rpcUrls: ['http://localhost:8545'],
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
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

export const CONTRACTS = {
  VM: '0x6376B74C56a5ee60d79D0eba53C5ceb5357F3556',
  REGISTRY: '0x99960401794C8358c4b1E9F3010102d28cEe8a3c',
  VM_LOCAL: '0x162A433068F51e18b7d13932F27e66a3f99E6890', // Fallback defaults, user can update
  REGISTRY_LOCAL: '0x922D6956C99E12DFeB3224DEA977D0939758A1Fe', // Commonly deployed address
};
