// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BrainfuckVM} from "../src/BrainfuckVM.sol";
import {CartridgeRegistry} from "../src/CartridgeRegistry.sol";

contract ContadorTest is Test {
    BrainfuckVM public bfVm;
    CartridgeRegistry public registry;
    bytes public contadorCode;
    uint256 public contadorCartridgeId;

    address public alice = makeAddr("alice");

    function setUp() public {
        bfVm = new BrainfuckVM(30_000); // 30k tape
        registry = new CartridgeRegistry(address(bfVm));

        string memory codeStr = vm.readFile("scripts/contador.bf");
        contadorCode = bytes(codeStr);

        // Load the game into the CartridgeRegistry
        vm.prank(alice);
        contadorCartridgeId = registry.loadCartridge(contadorCode, "Contador Invertido");
    }

    function test_Contador_Scenario1_Win() public view {
        // Test N=15, Moves=[1, 2, 1, 2, 1, 2]
        bytes memory input = new bytes(8);
        input[0] = bytes1(uint8(15));
        input[1] = bytes1(uint8(1));
        input[2] = bytes1(uint8(2));
        input[3] = bytes1(uint8(1));
        input[4] = bytes1(uint8(2));
        input[5] = bytes1(uint8(1));
        input[6] = bytes1(uint8(2));
        input[7] = bytes1(uint8(0));

        bytes memory output = bfVm.execute(contadorCode, input, 500000);
        
        assertEq(output.length, 1, "Should output exactly 1 byte");
        assertEq(uint8(output[0]), 1, "Should win (1)");
    }

    function test_Contador_Scenario2_LossDivideOdd() public view {
        // Test N=15, Moves=[1, 2, 2]
        bytes memory input = new bytes(5);
        input[0] = bytes1(uint8(15));
        input[1] = bytes1(uint8(1)); // 14
        input[2] = bytes1(uint8(2)); // 7
        input[3] = bytes1(uint8(2)); // error (7/2)
        input[4] = bytes1(uint8(0));

        bytes memory output = bfVm.execute(contadorCode, input, 500000);
        
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 0, "Should lose (0) due to bad division");
    }

    function test_Contador_Scenario3_LossNotReachedOne() public view {
        // Test N=10, Moves=[2, 1, 2]
        bytes memory input = new bytes(5);
        input[0] = bytes1(uint8(10));
        input[1] = bytes1(uint8(2)); // 5
        input[2] = bytes1(uint8(1)); // 4
        input[3] = bytes1(uint8(2)); // 2
        input[4] = bytes1(uint8(0));

        bytes memory output = bfVm.execute(contadorCode, input, 500000);
        
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 0, "Should lose (0) because it ended at 2, not 1");
    }

    function test_Contador_Scenario4_Win10() public view {
        // Test N=10, Moves=[2, 1, 2, 2]
        bytes memory input = new bytes(6);
        input[0] = bytes1(uint8(10));
        input[1] = bytes1(uint8(2)); // 5
        input[2] = bytes1(uint8(1)); // 4
        input[3] = bytes1(uint8(2)); // 2
        input[4] = bytes1(uint8(2)); // 1
        input[5] = bytes1(uint8(0));

        bytes memory output = bfVm.execute(contadorCode, input, 500000);
        
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 1, "Should win (1) exactly on 10");
    }

    // ─── Tests Flowing Through CartridgeRegistry ──────────────────────────

    function test_Contador_RegistryFlow_Win() public {
        bytes memory input = new bytes(8);
        input[0] = bytes1(uint8(15));
        input[1] = bytes1(uint8(1));
        input[2] = bytes1(uint8(2));
        input[3] = bytes1(uint8(1));
        input[4] = bytes1(uint8(2));
        input[5] = bytes1(uint8(1));
        input[6] = bytes1(uint8(2));
        input[7] = bytes1(uint8(0));

        // Alice plays the "Contador Invertido" game via Registry
        vm.prank(alice);
        bytes memory output = registry.play(contadorCartridgeId, input, 500000);
        
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 1, "Should win (1) playing through Registry");

        // Validate playCount got incremented
        (, , , uint256 playCount) = registry.getCartridge(contadorCartridgeId);
        assertEq(playCount, 1, "Should have 1 play logged in the registry");
    }

    function test_Contador_RegistryFlow_Loss() public {
        bytes memory input = new bytes(5);
        input[0] = bytes1(uint8(15));
        input[1] = bytes1(uint8(1));
        input[2] = bytes1(uint8(2));
        input[3] = bytes1(uint8(2));
        input[4] = bytes1(uint8(0));

        vm.prank(alice);
        bytes memory output = registry.play(contadorCartridgeId, input, 500000);
        
        assertEq(output.length, 1);
        assertEq(uint8(output[0]), 0, "Should lose (0) playing through Registry");
    }
}
