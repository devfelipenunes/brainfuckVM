// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {BrainfuckVM} from "../src/BrainfuckVM.sol";
import {CartridgeRegistry} from "../src/CartridgeRegistry.sol";

contract CartridgeRegistryTest is Test {
    BrainfuckVM public bfVM;
    CartridgeRegistry public registry;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        bfVM = new BrainfuckVM(30_000);
        registry = new CartridgeRegistry(address(bfVM));
    }

    // ─── Load Cartridge ──────────────────────────

    function test_LoadCartridge() public {
        bytes memory program = bytes("+++.");
        vm.prank(alice);
        uint256 id = registry.loadCartridge(program, "Test Game");

        assertEq(id, 0);
        assertEq(registry.cartridgeCount(), 1);

        (bytes memory prog, string memory name, address creator, uint256 playCount) =
            registry.getCartridge(0);
        assertEq(prog, program);
        assertEq(name, "Test Game");
        assertEq(creator, alice);
        assertEq(playCount, 0);
    }

    function test_LoadCartridgeEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit CartridgeRegistry.CartridgeLoaded(0, alice, "My Game");

        vm.prank(alice);
        registry.loadCartridge(bytes("+++."), "My Game");
    }

    function test_LoadMultipleCartridges() public {
        vm.prank(alice);
        uint256 id0 = registry.loadCartridge(bytes("+++."), "Game A");

        vm.prank(bob);
        uint256 id1 = registry.loadCartridge(bytes(",."), "Game B");

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(registry.cartridgeCount(), 2);
    }

    function test_CannotLoadEmptyProgram() public {
        vm.expectRevert(CartridgeRegistry.EmptyProgram.selector);
        registry.loadCartridge(bytes(""), "Empty");
    }

    // ─── Play Cartridge (stateless) ──────────────

    function test_PlayCartridge() public {
        registry.loadCartridge(bytes(",."), "Echo");

        vm.prank(alice);
        bytes memory output = registry.play(0, bytes("A"), 100);

        assertEq(output.length, 1);
        assertEq(uint8(output[0]), uint8(bytes1("A")));
    }

    function test_PlayIncrementsPlayCount() public {
        registry.loadCartridge(bytes(",."), "Echo");

        registry.play(0, bytes("A"), 100);
        registry.play(0, bytes("B"), 100);
        registry.play(0, bytes("C"), 100);

        (, , , uint256 playCount) = registry.getCartridge(0);
        assertEq(playCount, 3);
    }

    function test_PlayEmitsEvent() public {
        registry.loadCartridge(bytes(",."), "Echo");

        vm.expectEmit(true, true, false, true);
        emit CartridgeRegistry.GamePlayed(
            0,
            alice,
            abi.encodePacked(bytes1("X"))
        );

        vm.prank(alice);
        registry.play(0, bytes("X"), 100);
    }

    function test_PlayCartridgeNotFound() public {
        vm.expectRevert(CartridgeRegistry.CartridgeNotFound.selector);
        registry.play(999, bytes("A"), 100);
    }

    // ─── Persistent State ────────────────────────

    function test_InitState() public {
        bytes memory defaultState = hex"003250500a"; // hunger=0, happy=50, energy=80, age=10
        registry.loadCartridge(bytes(",."), "Stateful", defaultState);

        vm.prank(alice);
        registry.initState(0);

        assertTrue(registry.hasState(0, alice));
        assertEq(registry.getPlayerState(0, alice), defaultState);
    }

    function test_InitStateCustom() public {
        registry.loadCartridge(bytes(",."), "Stateful");

        bytes memory customState = hex"AABBCCDD";
        vm.prank(alice);
        registry.initState(0, customState);

        assertTrue(registry.hasState(0, alice));
        assertEq(registry.getPlayerState(0, alice), customState);
    }

    function test_PlayWithState() public {
        // Echo cartridge: reads and outputs all input
        // Program: ,.,.,. (read 3, output 3)
        registry.loadCartridge(bytes(",.,.,. "), "Echo3");

        // Init state with 2 bytes
        vm.prank(alice);
        registry.initState(0, hex"AABB");

        // Play with 1 byte action + 2 bytes saved state = 3 bytes input
        vm.prank(alice);
        bytes memory output = registry.playWithState(0, hex"FF", 100);

        // Output should be all 3 input bytes echoed: FF AA BB
        assertEq(output.length, 3);
        assertEq(uint8(output[0]), 0xFF);
        assertEq(uint8(output[1]), 0xAA);
        assertEq(uint8(output[2]), 0xBB);

        // State should be updated to the output
        assertEq(registry.getPlayerState(0, alice), output);
    }

    function test_PlayWithStateRequiresInit() public {
        registry.loadCartridge(bytes(",."), "Game");

        vm.prank(alice);
        vm.expectRevert(CartridgeRegistry.NoSavedState.selector);
        registry.playWithState(0, hex"01", 100);
    }

    function test_MultiplePlayersState() public {
        registry.loadCartridge(bytes(",."), "Game");

        vm.prank(alice);
        registry.initState(0, hex"AA");

        vm.prank(bob);
        registry.initState(0, hex"BB");

        assertEq(registry.getPlayerState(0, alice), hex"AA");
        assertEq(registry.getPlayerState(0, bob), hex"BB");
    }

    // ─── Multiple Games ──────────────────────────

    function test_PlayDifferentCartridges() public {
        registry.loadCartridge(bytes("+++."), "Three");
        registry.loadCartridge(bytes(",."), "Echo");

        bytes memory out0 = registry.play(0, bytes(""), 100);
        bytes memory out1 = registry.play(1, bytes("Z"), 100);

        assertEq(uint8(out0[0]), 3);
        assertEq(uint8(out1[0]), uint8(bytes1("Z")));
    }
}
