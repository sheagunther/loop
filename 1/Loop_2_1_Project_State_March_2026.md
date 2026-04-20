# Loop 2.1 — Complete Project State Document
**Date:** March 15, 2026  
**Prepared by:** Claude AI  
**Purpose:** Complete onboarding document for any person or AI instance picking up this project. Covers philosophy, architecture, simulator specification, current build state, all features, known issues, and development history.

---

## Table of Contents

1. [Project Overview & Philosophy](#1-project-overview--philosophy)
2. [Version Numbering & Project Tracks](#2-version-numbering--project-tracks)
3. [The 14 Tenets](#3-the-14-tenets)
4. [Architecture — The Four Loops](#4-architecture--the-four-loops)
5. [Data Format — The 17-Bit Word](#5-data-format--the-17-bit-word)
6. [The Bus System](#6-the-bus-system)
7. [The ALU](#7-the-alu)
8. [Memory Slots](#8-memory-slots)
9. [Pattern Matchers](#9-pattern-matchers)
10. [Counters & Triggers](#10-counters--triggers)
11. [The Inject Channel](#11-the-inject-channel)
12. [Bus E — External Interface](#12-bus-e--external-interface)
13. [The Challenge Module](#13-the-challenge-module)
14. [The Session Log — .loop File Format](#14-the-session-log--loop-file-format)
15. [Simulator UI & Controls](#15-simulator-ui--controls)
16. [Visual Skins](#16-visual-skins)
17. [Easter Eggs](#17-easter-eggs)
18. [Current Build State (v.158)](#18-current-build-state-v158)
19. [Code Architecture](#19-code-architecture)
20. [Performance Optimizations](#20-performance-optimizations)
21. [Division of Labor](#21-division-of-labor)
22. [Planned / Pending Work](#22-planned--pending-work)
23. [Key Design Decisions & Rationale](#23-key-design-decisions--rationale)
24. [File Locations](#24-file-locations)

---

## 1. Project Overview & Philosophy

**Loop 2.1** is a manual flow computer simulator running in a web browser. It is the official specification of the Loop computing paradigm, designed and created by **Shea Gunther** of North Windham, Maine. Code and documentation are written by Claude AI.

### Core Concept

The machine has no stored program. There is no code running in the background, no scheduler, nothing executing automatically. **The operator is the program.** Every movement of data, every calculation, every routing decision is made by the human operator in real time as the machine runs.

This is not a limitation — it is the entire point.

Modern computers hide everything from users. Loop 2.1 inverts this: every bit is visible, every operation is observable, every decision belongs to the operator. The machine runs at human-observable speeds (default 1 Hz) so the operator can watch data move, trace cause and effect, and understand exactly what is happening at every moment.

### What Loop 2.1 Is

- An educational tool that teaches computing through direct physical interaction with data
- A performance art form — computation as deliberate craft
- A philosophical statement about transparency, agency, and human control
- A prototype for a potential physical machine and Minecraft display build
- The authoritative specification from which community variants (Loop 2.x) derive

### What Loop 2.1 Is Not

- A practical production computer
- A replacement for conventional CS education
- Anti-technology (it is pro-understanding)
- Nostalgic for old computers

### The Problem It Addresses

Modern computing relies on abstraction layers so deep that even professional engineers rarely understand what's happening at the hardware level. Users interact with systems they cannot see, running code they cannot read, making decisions they cannot audit. Loop 2.1 proves that transparent, human-controlled computation is possible and meaningful.

**"Computers don't have to be black boxes. Transparency is possible. Humans can stay in control."**

---

## 2. Version Numbering & Project Tracks

```
Loop 1.00001   = Throne room (single loop, 5-bit words, 2 operations) — Minecraft
Loop 1.99999   = Full Minecraft canonical build (4 loops, fixed 1 Hz, full redstone)
Loop 2.0       = Minecraft DISPLAY build — physical structure exists in Minecraft world,
                 ~80% of operator controls modeled, NO circuitry yet. Years from completion.
Loop 2.1       = Web simulator — THE OFFICIAL SPEC. What this document describes.
Loop 2.1–2.2   = Reserved for official spec revisions
Loop 2.2–2.99999 = Community variant space, organized by family clusters
                   (e.g., 2.4x = experimental; 2.7x–2.8x = speed variants)
```

Selected memorable numbers (2.42069, 2.55555, etc.) are reserved for potential future auction as a monetization mechanism.

**Loop 2.1 is the primary active project.** The Minecraft display build (Loop 2.0) is a long-term parallel track with no circuitry development happening currently.

### Active Files

- **Simulator:** `loop2-stage2.html` — single self-contained HTML file, all CSS and JS inline
- **Versioned deliveries:** `loop2-stage2 (NNN).html` where NNN is the build number
- **Changelog:** `loop2_changelog.md`
- **This document:** `Loop_2_1_Project_State_March_2026.md`
- **Target domain:** `loop2.computer` (not yet live)

---

## 3. The 14 Tenets

These core principles define what Loop computing is. Variants must preserve all 14.

1. **The Operator Is the Program** — No stored program exists. All control flow is human.
2. **Explicit State (No Black Boxes)** — All data visible at all times. Nothing happens invisibly.
3. **Legible Causality** — Every effect has a traceable cause. No emergent behavior.
4. **Data as Physical Entity** — Data has position, velocity, trajectory. It is conserved.
5. **Manual Flow** — Operator routes all data and triggers all operations.
6. **Circular Storage** — Memory is circular (loops), not arrays. Serial access.
7. **Bus as Programmable Structure** — Routing is configurable and visible. Topology is computation.
8. **Flags as Information** — Flags inform the operator; they do not trigger automatic execution.
9. **Graceful Failure** — Errors are visible, not hidden. System stops in observable state.
10. **Computation as Craft** — Quality over speed. Understanding over efficiency.
11. **Operator-Scale Timing** — Default 1 Hz. Always human-observable.
12. **Extensibility Through Modularity** — New components preserve operator agency and visibility.
13. **Optimization for Elegance** — Fewer steps better than faster steps. Flow state achievable.
14. **Augmentation, Not Replacement** — Modules are tools, not autopilot. Never replace human decision-making.

---

## 4. Architecture — The Four Loops

Each loop is a circular bit array (conveyor belt). Data circulates continuously. At one point on each loop — the Read/Write head — bits can be read, written, or gated out.

### The R/G/W Head Model

Each loop has three consecutive positions at the head:

- **R dot (bits[2])** — Read position. Buses and ALU sample here.
- **G dot (bits[1])** — Gate position. If gate is CLOSED, bit here is zeroed each tick.
- **W dot (bits[0])** — Write position. Bus deliveries, ALU writebacks, and inject output land here.

Each tick, every unpaused loop shifts its bits forward by one position (bits rotate toward lower indices, exiting at bits[0] and re-entering from the other end — except for data that exits via the gate).

### Loop Sizes (Current — v.158)

| Loop | Word Capacity | Bits Total | Purpose |
|------|--------------|------------|---------|
| Working | 18 words | 306 bits | Primary staging area, inject channel destination |
| ALU | 24 words | 408 bits | Connected to ALU engine, capture/writeback |
| Memory | 24 words | 408 bits | Bulk storage loop + 16 addressable slots |
| Big | 48 words | 816 bits | Largest loop, home of both Pattern Matchers |

**Note:** These are the wordCap values in DEFS. At BPW=17, total bit counts = wordCap × 17.

### Per-Loop Controls

Each loop has:
- **GATE button** — OPEN (data flows freely) or CLOSED (bit at G dot zeroed each tick)
- **⏸ button** — Pause/unpause individual loop
- **STEP button** — Advance only this loop one tick
- **Counter strip** — Shows counter value, eject-to-bus buttons (→A →B →C →D), COPY/EJECT toggle, RESET
- **READ display** — 17-bit pattern at the R dot, with decimal and hex values

---

## 5. Data Format — The 17-Bit Word

```
[ M | b15 b14 b13 b12 · b11 b10 b9 b8 b7 b6 b5 b4 b3 b2 b1 b0 ]
  1 marker bit  +  16 data bits
```

- **Marker bit (M):** Always 1 when a word is present, 0 for empty space. Essential because data circulates continuously with empty gaps between words — the machine needs to distinguish data from silence.
- **Data bits (b15–b0):** 16 bits = values 0 through 65,535
- **Top 4 bits (b15–b12):** In some contexts serve as a 4-bit address (0–15 for memory slots)
- **Marker bit mask:** `0x10000`
- **Data mask:** `0xFFFF`
- **Word format in logs:** `[M|BBBB·BBBBBBBBBBBB]`

**A word containing value zero is not empty.** A word with marker=1 and data=0x0000 is a valid word containing zero, distinct from an empty slot (marker=0).

### 12-Bit Compatibility Mode (ALU)

The ALU has a 12-bit mode toggle. When active, the top 4 bits (b15–b12) of both operands are masked to zero before computing. Results have zero in the top 4 positions. The top 4 bit-dots dim visually when 12-bit mode is active.

---

## 6. The Bus System

Five buses transfer data between components. Each bus is a 24-slot pipeline (BUS_N=24). One bit enters per tick; a full 17-bit word takes 17 ticks to traverse, then 17 more ticks to write into the destination (34 ticks total for a complete transfer).

### Bus Specifications

| Bus | Color | Sources | Destinations | Special |
|-----|-------|---------|--------------|---------|
| **A** | Purple | Working, ALU, Memory, Big, PM1, PM2, PM2·Match, PM2·Reject, all 5 counters | Working, ALU, Memory, Big, all 5 counters, Challenge, Network | Primary data bus |
| **B** | Violet | Same as A | Same as A | Identical capability to A; run simultaneously |
| **C** | Teal | Working, ALU, Memory, Big, PM sources, all counters | Working, ALU, Memory, Big, counters, Challenge, Network | Second general bus |
| **D** | Amber | Working, ALU, Memory, Big, PM sources, all counters | Working, ALU, Memory, Big, counters, Challenge, Network | Enables mega-loop configuration |
| **E** | Crimson | Working, ALU, Memory, Big | Working, ALU, Memory, Big | Dual-channel (outbound + inbound); connects to external endpoint |

### Mega-Loop Configuration

With four independent buses (A, B, C, D), an operator can route Working→ALU, ALU→Memory, Memory→Big, Big→Working simultaneously, creating a single continuous data pathway through all four components in sequence.

### Bus Direction

Buses flow either left-to-right or right-to-left depending on source/destination loop positions. The `getBusDir()` functions determine this based on which side of the layout each loop occupies. Invalid configurations (same source and destination) are rejected.

### Transfer Protocol

Each bus uses an `xfer` counter (a simple integer):
- When `xfer = 0`: waiting for marker bit
- When a marker bit (value 1) exits the source: `xfer = BPW` (17)
- Each subsequent tick: `xfer` decrements
- When `xfer = 0` again: word is complete

The `writeToLoop()` function handles delivery using this protocol. It fires counter triggers (wordWritten, bitsWritten) as appropriate.

---

## 7. The ALU

The ALU performs all calculations. It operates on operands drawn from four persistent registers and places the result in a dedicated Answer register.

### Registers

Four registers: **A, B, C, D**. All hold 16-bit values. All persist until explicitly overwritten. An **Answer** register holds the most recent computation result.

### Capture Route

The **HEAD → [A/B/C/D/Ans]** selector determines which register captures the next word arriving at the ALU loop read head. In **ADVANCE** mode (default), the route steps automatically after each SEND TO LOOP: A→B→C→D→Answer. In **HOLD** mode, it stays on the current register — useful for accumulator patterns.

### Operand Selection

**Op A ←** and **Op B ←** selectors choose which registers feed the two operand slots. Any register can feed either operand position (compute A+C, D−B, etc.) without moving data between registers.

### Operations

| Operation | Description |
|-----------|-------------|
| ADD | Op A + Op B. Sets carry if result exceeds 0xFFFF. |
| SUB | Op A − Op B. Sets carry on borrow. |
| AND | Bitwise AND |
| OR | Bitwise OR |
| XOR | Bitwise XOR |
| NOT | Bitwise complement of Op A (Op B unused) |
| SHL | Shift Op A left one bit. Top bit → carry; zero enters at b0. |
| SHR | Shift Op A right one bit. b0 → carry; zero enters at top. |
| NEG | Arithmetic negation (two's complement: 0 − Op A) |
| INC | Op A + 1 |
| DEC | Op A − 1. Carry set if Op A was 0 (underflow). |

**Note:** MUL and DIV are not available as single operations. Multiplication is accomplished via repeated addition.

### ALU Flags

| Flag | Meaning |
|------|---------|
| ZRO | Result is exactly zero |
| CRY | Carry out (ADD/INC), borrow (SUB/DEC), or shifted-out bit (SHL/SHR) |
| OVF | Signed overflow: result crossed the signed integer boundary |
| SGN | Top bit of result is set (negative in two's complement) |
| PAR | Even parity: number of set bits in result is even |

### Comparator

Runs automatically on every COMPUTE. Compares Op A and Op B and sets six flags: GT, LT, EQ, GTE, LTE, NEQ. These flags inform the operator; they do not trigger automatic action.

The six flags are packed into a single 16-bit word (GT→b5, LT→b4, EQ→b3, GTE→b2, LTE→b1, NEQ→b0) and can be written into the ALU Loop via SEND TO LOOP in the comparator section.

---

## 8. Memory Slots

The Memory loop provides 16 addressed memory slots — fixed storage locations numbered 0 through 15 that hold 16-bit values independently of loop circulation.

### Address Selector

A 4-bit address selector (levers b3–b0) selects which slot is active. 4-bit addressing gives access to slots 0–15.

### Write Mode

When **ENABLE WRITE TO SLOTS** is active, every complete word passing the Memory Loop read head is captured into the currently addressed slot.

### Auto-Increment

When **AUTO-INC** is active, each successive captured word is stored into the next sequential slot. After slot 15, wraps to 0.

### Address-Read Mode

When **ADDR-READ: ON** is active alongside ENABLE WRITE TO SLOTS, incoming words write themselves to the slot number encoded in their top 4 bits (b15–b12, values 0–15), overriding the manual address selector. The full 16-bit value is stored intact.

### Reading from Slots

Each slot has a **SEND TO LOOP** button that injects that slot's value into the Memory Loop head. Enable **DESTRUCT** to clear the slot after sending.

### Batch Write All

**BATCH WRITE ALL** outputs all 16 slots sequentially into the Memory Loop in slot order (0 through 15).

### Clearing

Each slot has a **CLEAR** button that empties it immediately regardless of clock state.

---

## 9. Pattern Matchers

Two Pattern Matchers (PM1 and PM2) are attached to the Big Loop, positioned on the bottom track. PM1 is encountered first; PM2 is downstream in cascade. Every word circulating in the Big Loop passes both inspection points on every rotation.

### PM1 Eject Position

`PM1_EJECT_IDX = 444` (approximately 82% around the 816-bit Big Loop, left-of-center on bottom track).

### PM2 Eject Position

`PM2_EJECT_IDX = 427` (one word downstream of PM1, encountered second).

### How Matching Works

Each PM has two 16-bit registers:
- **Mask** — bit=1 means "check this bit," bit=0 means "ignore"
- **Pattern** — the value to compare against for the bits selected by the mask

**Match condition:** `(data AND mask) == (pattern AND mask)`

The PM is active when at least one mask bit is set. Clearing all mask bits to zero disables it.

### On a Match

1. MATCH flag lights and match counter increments
2. If REWRITE is ARMED, the matched word is modified in-place before any other action
3. The word is loaded into the PM output bridge
4. **EJECT: COPY** — word stays in Big Loop and continues circulating
5. **EJECT: DESTRUCTIVE** — word is zeroed out and removed from Big Loop

### PM1 Output

PM1 output sits in the bridge until Bus A reads it. Set Bus A Source to PM, set a destination, and turn Bus A ON. The bridge holds only one word at a time — if a second match fires before the first is consumed, the bridge is overwritten.

### PM2 Cascade Mode

PM2 operates independently with its own mask, pattern, rewrite, and eject settings. Since it is downstream of PM1, it only sees words that PM1 passed.

### Rewrite Mode

When REWRITE: ARMED, matched words have specified bits modified:
- **Rewrite Mask** — selects which bit positions to change
- **Rewrite Value** — specifies the new values for those positions

### Cooldown Fix (Critical Bug History)

The PM cooldown exists to prevent a matched word from triggering multiple times as it exits the eject position. A 12-bit word takes 12 ticks to fully leave. The correct fix (applied in v.109): set the cooldown to BPW-1 ticks immediately upon detecting any marker at the eject position, before the match check. Non-matching words also arm the cooldown.

---

## 10. Counters & Triggers

Loop 2.1 has five counters: one for each loop (Working, ALU, Memory, Big) and one global. All start at 0 and run to infinity (no cap).

**Counters are not automatic.** By default, every trigger is off and no counter increments. Operators must activate triggers in the Counter Triggers panel.

### Triggers — All Loops

| Trigger | Fires when... |
|---------|--------------|
| Word Written | Marker bit arrives at write position — start of a word entering the loop |
| Word Read | Final bit of a word passes the read position — one complete pass |
| Bits Written | Any bit written that is part of a word (fires BPW× per word) |
| Bits Read | Any bit sampled that is part of a passing word (fires BPW× per word) |
| Full Cycle | Loop completes one full rotation |

### Additional Triggers

- **ALU loop:** Reg Sent, Answer Sent, Cmp Sent
- **Memory loop:** Write to Slot, Read from Slot
- **Big loop:** PM Match, PM Rewrite, PM Eject

### Global Counter

Increments once for every increment of any loop counter — a running total of all counter fires across all four loops.

### Counter Controls

| Control | Function |
|---------|----------|
| →A / →B / →C / →D | Send counter value as 17-bit word onto that bus |
| COPY / EJECT | EJECT resets counter to zero after sending; COPY preserves it |
| RESET | Sets counter to zero immediately |

### Op Count

The Op Count mechanism links counters to an automatic halt: set a target value (0–99999), link counters using letter buttons (W, A, M, B, G). When a linked counter reaches the target, that loop halts automatically. Releasing a halt: press RESET on the linked counter.

---

## 11. The Inject Channel

The operator injects values into the Working Loop via the inject channel.

### Operator Switches

16 toggle switches represent the 16 data bits, grouped as: 4 switches for bits b15–b12 (address bits), a small gap, then 12 switches for b11–b0. Flip up for 1, down for 0. The display shows the value in decimal and hex as levers are set.

### Sending a Value

Press **▼ SEND**. The machine prepends the marker bit and loads the 17-bit word into the inject channel (INJ_N=17 slots). The word enters the Working Loop one bit per tick over 17 ticks.

The INJECT LED lights while the channel has bits in flight. A second SEND is blocked until the channel clears.

### Drag-to-Set

As of v.153, all toggle switches (operator levers, PM levers, memory address levers) support drag-to-set. Click and hold on a toggle, then drag across others — they all flip to the same state as the first toggle you clicked. Dragging back over a toggle you already hit does not re-toggle it. Works on operator input levers, both PM1 and PM2 lever rows (mask, pattern, change mask, change value), and memory address levers.

### RNG

The RNG button generates a random value and injects it directly into the Working Loop. Min/Max fields constrain the range (0–65535 clamped).

---

## 12. Bus E — External Interface

Bus E is a dual-channel bus that connects the simulator to an external endpoint (Challenge module or future Network). Unlike Buses A–D which are single pipelines, Bus E has two independent 24-slot arrays:

- **`busEOutBits`** — outbound (loop → external), drawn in crimson
- **`busEInBits`** — inbound (external → loop), drawn in green

Both channels are drawn on the same canvas strip using `globalCompositeOperation='screen'` for additive color mixing.

### Configuration

**External Endpoint** — Challenge or Network (currently only Challenge is implemented)  
**Outbound Source** — which loop's read head feeds the outbound channel  
**Inbound Destination** — which loop receives words arriving from the external endpoint

Bus E auto-enables when a challenge starts (if not already on).

### External Interface Functions

```javascript
writeToExternal(exitBit, xfer)   // called each tick with bit exiting outbound bus
getExternalInboundBit()          // called each tick to get next inbound bit
sendWordInbound(val)             // queues a full word into the inbound bit queue
onExternalWordReceived(data)     // called when a full outbound word arrives at external
challengeReceiveWord(val)        // routed from onExternalWordReceived when ext=challenge
```

### Inbound Queue

`_extInQueue` — a flat bit array. `sendWordInbound(val)` pushes a marker bit followed by 16 data bits MSB-first. `getExternalInboundBit()` shifts one bit out per tick.

### Challenge/Network as Bus A/B/C/D Destination

Buses A, C, and D can also route directly to the external endpoint (Challenge or Network) when their destination is set accordingly. Their exit bits flow through `writeToExternal()`.

---

## 13. The Challenge Module

The Challenge Module is a sidebar section (pink/magenta accent, `#cc4488`) at the top of the right column. It presents computational problems to the operator and evaluates the response.

### Current Challenge: Add X Numbers

The operator selects how many values to add (2–32, available options: 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32). Pressing **NEW CHALLENGE**:

1. Generates N random values (1–32767 range, sum guaranteed to fit in 16 bits)
2. Auto-enables Bus E if not already on
3. Queues all values into `_extInQueue` via `sendWordInbound()`, with a BPW-bit gap (17 zeros) between each value so they are visually distinguishable as separate words on the inbound strip
4. Values arrive in the operator's chosen inbound destination loop
5. Operator adds them using the machine, routes the sum to the chosen outbound source loop
6. The sum exits via Bus E outbound to `writeToExternal()` → `challengeReceiveWord()`
7. The module evaluates and displays the result

### Scoring Formula

```
timePenalty  = floor(wallSeconds × 4)          // 4 pts/sec of real elapsed time
opPenalty    = opDelta × 12                    // 12 pts per operator action
speedBonus   = max(0, round(100 − wallSec × 2)) // up to +100 for sub-50 second solve
rawScore     = 1000 − timePenalty − opPenalty + speedBonus
score        = max(50, rawScore)               // floor: 50 for any correct answer
```

Wrong answer: score = 0.

### Operator Action Tracking

`_opCount` — a global always-on counter that increments at the top of `logSetup()` regardless of whether the session logger is active. The challenge module captures `CHALL.opsAtStart = _opCount` at challenge start and computes `opDelta = _opCount - CHALL.opsAtStart` at evaluation.

### Score Display

Shows breakdown: `742 (−160t −120op +22spd)` — time penalty, op penalty, speed bonus.

### History

Last 10 runs shown in the challenge panel, format: `✓ ×4 sum=61432 → 23.4s · 412tk · 9op · 763pts`

### State Object

```javascript
const CHALL = {
  active, state,          // 'idle' | 'feeding' | 'done'
  values: [],             // the N values sent
  n,                      // count of values
  expected,               // correct sum
  received: [],           // words received back
  startTick, startTime,   // for elapsed measurement
  opsAtStart,             // _opCount at challenge start
  history: [],            // last 10 result strings
};
```

### Abort Behavior

`challAbort()` clears both `_extInQueue` and `_extOutBuf` to flush any pending bits. Without this, stale bits from a previous challenge would arrive in the operator's loop after abort.

---

## 14. The Session Log — .loop File Format

Loop 2.1 records sessions to a structured `.loop` file. Every operator action and machine event is captured in dual format: machine-parseable code to the left of `||`, human-readable description to the right.

### File Sections

| Section | Contents |
|---------|----------|
| SPEC | Machine configuration at session start: loop sizes, word format, clock speed, operator handle, session name |
| INIT | Full machine state snapshot at session start (loop contents, register values, counter states) |
| OPS | Tick-by-tick operation log. T##### = clock tick lines. S##### = operator setup actions between ticks |
| (NOTES) | Free-text operator notes, between END OPERATIONS and FINAL section |
| FINAL | Complete machine state snapshot at session end, plus performance statistics |

### Line Formats

```
T00042.TICK BUS=ON GATES=OOOO WK=... || Tick 42: bus on, gates all open, heads: ...
S00042.OP.BUSA.SRC WORKING          || [setup@42] Operator sets Bus A source to working
```

T-lines = machine events (automatic). S-lines = operator decisions (manual intervention). This distinction — making human intervention explicitly visible in the record — is a philosophically important feature of the paradigm.

### INIT/FINAL Loop State Format

Each loop's bits are recorded as the SPEC/INIT/FINAL log lines using `loopContents()` which formats the bit array into word-by-word descriptions.

### BITS Lines

`INIT.LOOP.*.BITS` and `FINAL.LOOP.*.BITS` lines record the complete bit state of each loop for accurate replay.

### Statistics (FINAL Section)

- Operator Actions, Words Transferred, ALU Ops Executed
- Injects, Bus Activations, Gate Toggles
- PM Matches, Step-Backs (now always 0 — feature removed)
- Actions per Tick, Words per Tick
- Pause time, run time, session duration, pause fraction
- Memory slot writes

---

## 15. Simulator UI & Controls

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: Logo · Credit · Clock% · Build · Skin · Handle ·   │
│         Session · Tick Counter                              │
├─────────────────────────────────────────────────────────────┤
│ CONTROLS: START/STEP · Speed slider+input · Op Count ·     │
│           LEDs: CLOCK RUNNING BUS INJECT         [Kilroy]  │
├───────────────────────────────────────────┬─────────────────┤
│ MAIN AREA                                 │ SIDEBAR         │
│  ┌─ INJECT ROW (levers + channel) ──────┐ │ Challenges      │
│  ├─ TOP LOOPS: Working | ALU ───────────┤ │ Global Counter  │
│  ├─ BUS A ──────────────────────────────┤ │ Counter Triggers│
│  ├─ BUS B ──────────────────────────────┤ │ ALU             │
│  ├─ BUS C ──────────────────────────────┤ │ Bus A Config    │
│  ├─ BUS D ──────────────────────────────┤ │ Bus B Config    │
│  ├─ BUS E ──────────────────────────────┤ │ Bus C Config    │
│  └─ BOTTOM LOOPS: Memory | Big ─────────┘ │ Bus D Config    │
│                                            │ Bus E Config    │
│                                            │ Pattern Matcher │
│                                            │ Pattern Matcher2│
│                                            │ Memory Slots    │
│  STATUS LOG (6 lines)                      └─────────────────┤
└─────────────────────────────────────────────────────────────┘
```

### Master Controls

| Control | Function |
|---------|----------|
| START / STOP | Starts or halts the master clock |
| STEP | Advances entire machine one tick |
| Speed slider | Range slider 1–144 Hz in 1 Hz steps |
| Speed input | Number input 0.1–144 Hz, accepts decimals |
| Op Count | Target value + W/A/M/B/G link buttons |
| BACK button | Removed (v.158) |

The slider and number input are synchronized: moving the slider updates the number box, typing in the number box snaps the slider to the nearest integer. The clock runs at the exact decimal value from the number box.

### Clock Accuracy Display

Shows rolling 16-sample average of actual vs target tick interval as a percentage. Green ≥95%, amber ≥75%, red below. Shows `—` when stopped, `STOPPED` when clock is off.

### Status Log

6 lines of scrolling status messages, color-coded by type (info, bus, ok, err).

---

## 16. Visual Skins

Three skins implemented as CSS variable overrides plus a canvas color object (`SK`):

| Skin | Description |
|------|-------------|
| **OG** (default) | Cool blue-grey industrial aesthetic, dark background |
| **WinAmp** | Dark mode, 1990s bevel aesthetic, green accents |
| **Sunrise** | Warm amber and terracotta, softer and more approachable |

Switching skins is instant. The `SK` object contains pre-cached color strings for canvas drawing functions (bus strip colors, data word colors, etc.).

---

## 17. Easter Eggs

### Kilroy Was Here

**Trigger:** Load the value 42 into all four ALU registers (A, B, C, D simultaneously).

**Behavior:** A tiny pixel-art Kilroy figure (11×7 pixels, `image-rendering: pixelated`) slides up from below the border between the header and controls bar. The bottom edge of his head is flush with the separator line. He has a bald dome, two eye pixels, a single nose pixel, and two finger pixels gripping the wall edge on each side.

**Animation:** Appears with a slight bounce (`cubic-bezier(0.34, 1.4, 0.64, 1)`) and slides back down when any ALU register changes from 42.

**Implementation:** `kilroyCheck()` is called 4 times per second in the throttle block. Uses CSS classes `.visible` and `.hiding` on `#kilroy`.

---

## 18. Current Build State (v.158)

### Architecture Constants

```javascript
const BPW   = 17;   // 1 marker bit + 16 data bits per word
const BUS_N = 24;   // bus pipeline length (slots)
const INJ_N = 17;   // inject channel length

// Loop word capacities (DEFS)
Working: 18 words (306 bits)
ALU:     24 words (408 bits)
Memory:  24 words (408 bits)
Big:     48 words (816 bits)

// PM positions (index into Big loop bit array)
PM1_EJECT_IDX = 444
PM2_EJECT_IDX = 427

// Memory
mem.slots: 16 slots (null = empty), 4-bit addressing (0-15)
mem.addrBits: [b3, b2, b1, b0]

// Default clock
clockHz = 1.0 Hz (range: 0.1–144 Hz)
```

### Feature Complete List (v.158)

- ✅ Four circular loops with R/G/W head model
- ✅ Five buses (A purple, B violet, C teal, D amber, E crimson)
- ✅ Mega-loop configuration possible with A+B+C+D simultaneously
- ✅ ALU with four registers (A/B/C/D), Answer, 11 operations, comparator
- ✅ 8-bit / 12-bit / 16-bit mode ALU toggle (currently 12-bit and 16-bit)
- ✅ 16 addressable memory slots with auto-increment, address-read mode, batch write
- ✅ Two Pattern Matchers in cascade (PM1 + PM2) with mask/pattern/rewrite/eject
- ✅ Five counters (W/A/M/B/G) with configurable triggers per loop
- ✅ Op Count halt mechanism
- ✅ 16-lever operator input panel with drag-to-set
- ✅ RNG (0–65535 range)
- ✅ Session logger → .loop file download
- ✅ Operator notes field
- ✅ Bus E external interface with dual outbound/inbound channels
- ✅ Challenge module (Add X Numbers, 2–32 values)
- ✅ Speed slider (1–144 Hz, 1 Hz steps) + number input (0.1–144 Hz)
- ✅ Three skins (OG, WinAmp, Sunrise)
- ✅ Clock accuracy % display
- ✅ Drag-to-set on all toggle types
- ✅ Kilroy easter egg
- ✅ Step-back REMOVED (v.158, was dead code consuming resources)

### Removed Features

- **Step-back / undo** — Removed in v.158. The feature was implemented (captureSnapshot, stepBack, prevSnapshot) but had been disabled from the UI earlier. Removing it eliminated a large per-tick performance cost (spreading ~1200+ array elements into a new object every tick).

---

## 19. Code Architecture

The entire simulator is a single self-contained HTML file. All CSS and JavaScript are inline. No external dependencies, no build step, no server required.

### Key Global Variables

```javascript
// Machine state
const loops = { working, alu, memory, big }  // each has .bits[], .flash, .gateOpen, .paused
let busBits, busBBits, busCBits, busDdBits    // bus A, B, C, D bit arrays
let busEOutBits, busEInBits                    // Bus E dual channels
let injBuffer                                  // inject channel
let alu = { a, b, c, d, result, flags, ... }  // ALU state
let mem = { slots[], addrBits[], ... }         // memory state
let pm = { maskBits[], matchBits[], ... }      // PM1 state
let pm2 = { ... }                              // PM2 state
let ctr = { working, alu, memory, big, global } // counter state

// Timing
let running, tickCount, clockHz, lastTick, lastFrame

// Performance
let _opCount = 0  // always-on operator action counter (independent of logger)
```

### Key Functions

```javascript
doTick()           // main simulation step — called each clock interval
renderAll()        // redraws all canvases and updates all DOM displays
mainLoop(now)      // rAF loop — handles timing, flash decay, throttled updates

// Bus ticks (called from doTick)
busBTick()         // Bus B (mirrors A with counter support)
busCTick(srcBit)   // Bus C
busDTick(srcBit)   // Bus D
// Bus A tick is inline in doTick
// Bus E tick is inline in doTick

// Data transfer
writeToLoop(bit, dst, xfer)    // deliver one bit per tick to a destination loop
writeToExternal(bit, xfer)     // deliver one bit per tick to external endpoint
sendWordInbound(val)           // queue a full word into Bus E inbound

// PM
pmTick()     // Pattern Matcher 1
pm2Tick()    // Pattern Matcher 2

// Counters
ctrTickLoops()    // advance all loop counters each tick
ctrFire(id, trig) // increment a counter if its trigger is active
ctrDrainToBusA/B/C/D()  // inject counter values onto buses when requested

// Snapshot (removed v.158)
// captureSnapshot(), stepBack(), prevSnapshot — all deleted

// Display
drawLoop(def)      // canvas draw for one loop
drawBus()          // Bus A canvas
drawBusB/C/D/E()   // other bus canvases
drawInject()       // inject channel canvas
aluUpdateDisplay() // ALU DOM updates (dirty-flagged)
memUpdateDisplay() // Memory DOM updates (dirty-flagged)
updateDetail(def)  // READ display for one loop (word-hash dirty-skip)

// Challenge
challStart()              // begin a challenge
challAbort()              // abort and flush queues
challengeReceiveWord(val) // called when outbound word reaches external
challEvaluate()           // score and display result
```

### Pre-Built Lookup Structures (Performance)

```javascript
const LOOP_IDS_SET = new Set(['working','alu','memory','big'])  // O(1) membership test
const DEF_BY_ID = {}   // populated at init: { working: def, alu: def, ... }
const UNARY_OPS = new Set(['NOT','SHL','SHR','NEG','INC','DEC'])
const CARRY_OPS = new Set(['NEG','INC','DEC'])
```

### Element Cache (EL)

All hot-path DOM elements are cached at init in the `EL` object to avoid repeated `getElementById` calls:

```javascript
EL.tickDisplay, EL.ledClock, EL.ledRun, EL.ledBus, EL.ledInj
EL.perfDisp, EL.memAddrDisp, EL.speedLabel, EL.speedInput, EL.speedSlider
EL.ctxBusa, EL.ctxBusb, EL.ctxBusc, EL.ctxBusd, EL.ctxBuse
// Plus ALU bit elements, flag elements, PM elements (aluInitBitEls, etc.)
```

### Dirty Flags

- `_aluDirty` — set when ALU state changes; `aluUpdateDisplay()` skips DOM writes if false
- `_memDirty` — same for memory
- `_ctrLastVal` — per-counter last-displayed value; `ctrUpdateDisplay()` skips if unchanged
- `updateDetail()` — word-hash dirty skip: skips all DOM writes if word at R dot unchanged

---

## 20. Performance Optimizations

Applied in v.157–v.158. Key changes:

### renderAll Throttling (v.157)

`renderAll()` was previously called every rAF frame (~60fps) regardless of tick state. Now only renders when:
1. A tick actually fired this frame (`_ticked = true`), OR
2. Any flash value is still > 0 (to animate glow decay)

At 1 Hz clock this drops render calls from ~60/sec to ~1–3/sec.

### Snapshot Eliminated (v.158)

`captureSnapshot()` was spreading 1200+ array elements into a new object every tick. At 144 Hz this was ~172,000 array copies/second. Eliminated entirely (feature was already dead).

### Set/Map Lookups (v.157)

Replaced all `DEFS.find(d=>d.id===id)`, `[...].includes()` array literal allocations in hot paths with `DEF_BY_ID[id]` object lookup and `LOOP_IDS_SET.has()` Set membership checks — O(1) vs O(n) with no allocation.

### Counter Display Dirty Skip (v.157)

`ctrUpdateDisplay()` skips DOM write if displayed value hasn't changed since last call.

### Word Count in drawLoop (v.157)

`lp.bits.reduce()` (allocation + traversal) replaced with simple for-loop counter.

### Cached getContext() (v.135)

Canvas 2D contexts cached via `getCtx()` helper. Bus slot drawing batched into grouped path calls.

---

## 21. Division of Labor

**Shea Gunther designs everything.** All architectural decisions, feature specifications, philosophical framework, challenge design, UI layout, and the 14 tenets originate with Shea.

**Claude AI writes all code and documentation.** This includes the HTML/CSS/JS simulator, this document, the user manual, and the changelog.

This arrangement is transparent and intentional. The preface of the Loop 2.1 Complete Record explains it directly: AI enables building a working prototype of a complex idea without the $15,000 cost of professional development. The plan is to commission a human engineer to write a clean, secure, maintainable version if the project proves itself.

### Session Structure

Development happens in Claude conversations that grow until context fills, then hand off to new sessions. Each session begins by reading the project state documents and recent changelog. The active working file is always `/home/claude/v122.html` (kept at this name for historical reasons — it was the working file name from the first tracked session).

---

## 22. Planned / Pending Work

### Immediate (Challenge Module Expansion)

The challenge module is designed to be extensible. Currently only "Add X Numbers" is implemented. The architecture supports:
- Multiply two numbers (return product)
- Sort N values (return in ascending order)
- Sum a list (same as current but framed differently)
- Odd One Out (nine values follow a pattern, one doesn't)
- Every Nth Value (extract every Nth from a stream)
- Apply to All (apply an operation to each value)
- Filter a String (return values matching a criterion)

All of these were implemented in v.138, removed in v.140 to simplify, and the infrastructure is ready to re-add them once the base challenge is fully stable.

### Networking (Bus E → Network Mode)

The Bus E external interface is designed to support peer-to-peer networking between multiple simulator instances. Planned:
- WebRTC peer-to-peer connections (no server after handshake)
- Session negotiation via copy/paste text blob
- 4-bit network addressing (up to 16 machines per network, top 4 bits b15–b12)
- Broadcast address: 1111 (reserved)
- Competitive formats: 1v1 duels, 2v2 relay, Missile Command battle mode

### Competitive/Educational Formats

Discussed but not implemented:
- Referee machine concept (fires values to multiple machines simultaneously)
- Health display (visual indicator when queue is backing up)
- Scoreboard / leaderboard infrastructure
- Tournament bracket support

### Community Infrastructure

- `loop2.computer` domain (registered, not live)
- Variant registration system (planned: no-fee registration requiring visible Loop 2.x branding, backlinks, public variant specs)
- Challenge submission via physical mail (PO Box, QR code + video)
- Forum (Discourse-style recommended over Discord for knowledge permanence)

### Replay Viewer

`loop2-replay-viewer.html` exists as a standalone tool. It has full visual parity with the simulator, playback controls (step, play/pause, speed, seek), drag-and-drop `.loop` file loading, and a baked-in "Add Two Numbers" demo. The replay engine parses `.loop` files into SPEC/INIT/OPS/FINAL sections and uses checkpoints every 40 events for efficient backward stepping.

### Physical Implementation (Long-Term)

- Coffee table form factor: 36"×48", glass top, LED strips, ESP32/Arduino
- Room-scale installation ("The Computing Grounds"): basement-sized landscape where data flows like trains, pattern matcher as volcano, ALU as steampunk foundry, etc. Estimated $50–350k.

---

## 23. Key Design Decisions & Rationale

### Why 17-Bit Words (1 marker + 16 data)?

- Marker bit is essential: distinguishes data from empty space in loops
- 16 data bits = 0–65535, full 16-bit range, meaningful computation
- Top 4 bits serve dual purpose as 4-bit memory address (0–15) in address-read mode
- Previous spec used 12-bit (1+11), migrated in v.122–v.124

### Why Circular Loops Instead of Arrays?

- Visual metaphor: data goes around, comes back
- Natural for streaming
- Enables pattern matching at inspection points
- Persistence: data stays until ejected
- Forces different thinking about memory access (which is the point)

### Why 1 Hz Default?

- Human-observable speed
- Can pause, inspect mid-computation
- Meditative — watching computation unfold
- Educational — time to understand each step
- Debugging intuitive — see where things break

### Why No Stored Program?

- Forces understanding — can't use without knowing how
- Preserves agency — human always in control
- Educational — learn by doing
- Performance art — computation as deliberate act

### Why Five Buses?

Bus D (amber) was added to enable the mega-loop configuration: Working→ALU→Memory→Big→Working, routing all four buses simultaneously to create a single continuous data pathway. The 14 tenets include that buses are programmable structures — routing IS part of the computation. Four buses make this philosophy concrete in a new way.

### Why BUS_N=24?

One full 17-bit word plus 4-bit padding on each side. Enough to see a complete word in transit on the canvas strip.

### Bus E as Dual Channel

Outbound (loop→external) and inbound (external→loop) are independent channels on the same physical strip. Using `globalCompositeOperation='screen'` allows them to visually overlap when both are active without one obscuring the other.

### Step-Back Removal

The step-back feature (one-level undo) was implemented but removed from the UI at some point before tracking began. The underlying `captureSnapshot()` code remained, running every tick and spreading ~1200+ array elements into a new heap object. At high clock speeds this was significant GC pressure. Removed in v.158 with zero functional impact.

### Score Formula Design

The challenge scoring weights: real wall-clock time (×4 points/sec), operator actions (×12 per action), and speed bonus (up to +100 for sub-50 second solves). Floor of 50 for any correct answer. Rationale: time penalty rewards machine mastery (running at higher Hz), op penalty rewards clean minimal routing, speed bonus rewards both. An expert 15-second 6-action solve scores ~938; a learning 90-second 18-action solve scores ~424.

---

## 24. File Locations

### Active Working Files

| File | Location | Description |
|------|----------|-------------|
| Simulator (working copy) | `/home/claude/v122.html` | Current active build |
| Simulator (latest output) | `/mnt/user-data/outputs/loop2-stage2.html` | Latest delivered version |
| Versioned deliveries | `/mnt/user-data/outputs/loop2-stage2 (NNN).html` | Each build numbered |
| Changelog | `/mnt/user-data/outputs/loop2_changelog.md` | Full version history |
| This document | `/mnt/user-data/outputs/Loop_2_1_Project_State_March_2026.md` | Current state doc |
| Replay Viewer | `/mnt/user-data/outputs/loop2-replay-viewer.html` | Standalone replay tool |

### Project Documentation (Read-Only)

| File | Location | Description |
|------|----------|-------------|
| Loop 2.0 Complete Documentation | `/mnt/project/Loop_2_0_Complete_Documentation.md` | Full Loop 2.0 spec |
| Loop 2.1 Complete Record (docx) | `/mnt/project/Loop_2_1___Complete_Record.docx` | Development history + user manual |

### Transcripts

Previous session transcripts: `/mnt/transcripts/`  
Journal/catalog: `/mnt/transcripts/journal.txt`

---

## Appendix A: Build Version Summary

| Build Range | Key Changes |
|-------------|-------------|
| pre-v.94 | Pre-tracking era |
| v.94–v.115 | R/G/W head architecture, RNG, Bus C+D, counter system, pattern matcher cooldown fix, memory address-read mode |
| v.116 | Speed slider minimum raised to 0.50 Hz |
| v.117–v.121 | Bus equalization, sidebar panel reorder, bus C/D defaults |
| v.122–v.124 | **Major: 17-bit word architecture migration** (BPW 12→17) |
| v.125–v.131 | Lever sizing, counter uncap, ALU mode, loop size revision, PM head position, BUS_N reduction |
| v.132–v.133 | Clock accuracy display |
| v.134–v.135 | Performance optimization rounds 1+2 |
| v.136–v.137 | Bus E added |
| v.138–v.143 | Challenge module (built, debugged, simplified), sidebar reorder, Bus E fixes |
| v.144–v.151 | Challenge module bugs fixed, Bus E routing, scoring, N-values challenge |
| v.152–v.154 | "Challenges" rename, Batch Write fix (16 slots), speed to 144Hz, Kilroy easter egg |
| v.155–v.156 | Drag-to-set toggle behavior, speed slider+input combined |
| v.157 | Performance optimization: renderAll throttle, LOOP_IDS_SET, DEF_BY_ID, dirty flags |
| v.158 | Step-back/snapshot code fully removed |

**Current build: v.158**  
**Next delivery must be: v.159**

---

## Appendix B: Operator Persona

The simulator uses the handle "Sheaman" for Shea Gunther in session logs. The operator handle field accepts any text up to 24 characters.

---

## Appendix C: Three Audience Segments

Identified through development discussions:

1. **Pedagogy-focused learners** — students who need to see computation before they can reason about it. Loop 2.1 makes the abstract concrete. The machine teaches by making you do it.

2. **Precision-oriented personality types** — people deeply satisfied by procedures that punish sloppiness and reward mastery. The machine's demands are exactly the appeal.

3. **Streamers and speedrunners** — for whom a fully visible machine state and a procedure requiring perfection is not a liability but the entire draw. "You might have accidentally built an esport for people who find normal esports too chaotic." A niche but real audience — thousands of the right people, not millions.

---

*End of document.*  
*Loop 2.1 · loop2.computer · "The Operator Is the Program"*
