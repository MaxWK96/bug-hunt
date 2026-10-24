"use client";

import { useEffect, useState } from "react";

// ---------- Game settings ----------
const BUG_TYPES = [
  { name: "Gas", emoji: "🐜", points: 1, speed: 12, weight: 35 },
  { name: "Low", emoji: "🪲", points: 2, speed: 16, weight: 25 },
  { name: "Medium", emoji: "🐞", points: 3, speed: 20, weight: 20 },
  { name: "High", emoji: "🕷️", points: 5, speed: 26, weight: 13 },
  { name: "Critical", emoji: "🦂", points: 10, speed: 34, weight: 7 },
];
const CRITICAL = BUG_TYPES.length - 1;
const LIVES = 3;

type Bug = { id: number; type: number; x: number; y: number }; // x and y in % of the field
type Splat = { id: number; x: number; y: number; text: string; until: number };
type GameState = {
  bugs: Bug[];
  splats: Splat[];
  score: number;
  combo: number;
  lives: number;
  nextId: number;
  elapsed: number; // seconds since start
  spawnTimer: number; // seconds until next bug
  over: boolean;
};

const newGame = (): GameState => ({
  bugs: [],
  splats: [],
  score: 0,
  combo: 0,
  lives: LIVES,
  nextId: 0,
  elapsed: 0,
  spawnTimer: 0.5,
  over: false,
});

// Pick a bug type, common bugs more often than critical ones
const randomType = () => {
  const total = BUG_TYPES.reduce((sum, t) => sum + t.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < BUG_TYPES.length; i++) {
    r -= BUG_TYPES[i].weight;
    if (r < 0) return i;
  }
  return 0;
};

// Combo x1 for the first 4 kills in a row, x2 from 5, x3 from 10 ...
const multiplier = (combo: number) => 1 + Math.floor(combo / 5);

// One animation frame: move bugs, handle escapes, spawn new bugs
const step = (g: GameState, dt: number, now: number): GameState => {
  if (g.over) return g;

  const elapsed = g.elapsed + dt;
  const speedUp = 1 + elapsed / 60; // everything gets faster over time
  let { lives, combo, nextId, spawnTimer } = g;
  const splats = g.splats.filter(s => s.until > now);

  // Move bugs to the right; bugs that reach deploy() escape
  const bugs: Bug[] = [];
  for (const bug of g.bugs) {
    const x = bug.x + BUG_TYPES[bug.type].speed * speedUp * dt;
    if (x < 100) {
      bugs.push({ ...bug, x });
    } else {
      combo = 0;
      if (bug.type === CRITICAL) {
        lives -= 1;
        splats.push({ id: nextId++, x: 80, y: bug.y, text: "💀 EXPLOITED", until: now + 900 });
      }
    }
  }

  // Spawn a new bug on the left, faster and faster
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    bugs.push({ id: nextId++, type: randomType(), x: 0, y: 8 + Math.random() * 80 });
    spawnTimer = Math.max(0.35, 0.9 - elapsed * 0.008);
  }

  return { ...g, bugs, splats, lives, combo, nextId, elapsed, spawnTimer, over: lives <= 0 };
};

// Player clicked a bug
const squash = (g: GameState, id: number, now: number): GameState => {
  const bug = g.bugs.find(b => b.id === id);
  if (!bug || g.over) return g;
  const combo = g.combo + 1;
  const gained = BUG_TYPES[bug.type].points * multiplier(combo);
  return {
    ...g,
    bugs: g.bugs.filter(b => b.id !== id),
    splats: [...g.splats, { id: g.nextId, x: bug.x, y: bug.y, text: `💥 +${gained}`, until: now + 500 }],
    nextId: g.nextId + 1,
    score: g.score + gained,
    combo,
  };
};

type Props = {
  onScore: (score: number) => void; // tells the parent the current score
};

export const BugSquash = ({ onScore }: Props) => {
  const [game, setGame] = useState<GameState>(newGame);

  // Game loop: runs every animation frame (about 60 times per second)
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); // seconds since last frame
      last = now;
      setGame(g => step(g, dt, now));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame); // stop when the component disappears
  }, []);

  useEffect(() => {
    onScore(game.score);
  }, [game.score, onScore]);

  const hit = (id: number) => setGame(g => squash(g, id, performance.now()));
  const miss = () => setGame(g => ({ ...g, combo: 0 })); // clicking empty space breaks the combo

  return (
    <div className="w-full">
      {/* Scoreboard */}
      <div className="flex justify-between font-mono text-sm mb-2">
        <span>Score: {game.score}</span>
        <span>Combo x{multiplier(game.combo)}</span>
        <span>{"❤️".repeat(Math.max(game.lives, 0))}</span>
      </div>

      {/* Playing field */}
      <div
        className="relative h-72 bg-black rounded-lg overflow-hidden select-none touch-none cursor-crosshair"
        onPointerDown={miss}
      >
        {/* Fake code in the background */}
        <pre className="absolute inset-0 p-3 text-xs text-green-900 pointer-events-none">
          {`function withdraw() external {\n  uint256 amount = balances[msg.sender];\n  (bool ok, ) = msg.sender.call{value: amount}("");\n  require(ok);\n  balances[msg.sender] = 0;\n}`}
        </pre>

        {/* The deploy line the bugs must not reach */}
        <div className="absolute right-0 top-0 h-full w-2 bg-error/70" />
        <span className="absolute right-3 bottom-2 text-xs text-error font-mono">deploy() 🚀</span>

        {game.bugs.map(bug => (
          <button
            key={bug.id}
            className={`absolute text-3xl leading-none -translate-x-1/2 -translate-y-1/2 ${
              bug.type === CRITICAL ? "drop-shadow-[0_0_8px_red]" : ""
            }`}
            style={{ left: `${bug.x}%`, top: `${bug.y}%` }}
            onPointerDown={e => {
              e.stopPropagation(); // a hit is not a miss
              hit(bug.id);
            }}
            aria-label={`Squash ${BUG_TYPES[bug.type].name} bug`}
          >
            {BUG_TYPES[bug.type].emoji}
          </button>
        ))}

        {game.splats.map(s => (
          <span
            key={s.id}
            className="absolute whitespace-nowrap text-sm font-bold text-warning pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            {s.text}
          </span>
        ))}

        {game.over && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2">
            <p className="text-2xl font-bold text-error">💀 Protocol drained</p>
            <p className="text-white">Score: {game.score}</p>
            <button
              className="btn btn-primary btn-sm"
              onPointerDown={e => e.stopPropagation()}
              onClick={() => setGame(newGame())}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <p className="text-xs opacity-70 mt-2">
        Squash bugs before they reach deploy(). Don&apos;t let a 🦂 Critical through: 3 and the protocol is drained.
      </p>
    </div>
  );
};
