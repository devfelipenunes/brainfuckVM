// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title BrainfuckVM
/// @notice On-chain Brainfuck interpreter. Executes BF programs entirely on-chain.
/// @dev All 8 BF commands are supported: > < + - . , [ ]
///      Memory tape is configurable, defaults to 30,000 cells (uint8).
///      A step limit prevents infinite loops from consuming all gas.
contract BrainfuckVM {
    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────
    error PointerOverflow();
    error PointerUnderflow();
    error MaxStepsExceeded();
    error UnmatchedBracket();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event ProgramExecuted(
        bytes32 indexed programHash,
        address indexed caller,
        bytes output
    );

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    uint256 public immutable tapeSize;

    /// @notice Stores the last execution result per program hash
    mapping(bytes32 => bytes) public lastResult;

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor(uint256 _tapeSize) {
        tapeSize = _tapeSize == 0 ? 30_000 : _tapeSize;
    }

    // ──────────────────────────────────────────────
    //  Public entry point (stores result + emits event)
    // ──────────────────────────────────────────────

    /// @notice Execute a Brainfuck program on-chain and store the result.
    /// @param program The BF program as raw bytes (ASCII)
    /// @param input   The input buffer for the `,` command
    /// @param maxSteps Maximum number of instruction steps before reverting
    /// @return output The output produced by the `.` command
    function run(
        bytes calldata program,
        bytes calldata input,
        uint256 maxSteps
    ) external returns (bytes memory output) {
        output = execute(program, input, maxSteps);
        bytes32 programHash = keccak256(program);
        lastResult[programHash] = output;
        emit ProgramExecuted(programHash, msg.sender, output);
    }

    // ──────────────────────────────────────────────
    //  Pure interpreter (no state changes)
    // ──────────────────────────────────────────────

    /// @notice Execute a Brainfuck program and return the output (pure computation).
    /// @param program The BF program as raw bytes (ASCII)
    /// @param input   The input buffer for the `,` command
    /// @param maxSteps Maximum number of instruction steps before reverting
    /// @return The output produced by the `.` command
    function execute(
        bytes calldata program,
        bytes calldata input,
        uint256 maxSteps
    ) public pure returns (bytes memory) {
        uint256 progLen = program.length;
        if (progLen == 0) return new bytes(0);

        // Pre-compute bracket jump table
        uint256[] memory jumpTable = _buildJumpTable(program);

        // Pack VM state into a struct-like array to avoid stack depth issues
        // [0] = ptr (data pointer)
        // [1] = pc (program counter)
        // [2] = inputPtr
        // [3] = steps
        // [4] = outLen
        uint256[5] memory state;

        uint8[] memory tape = new uint8[](30_000);
        bytes memory outBuf = new bytes(256);

        while (state[1] < progLen) {
            if (state[3] >= maxSteps) revert MaxStepsExceeded();

            bytes1 op = program[state[1]];

            if (op == ">") {
                state[0]++;
                if (state[0] >= 30_000) revert PointerOverflow();
            } else if (op == "<") {
                if (state[0] == 0) revert PointerUnderflow();
                state[0]--;
            } else if (op == "+") {
                unchecked { tape[state[0]]++; }
            } else if (op == "-") {
                unchecked { tape[state[0]]--; }
            } else if (op == ".") {
                if (state[4] >= outBuf.length) {
                    outBuf = _growBuffer(outBuf, state[4]);
                }
                outBuf[state[4]] = bytes1(tape[state[0]]);
                state[4]++;
            } else if (op == ",") {
                if (state[2] < input.length) {
                    tape[state[0]] = uint8(input[state[2]]);
                    state[2]++;
                } else {
                    tape[state[0]] = 0;
                }
            } else if (op == "[") {
                if (tape[state[0]] == 0) {
                    state[1] = jumpTable[state[1]];
                }
            } else if (op == "]") {
                if (tape[state[0]] != 0) {
                    state[1] = jumpTable[state[1]];
                }
            }

            state[1]++;
            state[3]++;
        }

        // Trim output buffer to actual length
        return _trimBuffer(outBuf, state[4]);
    }

    // ──────────────────────────────────────────────
    //  Internal helpers
    // ──────────────────────────────────────────────

    /// @dev Grow the output buffer by doubling its size
    function _growBuffer(
        bytes memory buf,
        uint256 currentLen
    ) internal pure returns (bytes memory newBuf) {
        newBuf = new bytes(buf.length * 2);
        for (uint256 i = 0; i < currentLen; i++) {
            newBuf[i] = buf[i];
        }
    }

    /// @dev Trim buffer to actual content length
    function _trimBuffer(
        bytes memory buf,
        uint256 len
    ) internal pure returns (bytes memory result) {
        result = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = buf[i];
        }
    }

    /// @dev Build a jump table mapping each `[` to its matching `]` and vice versa.
    function _buildJumpTable(
        bytes calldata program
    ) internal pure returns (uint256[] memory jumpTable) {
        uint256 len = program.length;
        jumpTable = new uint256[](len);

        uint256[] memory stack = new uint256[](len);
        uint256 stackPtr = 0;

        for (uint256 i = 0; i < len; i++) {
            if (program[i] == "[") {
                stack[stackPtr] = i;
                stackPtr++;
            } else if (program[i] == "]") {
                if (stackPtr == 0) revert UnmatchedBracket();
                stackPtr--;
                uint256 open = stack[stackPtr];
                jumpTable[open] = i;
                jumpTable[i] = open;
            }
        }

        if (stackPtr != 0) revert UnmatchedBracket();
    }
}
