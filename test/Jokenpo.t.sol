// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BrainfuckVM} from "../src/BrainfuckVM.sol";
import {CartridgeRegistry} from "../src/CartridgeRegistry.sol";

contract JokenpoTest is Test {
    BrainfuckVM public bfVm;
    CartridgeRegistry public registry;
    bytes public jokenpoCode;
    uint256 public jokenpoCartridgeId;

    address public alice = makeAddr("alice");

    function setUp() public {
        bfVm = new BrainfuckVM(30_000); // 30k tape
        registry = new CartridgeRegistry(address(bfVm));

        string memory codeStr = vm.readFile("scripts/jokenpo.bf");
        jokenpoCode = bytes(codeStr);

        // Load the game into the CartridgeRegistry
        vm.prank(alice);
        jokenpoCartridgeId = registry.loadCartridge(jokenpoCode, "Jokenpo");
    }

    function test_Jokenpo_Direct_Win() public view {
        // Player 1 (Paper) vs Seed 0 (Rock -> 0%3 = 0)
        bytes memory input = new bytes(2);
        input[0] = bytes1(uint8(1));
        input[1] = bytes1(uint8(0));

        bytes memory output = bfVm.execute(jokenpoCode, input, 500000);
        
        assertEq(output.length, 1, "Should output exactly 1 byte");
        assertEq(uint8(output[0]), 1, "Should win (1)");
    }

    function test_Jokenpo_Direct_Loss() public view {
        // Player 0 (Rock) vs Seed 1 (Paper -> 1%3 = 1)
        bytes memory input = new bytes(2);
        input[0] = bytes1(uint8(0));
        input[1] = bytes1(uint8(1));

        bytes memory output = bfVm.execute(jokenpoCode, input, 500000);
        
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 2, "Should lose (2)");
    }

    function test_Jokenpo_Direct_Draw() public view {
        // Player 2 (Scissors) vs Seed 5 (Scissors -> 5%3 = 2)
        bytes memory input = new bytes(2);
        input[0] = bytes1(uint8(2));
        input[1] = bytes1(uint8(5));

        bytes memory output = bfVm.execute(jokenpoCode, input, 500000);
        
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 0, "Should draw (0)");
    }

    // ─── Tests Flowing Through CartridgeRegistry ──────────────────────────

    function test_Jokenpo_RegistryFlow_Win() public {
        // Player 2 (Scissors) vs Seed 1 (Paper -> 1)
        bytes memory input = new bytes(2);
        input[0] = bytes1(uint8(2));
        input[1] = bytes1(uint8(1));

        // Alice plays the "Jokenpo" game via Registry
        vm.prank(alice);
        bytes memory output = registry.play(jokenpoCartridgeId, input, 500000);
        
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 1, "Should win (1) playing through Registry");

        // Validate playCount got incremented
        (, , , uint256 playCount) = registry.getCartridge(jokenpoCartridgeId);
        assertEq(playCount, 1, "Should have 1 play logged in the registry");
    }

    function test_Jokenpo_RegistryFlow_Loss() public {
        // Player 1 (Paper) vs Seed 8 (Scissors -> 8%3 = 2)
        bytes memory input = new bytes(2);
        input[0] = bytes1(uint8(1));
        input[1] = bytes1(uint8(8));

        vm.prank(alice);
        bytes memory output = registry.play(jokenpoCartridgeId, input, 500000);
        
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 2, "Should lose (2) playing through Registry");
    }

    function test_Jokenpo_RegistryFlow_Draw() public {
        // Player 0 (Rock) vs Seed 0 (Rock -> 0%3 = 0)
        bytes memory input = new bytes(2);
        input[0] = bytes1(uint8(0));
        input[1] = bytes1(uint8(0));

        vm.prank(alice);
        bytes memory output = registry.play(jokenpoCartridgeId, input, 500000);
        
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 0, "Should draw (0) playing through Registry");
    }
}
