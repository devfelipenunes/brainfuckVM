// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BrainfuckVM} from "../src/BrainfuckVM.sol";

contract GasBenchmark is Test {
    BrainfuckVM public vm_;

    function setUp() public {
        vm_ = new BrainfuckVM(1000); // Smaller tape for benchmarking
    }

    function test_Gas_Baseline() public view {
        vm_.execute(bytes(""), "", 10);
    }

    function test_Gas_Inc() public view {
        // Measure 1000 increments
        bytes memory prog = new bytes(1000);
        for(uint i=0; i<1000; i++) prog[i] = "+";
        vm_.execute(prog, "", 1001);
    }

    function test_Gas_Move() public view {
        // Measure 1000 moves
        bytes memory prog = new bytes(1000);
        for(uint i=0; i<1000; i++) prog[i] = ">";
        vm_.execute(prog, "", 1001);
    }

    function test_Gas_Inc_10000() public view {
        // Measure 10,000 increments to amortize build cost
        bytes memory prog = new bytes(10000);
        for(uint i=0; i<10000; i++) prog[i] = "+";
        vm_.execute(prog, "", 10001);
    }

    function _repeat(string memory char, uint256 count) internal pure returns (bytes memory) {
        bytes memory res = new bytes(count);
        bytes1 c = bytes1(bytes(char));
        for(uint i=0; i<count; i++) res[i] = c;
        return res;
    }
}
