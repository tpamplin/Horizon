# Dice Explosion Animation — Implementation Prompt

> **File:** `client/src/components/dice/DiceAnimation.tsx`
> **CSS:** `client/src/components/dice/DiceAnimation.css`
> **Library:** Framer Motion (`framer-motion`, already installed)

---

## What This Feature Is

The dice roller in our VTT supports **exploding dice**. When a die rolls its maximum value (e.g., 4 on a d4), the player rolls another die of the same size and adds it. The server returns the full chain — e.g., a d4 that exploded twice then rolled 2 returns `explosionChain: [4, 4, 2]`.

The `DiceAnimation` component renders this as an animated expression. The desired final visual state:

```
[4] + [4] + [2] + 5 = 15
```

Where `[4]` and `[4]` are yellow explosions, `[2]` is the final non-max roll (centered), `+5` is a purple modifier, and `= 15` is the green total.

---

## Detailed Visual Requirements

### Layout

Three zones in a horizontal row:

```
+---------------------------------------------------------+
|  [4] + [4] +       [2]        + 5 mod   = 15           |
|  <-- left group -->  <-- center -->  <-- right group --> |
+---------------------------------------------------------+
```

- **Center slot:** The **final non-exploding roll** lives here. It is the visual anchor. It **never moves**. It should be at the exact horizontal center of the screen at all times.
- **Left group:** Accumulated explosion numbers. Each explosion has a trailing `+` sign. Items appear chronologically (first explosion leftmost, most recent closest to center).
- **Right group:** Modifiers and equals+total. Appear only after all dice are done. Stationary, only fade in. Modifiers are purple. Equals and total are green.

### Animation Sequence Per Die (in order, one at a time)

For a pool `1d4` that returns chain `[4, 4, 2]`:

| Frame | Center | Left Group | What happens |
|-------|--------|------------|--------------|
| 1 | (spinning cube) | *(empty)* | First die spins for ~1.2s |
| 2 | **4** (yellow, pulses scale 1->1.4->1) | *(empty)* | Value revealed. It is max, so it glows/pulses for ~0.75s |
| 3 | *(empty)* | **4** slides in from the right, settles. `+` appears next to it. | The "4" flies from the center area to the left group. One continuous motion. |
| 4 | (spinning cube) | **4** + | Second die spins |
| 5 | **4** (yellow, pulses) | **4** + | Second value revealed — another max |
| 6 | *(empty)* | **4** + **4** slides in from right, settles. Existing "4" and its `+` shift left to make room. New `+` appears. | Second "4" flies to left group. First "4" and its `+` shift left simultaneously by the same distance. One cohesive leftward shift of the entire left group. |
| 7 | (spinning cube) | **4** + **4** + | Third die spins |
| 8 | **2** (white, normal) | **4** + **4** + | Final value revealed. Not max — **stays centered forever**. |
| 9 | **2** | **4** + **4** + +5 = **15** | Modifiers stagger-fade in (purple, one at a time, ~100ms apart), then equals and total (green). |

### Key Animation Rules

1. **Only max-value rolls slide left.** The final roll in every chain stays centered.
2. **Items appear chronologically.** First roll is processed first, last roll last. The expression reads left-to-right as the dice were rolled.
3. **Each explosion slides left by exactly one unit width** (~72–84px). Not more, not less. One smooth motion per element per slide.
4. **When a new explosion slides, ALL existing left-group items (numbers + `+` signs) shift left by the same distance simultaneously.** One cohesive motion. No stagger, no individual tweens, no bounce.
5. **A `+` sign trails each explosion.** The `+` lives between the explosion and whatever is to its right (another explosion, or the center). It fades in as the explosion settles.
6. **Modifiers appear one at a time** with ~100ms stagger, sliding in from the left. Purple (`#a371f7`).
7. **Equals and total always last, always far-right.** Green (`#3fb950`).
8. **Respect `prefers-reduced-motion`** — show final expression statically with no animation.

---

## What We Have Tried — And Why Each Failed

We have spent ~8 hours across 15+ iterations. Here is every approach and its fatal flaw:

### Attempt 1: Manual FLIP (getBoundingClientRect + requestAnimationFrame)

