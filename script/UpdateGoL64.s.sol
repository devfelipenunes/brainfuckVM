// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CartridgeRegistry} from "../src/CartridgeRegistry.sol";

contract UpdateGoL64 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address registryAddr = 0x64cc8469F4377683252fe58b72fca0db4Cd670B2; // New Registry Address
        CartridgeRegistry registry = CartridgeRegistry(registryAddr);

        vm.startBroadcast(deployerPrivateKey);

        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/scripts/gameoflife_64_hex.txt");
        string memory hexContent = vm.readFile(path);
        bytes memory programBytes = vm.parseBytes(string.concat("0x", hexContent));

        uint256 golId = registry.loadCartridge(programBytes, "GoL 3D (64 Cells)");
        console.log("New 64-cell GoL registered with ID:", golId);

        vm.stopBroadcast();
    }
}
