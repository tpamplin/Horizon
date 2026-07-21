// =============================================================================
// Horizon - DiceAnimation Component
// =============================================================================
// Absolute-from-center layout: every zone is anchored at the horizontal center.
// Explosions are absolutely positioned with explicit x targets â€” when a new
// explosion is added, ALL left-group items animate to x -= UNIT simultaneously.
// No layoutId (no clone/double-move), no flex reflow (no snap), no translate
// holes (x is the layout, not an overlay on flex).
// =============================================================================

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { useDiceStore } from "../../stores/diceStore.js";
import type { DieResult } from "shared";
import "./DiceAnimation.css";

interface DieItem {
  key: string;
  value: number;
  sides: number;
  isMax: boolean;
  label: string;
  dieIndex: number;
}

interface ModItem {
  key: string;
  value: number;
  label: string;
}

interface DiceAnimationProps {
  adversityTokens?: number;
}

/** Width of one exploded unit (die + trailing +). Must match CSS. */
const UNIT_WIDTH = 84;
/**
 * Space between the last explosion's trailing `+` and the center die.
 * Must clear ~half the center die (~32px) plus breathing room.
 */
const CENTER_GAP = 40;
/**
 * Right-anchored units sit left of center at x=0. A positive start x shifts
 * the unit right so the die face lines up with the center slot on mount â€”
 * then we tween left. Avoids the left:50% "flash right then slide left" bug.
 */
const FLIGHT_START_X = 44;
const SPIN_MS = 1200;
const PULSE_MS = 750;
const SLIDE_MS = 720;
const MOD_STAGGER_S = 0.1;
const SLIDE_S = SLIDE_MS / 1000;

const slideTween = {
  type: "tween" as const,
  duration: SLIDE_S,
  ease: "easeOut" as const,
};

