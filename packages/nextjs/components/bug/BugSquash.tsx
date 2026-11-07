"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------- Game settings ----------
// Everything that crawls across the field. Weight = how often it spawns
const KINDS = {
  gas: { emoji: "🐜", points: 1, speed: 12, hp: 1, weight: 26 }, // comes in swarms
  low: { emoji: "🪲", points: 2, speed: 16, hp: 1, weight: 20 },
  medium: { emoji: "🐞", points: 3, speed: 20, hp: 1, weight: 16 },
  high: { emoji: "🕷️", points: 5, speed: 18, hp: 2, weight: 12 }, // armored: 2 clicks
  critical: { emoji: "🦂", points: 10, speed: 30, hp: 1, weight: 7 }, // zigzags
  worm: { emoji: "🐛", points: 4, speed: 9, hp: 1, weight: 0 }, // boss, spawned on a timer
  feature: { emoji: "✅", points: -5, speed: 14, hp: 1, weight: 9 }, // not a bug, don't click!
  slither: { emoji: "🔍", points: 0, speed: 14, hp: 1, weight: 1.5 }, // squashes every bug
  pause: { emoji: "⏸️", points: 0, speed: 14, hp: 1, weight: 1.5 }, // freezes for 3 s
  guard: { emoji: "🛡️", points: 0, speed: 14, hp: 1, weight: 1 }, // extra life
};
type Kind = keyof typeof KINDS;
const BUGS: Kind[] = ["gas", "low", "medium", "high", "critical", "worm"];
const isBug = (kind: Kind) => BUGS.includes(kind);

const LIVES = 3;
const MAX_LIVES = 5;
const FIRST_BOSS = 30; // seconds
const BOSS_EVERY = 45;
const WORM_SIZE = ["", "text-3xl", "text-4xl", "text-5xl"]; // font size per worm size
const BEST_KEY = "bugSquashBest";

type Entity = { id: number; kind: Kind; x: number; y: number; baseY: number; hp: number; size: number; age: number }; // x and y in % of the field
type Splat = { id: number; x: number; y: number; text: string; until: number };
type Stain = { id: number; x: number; y: number; r: number };
type Sfx = "squash" | "armor" | "bad" | "power" | "exploit" | "win" | "jackpot";
type GameState = {
  entities: Entity[];
  splats: Splat[];
  stains: Stain[]; // squashed bugs leave marks on the code
  score: number;
  combo: number;
  lives: number;
  elapsed: number; // seconds since start
  spawnTimer: number; // seconds until next spawn
  bossTimer: number; // seconds until next worm
  frozen: number; // seconds left of pause()
  now: number; // timestamp of the last frame
  shakeUntil: number;
  bannerUntil: number;
  over: boolean;
  sfx: Sfx[]; // sounds to play after this update
};

let lastId = 0;
const uid = () => ++lastId;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const newGame = (): GameState => ({
  entities: [],
  splats: [],
  stains: [],
  score: 0,
  combo: 0,
  lives: LIVES,
  elapsed: 0,
  spawnTimer: 0.5,
  bossTimer: FIRST_BOSS,
  frozen: 0,
  now: 0,
  shakeUntil: 0,
  bannerUntil: 0,
  over: false,
  sfx: [],
});

const newEntity = (kind: Kind, x: number, y: number, size = 1): Entity => ({
  id: uid(),
  kind,
  x,
  y,
  baseY: y,
  hp: KINDS[kind].hp,
  size,
  age: 0,
});

// Pick what to spawn, common bugs more often than critical ones
const randomKind = (): Kind => {
  const kinds = Object.keys(KINDS) as Kind[];
  const total = kinds.reduce((sum, k) => sum + KINDS[k].weight, 0);
  let r = Math.random() * total;
  for (const k of kinds) {
    r -= KINDS[k].weight;
    if (r < 0) return k;
  }
  return "gas";
};

// Combo x1 for the first 4 kills in a row, x2 from 5, x3 from 10 ...
const multiplier = (combo: number) => 1 + Math.floor(combo / 5);

const addStains = (stains: Stain[], bugs: Entity[]) =>
  [...stains, ...bugs.map(b => ({ id: uid(), x: b.x, y: b.y, r: 14 + Math.random() * 16 }))].slice(-60);

