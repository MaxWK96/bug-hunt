// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.7.0
// Kopierat mall från https://wizard.openzeppelin.com/
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

contract BugToken is ERC20, ERC20Burnable, Ownable, ERC20Capped {
    uint256 public constant FAUCET_AMOUNT = 500 ether;
    uint256 public constant FAUCET_COOLDOWN = 24 hours;

mapping(address => uint256) public lastClaim;

    constructor(address owner)
        ERC20("Bug Bounty Token", "BUG")
        ERC20Capped(10_000_000 ether)
        Ownable(owner)
    {
        _mint(address(this), 4_000_000 ether); // fauceten
        _mint(msg.sender, 3_000_000 ether); // deployer, sa prize pool och owner
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
function claim() external {
    require(block.timestamp >= nextClaimTime(msg.sender),'Wait 24h');

    require(balanceOf(address(this)) >= FAUCET_AMOUNT, 'Faucet empty');

       lastClaim[msg.sender] = block.timestamp;
        _transfer(address(this), msg.sender, FAUCET_AMOUNT);
    }

    function nextClaimTime(address user) public view returns (uint256) {
        if (lastClaim[user] == 0) return 0;
        return lastClaim[user] + FAUCET_COOLDOWN;
    }

    // Behovs pga erc20 och erc20capped
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Capped) {
        super._update(from, to, value);
    }
}