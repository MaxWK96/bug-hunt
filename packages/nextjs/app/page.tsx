"use client";

import Image from "next/image";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { Faucet } from "~~/components/bug/Faucet";
import { Game } from "~~/components/bug/Game";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export default function Home() {
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { data: token } = useDeployedContractInfo({ contractName: "BugToken" });
  const { data: totalSupply } = useScaffoldReadContract({ contractName: "BugToken", functionName: "totalSupply" });

  return (
    <main className="max-w-4xl mx-auto px-4">
      {/* Hero */}
      <section className="flex flex-col md:flex-row items-center gap-8 py-12">
        <Image src="/bug-mascot.png" alt="$BUG mascot" width={220} height={220} />
        <div className="text-center md:text-left">
          <h1 className="text-5xl font-bold">$BUG</h1>
          <p className="text-xl">Bug Bounty Token</p>
          <p className="mt-4">Auditors charge for finding bugs. We pay you. Spend 100 $BUG and see what you find.</p>
          <div className="flex gap-3 mt-6 justify-center md:justify-start">
            <a href="#game" className="btn btn-primary">
              Start hunting
            </a>
            {!address && (
              <button className="btn btn-outline" onClick={openConnectModal}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Token info */}
      <section className="py-12">
        <h2 className="text-3xl font-bold mb-4">Token info</h2>
        <p>Total supply: {totalSupply !== undefined ? formatEther(totalSupply) : "…"} BUG (max 10,000,000)</p>
        <p>Network: Ethereum Sepolia</p>
        {token && (
          <>
            <Address address={token.address} />
            <a className="link" href={`https://sepolia.etherscan.io/token/${token.address}`} target="_blank">
              View on Etherscan
            </a>
          </>
        )}
        <h3 className="text-xl font-bold mt-6">Tokenomics</h3>
        <ul className="list-disc ml-6">
          <li>40% faucet (free for everyone)</li>
          <li>20% bounty prize pool</li>
          <li>10% owner</li>
          <li>30% not minted yet</li>
        </ul>
      </section>

      {/* Game */}
      <section id="game" className="py-12 flex flex-col items-center gap-6">
        <h2 className="text-3xl font-bold">Hunt for bugs</h2>
        <Faucet />
        <Game />
      </section>

      {/* Community */}
      <section className="py-12">
        <h2 className="text-3xl font-bold mb-4">About the meme</h2>
        <p>Every smart contract has bugs. $BUG turns bug hunting into a game.</p>
        <h3 className="text-xl font-bold mt-6">Roadmap</h3>
        <ol className="list-decimal ml-6">
          <li>Deploy on Sepolia ✅</li>
          <li>Find 1,000 imaginary bugs</li>
          <li>Moon 🌕</li>
        </ol>
      </section>
    </main>
  );
}