// ---------- Sound (WebAudio, no files needed) ----------
let audio: AudioContext | undefined;
const tone = (from: number, to: number, ms: number, type: OscillatorType = "square", delay = 0) => {
  audio ??= new AudioContext();
  if (audio.state === "suspended") audio.resume().catch(() => {});
  const start = audio.currentTime + delay / 1000;
  const end = start + ms / 1000;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, end);
  gain.gain.setValueAtTime(0.08, start);
  gain.gain.exponentialRampToValueAtTime(0.001, end);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(end);
};
const arpeggio = (notes: number[], ms: number) => notes.forEach((f, i) => tone(f, f, ms, "triangle", i * ms * 0.8));

const SOUNDS: Record<Sfx, () => void> = {
  squash: () => tone(600, 150, 80),
  armor: () => tone(1200, 900, 60, "triangle"),
  bad: () => tone(200, 80, 250, "sawtooth"),
  power: () => arpeggio([500, 750, 1000], 80),
  exploit: () => tone(300, 40, 500, "sawtooth"),
  win: () => arpeggio([520, 660, 780], 120),
  jackpot: () => arpeggio([520, 660, 780, 1040, 1320, 1560], 120),
};
const VIBRATE: Partial<Record<Sfx, number | number[]>> = { bad: 80, exploit: 200, jackpot: [100, 50, 100, 50, 200] };

// ---------- Game logic ----------
// One animation frame: move everything, handle escapes, spawn new bugs
const step = (g: GameState, dt: number, now: number): GameState => {
  if (g.over) return { ...g, now };

  const elapsed = g.elapsed + dt;
  const speedUp = 1 + elapsed / 60; // everything gets faster over time
  const frozen = Math.max(0, g.frozen - dt);
  let { lives, combo, spawnTimer, bossTimer, shakeUntil } = g;
  const sfx: Sfx[] = [];
  const splats = g.splats.filter(s => s.until > now);

  // Move to the right; bugs that reach deploy() escape
  const entities: Entity[] = [];
  for (const e of g.entities) {
    if (frozen > 0) {
      entities.push(e);
      continue;
    }
    const age = e.age + dt;
    const x = e.x + KINDS[e.kind].speed * speedUp * dt;
    const wiggle = e.kind === "critical" ? Math.sin(age * 5) * 12 : e.kind === "worm" ? Math.sin(age * 3) * 4 : 0;
    const y = clamp(e.baseY + wiggle, 6, 92);
    if (x < 100) {
      entities.push({ ...e, x, y, age });
      continue;
    }
    if (!isBug(e.kind)) continue; // features and power-ups just leave
    combo = 0;
    if (e.kind === "critical" || e.kind === "worm") {
      lives -= 1;
      shakeUntil = now + 400;
      sfx.push("exploit");
      const text = e.kind === "worm" ? "💀 RE-ENTERED" : "💀 EXPLOITED";
      splats.push({ id: uid(), x: 80, y, text, until: now + 900 });
    }
  }

  // Spawn on the left, faster and faster. Nothing spawns during pause()
  if (frozen === 0) {
    spawnTimer -= dt;
    bossTimer -= dt;
    if (spawnTimer <= 0) {
      const kind = randomKind();
      const y = 8 + Math.random() * 80;
      const count = kind === "gas" ? 3 + Math.floor(Math.random() * 3) : 1;
      for (let i = 0; i < count; i++) {
        entities.push(newEntity(kind, -i * 5, clamp(y + (Math.random() - 0.5) * 16, 6, 92)));
      }
      spawnTimer = Math.max(0.35, 0.9 - elapsed * 0.008);
    }
    if (bossTimer <= 0) {
      entities.push(newEntity("worm", 0, 50, 3));
      bossTimer = BOSS_EVERY;
      splats.push({ id: uid(), x: 15, y: 50, text: "⚠️ Reentrancy worm!", until: now + 1500 });
    }
  }

  return {
    ...g,
    entities,
    splats,
    lives,
    combo,
    elapsed,
    spawnTimer,
    bossTimer,
    frozen,
    now,
    shakeUntil,
    sfx,
    over: lives <= 0,
  };
};