Hand-rolled inverse-transform FLIP. ~80 lines of code.

**Failure:** Zero visual effect. `getBoundingClientRect()` returned the same rects before and after state updates because DOM positions never actually changed (items stayed in the same flex order). Delta was always 0. Nothing moved.

### Attempts 2-4: Step-counter state machine + FLIP

Added a multi-step sequencer (`useEffect` reacting to a `step` counter). Odd steps = reveal, even steps = slide.

**Failure:** The sequencer had multiple scope/logic bugs: `totalSteps` scoped inside one `if` block (invisible elsewhere), odd-step handler returned early preventing modifiers/total from appearing, formula didn't account for the initial die (off-by-one). After fixing the logic, the FLIP still computed delta=0 because items never changed DOM position.

### Attempt 5: Framer Motion `layoutId` (shared-element transitions)

Used Framer Motion's `layoutId` prop. When a die in the center is removed and a die with the same `layoutId` is added in the left group, Framer Motion clones the element, positions it `fixed`, and animates a `transform` between the two positions.

**Failure: "Double-move."** `layoutId` works in two phases: (1) a clone flies from old position to new position, (2) the clone is removed and the real element is revealed. The reveal creates a visible second step that the eye perceives as a double-move or bounce. This is inherent to `layoutId` — it is a clone-and-reveal mechanism, not a single continuous motion.

Additionally, during the clone's flight, the real DOM element in the left group is removed from layout flow. This destabilizes sibling elements (`+` signs) as the flex row recalculates. When the animation ends, everything snaps back.

### Attempt 6: `layoutId` on wrapper vs. inner div

Moved `layoutId` from the wrapper `<div>` to the inner `.da-item` `<div>` to eliminate size-tweening during flight.

**Failure:** Made no difference to the flight (Framer Motion still clones-and-flies). Additionally broke the `+` signs — they were no longer coupled to the die during flight, causing them to snap instead of slide.

### Attempt 7: Flat-row with `translateX`

Eliminated `layoutId` entirely. Put all items in a single flex row. Each die gets `animate={{ x: -UNIT * slideOffset }}`. No parent changes, no clones.

**Failure:** `translateX` does not affect layout — flex still reserves the original space. This creates 84px "holes" in the row where items translated away. Also, `justify-content: center` centers the GROUP based on natural positions, so the final die drifts off-center as items translate left. No CSS property both affects layout and animates smoothly on the GPU.

### Attempt 8: Three-zone with `AnimatePresence`

Center slot uses `position: absolute; left: 50%; transform: translateX(-50%)` — always centered. Left group items enter via `AnimatePresence` with `initial={{ x: UNIT, opacity: 0 }}` -> `animate={{ x: 0, opacity: 1 }}`. No `layoutId`, no cross-parent elements.

**Failure:** `AnimatePresence` only animates NEW items. Existing items in the left group snap to their new flex positions when a new item is added — they don't slide. Only the most recent explosion slides; everything else teleports. Existing `+` signs also jump.

---

## What We Need

A working implementation of the animation described in the frame-by-frame table above.

### Files

- `client/src/components/dice/DiceAnimation.tsx`
- `client/src/components/dice/DiceAnimation.css`

### Data you receive

From the dice store (`useDiceStore`):
- `isRolling: boolean` — `true` when a roll is in progress, `false` when result is ready
- `lastResult: DiceRollResponse | null` — set when the server responds

From `lastResult.result.dice: DieResult[]`:
```ts
interface DieResult {
  sides: number;           // e.g., 4
  result: number;          // total of chain (e.g., 10 for [4,4,2])
  explosionChain?: number[]; // e.g., [4, 4, 2] — undefined if no explosion
}
```

From `lastResult.modifiers` (optional):
```ts
{ flatBonus?: number; statBonuses?: Record<string, number> }
```

### Hard constraints

- Framer Motion is already installed (MIT, free)
- Plain CSS, no Tailwind
- The 3D cube spinner must stay (CSS `@keyframes cube-spin`)
- `prefers-reduced-motion` must be respected (show final expression statically)
- Build must pass (`npm run build`)
- 125/125 client tests must pass (`npm test -w client -- --run`)