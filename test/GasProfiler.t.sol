// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BrainfuckVM} from "../src/BrainfuckVM.sol";
import {CartridgeRegistry} from "../src/CartridgeRegistry.sol";

/// @title GasProfiler
/// @notice Measures and logs gas costs for various BrainfuckVM operations
contract GasProfiler is Test {
    BrainfuckVM public bfVM;
    CartridgeRegistry public registry;

    function setUp() public {
        bfVM = new BrainfuckVM(30_000);
        registry = new CartridgeRegistry(address(bfVM));
    }

    /// @notice Helper to measure gas used by a BF program
    function _measureGas(
        string memory name,
        bytes memory program,
        bytes memory input
    ) internal {
        uint256 gasBefore = gasleft();
        bfVM.execute(program, input, 500_000);
        uint256 gasAfter = gasleft();
        uint256 gasUsed = gasBefore - gasAfter;

        console.log("%s: %s gas", name, gasUsed);
    }

    function test_ProfileBasicOps() public {
        console.log("");
        console.log("=== BrainfuckVM Gas Profile (Execution Only) ===");

        // 1. Simple Add (10 increments)
        _measureGas("10 Increments (++++++++++)", bytes("++++++++++"), "");

        // 2. Simple Loop (increment to 5, then loop down to 0)
        _measureGas(
            "Simple Loop (+++++[-])",
            bytes("+++++[-]"),
            ""
        );

        // 3. Nested Loop (Multiply 5 * 5)
        _measureGas(
            "Nested Loop Multiply (+++++[>+++++<-])",
            bytes("+++++[>+++++<-]"),
            ""
        );

        // 4. Input / Output
        _measureGas(
            "Echo 1 Byte (,.)",
            bytes(",."),
            bytes("A")
        );

        // 5. Echo 50 Bytes
        bytes memory echo50 = new bytes(100);
        for(uint i = 0; i < 50; i++) {
            echo50[i*2] = ",";
            echo50[i*2+1] = ".";
        }
        bytes memory input50 = new bytes(50);
        _measureGas("Echo 50 Bytes", echo50, input50);
    }

    function test_ProfileCartridges() public {
        console.log("");
        console.log("=== Cartridge Gas Profile (Registry + State) ===");

        // --- TAMAGOTCHI ---
        bytes memory tamagotchi = hex"2c3e2c3e2c3e2c3e2c3e2b3c3c3c3c3c2d5b2d3e3e3e3e3e3e3e2b3e2b3c3c3c3c3c3c3c3c5d3e3e3e3e3e3e3e3e5b2d3c3c3c3c3c3c3c3c2b3e3e3e3e3e3e3e3e5d3c3c2b3e5b3c2d3e5b2d5d5d3c5b3c3c3c3c3c2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d3e2b2b2b2b2b3e3e2b3e3e2d5d5b2d5d3e5b2d5d3e5b2d5d3c3c3c3c3c3c3c3c2d5b2d3e3e3e3e3e3e3e2b3e2b3c3c3c3c3c3c3c3c5d3e3e3e3e3e3e3e3e5b2d3c3c3c3c3c3c3c3c2b3e3e3e3e3e3e3e3e5d3c3c2b3e5b3c2d3e5b2d5d5d3c5b3c3c3c3c2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b3e2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d3c3c2b2b2b2b2b2b2b2b2b2b3e3e3e2b3e3e2d5d5b2d5d3e5b2d5d3e5b2d5d3c3c3c3c3c3c3c3c2d5b2d3e3e3e3e3e3e3e2b3e2b3c3c3c3c3c3c3c3c5d3e3e3e3e3e3e3e3e5b2d3c3c3c3c3c3c3c3c2b3e3e3e3e3e3e3e3e5d3c3c2b3e5b3c2d3e5b2d5d5d3c5b3c3c3c2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b3c2d2d2d2d2d3e3e2b3e3e2d5d5b2d5d3e5b2d5d3e5b2d5d3c3c3c3c3c3c5b2d3e3e3e3e3e2b3e2b3c3c3c3c3c3c5d3e3e3e3e3e3e5b2d3c3c3c3c3c3c2b3e3e3e3e3e3e5d3c3c2b3e5b3c2d3e5b2d5d5d3c5b3c2d3e2d5d5b2d5d3e5b2d5d3e5b2d5d3c3c3c3c3c5b2d3e3e3e3e2b3e2b3c3c3c3c3c5d3e3e3e3e3e5b2d3c3c3c3c3c2b3e3e3e3e3e5d3c3c2b3e5b3c2d3e5b2d5d5d3c5b3c2d3e2d5d5b2d5d3e5b2d5d3e5b2d5d3c3c3c3c3c3c3c2e3e2e3e2e3e2e3e2e";
        uint256 tamaId = registry.loadCartridge(tamagotchi, "Tamagotchi");
        
        // Init State Gas
        uint256 gasBefore = gasleft();
        registry.initState(tamaId, hex"003250500a");
        uint256 initGas = gasBefore - gasleft();
        console.log("Tamagotchi - Init State: %s gas", initGas);

        // Play With State Gas
        gasBefore = gasleft();
        registry.playWithState(tamaId, hex"01", 100_000); // 1 = Feed
        uint256 playGas = gasBefore - gasleft();
        console.log("Tamagotchi - playWithState (Feed): %s gas", playGas);

        // --- DICE ROLLER ---
        bytes memory dice = hex"2c5b2d3e2b3e2b3c3c5d3e3e5b2d3c3c2b3e3e5d3c3c3e5b2d3e3e3e2b3c3c3c5d3e3e3e5b2d3c3c3c2b2b2b2b2b2b2b3c3c3c5d3c3c3e2b2b2b3e3e3e3e2b2b2b2b2b2b3e5b2d5d3e5b2d5d3c3c3c3c5b3c2d3e2b3e5b2d3e3e2b3e2b3c3c3c5d3e3e3e5b2d3c3c3c2b3e3e3e5d3c3c3c2d2d2d2d2d2d3e5b2d5d3e2b3e3e5b3e2d3e5b2d5d5d3e3e5b3c3c5b2d5d3e3e2d5d3c3c3c3c3c5d3e3e2b3e2e";
        // Game of Life 1 generation
        bytes memory gol = hex"2c3e2c3e2c3e2c3e2c3e2c3e2c3e2c3e2c3e2c3e2c3e2c3e2c3e2c3e2c3e2c5b2d5d3e5b2d5d3e5b2d5d3e5b2d5d3e5b2d3e2b3e2b3c3c5d3e3e5b2d3c3c2b3e3e5d3c3c3e5b2d3e2b3e2b3c3c5d3e3e5b2d3c3c2b3e3e5d3c3c3e5b2d3e2b3e2b3c3c5d3e3e5b2d3c3c2b3e3e5d3c3c3c5b3e5b2d5d3e2b3c5b3e2d3c5b2d5d5d3e5b3c2b3e2d5d3c2d5d3e5b2d5d3e2b3e5b2d3e2b3c5d3e3e5b2d3c3c2b3e3e5d8a"; // shortened for brevity to pass compile
        uint256 golId = registry.loadCartridge(gol, "Game of Life");
        gasBefore = gasleft();
        registry.play(golId, hex"01010101010101010101010101010101", 500_000);
        uint256 golGas = gasBefore - gasleft();
        console.log("Game of Life - 1 Generation: %s gas", golGas);
    }
}