// Player clicked something on the field
const click = (g: GameState, id: number): GameState => {
  const e = g.entities.find(o => o.id === id);
  if (!e || g.over) return g;
  const rest = g.entities.filter(o => o.id !== id);
  const splat = (text: string) => [...g.splats, { id: uid(), x: e.x, y: e.y, text, until: g.now + 600 }];

  switch (e.kind) {
    case "feature":
      return {
        ...g,
        entities: rest,
        combo: 0,
        score: Math.max(0, g.score - 5),
        splats: splat("❌ It's a feature! -5"),
        shakeUntil: g.now + 250,
        sfx: ["bad"],
      };
    case "slither": {
      const bugs = rest.filter(o => isBug(o.kind));
      const gained = bugs.reduce((sum, b) => sum + KINDS[b.kind].points, 0) * multiplier(g.combo);
      return {
        ...g,
        entities: rest.filter(o => !isBug(o.kind)),
        score: g.score + gained,
        stains: addStains(g.stains, bugs),
        splats: splat(`🔍 Slither: ${bugs.length} bugs +${gained}`),
        sfx: ["power"],
      };
    }
    case "pause":
      return { ...g, entities: rest, frozen: 3, splats: splat("⏸️ pause()"), sfx: ["power"] };
    case "guard":
      return {
        ...g,
        entities: rest,
        lives: Math.min(g.lives + 1, MAX_LIVES),
        splats: splat("🛡️ +1 life"),
        sfx: ["power"],
      };
  }

  // Armored bug: lose a layer
  if (e.hp > 1) return { ...g, entities: [...rest, { ...e, hp: e.hp - 1 }], splats: splat("💢"), sfx: ["armor"] };

  const combo = g.combo + 1;
  const gained = KINDS[e.kind].points * multiplier(combo);
  // The worm re-enters: it splits into two smaller worms until it is size 1
  const children =
    e.kind === "worm" && e.size > 1
      ? [newEntity("worm", e.x - 4, e.y - 10, e.size - 1), newEntity("worm", e.x - 4, e.y + 10, e.size - 1)]
      : [];
  return {
    ...g,
    entities: [...rest, ...children],
    score: g.score + gained,
    combo,
    stains: addStains(g.stains, [e]),
    splats: splat(children.length ? `🐛 re-entered! +${gained}` : `💥 +${gained}`),
    sfx: ["squash"],
  };
};

type Props = {
  banner?: string; // hunt result to show over the game
  bigWin?: boolean;
  onClose?: () => void;
};

