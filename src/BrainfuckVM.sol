// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title BrainfuckVM
/// @notice On-chain Brainfuck interpreter. Executes BF programs entirely on-chain.
/// @dev Supports standard > < + - . , [ ] and provides an AoT compiler into bytecode.
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

    /// @notice Compiles a Brainfuck program into EVM-optimized bytecode layout
    function compile(bytes calldata script) public pure returns (bytes memory bytecode) {
        uint256 len = script.length;
        if (len == 0) return new bytes(0);

        uint32[] memory ins = new uint32[](len);
        uint256 insCount = 0;
        
        uint32[] memory loopStack = new uint32[](len);
        uint256 stackPtr = 0;
        
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = script[i];
            
            if (c == '>' || c == '<' || c == '+' || c == '-') {
                uint32 count = 1;
                while (i + 1 < len && script[i + 1] == c) {
                    if (count == 0xFFFFFF) break;
                    count++;
                    i++;
                }
                uint8 op;
                if (c == '>') op = 1;
                else if (c == '<') op = 2;
                else if (c == '+') op = 3;
                else if (c == '-') op = 4;
                ins[insCount++] = (uint32(op) << 24) | (count & 0xFFFFFF);
            } else if (c == '.') {
                ins[insCount++] = (5 << 24);
            } else if (c == ',') {
                ins[insCount++] = (6 << 24);
            } else if (c == '[') {
                // Optimize [-] Clear Macro
                if (i + 2 < len && (script[i + 1] == '-' || script[i + 1] == '+') && script[i + 2] == ']') {
                    ins[insCount++] = (9 << 24);
                    i += 2;
                } else if (i + 5 < len && script[i + 1] == '-' && script[i + 2] == '>' && script[i + 3] == '+' && script[i + 4] == '<' && script[i + 5] == ']') {
                    // Optimize [->+<] Move Macro (move to right)
                    ins[insCount++] = (10 << 24) | (1 & 0xFFFFFF);
                    i += 5;
                } else if (i + 5 < len && script[i + 1] == '-' && script[i + 2] == '<' && script[i + 3] == '+' && script[i + 4] == '>' && script[i + 5] == ']') {
                    // Optimize [-<+>] Move Macro (move to left)
                    ins[insCount++] = (11 << 24) | (1 & 0xFFFFFF);
                    i += 5;
                } else {
                    loopStack[stackPtr++] = uint32(insCount);
                    ins[insCount++] = (7 << 24);
                }
            } else if (c == ']') {
                if (stackPtr == 0) revert UnmatchedBracket();
                uint32 start = loopStack[--stackPtr];
                ins[start] |= uint32(insCount + 1);
                ins[insCount++] = (8 << 24) | (start + 1);
            }
        }
        if (stackPtr > 0) revert UnmatchedBracket();
        
        bytecode = new bytes(insCount * 4);
        for (uint256 j = 0; j < insCount; j++) {
            uint32 inst = ins[j];
            bytecode[j*4]   = bytes1(uint8(inst >> 24));
            bytecode[j*4+1] = bytes1(uint8(inst >> 16));
            bytecode[j*4+2] = bytes1(uint8(inst >> 8));
            bytecode[j*4+3] = bytes1(uint8(inst));
        }
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

    /// @notice Auto-detects if program is source or bytecode and executes. Reverts to memory compilation overhead for source.
    function execute(
        bytes calldata program,
        bytes calldata input,
        uint256 maxSteps
    ) public pure returns (bytes memory output) {
        if (program.length == 0) return new bytes(0);
        if (uint8(program[0]) <= 9) return executeCompiled(program, input, maxSteps);
        
        // Dynamic compilation penalty
        bytes memory bytecode = compile(program);
        return _executeCompiledMemory(bytecode, input, maxSteps);
    }

    /// @notice Fully optimized calldata execution for pre-compiled bytecode
    function executeCompiled(
        bytes calldata bytecode,
        bytes calldata input,
        uint256 maxSteps
    ) public pure returns (bytes memory output) {
        uint256 progLen = bytecode.length;
        if (progLen == 0) return new bytes(0);

        assembly {
            let tape := mload(0x40)
            mstore(0x40, add(tape, 10048))
            codecopy(tape, codesize(), 10048)

            output := mload(0x40)
            mstore(output, 0)
            mstore(0x40, add(output, 2080))

            let ptr := tape
            let inputPtr := 0
            let steps := 0
            let outLen := 0

            let progBase := bytecode.offset
            let endPtr := add(progBase, progLen)
            let inputBase := input.offset
            let inputLen := input.length
            
            for { let cursor := progBase } lt(cursor, endPtr) { } {
                if iszero(and(steps, 0x3f)) {
                    if gt(steps, maxSteps) {
                        let ptr_err := mload(0x40) // MaxStepsExceeded()
                        mstore(ptr_err, 0xf47200c400000000000000000000000000000000000000000000000000000000)
                        revert(ptr_err, 4)
                    }
                }
                steps := add(steps, 1)

                let inst := shr(224, calldataload(cursor))
                let op := shr(24, inst)
                let arg := and(inst, 0xFFFFFF)
                
                switch op
                case 1 { 
                    ptr := add(ptr, arg)
                    cursor := add(cursor, 4)
                }
                case 2 { 
                    ptr := sub(ptr, arg)
                    cursor := add(cursor, 4)
                }
                case 3 { 
                    mstore8(ptr, add(byte(0, mload(ptr)), arg))
                    cursor := add(cursor, 4)
                }
                case 4 { 
                    mstore8(ptr, sub(byte(0, mload(ptr)), arg))
                    cursor := add(cursor, 4)
                }
                case 5 {
                    mstore8(add(add(output, 32), outLen), byte(0, mload(ptr)))
                    outLen := add(outLen, 1)
                    cursor := add(cursor, 4)
                }
                case 6 {
                    let val := 0
                    if lt(inputPtr, inputLen) {
                        val := byte(0, calldataload(add(inputBase, inputPtr)))
                        inputPtr := add(inputPtr, 1)
                    }
                    mstore8(ptr, val)
                    cursor := add(cursor, 4)
                }
                case 7 {
                    if iszero(byte(0, mload(ptr))) {
                        cursor := add(progBase, mul(arg, 4))
                    }
                    if byte(0, mload(ptr)) {
                        cursor := add(cursor, 4)
                    }
                }
                case 8 {
                    if iszero(iszero(byte(0, mload(ptr)))) {
                        cursor := add(progBase, mul(arg, 4))
                    }
                    if iszero(byte(0, mload(ptr))) {
                        cursor := add(cursor, 4)
                    }
                }
                case 9 {
                    mstore8(ptr, 0)
                    cursor := add(cursor, 4)
                }
                case 10 {
                    let val := byte(0, mload(ptr))
                    mstore8(ptr, 0)
                    let rightPtr := add(ptr, arg)
                    mstore8(rightPtr, add(byte(0, mload(rightPtr)), val))
                    cursor := add(cursor, 4)
                }
                case 11 {
                    let val := byte(0, mload(ptr))
                    mstore8(ptr, 0)
                    let leftPtr := sub(ptr, arg)
                    mstore8(leftPtr, add(byte(0, mload(leftPtr)), val))
                    cursor := add(cursor, 4)
                }
                default {
                    cursor := add(cursor, 4)
                }
            }
            
            if gt(ptr, add(tape, 10000)) {
                let ptr_err := mload(0x40) // PointerOverflow()
                mstore(ptr_err, 0x26aaeb2700000000000000000000000000000000000000000000000000000000)
                revert(ptr_err, 4)
            }
            if lt(ptr, tape) {
                let ptr_err := mload(0x40) // PointerUnderflow()
                mstore(ptr_err, 0x3bf08bad00000000000000000000000000000000000000000000000000000000)
                revert(ptr_err, 4)
            }

            mstore(output, outLen)
            mstore(0x40, add(output, add(32, outLen)))
        }
    }

    /// @notice Optimized memory execution for on-the-fly JIT
    function _executeCompiledMemory(
        bytes memory bytecode,
        bytes calldata input,
        uint256 maxSteps
    ) internal pure returns (bytes memory output) {
        uint256 progLen = bytecode.length;
        if (progLen == 0) return new bytes(0);

        assembly {
            let tape := mload(0x40)
            mstore(0x40, add(tape, 10048))
            codecopy(tape, codesize(), 10048)

            output := mload(0x40)
            mstore(output, 0)
            mstore(0x40, add(output, 2080))

            let ptr := tape
            let inputPtr := 0
            let steps := 0
            let outLen := 0

            let progBase := add(bytecode, 32)
            let endPtr := add(progBase, progLen)
            let inputBase := input.offset
            let inputLen := input.length
            
            for { let cursor := progBase } lt(cursor, endPtr) { } {
                if iszero(and(steps, 0x3f)) {
                    if gt(steps, maxSteps) {
                        let ptr_err := mload(0x40)
                        mstore(ptr_err, 0xf47200c400000000000000000000000000000000000000000000000000000000)
                        revert(ptr_err, 4)
                    }
                }
                steps := add(steps, 1)

                let inst := shr(224, mload(cursor))
                let op := shr(24, inst)
                let arg := and(inst, 0xFFFFFF)
                
                switch op
                case 1 { 
                    ptr := add(ptr, arg)
                    cursor := add(cursor, 4)
                }
                case 2 { 
                    ptr := sub(ptr, arg)
                    cursor := add(cursor, 4)
                }
                case 3 { 
                    mstore8(ptr, add(byte(0, mload(ptr)), arg))
                    cursor := add(cursor, 4)
                }
                case 4 { 
                    mstore8(ptr, sub(byte(0, mload(ptr)), arg))
                    cursor := add(cursor, 4)
                }
                case 5 {
                    mstore8(add(add(output, 32), outLen), byte(0, mload(ptr)))
                    outLen := add(outLen, 1)
                    cursor := add(cursor, 4)
                }
                case 6 {
                    let val := 0
                    if lt(inputPtr, inputLen) {
                        val := byte(0, calldataload(add(inputBase, inputPtr)))
                        inputPtr := add(inputPtr, 1)
                    }
                    mstore8(ptr, val)
                    cursor := add(cursor, 4)
                }
                case 7 {
                    if iszero(byte(0, mload(ptr))) {
                        cursor := add(progBase, mul(arg, 4))
                    }
                    if byte(0, mload(ptr)) {
                        cursor := add(cursor, 4)
                    }
                }
                case 8 {
                    if iszero(iszero(byte(0, mload(ptr)))) {
                        cursor := add(progBase, mul(arg, 4))
                    }
                    if iszero(byte(0, mload(ptr))) {
                        cursor := add(cursor, 4)
                    }
                }
                case 9 {
                    mstore8(ptr, 0)
                    cursor := add(cursor, 4)
                }
                case 10 {
                    let val := byte(0, mload(ptr))
                    mstore8(ptr, 0)
                    let rightPtr := add(ptr, arg)
                    mstore8(rightPtr, add(byte(0, mload(rightPtr)), val))
                    cursor := add(cursor, 4)
                }
                case 11 {
                    let val := byte(0, mload(ptr))
                    mstore8(ptr, 0)
                    let leftPtr := sub(ptr, arg)
                    mstore8(leftPtr, add(byte(0, mload(leftPtr)), val))
                    cursor := add(cursor, 4)
                }
                default {
                    cursor := add(cursor, 4)
                }
            }
            
            if gt(ptr, add(tape, 10000)) {
                let ptr_err := mload(0x40)
                mstore(ptr_err, 0x26aaeb2700000000000000000000000000000000000000000000000000000000)
                revert(ptr_err, 4)
            }
            if lt(ptr, tape) {
                let ptr_err := mload(0x40)
                mstore(ptr_err, 0x3bf08bad00000000000000000000000000000000000000000000000000000000)
                revert(ptr_err, 4)
            }

            mstore(output, outLen)
            mstore(0x40, add(output, add(32, outLen)))
        }
    }
}