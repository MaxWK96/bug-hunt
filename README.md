# $BUG – Bug Hunt

Meme token and on-chain game about smart contract audits. Pay 100 BUG to hunt
for a bug; Chainlink VRF decides what you find.

Live site: https://bug-hunt-black.vercel.app/

## Contracts (Sepolia)
- BugToken: https://sepolia.etherscan.io/address/0x4adb52B80e3786b72adba7bD19c18C47B26db4cA
- BugHunt: https://sepolia.etherscan.io/address/0xF57E5eB09a82EA011e9AD4D879997A1aAbe9C7f9

## How to play
1. Get Sepolia ETH: Google Cloud Web3 faucet, faucets.chain.link/sepolia or sepolia-faucet.pk910.de
2. Connect MetaMask on Sepolia
3. Claim 500 BUG from the faucet (once per 24h)
4. Approve the game (1000 BUG = 10 hunts)
5. Hunt and wait 1-3 minutes for Chainlink

| Result | Chance | Bounty |
| --- | --- | --- |
| Nothing | 45% | 0 |
| Gas | 25% | 40 |
| Low | 15% | 100 |
| Medium | 9% | 200 |
| High | 4.5% | 400 |
| Critical | 1.5% | 1000 |

Average payout is 76 BUG per 100, so the pool grows slowly.

## Token
OpenZeppelin ERC20 + Burnable + Capped + Ownable. Max 10M.
40% faucet, 20% prize pool, 10% owner, 30% unminted.

## Security
- Randomness from Chainlink VRF, not block data
- Each pending hunt reserves the max bounty, so the pool can always pay
- One hunt at a time per player; owner can refund a stuck hunt

## Run locally
Node 20+, Yarn, Foundry (WSL on Windows).
    yarn install
    yarn start
Tests:
    cd packages/foundry && forge test

Built with Scaffold-ETH 2.
