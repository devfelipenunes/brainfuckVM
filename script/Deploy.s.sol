// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {BrainfuckVM} from "../src/BrainfuckVM.sol";
import {CartridgeRegistry} from "../src/CartridgeRegistry.sol";

contract Deploy is Script {
    uint256 public constant TAPE_SIZE = 30_000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy BrainfuckVM
        BrainfuckVM bfVm = new BrainfuckVM(TAPE_SIZE);
        console.log("BrainfuckVM deployed at:", address(bfVm));

        // Deploy CartridgeRegistry
        CartridgeRegistry registry = new CartridgeRegistry(address(bfVm));
        console.log("CartridgeRegistry deployed at:", address(registry));

        // ─── Register Tamagotchi Cartridge (571 bytes) ───
        bytes memory tamagotchi = hex"2c3e2c3e2c3e2c3e2c3e2b3c3c3c3c3c2d5b2d3e3e3e3e3e3e3e2b3e2b3c3c3c3c3c3c3c3c5d3e3e3e3e3e3e3e3e5b2d3c3c3c3c3c3c3c3c2b3e3e3e3e3e3e3e3e5d3c3c2b3e5b3c2d3e5b2d5d5d3c5b3c3c3c3c3c2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d3e2b2b2b2b2b3e3e2b3e3e2d5d5b2d5d3e5b2d5d3e5b2d5d3c3c3c3c3c3c3c3c2d5b2d3e3e3e3e3e3e3e2b3e2b3c3c3c3c3c3c3c3c5d3e3e3e3e3e3e3e3e5b2d3c3c3c3c3c3c3c3c2b3e3e3e3e3e3e3e3e5d3c3c2b3e5b3c2d3e5b2d5d5d3c5b3c3c3c3c2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b3e2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d3c3c2b2b2b2b2b2b2b2b2b2b3e3e3e2b3e3e2d5d5b2d5d3e5b2d5d3e5b2d5d3c3c3c3c3c3c3c3c2d5b2d3e3e3e3e3e3e3e2b3e2b3c3c3c3c3c3c3c3c5d3e3e3e3e3e3e3e3e5b2d3c3c3c3c3c3c3c3c2b3e3e3e3e3e3e3e3e5d3c3c2b3e5b3c2d3e5b2d5d5d3c5b3c3c3c2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b3c2d2d2d2d2d3e3e2b3e3e2d5d5b2d5d3e5b2d5d3e5b2d5d3c3c3c3c3c3c5b2d3e3e3e3e3e2b3e2b3c3c3c3c3c3c5d3e3e3e3e3e3e5b2d3c3c3c3c3c3c2b3e3e3e3e3e3e5d3c3c2b3e5b3c2d3e5b2d5d5d3c5b3c2d3e2d5d5b2d5d3e5b2d5d3e5b2d5d3c3c3c3c3c5b2d3e3e3e3e2b3e2b3c3c3c3c3c5d3e3e3e3e3e5b2d3c3c3c3c3c2b3e3e3e3e3e5d3c3c2b3e5b3c2d3e5b2d5d5d3c5b3c2d3e2d5d5b2d5d3e5b2d5d3e5b2d5d3c3c3c3c3c3c3c2e3e2e3e2e3e2e3e2e";
        bytes memory tamaDefaultState = hex"00503250"; // hunger=0, hap=50, eng=50, age=0
        uint256 tamaId = registry.loadCartridge(tamagotchi, "Tamagotchi", tamaDefaultState);
        console.log("Tamagotchi cartridge ID:", tamaId);

        // ─── Register Dice Roller Cartridge (145 bytes) ───
        bytes memory dice = hex"2c5b2d3e2b3e2b3c3c5d3e3e5b2d3c3c2b3e3e5d3c3c3e5b2d3e3e3e2b3c3c3c5d3e3e3e5b2d3c3c3c2b2b2b2b2b2b2b3c3c3c5d3c3c3e2b2b2b3e3e3e3e2b2b2b2b2b2b3e5b2d5d3e5b2d5d3c3c3c3c5b3c2d3e2b3e5b2d3e3e2b3e2b3c3c3c5d3e3e3e5b2d3c3c3c2b3e3e3e5d3c3c3c2d2d2d2d2d2d3e5b2d5d3e2b3e3e5b3e2d3e5b2d5d5d3e3e5b3c3c5b2d5d3e3e2d5d3c3c3c3c3c5d3e3e2b3e2e";
        uint256 diceId = registry.loadCartridge(dice, "Dice Roller");
        console.log("Dice Roller cartridge ID:", diceId);

        // ─── Register Game of Life 64 Cartridge (Optimized) ───
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/scripts/gameoflife_64_hex.txt");
        string memory golHex = vm.readFile(path);
        bytes memory golBytes = vm.parseBytes(string.concat("0x", golHex));
        uint256 golId = registry.loadCartridge(golBytes, "GoL 64 (Optimized)");
        console.log("Game of Life cartridge ID:", golId);

        // Run test: Hello World to verify VM
        bytes memory helloWorld = bytes(
            "++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]"
            ">>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++."
        );
        bytes memory output = bfVm.run(helloWorld, "", 10_000);
        console.log("VM Test (Hello World):", string(output));

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("Network:           Monad Testnet (10143)");
        console.log("BrainfuckVM:      ", address(bfVm));
        console.log("CartridgeRegistry:", address(registry));
        console.log("Tamagotchi ID:     0");
        console.log("Dice Roller ID:    1");
        console.log("GoL 64 ID:         2");
        console.log("========================================");
    }
}