function getChain(die: DieResult): Array<{ value: number; isMax: boolean }> {
  const c = die.explosionChain;
  if (c && c.length > 0) return c.map((v, i) => ({ value: v, isMax: i < c.length - 1 }));
  return [{ value: die.result, isMax: false }];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function SpinningCube({ sides }: { sides: number }) {
  return (
    <div className="da-spin">
      <div className="da-cube">
        <div className="da-cube-face da-cube-front">{sides}</div>
        <div className="da-cube-face da-cube-back">?</div>
        <div className="da-cube-face da-cube-right">?</div>
        <div className="da-cube-face da-cube-left">?</div>
        <div className="da-cube-face da-cube-top">{sides}</div>
        <div className="da-cube-face da-cube-bottom">?</div>
      </div>
      <span className="da-spin-label">Rolling d{sides}</span>
    </div>
  );
}

function buildChain(dice: DieResult[]): DieItem[] {
  const chain: DieItem[] = [];
  dice.forEach((die, di) => {
    getChain(die).forEach((cs, ci) => {
      chain.push({
        key: `die-${di}-${ci}`,
        value: cs.value,
        sides: die.sides,
        isMax: cs.isMax,
        label: cs.isMax ? "explosion" : "roll",
        dieIndex: di,
      });
    });
  });
  return chain;
}

function buildMods(
  modifiers: { flatBonus?: number; statBonuses?: Record<string, number> } | undefined,
): ModItem[] {
  const mods: ModItem[] = [];
  if (modifiers?.flatBonus && modifiers.flatBonus !== 0) {
    mods.push({ key: "mod-flat", value: modifiers.flatBonus, label: "modifier" });
  }
  if (modifiers?.statBonuses) {
    for (const [stat, bonus] of Object.entries(modifiers.statBonuses)) {
      if (bonus !== 0) mods.push({ key: `mod-${stat}`, value: bonus, label: stat.toLowerCase() });
    }
  }
  return mods;
}

export function DiceAnimation({ adversityTokens = 0 }: DiceAnimationProps) {
  const isRolling = useDiceStore((s) => s.isRolling);
  const lastResult = useDiceStore((s) => s.lastResult);
  const boostLastRoll = useDiceStore((s) => s.boostLastRoll);

  const [centerItem, setCenterItem] = useState<DieItem | null>(null);
  const [centerStatus, setCenterStatus] = useState<"spinning" | "pulsing" | "visible">("spinning");
  const [explodedItems, setExplodedItems] = useState<DieItem[]>([]);
  const [modItems, setModItems] = useState<ModItem[]>([]);
  const [showMods, setShowMods] = useState(false);
  const [showTotal, setShowTotal] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [tokenDieIdx, setTokenDieIdx] = useState(-1);

  const runningRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (isRolling) {
      cancelledRef.current = true;
      runningRef.current = false;
      setCenterItem(null);
      setExplodedItems([]);
      setModItems([]);
      setShowMods(false);
      setShowTotal(false);
      setAllDone(false);
    }
  }, [isRolling]);

  useEffect(() => {
    if (isRolling || !lastResult) return;
    if (runningRef.current) return;

    const chain = buildChain(lastResult.result.dice);
    const mods = buildMods(lastResult.modifiers);
    setModItems(mods);

    runningRef.current = true;
    cancelledRef.current = false;

    // Reduced motion: jump straight to the final expression.
    if (prefersReducedMotion()) {
      const exploded = chain.filter((c) => c.isMax);
      const finalDie = [...chain].reverse().find((c) => !c.isMax) ?? null;
      setExplodedItems(exploded);
      setCenterItem(finalDie);
      setCenterStatus("visible");
      if (finalDie) setTokenDieIdx(finalDie.dieIndex);
      setShowMods(true);
      setShowTotal(true);
      setAllDone(true);
      runningRef.current = true; // block main effect on quiet boost
      return;
    }

    (async () => {
      for (let i = 0; i < chain.length; i++) {
        if (cancelledRef.current) return;
        const item = chain[i]!;

        setCenterItem(item);
        setCenterStatus("spinning");
        setTokenDieIdx(item.dieIndex);
        await delay(SPIN_MS);
        if (cancelledRef.current) return;

        if (item.isMax) {
          setCenterStatus("pulsing");
          await delay(PULSE_MS);
          if (cancelledRef.current) return;

          // Instant swap: center clears, left-group item mounts at x=0 (center)
          // and slides to its slot. Existing left items shift left by one UNIT.
          setExplodedItems((prev) => [...prev, item]);
          setCenterItem(null);
          await delay(SLIDE_MS);
        } else {
          setCenterStatus("visible");
          await delay(PULSE_MS);
        }
      }

      if (cancelledRef.current) return;
      setShowMods(true);
      await delay(Math.max(200, mods.length * 100 + 200));
      if (cancelledRef.current) return;
      setShowTotal(true);
      setAllDone(true);
      runningRef.current = true; // block main effect on quiet boost
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [isRolling, lastResult]);

  // When boostVersion increments and we're done animating, update the chain.
  const overallTotal = (() => {
    if (!lastResult) return 0;
    const diceSum = lastResult.result.dice.reduce((s, d) => s + d.result, 0);
    const advSum = lastResult.result.adversityResults.reduce((s, d) => s + d.result, 0);
    const mod = lastResult.result.modifier;
    // Also include flat/stat modifiers from the request (not baked into result.modifier)
    const extras = (lastResult as { modifiers?: { flatBonus?: number; statBonuses?: Record<string, number> } }).modifiers;
    const extraSum = (extras?.flatBonus ?? 0) + Object.values(extras?.statBonuses ?? {}).reduce((s, v) => s + v, 0);
    return diceSum + advSum + mod + extraSum;
  })();
  const hasExploded = explodedItems.length > 0;
  const isSimple = !hasExploded && modItems.length === 0;
  const explodedCount = explodedItems.length;

  if (!centerItem && explodedItems.length === 0 && !allDone) {
    return (
      <div className="da" aria-live="polite" aria-label="Rolling dice...">
        <div className="da-stage">
          <div className="da-center-slot">
            <div className="da-spin">
              <div className="da-cube">
                <div className="da-cube-face da-cube-front">?</div>
                <div className="da-cube-face da-cube-back">?</div>
                <div className="da-cube-face da-cube-right">?</div>
                <div className="da-cube-face da-cube-left">?</div>
                <div className="da-cube-face da-cube-top">?</div>
                <div className="da-cube-face da-cube-bottom">?</div>
              </div>
              <span className="da-spin-label">Rolling...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="da" aria-live="polite" aria-label="Dice roll result">
        <div className="da-stage">
          {/* Left: right-anchored at center; slots grow leftward by UNIT */}
          <div className="da-left-layer" aria-hidden={explodedCount === 0}>
            {explodedItems.map((item, i) => {
              // Closest-to-center explosion at -CENTER_GAP; each older one
              // one UNIT further left. Chronological leftâ†’right order.
              const targetX = -CENTER_GAP - (explodedCount - 1 - i) * UNIT_WIDTH;
              return (
                <motion.div
                  key={item.key}
                  className="da-exploded-unit"
                  initial={{ x: FLIGHT_START_X, y: "-50%", opacity: 1 }}
                  animate={{ x: targetX, y: "-50%", opacity: 1 }}
                  transition={slideTween}
                >
                  <div className="da-item">
                    <span className="da-value da-value--explosion">{item.value}</span>
                    <span className="da-label da-label--explosion">{item.label}</span>
                  </div>
                  <motion.span
                    className="da-operator"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: SLIDE_S , duration: 0.5, ease: "easeOut" }}
                  >
                    +
                  </motion.span>
                </motion.div>
              );
            })}
          </div>

          {/* Center: absolute, never moves */}
          <div className="da-center-slot">
            <AnimatePresence mode="wait">
              {centerItem && (
                <motion.div
                  key={centerItem.key}
                  className="da-item"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={
                    centerItem.isMax
                      ? { opacity: 0, transition: { duration: 0 } }
                      : { opacity: 0, scale: 0.8, transition: { duration: 0.15 } }
                  }
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  {centerStatus === "spinning" ? (
                    <SpinningCube sides={centerItem.sides} />
                  ) : (
                    <>
                      <motion.span
                        className={`da-value${centerItem.isMax ? " da-value--explosion" : ""}`}
                        animate={
                          centerStatus === "pulsing" ? { scale: [1, 1.4, 1] } : { scale: 1 }
                        }
                        transition={{ duration: 0.5 }}
                      >
                        {centerItem.value}
                      </motion.span>
                      <span
                        className={`da-label${centerItem.isMax ? " da-label--explosion" : ""}`}
                      >
                        {centerItem.label}
                      </span>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: modifiers + equals/total, stationary fade-in */}
          <div className="da-right-group">
            <AnimatePresence>
              {showMods &&
                modItems.flatMap((m, i) => [
                  <motion.span
                    key={`op-${m.key}`}
                    className="da-operator da-operator--modifier"
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: i * MOD_STAGGER_S }}
                  >
                    +
                  </motion.span>,
                  <motion.div
                    key={m.key}
                    className="da-item"
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: i * MOD_STAGGER_S }}
                  >
                    <span className="da-value da-value--modifier">{m.value}</span>
                    <span className="da-label da-label--modifier">{m.label}</span>
                  </motion.div>,
                ])}
              {showTotal && !isSimple && (
                <>
                  <motion.span
                    key="equals"
                    className="da-operator da-operator--equals"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, delay: modItems.length * MOD_STAGGER_S }}
                  >
                    =
                  </motion.span>
                  <motion.div
                    key="total"
                    className="da-item"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: modItems.length * MOD_STAGGER_S + 0.1,
                    }}
                  >
                    <span className="da-value da-value--total">{overallTotal}</span>
                    <span className="da-label">total</span>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {allDone && adversityTokens > 0 && (
          <motion.button
            type="button"
            className="da-token"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            onClick={() => {
              if (tokenDieIdx >= 0) boostLastRoll(tokenDieIdx);
            }}
            aria-label={`Spend 1 adversity token (${adversityTokens} left)`}
            title={`Spend token - ${adversityTokens} remaining`}
          >
            + Spend token
          </motion.button>
        )}
      </div>
    </MotionConfig>
  );
}
