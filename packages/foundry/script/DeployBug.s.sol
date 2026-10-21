// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DeployHelpers.s.sol";
import {BugToken} from "../contracts/BugToken.sol";
import {BugHunt} from "../contracts/BugHunt.sol";

contract DeployBug is ScaffoldETHDeploy {
    // Chainlink VRF på Sepolia (docs.chain.link -> VRF -> Supported Networks)
    address constant VRF_COORDINATOR = 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B;
    bytes32 constant KEY_HASH = 0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae;

    uint256 constant SUBSCRIPTION_ID = 60141830518941554002873287592359316424791137174269555936867016855213414864307;
    address constant MY_WALLET = 0x457cD3492F05143cA56e5aAB93852Cbd1831e0e2;

    function run() external ScaffoldEthDeployerRunner {
        BugToken token = new BugToken(MY_WALLET);
        BugHunt game = new BugHunt(VRF_COORDINATOR, address(token), SUBSCRIPTION_ID, KEY_HASH);

        token.transfer(address(game), 2_000_000 ether); // prize pool
        token.transfer(MY_WALLET, 1_000_000 ether); // min wallet
    }
}