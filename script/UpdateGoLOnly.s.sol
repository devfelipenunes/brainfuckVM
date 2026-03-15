// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CartridgeRegistry} from "../src/CartridgeRegistry.sol";

contract UpdateGoL32 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address registryAddr = 0x235eEE2f7dcf6b90320Dd387E22D8985C564cBAe;
        CartridgeRegistry registry = CartridgeRegistry(registryAddr);

        string memory golHex = vm.readFile("scripts/gameoflife_32_hex.txt");
        bytes memory golProgram = vm.parseBytes(golHex);

        vm.startBroadcast(deployerPrivateKey);
        registry.loadCartridge(golProgram, "Game of Life 32");
        vm.stopBroadcast();
    }
}
