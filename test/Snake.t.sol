// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BrainfuckVM} from "../src/BrainfuckVM.sol";
import {CartridgeRegistry} from "../src/CartridgeRegistry.sol";

contract SnakeTest is Test {
    BrainfuckVM public bfVm;
    CartridgeRegistry public registry;
    bytes public snakeCode;
    uint256 public snakeCartridgeId;

    address public alice = makeAddr("alice");

    // Movement ASCII codes
    uint8 constant W = 119; // up
    uint8 constant A = 97;  // left
    uint8 constant S = 115; // down
    uint8 constant D = 100; // right

    // Max steps for BF execution (Snake loops are heavier than single-turn games)
    uint256 constant MAX_STEPS = 5_000_000;

    function setUp() public {
        bfVm = new BrainfuckVM(30_000);
        registry = new CartridgeRegistry(address(bfVm));

        string memory codeStr = vm.readFile("scripts/snake.bf");
        snakeCode = bytes(codeStr);

        // Load the Snake cartridge
        vm.prank(alice);
        snakeCartridgeId = registry.loadCartridge(snakeCode, "Snake Minimalista");
    }

    // ─── Helper ─────────────────────────────────────────────────────────

    /// @dev Build interleaved input: [move0, seed0, move1, seed1, ...]
    function _buildInput(
        uint8[] memory moves,
        uint8[] memory seeds
    ) internal pure returns (bytes memory input) {
        require(moves.length == seeds.length, "moves/seeds length mismatch");
        input = new bytes(moves.length * 2);
        for (uint256 i = 0; i < moves.length; i++) {
            input[i * 2]     = bytes1(moves[i]);
            input[i * 2 + 1] = bytes1(seeds[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Direct BrainfuckVM Tests
    // ═══════════════════════════════════════════════════════════════════

    function test_Snake_Direct_MoveRight_Safe() public view {
        // Start at (2,2), move right → (3,2). No wall, no food.
        uint8[] memory moves = new uint8[](1);
        uint8[] memory seeds = new uint8[](1);
        moves[0] = D; seeds[0] = 0;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2, "Should output 2 bytes");
        assertEq(uint8(output[0]), 0, "game_over should be 0 (survived)");
        assertEq(uint8(output[1]), 0, "score should be 0 (no food)");
    }

    function test_Snake_Direct_MoveLeft_Safe() public view {
        uint8[] memory moves = new uint8[](1);
        uint8[] memory seeds = new uint8[](1);
        moves[0] = A; seeds[0] = 0;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 0, "game_over=0");
        assertEq(uint8(output[1]), 0, "score=0");
    }

    function test_Snake_Direct_MoveUp_Safe() public view {
        uint8[] memory moves = new uint8[](1);
        uint8[] memory seeds = new uint8[](1);
        moves[0] = W; seeds[0] = 0;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 0, "game_over=0");
        assertEq(uint8(output[1]), 0, "score=0");
    }

    function test_Snake_Direct_MoveDown_Safe() public view {
        uint8[] memory moves = new uint8[](1);
        uint8[] memory seeds = new uint8[](1);
        moves[0] = S; seeds[0] = 0;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 0, "game_over=0");
        assertEq(uint8(output[1]), 0, "score=0");
    }

    function test_Snake_Direct_HitRightWall() public view {
        // Start x=2, move right 3x → x=5 → game over
        uint8[] memory moves = new uint8[](3);
        uint8[] memory seeds = new uint8[](3);
        moves[0] = D; seeds[0] = 0;
        moves[1] = D; seeds[1] = 0;
        moves[2] = D; seeds[2] = 0;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 1, "game_over=1 (hit right wall)");
        assertEq(uint8(output[1]), 0, "score=0");
    }

    function test_Snake_Direct_HitLeftWall() public view {
        // Start x=2, move left 3x → x=-1 (wraps to 255) → game over
        uint8[] memory moves = new uint8[](3);
        uint8[] memory seeds = new uint8[](3);
        moves[0] = A; seeds[0] = 0;
        moves[1] = A; seeds[1] = 0;
        moves[2] = A; seeds[2] = 0;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 1, "game_over=1 (hit left wall)");
        assertEq(uint8(output[1]), 0, "score=0");
    }

    function test_Snake_Direct_HitBottomWall() public view {
        // Start y=2, move down 3x → y=5 → game over
        uint8[] memory moves = new uint8[](3);
        uint8[] memory seeds = new uint8[](3);
        moves[0] = S; seeds[0] = 0;
        moves[1] = S; seeds[1] = 0;
        moves[2] = S; seeds[2] = 0;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 1, "game_over=1 (hit bottom wall)");
        assertEq(uint8(output[1]), 0, "score=0");
    }

    function test_Snake_Direct_HitTopWall() public view {
        // Start y=2, move up 3x → y=-1 (wraps to 255) → game over
        uint8[] memory moves = new uint8[](3);
        uint8[] memory seeds = new uint8[](3);
        moves[0] = W; seeds[0] = 0;
        moves[1] = W; seeds[1] = 0;
        moves[2] = W; seeds[2] = 0;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 1, "game_over=1 (hit top wall)");
        assertEq(uint8(output[1]), 0, "score=0");
    }

    function test_Snake_Direct_CollectFood() public view {
        // Head starts at (2,2), food at (0,0).
        // Move left×2, up×2 → reach (0,0) → eat food → score=1
        uint8[] memory moves = new uint8[](4);
        uint8[] memory seeds = new uint8[](4);
        moves[0] = A; seeds[0] = 10;
        moves[1] = A; seeds[1] = 10;
        moves[2] = W; seeds[2] = 10;
        moves[3] = W; seeds[3] = 10;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 0, "game_over=0 (survived)");
        assertEq(uint8(output[1]), 1, "score=1 (collected food)");
    }

    function test_Snake_Direct_CollectFoodThenSurvive() public view {
        // Eat food at (0,0) then move right → still alive
        uint8[] memory moves = new uint8[](5);
        uint8[] memory seeds = new uint8[](5);
        moves[0] = A; seeds[0] = 10;
        moves[1] = A; seeds[1] = 10;
        moves[2] = W; seeds[2] = 10;
        moves[3] = W; seeds[3] = 10;
        moves[4] = D; seeds[4] = 0;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 0, "game_over=0");
        assertEq(uint8(output[1]), 1, "score=1");
    }

    function test_Snake_Direct_SquareLoop_NoFood() public view {
        // Move in a square from center: D, S, A, W → back to (2,2)
        uint8[] memory moves = new uint8[](4);
        uint8[] memory seeds = new uint8[](4);
        moves[0] = D; seeds[0] = 0;
        moves[1] = S; seeds[1] = 0;
        moves[2] = A; seeds[2] = 0;
        moves[3] = W; seeds[3] = 0;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 0, "game_over=0");
        assertEq(uint8(output[1]), 0, "score=0 (no food eaten)");
    }

    function test_Snake_Direct_ZigZag_Safe() public view {
        // Multiple direction changes within bounds
        uint8[] memory moves = new uint8[](6);
        uint8[] memory seeds = new uint8[](6);
        moves[0] = D; seeds[0] = 0;
        moves[1] = D; seeds[1] = 0;
        moves[2] = S; seeds[2] = 0;
        moves[3] = S; seeds[3] = 0;
        moves[4] = A; seeds[4] = 0;
        moves[5] = A; seeds[5] = 0;

        bytes memory output = bfVm.execute(snakeCode, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 0, "game_over=0");
        assertEq(uint8(output[1]), 0, "score=0");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CartridgeRegistry Flow Tests
    // ═══════════════════════════════════════════════════════════════════

    function test_Snake_RegistryFlow_Survive() public {
        // Simple safe move through registry
        uint8[] memory moves = new uint8[](1);
        uint8[] memory seeds = new uint8[](1);
        moves[0] = D; seeds[0] = 0;

        vm.prank(alice);
        bytes memory output = registry.play(snakeCartridgeId, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 0, "game_over=0 via Registry");
        assertEq(uint8(output[1]), 0, "score=0 via Registry");

        (, , , uint256 playCount) = registry.getCartridge(snakeCartridgeId);
        assertEq(playCount, 1, "Should have 1 play logged");
    }

    function test_Snake_RegistryFlow_GameOver() public {
        // Hit right wall through registry
        uint8[] memory moves = new uint8[](3);
        uint8[] memory seeds = new uint8[](3);
        moves[0] = D; seeds[0] = 0;
        moves[1] = D; seeds[1] = 0;
        moves[2] = D; seeds[2] = 0;

        vm.prank(alice);
        bytes memory output = registry.play(snakeCartridgeId, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 1, "game_over=1 via Registry (hit wall)");
        assertEq(uint8(output[1]), 0, "score=0 via Registry");

        (, , , uint256 playCount) = registry.getCartridge(snakeCartridgeId);
        assertEq(playCount, 1, "Should have 1 play logged");
    }

    function test_Snake_RegistryFlow_CollectFood() public {
        // Collect food at (0,0) through registry
        uint8[] memory moves = new uint8[](4);
        uint8[] memory seeds = new uint8[](4);
        moves[0] = A; seeds[0] = 10;
        moves[1] = A; seeds[1] = 10;
        moves[2] = W; seeds[2] = 10;
        moves[3] = W; seeds[3] = 10;

        vm.prank(alice);
        bytes memory output = registry.play(snakeCartridgeId, _buildInput(moves, seeds), MAX_STEPS);

        assertEq(output.length, 2);
        assertEq(uint8(output[0]), 0, "game_over=0 via Registry");
        assertEq(uint8(output[1]), 1, "score=1 via Registry (food collected)");

        (, , , uint256 playCount) = registry.getCartridge(snakeCartridgeId);
        assertEq(playCount, 1, "Should have 1 play logged");
    }

    function test_Snake_RegistryFlow_MultipleGames() public {
        // Play twice through registry, verify playCount increments
        uint8[] memory moves = new uint8[](1);
        uint8[] memory seeds = new uint8[](1);
        moves[0] = D; seeds[0] = 0;

        vm.prank(alice);
        registry.play(snakeCartridgeId, _buildInput(moves, seeds), MAX_STEPS);

        vm.prank(alice);
        registry.play(snakeCartridgeId, _buildInput(moves, seeds), MAX_STEPS);

        (, , , uint256 playCount) = registry.getCartridge(snakeCartridgeId);
        assertEq(playCount, 2, "Should have 2 plays logged in the registry");
    }
}
