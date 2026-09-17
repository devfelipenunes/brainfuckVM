// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "forge-std/Script.sol";
import "../src/BrainfuckVM.sol";
import "../src/GlitchManager.sol";

contract DeployGlitchManagerScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address existingVm = vm.envOr("VM_ADDRESS", address(0));
        BrainfuckVM vmContract = existingVm == address(0) ? new BrainfuckVM(30000) : BrainfuckVM(existingVm);

        GlitchManager manager = new GlitchManager(address(vmContract));
        console.log("BrainfuckVM:", address(vmContract));
        console.log("GlitchManager:", address(manager));

        vm.stopBroadcast();
    }
}
