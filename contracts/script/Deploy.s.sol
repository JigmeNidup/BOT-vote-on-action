// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {VoteOnAction} from "../src/VoteOnAction.sol";

contract Deploy is Script {
    error WrongChain(uint256 chainId);

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        (string memory network, string memory file, string memory rpc, string memory explorer) = _target();

        vm.startBroadcast(deployerKey);
        VoteOnAction voteOnAction = new VoteOnAction();
        vm.stopBroadcast();

        console2.log("VoteOnAction", address(voteOnAction));
        console2.log("chainId", block.chainid);

        if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            string memory json = "deployment";
            vm.serializeString(json, "network", network);
            vm.serializeUint(json, "chainId", block.chainid);
            vm.serializeString(json, "rpcUrl", rpc);
            vm.serializeString(json, "explorerUrl", explorer);
            string memory out = vm.serializeAddress(json, "contract", address(voteOnAction));
            vm.writeFile(file, out);
            console2.log("wrote", file);
        }
    }

    function _target()
        internal
        view
        returns (string memory network, string memory file, string memory rpc, string memory explorer)
    {
        if (block.chainid == 677) {
            return ("bot", "deployments/bot-mainnet.json", "https://rpc.botchain.ai", "https://scan.botchain.ai");
        }
        if (block.chainid == 968) {
            return ("bot-testnet", "deployments/bot-testnet.json", "https://rpc.bohr.life", "https://scan.bohr.life");
        }
        revert WrongChain(block.chainid);
    }
}
