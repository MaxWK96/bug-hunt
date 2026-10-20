// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BugToken} from "../contracts/BugToken.sol";

contract BugTokenTest is Test {
    BugToken token;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        token = new BugToken(owner); // this test contract is the deployer and gets 3M
    }

    // ---------- mint ----------
    function test_OwnerCanMint() public {
        vm.prank(owner);
        token.mint(alice, 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
    }

    function test_RevertWhen_NotOwnerMints() public {
        vm.prank(alice);
        vm.expectRevert();
        token.mint(alice, 100 ether);
    }

    function test_RevertWhen_MintOverCap() public {
        vm.prank(owner);
        vm.expectRevert();
        token.mint(alice, 3_000_001 ether); // 7M already minted, cap is 10M
    }

    // ---------- burn & transfer ----------
    function test_Burn() public {
        token.burn(100 ether);
        assertEq(token.totalSupply(), 7_000_000 ether - 100 ether);
    }

    function test_Transfer() public {
        token.transfer(alice, 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
    }

    function test_RevertWhen_TransferTooMuch() public {
        vm.prank(alice); // alice has 0
        vm.expectRevert();
        token.transfer(bob, 1 ether);
    }

    // ---------- faucet ----------
    function test_Claim() public {
        vm.prank(alice);
        token.claim();
        assertEq(token.balanceOf(alice), 500 ether);
    }

    function test_RevertWhen_ClaimTwice() public {
        vm.startPrank(alice);
        token.claim();
        vm.expectRevert("Wait 24h");
        token.claim();
        vm.stopPrank();
    }

    function test_ClaimAgainAfter24h() public {
        vm.startPrank(alice);
        token.claim();
        vm.warp(block.timestamp + 24 hours);
        token.claim();
        vm.stopPrank();
        assertEq(token.balanceOf(alice), 1000 ether);
    }

    function test_RevertWhen_FaucetEmpty() public {
        deal(address(token), address(token), 100 ether); // only 100 BUG left in the faucet
        vm.prank(alice);
        vm.expectRevert("Faucet empty");
        token.claim();
    }
}