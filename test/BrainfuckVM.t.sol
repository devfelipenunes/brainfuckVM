// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BrainfuckVM} from "../src/BrainfuckVM.sol";

contract BrainfuckVMTest is Test {
    BrainfuckVM public vm_;

    function setUp() public {
        vm_ = new BrainfuckVM(30_000);
    }

    // ─── Basic Commands ──────────────────────────

    function test_IncrementDecrement() public view {
        // +++--- should leave cell at 0, no output
        bytes memory output = vm_.execute(bytes("+++---"), "", 100);
        assertEq(output.length, 0);
    }

    function test_IncrementAndOutput() public view {
        // Put 65 ('A') in cell 0, then output it
        // 65 = 64 + 1 = (16*4) + 1
        // We'll do it with a loop: set cell0=65 then print
        // Quick approach: 65 plus signs followed by a dot
        bytes memory program = _repeatChar("+", 65);
        program = abi.encodePacked(program, ".");
        bytes memory output = vm_.execute(program, "", 200);
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 65); // 'A'
    }

    function test_MovePointer() public view {
        // >+++.  → move to cell 1, increment 3 times, output (should be 3)
        bytes memory output = vm_.execute(bytes(">+++."), "", 100);
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 3);
    }

    function test_MovePointerLeftRight() public view {
        // +++>++<.  → cell0=3, move right, cell1=2, move left, output cell0 (=3)
        bytes memory output = vm_.execute(bytes("+++>++<."), "", 100);
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 3);
    }

    function test_Output() public view {
        // Put 72 ('H') in cell 0, then output
        bytes memory program = abi.encodePacked(_repeatChar("+", 72), ".");
        bytes memory output = vm_.execute(program, "", 200);
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 72); // 'H'
    }

    function test_Input() public view {
        // , reads one byte from input, . outputs it
        bytes memory output = vm_.execute(bytes(",."), bytes("X"), 100);
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), uint8(bytes1("X")));
    }

    function test_InputEOF() public view {
        // When input is exhausted, `,` should set cell to 0
        bytes memory output = vm_.execute(bytes(",."), "", 100);
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 0);
    }

    function test_MultipleInputs() public view {
        // Read 3 chars, output them in reverse order using pointer movement
        // ,>,>,<<.>.>.
        bytes memory output = vm_.execute(
            bytes(",>,>,<<.>.>."),
            bytes("ABC"),
            100
        );
        assertEq(output.length, 3);
        assertEq(uint8(output[0]), uint8(bytes1("A")));
        assertEq(uint8(output[1]), uint8(bytes1("B")));
        assertEq(uint8(output[2]), uint8(bytes1("C")));
    }

    // ─── Loops ───────────────────────────────────

    function test_SimpleLoop() public view {
        // +++[-] → set cell to 3, then loop decrement to 0
        bytes memory output = vm_.execute(bytes("+++[-]."), "", 100);
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 0); // Cell should be 0 after [-]
    }

    function test_NestedLoops() public view {
        // Use nested loops to compute multiplication: 3 * 4 = 12
        // cell0=3, cell1=0
        // [>++++<-] → for each decrement of cell0, add 4 to cell1
        // Result: cell1 = 12
        bytes memory output = vm_.execute(
            bytes("+++[>++++<-]>."),
            "",
            200
        );
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 12);
    }

    function test_SkipLoopWhenZero() public view {
        // [+++]. → cell is 0, so loop is skipped entirely, output 0
        bytes memory output = vm_.execute(bytes("[+++]."), "", 100);
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 0);
    }

    // ─── Classic Programs ────────────────────────

    function test_HelloWorld() public view {
        // Classic Hello World BF program
        bytes memory program = bytes(
            "++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]"
            ">>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++."
        );

        bytes memory output = vm_.execute(program, "", 10_000);

        // Should output "Hello World!\n"
        assertEq(string(output), "Hello World!\n");
    }

    function test_Addition() public view {
        // Add two input numbers (single digit as ASCII)
        // Read two digits, subtract ASCII '0' (48) from each, add them, add '0' back, output
        // Program: ,>,[<+>-]<.  (add cell1 to cell0)
        // Input: chr(3) and chr(5) → result should be chr(8) = 8
        bytes memory input = new bytes(2);
        input[0] = bytes1(uint8(3));
        input[1] = bytes1(uint8(5));

        bytes memory output = vm_.execute(
            bytes(",>,[<+>-]<."),
            input,
            200
        );

        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 8); // 3 + 5 = 8
    }

    // ─── Edge Cases ──────────────────────────────

    function test_EmptyProgram() public view {
        bytes memory output = vm_.execute(bytes(""), "", 100);
        assertEq(output.length, 0);
    }

    function test_MaxStepsRevert() public {
        // Infinite loop should hit step limit
        // +[] → cell=1, infinite loop since cell never becomes 0
        vm.expectRevert(BrainfuckVM.MaxStepsExceeded.selector);
        vm_.execute(bytes("+[]"), "", 100);
    }

    function test_PointerUnderflow() public {
        vm.expectRevert(BrainfuckVM.PointerUnderflow.selector);
        vm_.execute(bytes("<"), "", 100);
    }

    function test_PointerOverflow() public {
        // Move pointer past tape size
        bytes memory program = _repeatChar(">", 30_000);
        vm.expectRevert(BrainfuckVM.PointerOverflow.selector);
        vm_.execute(program, "", 50_000);
    }

    function test_UnmatchedOpenBracket() public {
        vm.expectRevert(BrainfuckVM.UnmatchedBracket.selector);
        vm_.execute(bytes("[+"), "", 100);
    }

    function test_UnmatchedCloseBracket() public {
        vm.expectRevert(BrainfuckVM.UnmatchedBracket.selector);
        vm_.execute(bytes("+]"), "", 100);
    }

    function test_Wrapping() public view {
        // uint8 overflow: 255 + 1 = 0 (wrapping)
        bytes memory program = abi.encodePacked(_repeatChar("+", 256), ".");
        bytes memory output = vm_.execute(program, "", 500);
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 0); // 256 wraps to 0
    }

    function test_WrappingUnderflow() public view {
        // uint8 underflow: 0 - 1 = 255 (wrapping)
        bytes memory output = vm_.execute(bytes("-."), "", 100);
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 255);
    }

    // ─── Public run() Function ───────────────────

    function test_RunStoresResult() public {
        bytes memory program = abi.encodePacked(_repeatChar("+", 65), ".");
        bytes32 programHash = keccak256(program);

        vm_.run(program, "", 200);

        bytes memory stored = vm_.lastResult(programHash);
        assertEq(stored.length, 1);
        assertEq(uint8(stored[0]), 65);
    }

    function test_RunEmitsEvent() public {
        bytes memory program = abi.encodePacked(_repeatChar("+", 65), ".");
        bytes32 programHash = keccak256(program);

        vm.expectEmit(true, true, false, true);
        emit BrainfuckVM.ProgramExecuted(
            programHash,
            address(this),
            abi.encodePacked(bytes1(uint8(65)))
        );

        vm_.run(program, "", 200);
    }

    // ─── Helpers ─────────────────────────────────

    function _repeatChar(
        string memory char,
        uint256 count
    ) internal pure returns (bytes memory) {
        bytes memory result = new bytes(count);
        bytes1 c = bytes1(bytes(char));
        for (uint256 i = 0; i < count; i++) {
            result[i] = c;
        }
        return result;
    }
}
