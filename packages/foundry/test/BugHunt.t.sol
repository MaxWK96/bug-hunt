// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BugToken} from "../contracts/BugToken.sol";
import {BugHunt} from "../contracts/BugHunt.sol";
import {VRFCoordinatorV2_5Mock} from "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol";

contract BugHuntTest is Test {
    BugToken token;
    BugHunt game;
    VRFCoordinatorV2_5Mock vrf;
    uint256 subId;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        // Fake Chainlink, set up like on vrf.chain.link
        vrf = new VRFCoordinatorV2_5Mock(0.1 ether, 1e9, 4e15);
        subId = vrf.createSubscription();
        vrf.fundSubscriptionWithNative{value: 100 ether}(subId);

        token = new BugToken(address(this));
        game = new BugHunt(address(vrf), address(token), subId, bytes32(0));
        vrf.addConsumer(subId, address(game));

        token.transfer(address(game), 2_000_000 ether); // prize pool
        token.transfer(alice, 1000 ether);
        vm.prank(alice);
        token.approve(address(game), 1000 ether);
    }

    // alice hunts, then fake Chainlink answers with the number we choose
    function huntWithRoll(uint256 roll) internal {
        vm.prank(alice);
        uint256 requestId = game.hunt();

        uint256[] memory words = new uint256[](1);
        words[0] = roll;
        vrf.fulfillRandomWordsWithOverride(requestId, address(game), words);
    }

    function test_HuntTakes100AndReserves() public {
        vm.prank(alice);
        game.hunt();
        assertEq(token.balanceOf(alice), 900 ether);
        assertTrue(game.isHunting(alice));
        assertEq(game.reserved(), 1000 ether);
    }

    function test_CriticalPays1000() public {
        huntWithRoll(9999);
        assertEq(token.balanceOf(alice), 900 ether + 1000 ether);
        assertEq(game.lastSeverity(alice), 5);
        assertFalse(game.isHunting(alice));
        assertEq(game.reserved(), 0);
    }

    function test_NothingPaysZero() public {
        huntWithRoll(0);
        assertEq(token.balanceOf(alice), 900 ether);
        assertEq(game.lastSeverity(alice), 0);
    }

    function test_ResultBoundaries() public view {
        (uint8 s1,) = game.result(4499);
        (uint8 s2,) = game.result(4500);
        (uint8 s3,) = game.result(9849);
        (uint8 s4,) = game.result(9850);
        assertEq(s1, 0);
        assertEq(s2, 1);
        assertEq(s3, 4);
        assertEq(s4, 5);
    }

    function test_RevertWhen_NoApproval() public {
        token.transfer(bob, 100 ether); // bob has BUG but never approved
        vm.prank(bob);
        vm.expectRevert();
        game.hunt();
    }

    function test_RevertWhen_AlreadyHunting() public {
        vm.startPrank(alice);
        game.hunt();
        vm.expectRevert("Already hunting");
        game.hunt();
        vm.stopPrank();
    }

    function test_RevertWhen_PoolTooLow() public {
        BugHunt small = new BugHunt(address(vrf), address(token), subId, bytes32(0));
        vrf.addConsumer(subId, address(small));
        token.transfer(address(small), 500 ether); // pool smaller than one Critical
        vm.prank(alice);
        token.approve(address(small), 100 ether);

        vm.prank(alice);
        vm.expectRevert("Pool too low");
        small.hunt();
    }

    function test_OwnerCanRefund() public {
        vm.prank(alice);
        uint256 requestId = game.hunt();
        game.refund(requestId); // this test contract is the owner
        assertEq(token.balanceOf(alice), 1000 ether);
        assertFalse(game.isHunting(alice));
    }

    function test_RevertWhen_NotOwnerRefunds() public {
        vm.prank(alice);
        uint256 requestId = game.hunt();
        vm.prank(bob);
        vm.expectRevert();
        game.refund(requestId);
    }

    // Foundry runs this 256 times with random rolls
    function testFuzz_AnyRollPaysCorrectly(uint256 roll) public {
        huntWithRoll(roll);
        (, uint256 expected) = game.result(roll % 10_000);
        assertEq(token.balanceOf(alice), 900 ether + expected);
        assertEq(game.reserved(), 0);
    }
}