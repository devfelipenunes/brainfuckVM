// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BrainfuckVM} from "./BrainfuckVM.sol";

/// @title GlitchManager
/// @notice O Orquestrador do Glitch Protocol. NFT-based. Cada token é uma vida/fita.
contract GlitchManager {
    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────
    error NotAHuman();
    error NotOwner();
    error CooldownActive();
    error PlayerDead();
    error InsufficientFunds();
    error NotAuthorized();
    error NotAdmin();
    error DailyLimitReached();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event NodeBreached(uint256 indexed tokenId, address indexed player, uint256 timestamp);
    event ActionExecuted(uint256 indexed tokenId, bytes resultingTape);
    event Permadeath(uint256 indexed tokenId);
    event DevAuthorization(address indexed dev, bool allowed);
    event DevGateUpdated(bool enabled);

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    BrainfuckVM public immutable VM;
    address public admin;

    uint256 public constant ENTRY_FEE = 0.01 ether;
    uint256 public constant COOLDOWN = 1 hours; // Mudado para 1 hora para facilitar testes

    // Fita de memória inicial default (16 bytes)
    // C0: HP(100), C1: Energy(100), C2: Attack(10), C3: Shield(0)
    // C0: HP(50), C1: Energy(50), C2: Credits(50), C3: Sec-Lvl(50)
    // C0: HP(50), C1: Energy(50), C2: Credits(50), C3: Sec-Lvl(50)
    bytes public constant DEFAULT_TAPE = hex"32_32_32_32_00_00_00_00_00_00_00_00_00_00_00_00";

    uint256 public totalSupply;
    
    // ERC721 Minimal State
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;

    // Glitch State
    mapping(uint256 => bytes) public tokenTape;
    mapping(uint256 => uint256) public lastAccess;
    mapping(uint256 => bool) public isDead;
    
    // Daily Limit State
    mapping(uint256 => uint256) public swipesToday;
    mapping(uint256 => uint256) public lastSwipeDay;
    uint256 public constant MAX_DAILY_SWIPES = 10; // 10 ações por dia

    // Mapping temporário para validar devs off-chain (EIP-712 seria o ideal para produção)
    mapping(address => bool) public authorizedDevs;
    bool public devGateEnabled = false; // Desativado para testes

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor(address _vm) {
        VM = BrainfuckVM(_vm);
        admin = msg.sender;
        authorizedDevs[msg.sender] = true;
    }

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────
    modifier canPlay(uint256 tokenId) {
        if (ownerOf[tokenId] != msg.sender) revert NotOwner();
        if (isDead[tokenId]) revert PlayerDead();
        // if (block.timestamp < lastAccess[tokenId] + COOLDOWN) revert CooldownActive(); // Removido cooldown estrito para testes rápidos no frontend!
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ──────────────────────────────────────────────
    //  Mint / Entry Point
    // ──────────────────────────────────────────────
    // Permite que uma carteira minte. Quem chama isso seria sua API validando a carteira Stellar.
    function authorizeDev(address dev, bool allowed) external onlyAdmin {
        authorizedDevs[dev] = allowed;
        emit DevAuthorization(dev, allowed);
    }

    function setDevGateEnabled(bool enabled) external onlyAdmin {
        devGateEnabled = enabled;
        emit DevGateUpdated(enabled);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }

    function breachNode() external payable returns (uint256) {
        if (devGateEnabled && !authorizedDevs[msg.sender]) revert NotAuthorized();
        if (msg.value < ENTRY_FEE) revert InsufficientFunds();

        uint256 tokenId = ++totalSupply;
        
        ownerOf[tokenId] = msg.sender;
        balanceOf[msg.sender]++;
        
        tokenTape[tokenId] = DEFAULT_TAPE;
        lastAccess[tokenId] = 0;
        lastSwipeDay[tokenId] = block.timestamp / 1 days;
        swipesToday[tokenId] = 0;
        isDead[tokenId] = false;

        emit NodeBreached(tokenId, msg.sender, block.timestamp);
        return tokenId;
    }

    // ──────────────────────────────────────────────
    //  Ação Core: Deslize (Swipe)
    // ──────────────────────────────────────────────
    function swipe(uint256 tokenId, bytes calldata brainfuckProgram) external canPlay(tokenId) {
        // Daily Limit Logic
        uint256 currentDay = block.timestamp / 1 days;
        if (lastSwipeDay[tokenId] < currentDay) {
            swipesToday[tokenId] = 0; // Reseta no novo dia
            lastSwipeDay[tokenId] = currentDay;
        }
        if (swipesToday[tokenId] >= MAX_DAILY_SWIPES) revert DailyLimitReached();

        swipesToday[tokenId] += 1;
        lastAccess[tokenId] = block.timestamp;
        
        bytes memory tape = tokenTape[tokenId];
        
        // Compila o código BF raw recebido para bytecode e executa
        bytes memory compiledScript = VM.compile(brainfuckProgram);
        bytes memory output = VM.execute(compiledScript, tape, 5000);
        
        // Preenche de volta, garantindo 16 bytes
        for (uint i = 0; i < 16 && i < output.length; i++) {
            tape[i] = output[i];
        }

        tokenTape[tokenId] = tape;
        
        // Se qualquer um dos quatro atributos zerar (0) ou estourar (>= 100), o jogador morre.
        if (
            uint8(tape[0]) == 0 || uint8(tape[0]) >= 100 ||
            uint8(tape[1]) == 0 || uint8(tape[1]) >= 100 ||
            uint8(tape[2]) == 0 || uint8(tape[2]) >= 100 ||
            uint8(tape[3]) == 0 || uint8(tape[3]) >= 100
        ) {
            isDead[tokenId] = true;
            emit Permadeath(tokenId);
        } else {
            emit ActionExecuted(tokenId, tape);
        }
    }
    
    // Funções de leitura úteis para o front
    function getPlayerTokens(address player) external view returns (uint256[] memory) {
        uint256 count = balanceOf[player];
        uint256[] memory tokens = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= totalSupply; i++) {
            if (ownerOf[i] == player) {
                tokens[idx] = i;
                idx++;
            }
        }
        return tokens;
    }

    function getDailyStatus(uint256 tokenId) external view returns (uint256 used, uint256 remaining, uint256 max, uint256 day) {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 usedToday = swipesToday[tokenId];
        if (lastSwipeDay[tokenId] < currentDay) {
            usedToday = 0;
        }
        uint256 remainingToday = MAX_DAILY_SWIPES > usedToday ? (MAX_DAILY_SWIPES - usedToday) : 0;
        return (usedToday, remainingToday, MAX_DAILY_SWIPES, currentDay);
    }
}
