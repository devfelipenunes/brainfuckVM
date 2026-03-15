// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CartridgeRegistry} from "../src/CartridgeRegistry.sol";

contract UpdateDice is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address registryAddr = 0xf781132c072E2D6D80733044bAD33A4b0709BA30; // Registry Address
        CartridgeRegistry registry = CartridgeRegistry(registryAddr);

        vm.startBroadcast(deployerPrivateKey);

        // Register new fixed Dice Roller (147 bytes)
        bytes memory dice = hex"3e3e2c5b2d3e2b3e2b3c3c5d3e3e5b2d3c3c2b3e3e5d3c5b2d3e3e2b3c3c5d3e3e5b2d3c3c2b2b2b2b2b2b2b3e3e5d3c3c2b2b2b3e3e3e2b2b2b2b2b2b3e5b2d5d3e5b2d5d3c3c3c3c3c5b2d3e3e3e3e2b5b2d3c3c2b3c2b3e3e3e5d3c3c3c5b2d3e3e3e2b3c3c3c5d3e2d2d2d2d2d2d3c5b2d5d2b3e5b3c2d3e5b2d5d5d3c5b3e3e3e5b2d5d3c3c3c2d5d3c5d3e3e3e3e2b2e";
        uint256 diceId = registry.loadCartridge(dice, "Dice Roller v2");
        console.log("New Dice Roller registered with ID:", diceId);

        vm.stopBroadcast();
    }
}
