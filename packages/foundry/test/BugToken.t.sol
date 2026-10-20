// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BugToken} from "../contracts/BugToken.sol";

contract BugTokenTest is Test {
    BugToken token;
    address owner = makeAddr("owner");
    address lars = makeAddr("lars");
    address knut = makeAddr("knut");

    function setUp() public {
        token = new BugToken(owner); // detta testkontraktet är deployer och får 3M
    }

    // ---------- testar mintningen ----------
    function test_OwnerCanMint() public {
        vm.prank(owner);
        token.mint(lars, 100 ether);
        assertEq(token.balanceOf(lars), 100 ether);
    }

    function test_RevertWhen_NotOwnerMints() public {
        vm.prank(lars);
        vm.expectRevert();
        token.mint(lars, 100 ether);
    }

    function test_RevertWhen_MintOverCap() public {
        vm.prank(owner);
        vm.expectRevert();
        token.mint(lars, 3_000_001 ether); // 7M redan mintade, cap är 10M
    }

    // ---------- burn & transfer ----------
    function test_Burn() public {
        token.burn(100 ether);
        assertEq(token.totalSupply(), 7_000_000 ether - 100 ether);
    }

    function test_Transfer() public {
        token.transfer(lars, 100 ether);
        assertEq(token.balanceOf(lars), 100 ether);
    }

    function test_RevertWhen_TransferTooMuch() public {
        vm.prank(lars); // lars har 0
        vm.expectRevert();
        token.transfer(knut, 1 ether);
    }

    // ---------- faucet ----------
    function test_Claim() public {
        vm.prank(lars);
        token.claim();
        assertEq(token.balanceOf(lars), 500 ether);
    }

    function test_RevertWhen_ClaimTwice() public {
        vm.startPrank(lars);
        token.claim();
        vm.expectRevert("Wait 24h");
        token.claim();
        vm.stopPrank();
    }

    function test_ClaimAgainAfter24h() public {
        vm.startPrank(lars);
        token.claim();
        vm.warp(block.timestamp + 24 hours);
        token.claim();
        vm.stopPrank();
        assertEq(token.balanceOf(lars), 1000 ether);
    }

    function test_RevertWhen_FaucetEmpty() public {
        deal(address(token), address(token), 100 ether); // bara 100 BUG kvar i faucet
        vm.prank(lars);
        vm.expectRevert("Faucet empty");
        token.claim();
    }
}