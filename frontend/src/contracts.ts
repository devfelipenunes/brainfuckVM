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
  VM: '0xa935a455314c58bC4773Ffb3570b1C1f2249222c',
  REGISTRY: '0x9b9fd1Ae43Ff12c2f43d131fd777ad21D3e69Da9',
  VM_LOCAL: '0x045857BDEAE7C1c7252d611eB24eB55564198b4C', // Fallback defaults, user can update
  REGISTRY_LOCAL: '0x2b5A4e5493d4a54E717057B127cf0C000C876f9B', // Commonly deployed address
};
