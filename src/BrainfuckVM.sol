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
    error PointerOverflow();     // 0x26aaeb27
    error PointerUnderflow();    // 0x3bf08bad
    error MaxStepsExceeded();    // 0xf47200c4
    error UnmatchedBracket();     // 0xccba53b7

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
    /// @return output The output produced by the `.` command
    function execute(
        bytes calldata program,
        bytes calldata input,
        uint256 maxSteps
    ) public pure returns (bytes memory output) {
        uint256 progLen = program.length;
        if (progLen == 0) return new bytes(0);

        bytes memory jumpTable = _buildJumpTable(program);
        
        assembly {
            let tape := mload(0x40)
            
            // Allocate 30,000 bytes for tape + padding
            mstore(0x40, add(tape, 30048)) 
            codecopy(tape, codesize(), 30048) // Zero-init tape

            output := mload(0x40)
            mstore(output, 0)
            mstore(0x40, add(output, 4096)) // Initial output buffer (4k)

            let cursor := 0
            let ptr := tape
            let inputPtr := 0
            let steps := 0
            let outLen := 0

            let progPtr := program.offset
            let inputBase := input.offset
            let jumpBase := add(jumpTable, 32)
            
            for {} lt(cursor, progLen) { } {
                if iszero(and(steps, 0x3f)) {
                    if gt(steps, maxSteps) {
                        let ptr_err := mload(0x40)
                        mstore(ptr_err, 0xf47200c400000000000000000000000000000000000000000000000000000000)
                        revert(ptr_err, 4)
                    }
                }
                steps := add(steps, 1)

                let op := byte(0, calldataload(add(progPtr, cursor)))
                
                // RLE Peek Ahead
                let count := 1
                if or(or(eq(op, 0x2b), eq(op, 0x2d)), or(eq(op, 0x3e), eq(op, 0x3c))) {
                    for { let i := add(cursor, 1) } lt(i, progLen) { i := add(i, 1) } {
                        let nextOp := byte(0, calldataload(add(progPtr, i)))
                        if iszero(eq(nextOp, op)) { break }
                        count := add(count, 1)
                    }
                }
                
                switch op
                case 0x3e { 
                    ptr := add(ptr, count)
                    if iszero(lt(ptr, add(tape, 30000))) {
                        let ptr_err := mload(0x40)
                        mstore(ptr_err, 0x26aaeb2700000000000000000000000000000000000000000000000000000000)
                        revert(ptr_err, 4)
                    }
                    cursor := add(cursor, count)
                }
                case 0x3c { 
                    if lt(ptr, add(tape, count)) {
                        let ptr_err := mload(0x40)
                        mstore(ptr_err, 0x3bf08bad00000000000000000000000000000000000000000000000000000000)
                        revert(ptr_err, 4)
                    }
                    ptr := sub(ptr, count)
                    cursor := add(cursor, count)
                }
                case 0x2b { 
                    mstore8(ptr, add(byte(0, mload(ptr)), count))
                    cursor := add(cursor, count)
                }
                case 0x2d { 
                    mstore8(ptr, sub(byte(0, mload(ptr)), count))
                    cursor := add(cursor, count)
                }
                case 0x2e {
                    mstore8(add(add(output, 32), outLen), byte(0, mload(ptr)))
                    outLen := add(outLen, 1)
                    cursor := add(cursor, 1)
                }
                case 0x2c {
                    let val := 0
                    if lt(inputPtr, input.length) {
                        val := byte(0, calldataload(add(inputBase, inputPtr)))
                        inputPtr := add(inputPtr, 1)
                    }
                    mstore8(ptr, val)
                    cursor := add(cursor, 1)
                }
                case 0x5b {
                    if iszero(byte(0, mload(ptr))) {
                        let offset := mul(cursor, 2)
                        cursor := add(shr(240, mload(add(jumpBase, offset))), 1)
                    }
                    if byte(0, mload(ptr)) {
                        cursor := add(cursor, 1)
                    }
                }
                case 0x5d {
                    if iszero(iszero(byte(0, mload(ptr)))) {
                        let offset := mul(cursor, 2)
                        cursor := add(shr(240, mload(add(jumpBase, offset))), 1)
                    }
                    if iszero(byte(0, mload(ptr))) {
                        cursor := add(cursor, 1)
                    }
                }
                default {
                    cursor := add(cursor, 1)
                }
            }
            
            mstore(output, outLen)
            mstore(0x40, add(output, add(32, outLen)))
        }
    }

    /// @dev Build a jump table mapping each `[` to its matching `]` and vice versa.
    function _buildJumpTable(
        bytes calldata program
    ) internal pure returns (bytes memory jumpTable) {
        uint256 len = program.length;
        jumpTable = new bytes(len * 2);
        if (len == 0) return jumpTable;

        assembly {
            let stack := mload(0x40)
            mstore(0x40, add(stack, mul(len, 32)))
            let stackPtr := 0
            
            let progPtr := program.offset
            let jumpBase := add(jumpTable, 32)
            
            for { let i := 0 } lt(i, len) { i := add(i, 1) } {
                let op := byte(0, calldataload(add(progPtr, i)))
                
                if eq(op, 0x5b) {
                    mstore(add(stack, mul(stackPtr, 32)), i)
                    stackPtr := add(stackPtr, 1)
                }
                
                if eq(op, 0x5d) {
                    if iszero(stackPtr) {
                        let ptr_err := mload(0x40)
                        mstore(ptr_err, 0xccba53b700000000000000000000000000000000000000000000000000000000)
                        revert(ptr_err, 4)
                    }
                    stackPtr := sub(stackPtr, 1)
                    let startPos := mload(add(stack, mul(stackPtr, 32)))
                    
                    let p1 := mul(startPos, 2)
                    let p2 := mul(i, 2)
                    
                    mstore8(add(jumpBase, p1), shr(8, i))
                    mstore8(add(jumpBase, add(p1, 1)), and(i, 0xff))
                    
                    mstore8(add(jumpBase, p2), shr(8, startPos))
                    mstore8(add(jumpBase, add(p2, 1)), and(startPos, 0xff))
                }
            }
            
            // Check for unmatched open brackets
            if iszero(iszero(stackPtr)) {
                let ptr_err := mload(0x40)
                mstore(ptr_err, 0xccba53b700000000000000000000000000000000000000000000000000000000)
                revert(ptr_err, 4)
            }
        }
    }
}
