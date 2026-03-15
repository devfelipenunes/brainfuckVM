// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CartridgeRegistry} from "../src/CartridgeRegistry.sol";

contract UpdateGoL1000 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address registryAddr = 0xf781132c072E2D6D80733044bAD33A4b0709BA30; // Registry Address
        CartridgeRegistry registry = CartridgeRegistry(registryAddr);

        vm.startBroadcast(deployerPrivateKey);

        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/scripts/gameoflife_1000_hex.txt");
        string memory hexContent = vm.readFile(path);
        bytes memory programBytes = vm.parseBytes(string.concat("0x", hexContent));

        uint256 golId = registry.loadCartridge(programBytes, "GoL 3D (1000 Cells)");
        console.log("New 1000-cell GoL registered with ID:", golId);

        vm.stopBroadcast();
    }
}
