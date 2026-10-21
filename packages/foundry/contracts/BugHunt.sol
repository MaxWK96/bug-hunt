// SPDX-License-Identifier: MIT
// Mall från https://docs.chain.link/vrf/v2-5/subscription/get-a-random-number
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract BugHunt is VRFConsumerBaseV2Plus {
    using SafeERC20 for IERC20;

    uint256 public constant COST = 100 ether;
    uint256 public constant MAX_BOUNTY = 1000 ether;

    IERC20 public immutable bug;
    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;

    uint256 public reserved; // BUG promised to hunts still waiting for Chainlink

    mapping(uint256 => address) public playerOf; // requestId => player
    mapping(address => bool) public isHunting;
    mapping(address => uint8) public lastSeverity; // 0 = nothing ... 5 = critical
    mapping(address => uint256) public lastBounty;

    event HuntStarted(address indexed player, uint256 requestId);
    event HuntResult(address indexed player, uint8 severity, uint256 bounty);

    constructor(address coordinator, address bugToken, uint256 subId, bytes32 _keyHash)
        VRFConsumerBaseV2Plus(coordinator)
    {
        bug = IERC20(bugToken);
        subscriptionId = subId;
        keyHash = _keyHash;
    }

    // Step 1: spelaren betalar 100 BUG och vi ber Chainlink om ett random nummer
    function hunt() external returns (uint256 requestId) {
        require(!isHunting[msg.sender], "Already hunting");
        require(poolAvailable() >= MAX_BOUNTY, "Pool too low");

        isHunting[msg.sender] = true;
        reserved += MAX_BOUNTY;
        bug.safeTransferFrom(msg.sender, address(this), COST);

        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: 3,
                callbackGasLimit: 500_000,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: true}))
            })
        );
        playerOf[requestId] = msg.sender;
        emit HuntStarted(msg.sender, requestId);
    }

    // Step 2: Chainlink callar detta med random nummer. Får inte reverata.
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        address player = playerOf[requestId]; //slå upp spelaren
        if (player == address(0)) return; // om det är en okänd spelare så kör return. Revert skulle låsa allt pga att chainlink inte skulle försöka igen
        delete playerOf[requestId]; //behövs så samma ssvar inte kan betals 2 ggr

        (uint8 severity, uint256 bounty) = result(randomWords[0] % 10_000); // %10_000 gör det stora slumptalet till 0-9999

        reserved -= MAX_BOUNTY;
        isHunting[player] = false;
        lastSeverity[player] = severity;
        lastBounty[player] = bounty;

        if (bounty > 0) bug.safeTransfer(player, bounty);
        emit HuntResult(player, severity, bounty);
    }

    // Gör ett nummer 0-9999 till en severity och en bounty
    function result(uint256 roll) public pure returns (uint8 severity, uint256 bounty) {
        if (roll < 4500) return (0, 0); //            45% nothing
        if (roll < 7000) return (1, 40 ether); //     25% gas
        if (roll < 8500) return (2, 100 ether); //    15% low
        if (roll < 9400) return (3, 200 ether); //     9% medium
        if (roll < 9850) return (4, 400 ether); //   4.5% high
        return (5, 1000 ether); //                   1.5% critical
    }

    // Prize pool minus vad som är lovat för pågående hunts
    function poolAvailable() public view returns (uint256) {
        uint256 balance = bug.balanceOf(address(this));
        return balance > reserved ? balance - reserved : 0;
    }

    // Om Chainlink aldrig svarar, owner refundar spelaren
    function refund(uint256 requestId) external onlyOwner {
        address player = playerOf[requestId];
        require(player != address(0), "Unknown request");
        delete playerOf[requestId];

        reserved -= MAX_BOUNTY;
        isHunting[player] = false;
        bug.safeTransfer(player, COST);
    }
}