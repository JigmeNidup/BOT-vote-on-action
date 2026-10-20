// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {VoteOnAction} from "../src/VoteOnAction.sol";

contract Deploy is Script {
    error WrongChain(uint256 chainId);

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        if (block.chainid != 968) revert WrongChain(block.chainid);

        vm.startBroadcast(deployerKey);
        VoteOnAction voteOnAction = new VoteOnAction();
        vm.stopBroadcast();

        console2.log("VoteOnAction", address(voteOnAction));
        console2.log("chainId", block.chainid);

        if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            string memory json = "deployment";
            vm.serializeString(json, "network", "bot-testnet");
            vm.serializeUint(json, "chainId", 968);
            vm.serializeString(json, "rpcUrl", "https://rpc.bohr.life");
            vm.serializeString(json, "explorerUrl", "https://scan.bohr.life");
            string memory out = vm.serializeAddress(json, "contract", address(voteOnAction));
            vm.writeFile("deployments/bot-testnet.json", out);
            console2.log("wrote deployments/bot-testnet.json");
        }
    }
}