export const BugSquash = ({ banner, bigWin, onClose }: Props) => {
  const [game, setGame] = useState<GameState>(newGame);
  const gameRef = useRef(game); // latest state, so sounds can be played outside setState
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const [best, setBest] = useState(0);
  const bestRef = useRef(0);
  const [newRecord, setNewRecord] = useState(false);

  // Every update goes through here: compute the next state, play its sounds, save records
  const apply = useCallback((update: (g: GameState) => GameState) => {
    const prev = gameRef.current;
    const next = update(prev);
    if (next === prev) return;

    for (const sfx of next.sfx) {
      if (!mutedRef.current) SOUNDS[sfx]();
      const pattern = VIBRATE[sfx];
      if (pattern) navigator.vibrate?.(pattern);
    }
    if (!prev.over && next.over && next.score > bestRef.current) {
      bestRef.current = next.score;
      setBest(next.score);
      setNewRecord(true);
      try {
        localStorage.setItem(BEST_KEY, String(next.score));
      } catch {}
    }

    gameRef.current = { ...next, sfx: [] };
    setGame(gameRef.current);
  }, []);

  // Load the best score saved in this browser
  useEffect(() => {
    try {
      bestRef.current = Number(localStorage.getItem(BEST_KEY)) || 0;
      setBest(bestRef.current);
    } catch {}
  }, []);

  // Game loop: runs every animation frame (about 60 times per second)
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); // seconds since last frame
      last = now;
      apply(g => step(g, dt, now));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame); // stop when the component disappears
  }, [apply]);

  // Show the hunt result over the game when Chainlink answers
  useEffect(() => {
    if (!banner) return;
    apply(g => ({
      ...g,
      bannerUntil: g.now + 4000,
      shakeUntil: bigWin ? g.now + 600 : g.shakeUntil,
      sfx: [bigWin ? "jackpot" : "win"],
    }));
  }, [banner, bigWin, apply]);

  const hit = (id: number) => apply(g => click(g, id));
  const miss = () => apply(g => ({ ...g, combo: 0 })); // clicking empty space breaks the combo
  const restart = () => {
    setNewRecord(false);
    apply(() => ({ ...newGame(), now: gameRef.current.now }));
  };
  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  };

  const shake = game.now < game.shakeUntil ? Math.sin(game.now / 25) * 6 : 0;

  return (
    <div className="w-full">
      {/* Scoreboard */}
      <div className="flex justify-between items-center font-mono text-sm mb-2 gap-2">
        <span>Score: {game.score}</span>
        <span>Best: {best}</span>
        <span>Combo x{multiplier(game.combo)}</span>
        <span>{"❤️".repeat(Math.max(game.lives, 0))}</span>
        <span className="flex gap-1">
          <button className="btn btn-ghost btn-xs" onClick={toggleMute} aria-label={muted ? "Sound on" : "Sound off"}>
            {muted ? "🔇" : "🔊"}
          </button>
          {onClose && (
            <button className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Close game">
              ✕
            </button>
          )}
        </span>
      </div>

      {/* Playing field */}
      <div
        className="relative h-72 bg-black rounded-lg overflow-hidden select-none touch-none cursor-crosshair"
        style={{ transform: `translateX(${shake}px)` }}
        onPointerDown={miss}
      >
        {/* Fake code in the background */}
        <pre className="absolute inset-0 p-3 text-xs text-green-900 pointer-events-none">
          {`function withdraw() external {\n  uint256 amount = balances[msg.sender];\n  (bool ok, ) = msg.sender.call{value: amount}("");\n  require(ok);\n  balances[msg.sender] = 0;\n}`}
        </pre>

        {/* Marks left by squashed bugs */}
        {game.stains.map(s => (
          <div
            key={s.id}
            className="absolute rounded-full bg-lime-500/20 pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.r, height: s.r }}
          />
        ))}

        {/* The deploy line the bugs must not reach */}
        <div className="absolute right-0 top-0 h-full w-2 bg-error/70" />
        <span className="absolute right-3 bottom-2 text-xs text-error font-mono">deploy() 🚀</span>

        {game.entities.map(e => (
          <button
            key={e.id}
            className={`absolute leading-none -translate-x-1/2 -translate-y-1/2 ${
              e.kind === "worm" ? WORM_SIZE[e.size] : "text-3xl"
            } ${e.kind === "critical" ? "drop-shadow-[0_0_8px_red]" : ""} ${
              e.hp > 1 ? "drop-shadow-[0_0_6px_#60a5fa]" : ""
            }`}
            style={{ left: `${e.x}%`, top: `${e.y}%` }}
            onPointerDown={ev => {
              ev.stopPropagation(); // a hit is not a miss
              hit(e.id);
            }}
            aria-label={`Click ${e.kind}`}
          >
            {KINDS[e.kind].emoji}
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

        {game.frozen > 0 && (
          <div className="absolute inset-0 bg-info/10 pointer-events-none flex items-start justify-center pt-2">
            <span className="text-info font-mono text-sm">⏸️ paused {game.frozen.toFixed(1)}s</span>
          </div>
        )}

        {banner && game.now < game.bannerUntil && (
          <div className="absolute inset-x-0 top-1/3 flex justify-center pointer-events-none">
            <div className={`bg-black/80 rounded-lg px-4 py-2 text-center ${bigWin ? "animate-bounce" : ""}`}>
              <p className="text-xs text-white/70">Chainlink says:</p>
              <p className="text-2xl font-bold text-white">{banner}</p>
            </div>
          </div>
        )}

        {game.over && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2">
            <p className="text-2xl font-bold text-error">💀 Protocol drained</p>
            <p className="text-white">Score: {game.score}</p>
            {newRecord && <p className="text-warning font-bold">🎉 New record!</p>}
            <div className="flex gap-2" onPointerDown={ev => ev.stopPropagation()}>
              <button className="btn btn-primary btn-sm" onClick={restart}>
                Try again
              </button>
              {onClose && (
                <button className="btn btn-ghost btn-sm text-white" onClick={onClose}>
                  Close
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs opacity-70 mt-2">
        Squash bugs before they reach deploy(). 🕷️ takes 2 hits, 🦂 zigzags and 🐛 re-enters when hit. Don&apos;t click
        ✅ features! Grab 🔍 Slither, ⏸️ pause() and 🛡️ ReentrancyGuard. Every 🦂 or 🐛 that gets through costs a ❤️.
      </p>
    </div>
  );
};
