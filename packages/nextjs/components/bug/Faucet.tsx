"use client";

import { useEffect, useState } from "react";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const Faucet = () => {
  const { address } = useAccount();

  // "now" i sekunder, uppdaterad varje sekund så  countdownen rör sig
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: nextClaim } = useScaffoldReadContract({
    contractName: "BugToken",
    functionName: "nextClaimTime",
    args: [address],
  });
  // faucet är tokenens kontrakts egna balance
  const { data: token } = useDeployedContractInfo({ contractName: "BugToken" });
  const { data: faucetLeft } = useScaffoldReadContract({
    contractName: "BugToken",
    functionName: "balanceOf",
    args: [token?.address],
  });
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "BugToken" });

  const faucetEmpty = faucetLeft !== undefined && faucetLeft < parseEther("500");
  const secondsLeft = nextClaim ? Math.max(0, Number(nextClaim) - now) : 0;
  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const claim = async () => {
    try {
      await writeContractAsync({ functionName: "claim" });
    } catch (e) {
      console.error(e); //  error popupen visas av Scaffold-ETH
    }
  };

  if (!address) return null;

  return (
    <div className="card bg-base-100 p-6 w-full max-w-md text-center">
      <h3 className="text-xl font-bold">Free $BUG faucet</h3>
      <p>500 BUG every 24 hours</p>
      <button className="btn btn-primary mt-4" disabled={secondsLeft > 0 || faucetEmpty || isMining} onClick={claim}>
        {isMining && <span className="loading loading-spinner" />}
        {faucetEmpty
          ? "Faucet is empty"
          : secondsLeft > 0
            ? `Next claim in ${hours}h ${minutes}m ${seconds}s`
            : "Claim 500 BUG"}
      </button>
    </div>
  );
};
