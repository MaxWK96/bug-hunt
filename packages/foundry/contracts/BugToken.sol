// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.7.0
// Kopierat mall från https://wizard.openzeppelin.com/
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

contract BugBountyToken is ERC20, ERC20Burnable, Ownable {
    constructor(address initialOwner)
        ERC20("BugBountyToken", "BUG")
        Ownable(initialOwner)
    {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}