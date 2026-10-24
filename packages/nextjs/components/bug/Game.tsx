"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { BugSquash } from "~~/components/bug/BugSquash";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const COST = parseEther("100");
const MAX_BOUNTY = parseEther("1000");

// Same order as the severity numbers in BugHunt.sol (0-5)
const RESULTS = ["😴 No findings", "⛽ Gas optimization", "🟢 Low", "🟡 Medium", "🟠 High", "🔴 CRITICAL"];

export const Game = () => {
  const { address, chain } = useAccount();
  const { data: game } = useDeployedContractInfo({ contractName: "BugHunt" });

  // Reads: Scaffold-ETH re-reads these every few seconds, so the page updates by itself
  const { data: balance } = useScaffoldReadContract({
    contractName: "BugToken",
    functionName: "balanceOf",
    args: [address],
  });
  const { data: allowance } = useScaffoldReadContract({
    contractName: "BugToken",
    functionName: "allowance",
    args: [address, game?.address],
  });
  const { data: pool } = useScaffoldReadContract({ contractName: "BugHunt", functionName: "poolAvailable" });
  const { data: isHunting } = useScaffoldReadContract({
    contractName: "BugHunt",
    functionName: "isHunting",
    args: [address],
  });
  const { data: severity } = useScaffoldReadContract({
    contractName: "BugHunt",
    functionName: "lastSeverity",
    args: [address],
  });
  const { data: bounty } = useScaffoldReadContract({
    contractName: "BugHunt",
    functionName: "lastBounty",
    args: [address],
  });

  // Writes: open MetaMask, wait for the transaction, show a status popup
  const { writeContractAsync: writeToken, isMining: approving } = useScaffoldWriteContract({
    contractName: "BugToken",
  });
  const { writeContractAsync: writeGame, isMining: sending } = useScaffoldWriteContract({ contractName: "BugHunt" });

  // Chainlink sends the result in its own transaction, so we watch isHunting:
  // when it goes from true to false, the result has arrived.
  const [showResult, setShowResult] = useState(false);
  const wasHunting = useRef(false);
  useEffect(() => {
    if (wasHunting.current && isHunting === false) setShowResult(true);
    wasHunting.current = isHunting === true;
  }, [isHunting]);

  // Bug Squash score while waiting (off-chain, just for fun)
  const [squashScore, setSquashScore] = useState(0);
  const [bestSquash, setBestSquash] = useState(0);
  const handleScore = useCallback((score: number) => {
    setSquashScore(score);
    setBestSquash(best => Math.max(best, score));
  }, []);

  const approve = async () => {
    if (!game) return;
    try {
      await writeToken({ functionName: "approve", args: [game.address, parseEther("1000")] });
    } catch (e) {
      console.error(e);
    }
  };

  const hunt = async () => {
    setShowResult(false);
    setSquashScore(0);
    try {
      await writeGame({ functionName: "hunt" });
    } catch (e) {
      console.error(e);
    }
  };

  if (!address) {
    return <p className="text-center">Connect your wallet to play.</p>;
  }

  return (
    <div className="card bg-base-100 p-6 w-full max-w-md text-center">
      {/* Wallet info */}
      <Address address={address} />
      <p className="text-sm">Network: {chain?.name}</p>
      <p className="text-3xl font-bold mt-2">{balance !== undefined ? formatEther(balance) : "…"} BUG</p>
      <p className="text-sm mt-1">Prize pool: {pool !== undefined ? formatEther(pool) : "…"} BUG</p>

      {/* Waiting or result */}
      {isHunting && (
        <div className="my-6">
          <p className="mb-2">Chainlink is deciding your bounty (1–3 min). Squash bugs while you wait!</p>
          <BugSquash onScore={handleScore} />
        </div>
      )}
      {showResult && !isHunting && severity !== undefined && bounty !== undefined && (
        <div className="my-6">
          <p className="text-3xl font-bold">{RESULTS[severity]}</p>
          <p className="text-xl">+{formatEther(bounty)} BUG</p>
          {squashScore > 0 && (
            <p className="text-sm mt-2">
              Bug Squash: {squashScore} points (best: {bestSquash})
            </p>
          )}
        </div>
      )}

      {/* The button: only the action that is valid right now */}
      {balance !== undefined && balance < COST ? (
        <p className="text-error mt-4">You need 100 BUG. Use the faucet.</p>
      ) : pool !== undefined && pool < MAX_BOUNTY ? (
        <p className="text-error mt-4">The prize pool is too low. Try later.</p>
      ) : allowance !== undefined && allowance < COST ? (
        <button className="btn btn-secondary mt-4" disabled={approving} onClick={approve}>
          {approving && <span className="loading loading-spinner" />}
          Approve 1000 BUG (10 hunts)
        </button>
      ) : (
        <button className="btn btn-primary mt-4" disabled={sending || isHunting} onClick={hunt}>
          {sending && <span className="loading loading-spinner" />}
          Hunt for bugs (100 BUG)
        </button>
      )}
    </div>
  );
};
