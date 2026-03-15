// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BrainfuckVM} from "./BrainfuckVM.sol";

/// @title CartridgeRegistry
/// @notice On-chain game store with persistent player state.
///         Register BF programs ("cartridges") once, then play them cheaply.
///         Player state is automatically saved between sessions.
contract CartridgeRegistry {
    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────
    error CartridgeNotFound();
    error EmptyProgram();
    error NoSavedState();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event CartridgeLoaded(
        uint256 indexed cartridgeId,
        address indexed creator,
        string name
    );

    event GamePlayed(
        uint256 indexed cartridgeId,
        address indexed player,
        bytes output
    );

    event StateInitialized(
        uint256 indexed cartridgeId,
        address indexed player
    );

    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────
    struct Cartridge {
        bytes program;
        string name;
        address creator;
        uint256 playCount;
        bytes defaultState; // Default initial state for new players
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    BrainfuckVM public immutable VM;
    uint256 public cartridgeCount;
    mapping(uint256 => Cartridge) internal _cartridges;

    /// @notice Persistent state per player per cartridge
    mapping(uint256 => mapping(address => bytes)) public playerState;

    /// @notice Whether a player has initialized state for a cartridge
    mapping(uint256 => mapping(address => bool)) public hasState;

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor(address _vm) {
        VM = BrainfuckVM(_vm);
    }

    // ──────────────────────────────────────────────
    //  Register a cartridge
    // ──────────────────────────────────────────────

    /// @notice Register a new BF program as a playable cartridge.
    /// @param program The BF program bytes
    /// @param name Human-readable name for the cartridge
    /// @param defaultState Default initial state for new players
    /// @return cartridgeId The ID of the registered cartridge
    function loadCartridge(
        bytes calldata program,
        string calldata name,
        bytes calldata defaultState
    ) external returns (uint256 cartridgeId) {
        if (program.length == 0) revert EmptyProgram();

        bytes memory bytecode = VM.compile(program);

        cartridgeId = cartridgeCount;
        _cartridges[cartridgeId] = Cartridge({
            program: bytecode,
            name: name,
            creator: msg.sender,
            playCount: 0,
            defaultState: defaultState
        });
        cartridgeCount++;

        emit CartridgeLoaded(cartridgeId, msg.sender, name);
    }

    /// @notice Overload without default state (for stateless games)
    function loadCartridge(
        bytes calldata program,
        string calldata name
    ) external returns (uint256 cartridgeId) {
        if (program.length == 0) revert EmptyProgram();

        bytes memory bytecode = VM.compile(program);

        cartridgeId = cartridgeCount;
        _cartridges[cartridgeId] = Cartridge({
            program: bytecode,
            name: name,
            creator: msg.sender,
            playCount: 0,
            defaultState: ""
        });
        cartridgeCount++;

        emit CartridgeLoaded(cartridgeId, msg.sender, name);
    }

    // ──────────────────────────────────────────────
    //  Initialize player state
    // ──────────────────────────────────────────────

    /// @notice Initialize state for a player (creates a new "save file")
    /// @param cartridgeId The cartridge to init state for
    function initState(uint256 cartridgeId) external {
        if (cartridgeId >= cartridgeCount) revert CartridgeNotFound();

        Cartridge storage cart = _cartridges[cartridgeId];
        playerState[cartridgeId][msg.sender] = cart.defaultState;
        hasState[cartridgeId][msg.sender] = true;

        emit StateInitialized(cartridgeId, msg.sender);
    }

    /// @notice Initialize with custom state
    function initState(uint256 cartridgeId, bytes calldata state) external {
        if (cartridgeId >= cartridgeCount) revert CartridgeNotFound();

        playerState[cartridgeId][msg.sender] = state;
        hasState[cartridgeId][msg.sender] = true;

        emit StateInitialized(cartridgeId, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Play a cartridge
    // ──────────────────────────────────────────────

    /// @notice Execute a cartridge with custom input (stateless mode).
    function play(
        uint256 cartridgeId,
        bytes calldata input,
        uint256 maxSteps
    ) external returns (bytes memory output) {
        if (cartridgeId >= cartridgeCount) revert CartridgeNotFound();

        Cartridge storage cart = _cartridges[cartridgeId];
        output = VM.execute(cart.program, input, maxSteps);
        cart.playCount++;

        emit GamePlayed(cartridgeId, msg.sender, output);
    }

    /// @notice Execute a cartridge using action + saved state, then save result.
    /// @dev Input is built as: [action byte(s)] ++ [saved state]
    /// @param cartridgeId The cartridge to play
    /// @param action The action bytes to prepend to saved state
    /// @param maxSteps Maximum execution steps
    function playWithState(
        uint256 cartridgeId,
        bytes calldata action,
        uint256 maxSteps
    ) external returns (bytes memory output) {
        if (cartridgeId >= cartridgeCount) revert CartridgeNotFound();
        if (!hasState[cartridgeId][msg.sender]) revert NoSavedState();

        Cartridge storage cart = _cartridges[cartridgeId];
        bytes memory savedState = playerState[cartridgeId][msg.sender];

        // Build input: action + saved state
        bytes memory fullInput = abi.encodePacked(action, savedState);
        output = VM.execute(cart.program, fullInput, maxSteps);

        // Save the output as new state
        playerState[cartridgeId][msg.sender] = output;
        cart.playCount++;

        emit GamePlayed(cartridgeId, msg.sender, output);
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    function getCartridge(
        uint256 cartridgeId
    )
        external
        view
        returns (
            bytes memory program,
            string memory name,
            address creator,
            uint256 playCount
        )
    {
        if (cartridgeId >= cartridgeCount) revert CartridgeNotFound();
        Cartridge storage cart = _cartridges[cartridgeId];
        return (cart.program, cart.name, cart.creator, cart.playCount);
    }

    function getProgram(
        uint256 cartridgeId
    ) external view returns (bytes memory) {
        if (cartridgeId >= cartridgeCount) revert CartridgeNotFound();
        return _cartridges[cartridgeId].program;
    }

    function getPlayerState(
        uint256 cartridgeId,
        address player
    ) external view returns (bytes memory) {
        if (cartridgeId >= cartridgeCount) revert CartridgeNotFound();
        return playerState[cartridgeId][player];
    }
}