// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title BrainfuckVM
/// @notice On-chain Brainfuck interpreter. Executes BF programs entirely on-chain.
/// @dev All 8 BF commands are supported: > < + - . , [ ]
contract BrainfuckVM {
    error PointerOverflow();
    error PointerUnderflow();
    error MaxStepsExceeded();
    error UnmatchedBracket();

    event ProgramExecuted(
        bytes32 indexed programHash,
        address indexed caller,
        bytes output
    );

    uint256 public immutable tapeSize;
    mapping(bytes32 => bytes) public lastResult;

    constructor(uint256 _tapeSize) {
        tapeSize = _tapeSize == 0 ? 30_000 : _tapeSize;
    }

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
            mstore(0x40, add(tape, 10048))
            codecopy(tape, codesize(), 10048)

            output := mload(0x40)
            mstore(output, 0)
            mstore(0x40, add(output, 2080))

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
                        mstore(ptr_err, 0xee41a16d00000000000000000000000000000000000000000000000000000000)
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
                    cursor := add(cursor, count)
                }
                case 0x3c { 
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
            
            if or(lt(ptr, tape), gt(ptr, add(tape, 10000))) {
                let ptr_err := mload(0x40)
                mstore(ptr_err, 0x6e26715800000000000000000000000000000000000000000000000000000000)
                revert(ptr_err, 4)
            }

            mstore(output, outLen)
            mstore(0x40, add(output, add(32, outLen)))
        }
    }

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
                        mstore(ptr_err, 0x3bf08bad00000000000000000000000000000000000000000000000000000000)
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
        }
    }
}
