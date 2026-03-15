// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CartridgeRegistry} from "../src/CartridgeRegistry.sol";

contract RegisterGoL is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address registryAddr = 0xf781132c072E2D6D80733044bAD33A4b0709BA30; // Registry Address
        CartridgeRegistry registry = CartridgeRegistry(registryAddr);

        vm.startBroadcast(deployerPrivateKey);

        // Load Game of Life hex from file
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/scripts/gameoflife_hex.txt");
        string memory hexContent = vm.readFile(path);
        
        // Quick parsing of hex string to bytes
        bytes memory programBytes = vm.parseBytes(string.concat("0x", hexContent));

        uint256 golId = registry.loadCartridge(programBytes, "Game of Life");
        console.log("Game of Life registered with ID:", golId);

        vm.stopBroadcast();
    }
}
