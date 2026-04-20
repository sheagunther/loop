::: page-header
<div>

::: logo
LOOP 2.1
:::

::: logo-sub
Manual Flow Computer · loop2.computer
:::

</div>

::: header-right
::: skin-group
[Skin]{style="font-family:var(--font);font-size:8px;letter-spacing:2px;color:var(--fg-dim);text-transform:uppercase;margin-right:3px;"}

OG

Winamp

Sunrise
:::

::: doc-title
::: title-main
Complete Knowledge Pack
:::

::: build-tag
v1 · Verified against build v.331 · April 2026
:::
:::
:::
:::

::: body-wrap
::: toc-title
Contents
:::

-   [About This Document](#ch-abstract)
-   [1 · What L21 Is](#ch-what)
-   [2 · The Eight Tenets](#ch-tenets)
-   [3 · Architecture Overview](#ch-arch)
-   [4 · Data Model](#ch-data)
-   [5 · The Four Loops](#ch-loops)
-   [6 · The Tick Engine](#ch-tick)
-   [7 · The Nine Buses](#ch-buses)
-   [8 · The ALU](#ch-alu)
-   [9 · The Memory System](#ch-memory)
-   [10 · Big Loop Peripherals](#ch-big)
-   [11 · Working Scratch Registers](#ch-wscr)
-   [12 · Counter System](#ch-ctr)
-   [13 · Inject Channel & Switches](#ch-inj)
-   [14 · Clock & Timing](#ch-clock)
-   [15 · Keyboard System](#ch-keyboard)
-   [16 · Challenge System](#ch-challenges)
-   [17 · Networking](#ch-networking)
-   [18 · Session Logger & Stats](#ch-logger)
-   [19 · Skins](#ch-skins)
-   [20 · File System](#ch-files)
-   [21 · Annotation System](#ch-annotation)
-   [22 · State Namespace (L21)](#ch-state)
-   [23 · Implementation Notes](#ch-impl)

::: {.content role="main"}
::: {#ch-abstract .abstract-box}
::: abstract-label
About This Document
:::

This is the complete technical knowledge pack for Loop 2.1 (L21), a browser-based manual flow computer built by Shea Gunther. All content is verified against the actual application source: build v.331 (18,899 lines of vanilla HTML/JS/CSS). Where guides and spec documents conflict with the running source, the source wins.

The audience is anyone who needs complete operational or implementation knowledge of L21: human operators, AI coding assistants working on the codebase, AI systems reasoning about L21\'s design, researchers, and technical reviewers. Operator-facing content explains what the machine does and how to use it. Programmer-facing content explains how the code implements it.

**This document supersedes all older guides for factual accuracy.** Older documents (loop21-manual, field-guide, technical-reference, etc.) may contain outdated counts, descriptions, or feature states. When in doubt, the source file and this document are authoritative.
:::

::: {#ch-what .chapter}
::: chapter-number
Section 1
:::

::: chapter-title
What Loop 2.1 Is
:::

Loop 2.1 is a **manual flow computer simulator**. It runs entirely in a browser --- a single HTML file with no server, no build step, no external dependencies beyond Google STUN servers for WebRTC peer connections. You open it and it works.

The machine stores data in **circular bit-array loops**. Data circulates continuously, passing fixed read/gate/write head positions on every rotation. The operator routes data between loops using configurable buses, triggers arithmetic operations on the ALU, manages memory slot contents, and uses Big Loop peripherals to filter streams. There is no stored program. There is no automatic branching. The operator makes every decision in real time.

The project originated as a Minecraft redstone computer --- first a small 5-bit-word machine, then a larger four-loop build (roughly 96×96 blocks, glass floor so you could watch signals travel). A Mandelbrot pixel took six hours in Minecraft. The browser simulator followed. Build v.331 represents the mature form of that design.

::: {.callout .note}
::: callout-label
Origin
:::

Loop 2.1 was built across 331 sessions between Shea Gunther and Claude (Anthropic), each session starting from a structured handoff document. The methodology for managing those sessions became Loop MMT™.
:::

::: {#ch-what-tagline .section}
::: section-title
The Core Claim
:::

The tagline is *\"The Operator Is the Program.\"* This is literal, not metaphorical. The machine has no autonomy. Flags inform the operator; they do not trigger action. Buses do not activate until the operator turns them on. ALU results sit idle until the operator writes them back. Nothing moves or changes without an explicit operator action.

This makes the machine a tool for building genuine computational understanding. You cannot misunderstand what a bus transfer is when you have to authorize every word it carries. You cannot be fuzzy about what an ALU flag means when deciding what to route next based on it.
:::
:::

::: {#ch-tenets .chapter}
::: chapter-number
Section 2
:::

::: chapter-title
The Eight Tenets
:::

These eight tenets are embedded in the application source and define what L21 is. They are design constraints, not aspirations.

  \#      Tenet                            What it means
  ------- -------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **1**   The Operator Is the Program      No stored program exists. The human makes all routing, operational, and control-flow decisions in real time. The operator participates throughout execution --- not just at setup.
  **2**   Explicit State, No Black Boxes   All data is visible at all times. All operations are observable. Nothing happens invisibly. Every effect has a traceable cause.
  **3**   Data as Physical Entity          Data has position, velocity, and trajectory. It moves at observable speeds, one bit per tick. It is conserved --- it does not appear or disappear. Moving data costs time, and that cost is always visible.
  **4**   Circular Storage                 Memory is circular, not indexed. Data flows past read points continuously. There is no absolute start or end --- only circulation. This demands cyclical thinking rather than linear thinking.
  **5**   Manual Flow                      The operator routes all data and triggers all operations. Flags inform the operator; they do not control execution. No automatic branching occurs.
  **6**   Bus as Programmable Structure    Buses connect components explicitly. Routing is configurable by the operator. Data paths are part of the computation, not infrastructure beneath it.
  **7**   Computation as Craft             Quality over speed. Understanding over efficiency. The operator is an artisan, not a user. Progress is measured by elegance --- minimal waste, clear workflow, clean choreography of data movement.
  **8**   Operator-Scale Timing            The clock runs at human-observable speeds. The recommended operating speed is 24 Hz --- fast enough to feel like real-time computation, slow enough to follow the data. Time is a resource for learning and for craft.
:::

::: {#ch-arch .chapter}
::: chapter-number
Section 3
:::

::: chapter-title
Architecture Overview
:::

L21 is a single HTML file (\~858 KB, \~18,900 lines). It runs in any modern browser. There are no external JavaScript dependencies. WebRTC peer connections use Google\'s public STUN servers. Everything else is self-contained.

::: section
::: section-title
The Machine at a Glance
:::

  Component                  Description
  -------------------------- ---------------------------------------------------------------------------------------
  **4 Loops**                Circular bit arrays: Working (18 words), ALU (24), Memory (24), Big (48)
  **9 Buses**                A--D unidirectional; E dual-channel external; F--G P2P WebRTC; H--I net-routable
  **ALU**                    4 input registers (A--D), 1 result register, 17 operations, comparator
  **Memory**                 16 addressable 16-bit slots on the Memory Loop
  **Big Loop Peripherals**   PM1, PM2 (pattern matchers); TG1, TG2 (threshold gates); cascade-capable
  **WSCR**                   4 Working Scratch Register slots --- fast temp storage on the Working Loop
  **Counters**               Per-loop counters (Working, ALU, Memory, Big) + global counter; configurable triggers
  **Inject Channel**         17-slot shift register feeding the Working Loop write head
  **Input Switches**         16 toggle bits; readable as a 16-bit unsigned value for injection
  **Networking**             WebRTC P2P; named virtual networks; hub election; chain challenges
  **Challenge System**       10 built-in + 1 club challenge; custom challenge API; CBX network protocol
  **Session Logger**         Records every tick to a structured .loop file format
  **Skins**                  OG (blue-grey), Winamp (dark/green phosphor), Sunrise (warm/amber)
  **File System**            .l21 snapshot save/restore; file-save bus destination
  **Annotation System**      Optional note-taking producing raw .loop + polished Loopscript output
:::

::: section
::: section-title
Technical Stack
:::

-   Vanilla JavaScript --- no framework, no npm, no build step
-   Web Audio API --- sound notifications and feedback tones
-   WebRTC (via PeerJS) --- networked bus connections between operators
-   File System Access API --- .loopscript and .l21 file writing
-   DOM-based rendering --- canvas overlays for loop visualization
-   Single synchronous tick engine driven by `setInterval`
:::
:::

::: {#ch-data .chapter}
::: chapter-number
Section 4
:::

::: chapter-title
Data Model
:::

::: section
::: section-title
Words and Bits
:::

The fundamental unit of data is a **word**: 17 bits (`BPW = 17`). The first bit is a **marker bit** (always 1 for a valid word). The remaining 16 bits are data, representing an unsigned integer from 0 to 65535.

Words travel through loops as serial bit streams. A word is not a discrete object --- it is a pattern of 17 consecutive bits, identifiable by the marker bit at its leading edge. The machine tracks words by detecting marker bits at the read head.
:::

::: section
::: section-title
Word Capacity and Loop Size
:::

Each loop is a flat JavaScript array of bits. Its total length is `wordCap × BPW`. A loop with capacity 18 words has 306 bits; capacity 48 has 816 bits. Bit array indices start at 0. Head positions are fixed:

  Head            Index       Function
  --------------- ----------- ------------------------------------------------------------------------------------------
  **R (Read)**    `bits[2]`   Where buses and the ALU sample data. Sampled before gate and rotate phases.
  **G (Gate)**    `bits[1]`   If loop gate is CLOSED, this bit is zeroed each tick. Positioned between read and write.
  **W (Write)**   `bits[0]`   Where buses and inject deliver new bits. Written after rotate.

::: {.callout .key}
::: callout-label
Critical Mechanic
:::

**R=bits\[2\], G=bits\[1\], W=bits\[0\] are fixed for all loops** --- they do not change based on headPos. The `headPos` property (\'top\') controls only which edge the visual bracket renders on, not the bit indices.
:::
:::

::: section
::: section-title
Rotation Direction
:::

Each tick, unpaused loops rotate via `bits.push(bits.shift())`. This moves bits from index 0 to index N-1 --- i.e., bits flow **high-index to low-index**. A bit written at W (bits\[0\]) takes N-2 ticks to reach R (bits\[2\]), traveling through the full loop length minus the head gap.

For Working (18 words = 306 bits): a bit written at W=bits\[0\] takes 304 ticks to reach R=bits\[2\].
:::

::: section
::: section-title
Value Encoding
:::

Data bits are stored MSB-first after the marker. To encode a 16-bit value: push 1 (marker), then bits 15 down to 0. To decode: read bits\[1\] through bits\[16\] and reconstruct MSB-first. This encoding is consistent across buses, inject, ALU writeback, memory writeback, and WSCR writeback.
:::
:::

::: {#ch-loops .chapter}
::: chapter-number
Section 5
:::

::: chapter-title
The Four Loops
:::

  Loop          ID          Capacity   Total Bits   Color                   Role
  ------------- ----------- ---------- ------------ ----------------------- -------------------------------------------------------------------------------------------------------------------------------
  **Working**   `working`   18 words   306          [blue]{.tag .working}   Operator\'s primary workspace. Inject channel feeds here. WSCR captures from here. Most operations start and end here.
  **ALU**       `alu`       24 words   408          [amber]{.tag .alu}      ALU input/output loop. Words routed here are captured into ALU registers. ALU and comparator results are written back here.
  **Memory**    `memory`    24 words   408          [green]{.tag .memory}   Addressable slot storage. Words circulating here can be captured into any of 16 named slots. Slots write back into this loop.
  **Big**       `big`       48 words   816          [cyan]{.tag .big}       High-capacity loop with filter peripherals. PM1, PM2, TG1, TG2 tap into this loop at fixed positions.

::: {.callout .note}
::: callout-label
Init State
:::

All four loops start empty (`fill: 0` in DEFS). No random data. The operator must inject values to work with them.
:::

::: section
::: section-title
Per-Loop State
:::

Each loop object has: `def` (the DEFS entry), `bits` (the bit array), `flash` (visual pulse decay float), `lastWord` (the most recent complete word seen at the R head), `gateOpen` (boolean, default true), `paused` (boolean, default false).

**Gate open** means data passes through bits\[1\] unmodified. **Gate closed** means bits\[1\] is zeroed each tick --- data arriving at the gate position is destroyed. This is used to drain loops or control data flow.

**Paused** means the loop does not rotate. Its bits stay frozen. Buses can still deliver to a paused loop\'s W head; the delivered bit just won\'t propagate until unpaused.
:::
:::

::: {#ch-tick .chapter}
::: chapter-number
Section 6
:::

::: chapter-title
The Tick Engine
:::

The simulation runs in discrete ticks. One tick = one complete pass through all simulation phases. Every component advances exactly one step per tick. The tick engine is synchronous --- all phases complete before the next frame.

::: section
::: section-title
Tick Phases (in order)
:::

  Phase          Function                                What happens
  -------------- --------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Preamble**   `tickPreamble()`                        Auto-writeback fires for any pending ALU answer. Clock accuracy sample recorded. Logger tick logged. Tick counter incremented. Global counter updated. Op-count halt check for global counter.
  **Sample**     `tickSampleBusSources()`                Read the current bit at each active bus\'s source before anything rotates. Returns a `sources` object with one bit per bus (A--I).
  **Read**       `tickReadPhase()`                       Update each loop\'s `lastWord` from its R head. Run Memory slot capture. Run ALU capture pipeline. Advance inject channel one slot; return the exit bit.
  **Gate**       `tickGatePhase()`                       For every loop with `gateOpen = false`: zero bits\[1\]. Destroys whatever is at the gate position.
  **Rotate**     `tickRotatePhase()`                     For every loop that is not paused and not op-count halted: `bits.push(bits.shift())`. All loops rotate in lockstep.
  **Write**      `tickWritePhase(sources, injExitBit)`   Deliver sampled bits to bus destinations. Drain counter queues to buses. Run PM1, PM2, TG1, TG2 ticks and bridge advances. Advance Memory writeback pipeline. Advance comparator writeback. Advance ALU writeback. Advance WSCR writeback. Deliver inject exit bit to Working W head. Run dual-channel bus ticks (E--I).

::: {.callout .warn}
::: callout-label
Order Matters
:::

Buses sample their source *before* rotation and deliver *after* rotation. This means a bit read at a loop\'s R head this tick appears at the bus destination\'s W head this same tick --- it traveled in one tick. However, the receiving loop still needs to rotate that bit from W to R, which takes full-loop-length ticks.
:::
:::

::: section
::: section-title
Single-Step Mode
:::

The operator can advance the machine one tick at a time via [.]{.kbd} (Period key) or the STEP button. This is the same tick engine --- same phases, same order --- just called once instead of continuously. Used for careful inspection of data positions.
:::

::: section
::: section-title
Constants
:::

  Constant                Value           Meaning
  ----------------------- --------------- -----------------------------------------------------------------------------------
  `BPW`                   17              Bits per word: 1 marker + 16 data
  `BUS_N`                 24              Bus shift register length (word + 4-bit padding each side)
  `INJ_N`                 17              Inject channel length (slots)
  `MAX_TICK_COUNT`        1,000,000,000   Tick counter wraps at this value
  `MAX_TICKS_PER_FRAME`   8               Cap catch-up ticks per animation frame (prevents runaway after tab backgrounding)
:::
:::

::: {#ch-buses .chapter}
::: chapter-number
Section 7
:::

::: chapter-title
The Nine Buses
:::

Buses copy bits from a source to a destination at one bit per tick. A word transfer takes BPW = 17 ticks (1 marker + 16 data bits). Buses do not modify data. They are purely transport.

::: section
::: section-title
Bus Type Overview
:::

  Bus         ID    Type               Default Src → Dst           Notes
  ----------- ----- ------------------ --------------------------- ------------------------------------------------------------------------------------
  **Bus A**   `a`   Unidirectional     Working → ALU               Primary bus for sending data to ALU. Can be reconfigured.
  **Bus B**   `b`   Unidirectional     Working → Memory            Primary bus for sending data to Memory loop.
  **Bus C**   `c`   Unidirectional     Working → Big               Primary bus for sending data to Big loop.
  **Bus D**   `d`   Unidirectional     Working → Challenge         Default destination is challenge system; configurable.
  **Bus E**   `e`   Dual-channel       External (challenge/file)   Bidirectional with external endpoint. Challenge system uses E for answer delivery.
  **Bus F**   `f`   Dual-channel P2P   Working ↔ Working           Left P2P WebRTC connection to neighboring machine.
  **Bus G**   `g`   Dual-channel P2P   Working ↔ Working           Right P2P WebRTC connection to neighboring machine.
  **Bus H**   `h`   Dual-channel Net   Working ↔ Working           Network-routable bus (Net0). Targets a specific peer by machine ID.
  **Bus I**   `i`   Dual-channel Net   Working ↔ Working           Network-routable bus (Net1). Targets a specific peer by machine ID.
:::

::: section
::: section-title
Unidirectional Buses (A--D): How They Work
:::

Each unidirectional bus has a `bits` array (BUS_N=24 elements), a source, a destination, an active flag, and transfer tracking. When active, it samples the source\'s R-head bit each tick and delivers the previous cycle\'s sampled bit to the destination\'s W-head.

Bus source can be any loop, PM1, PM2, PM2·Match, PM2·Reject, TG1, TG2, TG2·Match, TG2·Reject, or a counter output. Bus destination can be any loop, the challenge system, or file-save.

::: {.callout .tip}
::: callout-label
Counter Capture
:::

Buses A--D can also serve as counter capture destinations. When a counter\'s output is routed to a bus, the counter value is serialized as a 17-bit word and injected into the bus stream. This lets counter values be delivered to any loop.
:::
:::

::: section
::: section-title
Dual-Channel Buses (E--I): How They Work
:::

Dual-channel buses carry data in both directions simultaneously: `outBits` (outgoing) and `inBits` (incoming). They buffer words in `wordBuf` and queue inbound deliveries via `inQueue`.

For P2P buses (F, G), word assembly happens over 17 ticks before sending over the network connection. Incoming words are queued and delivered one bit per tick to the destination loop\'s W-head. Buses H and I additionally specify a `peerTarget` (machine ID) for routing over virtual networks.
:::

::: section
::: section-title
Valid Endpoints (Source / Destination)
:::

  Endpoint ID           As Source   As Destination   Description
  --------------------- ----------- ---------------- ----------------------------------
  `working`             ✓           ✓                Working Loop R/W head
  `alu`                 ✓           ✓                ALU Loop R/W head
  `memory`              ✓           ✓                Memory Loop R/W head
  `big`                 ✓           ✓                Big Loop R/W head
  `pm1`                 ✓           ---              PM1 bridge output
  `pm2`                 ✓           ---              PM2 bridge output (standard)
  `pm2match`            ✓           ---              PM2 match output (cascade mode)
  `pm2reject`           ✓           ---              PM2 reject output (cascade mode)
  `tg1`                 ✓           ---              TG1 bridge output
  `tg2`                 ✓           ---              TG2 bridge output (standard)
  `tg2match`            ✓           ---              TG2 match output (cascade mode)
  `tg2reject`           ✓           ---              TG2 reject output (cascade mode)
  `ext`                 ✓           ✓                External bus E inbound buffer
  `challenge`           ---         ✓                Challenge system answer receiver
  `file-save`           ---         ✓                File save stream receiver
  `ctr-working`, etc.   ✓           ---              Counter output drain sources
:::

::: section
::: section-title
Bus Toggle and Configuration
:::

Each bus has an active/inactive state. When inactive, the bus does nothing even if source and destination are configured. Toggling a bus on starts transfers; toggling off stops them. The operator can change source and destination while a bus is active --- this takes effect on the next sample.

Bus A--D can be configured via the keyboard chord system: press the bus digit (1--4) to enter chord mode, then a source key, then a destination key (see Section 15).
:::
:::

::: {#ch-alu .chapter}
::: chapter-number
Section 8
:::

::: chapter-title
The ALU
:::

The ALU (Arithmetic Logic Unit) captures words from the ALU Loop into up to four registers, operates on them, and writes results back into the ALU Loop. It is not automatic --- the operator configures which register captures the next word, selects the operation, and manually triggers writeback (or enables auto-writeback).

::: section
::: section-title
Registers
:::

  Register     ID             Role
  ------------ -------------- --------------------------------------------------------------------------
  **Reg A**    `alu.a`        Primary input operand (default Operand A source)
  **Reg B**    `alu.b`        Secondary input operand (default Operand B source)
  **Reg C**    `alu.c`        Auxiliary input register (can be reassigned as Op A or B source)
  **Reg D**    `alu.d`        Auxiliary input register (can be reassigned as Op A or B source)
  **Result**   `alu.result`   Output of the selected operation. Cannot capture; is written by compute.

Any register can be null (empty). If the Op A source register is null, result is also null and no computation occurs. If Op B source is null, it is treated as 0.
:::

::: section
::: section-title
Operand Source Selection
:::

The operator can independently assign **Operand A source** and **Operand B source** to any of the four registers (a, b, c, d). This means you can compute C--D, A+C, B XOR D, etc. --- not just A op B. Changing the operand source triggers immediate recompute.
:::

::: section
::: section-title
Operations (17 total)
:::

  Op       Type         Description                                       Flags set
  -------- ------------ ------------------------------------------------- --------------------------------
  `ADD`    Arithmetic   A + B                                             Z, C (carry), V (overflow), S
  `SUB`    Arithmetic   A − B                                             Z, C (borrow), V (overflow), S
  `AND`    Bitwise      A AND B                                           Z, S
  `OR`     Bitwise      A OR B                                            Z, S
  `XOR`    Bitwise      A XOR B                                           Z, S
  `NOT`    Unary        \~A (bitwise complement)                          Z, S
  `SHL`    Shift        A left-shift 1; MSB → carry                       Z, C, S
  `SHR`    Shift        A right-shift 1; LSB → carry                      Z, C, S
  `NEG`    Unary        Two\'s complement negation (\~A+1)                Z, C, V, S
  `INC`    Unary        A + 1                                             Z, C, V, S
  `DEC`    Unary        A − 1                                             Z, C, V, S
  `MOD`    Arithmetic   A mod B; carry set if B=0                         Z, C
  `ROR`    Shift        Rotate right 1 through carry                      Z, C, S
  `ABS`    Unary        Absolute value; carry set if input was negative   Z, C, V, S
  `NAND`   Bitwise      \~(A AND B)                                       Z, S
  `NOR`    Bitwise      \~(A OR B)                                        Z, S
  `XNOR`   Bitwise      \~(A XOR B)                                       Z, S

::: {.callout .note}
::: callout-label
Keyboard cycle
:::

The [V]{.kbd} key cycles forward through 11 ops: ADD, SUB, AND, OR, XOR, NOT, SHL, SHR, NEG, INC, DEC. MOD, ROR, ABS, NAND, NOR, XNOR are accessible only via click in the UI.
:::
:::

::: section
::: section-title
ALU Flags
:::

  Flag       Symbol   Meaning
  ---------- -------- ------------------------------------------------------------------
  Zero       Z        Result data bits are all 0
  Carry      C        Carry out of MSB (or borrow, or shift-out bit)
  Overflow   V        Signed arithmetic overflow (sign bit changed unexpectedly)
  Sign       S        MSB of result is 1 (result is negative if interpreted as signed)
  Parity     P        Number of set bits in result is even
:::

::: section
::: section-title
ALU Modes
:::

**16-bit mode** (default): Full 16-bit arithmetic on all bits. Data range 0--65535.

**12-bit mode** (toggle with MODE button): Top 4 bits of operands are masked to 0 before computing. Data range 0--4095. Used when Memory addressing is in play and you want to avoid address bits contaminating arithmetic. Toggle via `toggleAluMode()`.
:::

::: section
::: section-title
Capture Route
:::

The capture route determines which register (`a`, `b`, `c`, or `d`, or null/OFF) captures the next complete word arriving at the ALU Loop\'s R head. Route is set via the ROUTE buttons or [C]{.kbd} key.

**Advance mode** (default): After each capture, route auto-advances: a→b→c→d→null. Useful for loading multiple values in sequence.

**Hold mode**: Route stays on the selected register after each capture. Toggle with HOLD/ADVANCE button. Useful when you want to keep overwriting the same register.

Capture is a pipeline: the ALU reads one bit per tick from the ALU Loop\'s R-head as the word passes. When all 17 bits are in, the value is committed to the register and `aluCompute()` is triggered.
:::

::: section
::: section-title
Writeback
:::

When the operator triggers writeback ([R]{.kbd} or SEND ANSWER button), the result register is serialized (17 bits, MSB-first) into `alu.wbBuf` and delivered one bit per tick to the ALU Loop\'s W head. This takes 17 ticks.

Individual registers can also be written back (SEND A, SEND B, etc.) without using the result register.

**Auto-writeback**: When enabled, the result register is automatically sent to the ALU Loop on the tick after each new computation. The pending flag (`_autoWbPending`) is set at compute time and consumed at the start of the next tick in the Preamble phase. If the machine is stopped, auto-writeback fires immediately.
:::

::: section
::: section-title
Comparator
:::

The comparator runs alongside the ALU using the same operand A and B sources. It computes six relational flags every time operands change:

  Flag   True when
  ------ --------------
  GT     Op A \> Op B
  LT     Op A \< Op B
  EQ     Op A = Op B
  GTE    Op A ≥ Op B
  LTE    Op A ≤ Op B
  NE     Op A ≠ Op B

These 6 flags are packed into a 16-bit word (bits 5--0, MSB first: GT LT EQ GTE LTE NE) and can be sent to the ALU Loop via the CMP SEND button ([Shift+R]{.kbd}). The operator reads these flags to decide routing --- comparator flags do not trigger any automatic action.
:::
:::

::: {#ch-memory .chapter}
::: chapter-number
Section 9
:::

::: chapter-title
The Memory System
:::

The Memory System provides 16 addressable 16-bit storage slots. Words circulating on the Memory Loop can be captured into slots; slots can be written back to the Memory Loop on demand. Slots persist until cleared or overwritten.

::: section
::: section-title
Slot Capture (Loop → Slot)
:::

When **Write-to-Slots** mode is active, words passing the Memory Loop\'s R head are captured into the currently addressed slot. Addressing is determined by the address bits, which can be set manually (4-bit address register, addressing slots 0--15) or read from the word itself.

**Address-from-word mode**: When `mem.addrRead` is true, the first 3 bits of the word (after the marker, bits 15--12 of the data) determine the destination slot. This allows words to carry their own destination address.

**Auto-increment mode**: When enabled, each captured word goes into the next slot in sequence, starting from `autoIncStart`. Useful for loading a stream of values into consecutive slots.

**Batch capture**: Multiple words can be queued for capture in a single batch operation.
:::

::: section
::: section-title
Slot Writeback (Slot → Loop)
:::

Any slot can be sent to the Memory Loop\'s W head via the SEND button. This serializes the 16-bit value as a 17-bit word (marker + MSB-first data) into `mem.wbBuf` and delivers it one bit per tick. Only one writeback can be active at a time.

**Batch write**: BATCH WRITE ALL sends all occupied slots to the Memory Loop in sequence, each chained after the previous writeback completes. [Shift+Z]{.kbd} triggers this.

**Destructive reads**: When destructive mode is on, a slot is cleared (set to null) after its writeback completes. This is a read-and-destroy operation.
:::

::: section
::: section-title
File Loading into Memory
:::

Binary files can be streamed into Memory slots via the file load mechanism. Each byte pair becomes a 16-bit word, filling slots in sequence. The `_fileLoadQueue`, `_fileLoadName`, `_fileLoadTotal`, and `_fileLoadSent` fields track active file loads. The `filesCheckPartialSave` and `filesOnSlotWriteComplete` functions chain the load pipeline with the writeback pipeline.
:::

::: section
::: section-title
Memory State Fields
:::

  Field            Type      Description
  ---------------- --------- ---------------------------------------------------------
  `writeToSlots`   bool      When true, words at Memory R-head are captured to slots
  `addrRead`       bool      When true, slot address is read from word bits 15--12
  `addrBits`       \[4\]     4-bit address register (addrBits\[0\]=b3 MSB)
  `slots`          \[16\]    16-element array of 16-bit values or null
  `capPos`         int       Capture pipeline position (−1 = idle)
  `capAddr`        int       Which slot is being captured into
  `wbPos`          int       Writeback pipeline position (−1 = idle)
  `wbBuf`          \[17\]    Writeback bit buffer
  `destructive`    bool      Clear slot after writeback if true
  `autoInc`        bool      Auto-increment slot address on each capture
  `autoIncStart`   int       Starting slot for auto-increment
  `batchQueue`     int\[\]   Slot indices queued for batch writeback
:::
:::

::: {#ch-big .chapter}
::: chapter-number
Section 10
:::

::: chapter-title
Big Loop Peripherals
:::

The Big Loop has four attached peripherals: two Pattern Matchers (PM1, PM2) and two Threshold Gates (TG1, TG2). Each peripheral taps into the Big Loop at a fixed bit position, inspects passing words, and ejects matching words into an output bridge. The bridge feeds into buses as a source endpoint.

::: section
::: section-title
Peripheral Positions on Big Loop
:::

Each peripheral is assigned a fixed eject index on the Big Loop\'s bit array. The active position depends on the current filter order:

  Filter Order             Position 1 (idx 359)   Position 2 (idx 342)   Position 3 (idx 325)   Position 4 (idx 308)
  ------------------------ ---------------------- ---------------------- ---------------------- ----------------------
  **pm_first** (default)   PM1                    PM2                    TG1                    TG2
  **tg_first**             TG1                    TG2                    PM1                    PM2

Filter order is toggled with the FILTER ORDER button. Positions are 17 bits (one word) apart, so each peripheral sees data one word ahead of the next.
:::

::: section
::: section-title
Pattern Matchers (PM1, PM2)
:::

Each pattern matcher has four 16-bit registers:

-   **Mask**: Selects which bits to inspect (1 = inspect, 0 = ignore)
-   **Match**: Expected values for the inspected bits
-   **Change Mask**: Which bits to rewrite on a match (0 = no rewrite)
-   **Change Value**: New values for bits where change mask is set

When a word passes the PM\'s eject position: compute `(word & mask) == (match & mask)`. If true, the word is a match. If change mask is nonzero, the matched bits are rewritten before ejection.

Matched words are placed in the output bridge (`pm.outBuf` → `pm.bridge[0]`) one bit per tick. The bridge is a single-bit register drained each tick. A bus with the PM as source reads this bridge.

**Destructive mode**: When on (OUTFLOW: DESTRUCTIVE), matched words are removed from the Big Loop (the eject position bits are zeroed). When off (OUTFLOW: COPY), a copy goes to the bridge but the word also continues circulating in the Big Loop.

Each PM tracks `matchFlag` (has a match occurred since last clear) and `matchCount` (total matches). These can be sent to a bus for counter-based operations.

**Enabled state**: A PM only runs if it has any mask bits set. A PM with all mask bits 0 does nothing (isPatternMatcherActiveGeneric returns false).
:::

::: section
::: section-title
PM2 Cascade Mode
:::

PM2 can run in cascade mode. In cascade mode, PM2 receives PM1\'s output instead of reading directly from the Big Loop. This means PM2 filters PM1\'s matches. PM2 has two output streams in cascade mode: `matchBridge` (words that also match PM2) and `rejectBridge` (words that matched PM1 but not PM2). These are separately available as bus sources `pm2match` and `pm2reject`.
:::

::: section
::: section-title
Threshold Gates (TG1, TG2)
:::

Each threshold gate inspects the 16-bit data value of words passing its position and compares them to a numeric threshold using a configurable comparison mode:

  Mode    Passes when
  ------- -------------------------
  `gt`    word value \> threshold
  `lt`    word value \< threshold
  `gte`   word value ≥ threshold
  `lte`   word value ≤ threshold
  `eq`    word value = threshold
  `ne`    word value ≠ threshold

TG also supports **clamping**: if a word doesn\'t match the threshold condition, instead of being discarded or passing through, its value is replaced with `clampValue` before continuing in the Big Loop.

Like PMs, TGs have destructive and copy modes. TG2 also supports cascade mode, with separate match and reject output bridges.
:::

::: section
::: section-title
Cooldown
:::

Both PM and TG have a `cooldown` field that prevents back-to-back ejection of the same word position during the 17-tick window of a word passing the eject position. This prevents partial-word ejections.
:::
:::

::: {#ch-wscr .chapter}
::: chapter-number
Section 11
:::

::: chapter-title
Working Scratch Registers (WSCR)
:::

The WSCR system provides 4 fast-access 16-bit storage slots attached to the Working Loop. Think of them as named variables that can snapshot the Working Loop and replay values back into it --- without the full roundtrip of Memory addressing.

::: section
::: section-title
Slots
:::

Slots 0--3 (`wscr.slots[0..3]`), each storing a 16-bit integer or null. All start null.
:::

::: section
::: section-title
Capture Mode
:::

When capture mode is on (`wscr.capture = true`), the WSCR system monitors the Working Loop\'s R head each tick. When a complete 17-bit word passes, its 16-bit data value is captured into the current capture address (`wscr.capAddr`). The capture address auto-increments 0→1→2→3→0 after each word.

Toggle capture with the CAPTURE button. The button label shows which slot will receive the next capture.

Capture respects the Working Loop\'s paused and op-count halted states. No capture occurs if the loop isn\'t running.
:::

::: section
::: section-title
Writeback (Slot → Working Loop)
:::

Each slot has its own writeback pipeline (`wscr.wbPos[s]`, `wscr.wbBuf[s]`). Sending a slot serializes its value as a 17-bit word and delivers one bit per tick to the Working Loop\'s W head. Multiple slots can write back concurrently (each has its own pipeline), though they share the W head --- only one bit per tick lands at W, so concurrent writes overwrite each other. In practice, write one at a time unless you understand the interleaving.
:::
:::

::: {#ch-ctr .chapter}
::: chapter-number
Section 12
:::

::: chapter-title
Counter System
:::

Each loop has a configurable event counter. There is also a global counter that is the sum of all four loop counters. Counters drive halting (operator count feature) and can be serialized to buses.

::: section
::: section-title
Trigger Events per Loop
:::

  Loop      Available triggers
  --------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------
  Working   wordWritten, wordRead, bitsWritten, bitsRead, fullCycle, scratchBitsWritten, scratchBitsRead, scratchWordWritten, scratchWordRead
  ALU       wordWritten, wordRead, bitsWritten, bitsRead, fullCycle, regSent, aluAnswerSent, cmpAnswerSent
  Memory    wordWritten, wordRead, bitsWritten, bitsRead, fullCycle, writeToSlot, readFromSlot
  Big       wordWritten, wordRead, bitsWritten, bitsRead, fullCycle, pm1Match, pm1Rewrite, pm1Eject, pm2Match, pm2Rewrite, pm2Eject, tg1Match, tg1Eject, tg2Match, tg2Eject

Each trigger can be individually enabled or disabled. When enabled, the counter increments by 1 each time the event fires on that loop.
:::

::: section
::: section-title
Global Counter
:::

`ctr.global.val` is computed each tick in the Preamble phase as the sum of all four loop counter values. It is not independently configurable --- it reflects total activity across all counters that are running.
:::

::: section
::: section-title
Operator Count (Halt on Match)
:::

The operator can set a target value and link any counter (or global) to it. When the linked counter reaches the target value, the corresponding loop(s) halt --- they stop rotating and stop accepting bus input. This is the primary mechanism for automated stopping: \"run until 8 words have been processed.\"

Halted loops are tracked in `opCount.halted`. Bus sampling skips halted loops (returns 0). Counter ticks skip halted loops.
:::

::: section
::: section-title
Counter Eject to Bus
:::

Counter values can be serialized into bus streams. When a counter source is configured as a bus source (e.g., `ctr-working`), the current counter value is encoded as a 16-bit word and injected into the bus stream. This lets the operator route counter values as data words into loops for further processing.

Counter eject uses four drain queues (outBufA, outBufB, outBufC, outBufD) corresponding to buses A--D.
:::
:::

::: {#ch-inj .chapter}
::: chapter-number
Section 13
:::

::: chapter-title
Inject Channel & Input Switches
:::

::: section
::: section-title
Input Switches
:::

Sixteen toggle levers (bits 15--0, left to right) form the operator\'s manual data entry panel. Each lever is a single bit. The 16 bits combine into a 16-bit unsigned integer. The current decimal and hex values display live as levers are toggled.

The top 4 switches (bits 15--12) are visually separated from the lower 12 --- a reminder that top bits often serve as address bits in Memory operations.

Switches can be cleared all at once with [Q]{.kbd}. Individual switches are toggled by clicking (or drag-to-set across multiple).
:::

::: section
::: section-title
Inject Channel
:::

Pressing INJECT ([E]{.kbd}) reads the 16 input switch bits, encodes them as a 17-bit word (marker + MSB-first data), and loads them into `inj.pending`. Each tick of the Read phase, one bit shifts from pending into the inject buffer array (INJ_N = 17 slots), and the exit bit feeds into the Working Loop\'s W head.

An inject takes 17 ticks to fully enter the inject channel, then another 304 ticks to travel through the Working Loop from W to R (for an 18-word loop: 306 − 2 = 304 ticks). **You cannot inject again until the channel is fully clear** --- attempting to inject while busy logs an error and does nothing.

The INJ LED illuminates while bits are in the channel. The INJECT button is disabled while busy.

**CBX inject**: The challenge system can also inject values directly via `injectValue(val)`, bypassing the input switches. Same channel, same mechanic.

[Shift+E]{.kbd} sends a random value (RNG send) to the Working Loop --- same mechanism as inject, but with a randomly-generated 16-bit value.
:::
:::

::: {#ch-clock .chapter}
::: chapter-number
Section 14
:::

::: chapter-title
Clock & Timing
:::

::: section
::: section-title
Clock State
:::

The clock is either running or stopped. [Space]{.kbd} toggles it. When running, `setInterval` fires the tick engine at the configured Hz rate. The master clock LED flashes on each tick.
:::

::: section
::: section-title
Speed Settings
:::

Range: 0.1 Hz to 144 Hz. Default: **1 Hz**. Recommended operating speed: 24 Hz.

Step ladder (accessible via [\[]{.kbd} and [\]]{.kbd} keys): 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 144 Hz. The slider allows any value in the full range.

At high speeds (32+ Hz), individual loop changes become difficult to follow visually. The machine is fully functional at 144 Hz but is intended for inspection at lower speeds.
:::

::: section
::: section-title
Clock Accuracy Tracking
:::

The clock tracks actual tick intervals using a rolling window of 16 samples (`CLOCK_ACCURACY_SAMPLE_COUNT = 16`). At high speeds or when the browser tab is backgrounded, the JavaScript timer drifts from the configured rate. A catch-up cap (`MAX_TICKS_PER_FRAME = 8`) prevents more than 8 ticks firing in a single animation frame after tab backgrounding.
:::

::: section
::: section-title
Tick Counter
:::

The global tick counter increments on every tick, wrapping at 1,000,000,000. Displayed as a 9-digit zero-padded number. Used by the challenge system for efficiency scoring and by the session logger for timeline reconstruction.
:::

::: section
::: section-title
Session Pause Tracking
:::

When the clock is stopped, `stats.pauseMs` accumulates the wall-clock milliseconds elapsed while stopped. This is used in challenge scoring to separate thinking time from active execution time.
:::
:::

::: {#ch-keyboard .chapter}
::: chapter-number
Section 15
:::

::: chapter-title
Keyboard System
:::

L21 has a rich keyboard control system with three layers: flat (single key), shift (Shift + key), and chord (bus routing sequences). All Ctrl/Alt/Meta combinations are ignored --- reserved for browser/OS. Keys do nothing if an input element is focused (except Escape to blur, and Enter in chat).

::: section
::: section-title
Flat Layer (no modifier)
:::

  Key              Action
  ---------------- --------------------------------------------------------------------------
  [Space]{.kbd}    Toggle master clock on/off
  [.]{.kbd}        Step one tick (single step mode)
  [\[]{.kbd}       Decrease clock speed one step
  [\]]{.kbd}       Increase clock speed one step
  [S]{.kbd}        Toggle Working Loop pause
  [D]{.kbd}        Toggle ALU Loop pause
  [F]{.kbd}        Toggle Memory Loop pause
  [G]{.kbd}        Toggle Big Loop pause
  [R]{.kbd}        Send ALU answer (result) to ALU Loop
  [V]{.kbd}        Cycle ALU operation forward (ADD→SUB→AND→OR→XOR→NOT→SHL→SHR→NEG→INC→DEC)
  [C]{.kbd}        Cycle capture route forward (OFF→A→B→C→D→OFF)
  [E]{.kbd}        Inject switch value into Working Loop
  [Q]{.kbd}        Clear all input switches
  [X]{.kbd}        Toggle write-to-slots mode (Memory capture)
  [Z]{.kbd}        Send current Memory slot to Memory Loop
  [T]{.kbd}        Open chat input (focus chat field)
  [N]{.kbd}        Start a new challenge (if no challenge active)
  [H]{.kbd}        Toggle challenge spoiler (if spoiler button visible)
  [Enter]{.kbd}    Release chain challenge value (CBX, if button enabled)
  [Escape]{.kbd}   Cancel active chord; blur focused input
:::

::: section
::: section-title
Shift Layer (Shift + key)
:::

  Key                                Action
  ---------------------------------- ---------------------------------------------
  [Shift+S]{.kbd}                    Toggle Working Loop gate (open/closed)
  [Shift+D]{.kbd}                    Toggle ALU Loop gate
  [Shift+F]{.kbd}                    Toggle Memory Loop gate
  [Shift+G]{.kbd}                    Toggle Big Loop gate
  [Shift+R]{.kbd}                    Send comparator flags word to ALU Loop
  [Shift+V]{.kbd}                    Cycle ALU operation backward
  [Shift+C]{.kbd}                    Cycle capture route backward
  [Shift+E]{.kbd}                    Send random value (RNG) to Working Loop
  [Shift+X]{.kbd}                    Toggle Memory auto-increment mode
  [Shift+Z]{.kbd}                    Batch write all Memory slots to Memory Loop
  [Shift+1]{.kbd}--[Shift+9]{.kbd}   Toggle bus A--I on/off
  [Shift+N]{.kbd}                    Abort active challenge
:::

::: section
::: section-title
Chord System (Bus Routing)
:::

Pressing [1]{.kbd}--[4]{.kbd} (without Shift) enters chord mode for bus A--D respectively. A status overlay appears at the bottom of the screen. Then:

1.  Press a source key (see chord target table below)
2.  Press a destination key
3.  Bus source and destination are reconfigured. Overlay confirms with ✓

The chord times out after 2000 ms of inactivity. Invalid source or destination shows ✗ and cancels the chord. Pressing the same bus digit twice rapidly (within 300 ms) toggles that bus on/off instead of entering chord mode.

  Key         Endpoint       Valid Source?   Valid Dest?
  ----------- -------------- --------------- -------------
  [W]{.kbd}   Working Loop   ✓               ✓
  [A]{.kbd}   ALU Loop       ✓               ✓
  [M]{.kbd}   Memory Loop    ✓               ✓
  [B]{.kbd}   Big Loop       ✓               ✓
  [P]{.kbd}   PM1 output     ✓               ---
  [T]{.kbd}   TG1 output     ✓               ---
  [K]{.kbd}   CTR·Global     ✓               ✓
  [F]{.kbd}   File Save      ---             ✓

::: {.callout .tip}
::: callout-label
Example chord
:::

**Route Bus A from ALU to Working:** Press [1]{.kbd} (chord Bus A), then [A]{.kbd} (source = ALU Loop), then [W]{.kbd} (dest = Working). Overlay shows \"BUS A: ALU → WORKING ✓\".
:::

Net buses E--I are toggled via double-tap: press the digit key twice rapidly (within 300 ms). [5]{.kbd}→Bus E, [6]{.kbd}→Bus F, [7]{.kbd}→Bus G, [8]{.kbd}→Bus H, [9]{.kbd}→Bus I.
:::
:::

::: {#ch-challenges .chapter}
::: chapter-number
Section 16
:::

::: chapter-title
Challenge System
:::

The challenge system presents the operator with a computational task. Data values are loaded into the machine; the operator must process them and deliver the correct answer via Bus D or Bus E. Challenges are scored on time, ticks, and operator action count.

::: section
::: section-title
Built-In Challenges
:::

  ID                  Name                                Task
  ------------------- ----------------------------------- -------------------------------------------------------------------
  `add`               Add X Numbers                       Sum a stream of values
  `multiply`          Multiply Two Numbers                Compute A × B
  `transform_nth`     Transform Every Nth Value           Apply an operation to every Nth value in a stream
  `filter`            Filter: Pass Back Matching Values   Return only values meeting a condition
  `sort`              Sort Values (Low → High)            Sort a small set of values ascending
  `find_max`          Find the Maximum                    Identify the largest value in a stream
  `xor_checksum`      XOR Checksum                        XOR all values together
  `count_matches`     Count Matches                       Count how many values meet a condition
  `accumulate`        Accumulate to Threshold             Sum values until the total exceeds a threshold
  `chain_sum`         Chain Sum                           Network challenge: each machine adds its value to a running total
  `bridge_crossing`   ★ Bridge Crossing                   Operators Club challenge (generates completion code)
:::

::: section
::: section-title
Challenge Lifecycle
:::

1.  Operator presses NEW CHALLENGE ([N]{.kbd}) --- generates values, loads them into Working Loop
2.  Machine runs; operator processes values
3.  Operator delivers answer via the configured bus destination (Bus D/E → challenge endpoint)
4.  Challenge evaluates: compares received value(s) to expected
5.  Result displayed with time, ticks, operator actions, and score

Challenge state lives in the `CHALL` object (not inside L21 --- it is module-global). Key fields: `active`, `expected`, `expectedValues`, `received`, `startTick`, `startTime`, `opsAtStart`, `answerCount`.
:::

::: section
::: section-title
Scoring
:::

Score is based on three efficiency components: tick efficiency (ticks used vs. par ticks), operator efficiency (actions used vs. par actions), and time efficiency (wall time used vs. par time). Each challenge\'s `par()` function defines the target tick and action counts.
:::

::: section
::: section-title
Custom Challenges
:::

Operators and programmers can register custom challenges via the challenge registry. A valid custom challenge definition must include:

-   `id`: Lowercase letters, digits, underscores only; must be unique
-   `name`: Display name
-   `description`: What the operator must do
-   `generate(params)`: Function returning `{values, expected, expectedValues, answerCount, ...}`; must run in under 50 ms; dry-run tested 5 times on registration
-   `par(generateResult, params)`: Function returning `{ticks, ops}`
-   `params` (optional): Array of parameter definitions with `type` (\'number\', \'select\', \'toggle\'), `id`, `default`

Custom challenges cannot overwrite built-ins. Built-ins have `builtin: true` and are registered at startup.
:::

::: section
::: section-title
Operators Club
:::

Challenges with `club: true` (Bridge Crossing is the only current club challenge) generate a cryptographic completion code when solved correctly. This code encodes the tick count, operator actions, and wall time. To join the Operators Club: mail a printed application with the code, \$16 in two-dollar bills, and a pre-addressed stamped postcard to New Gloucester, Maine. Members receive a randomly-assigned member number and a newsletter at the author\'s discretion.
:::
:::

::: {#ch-networking .chapter}
::: chapter-number
Section 17
:::

::: chapter-title
Networking
:::

L21 machines can connect to each other peer-to-peer using WebRTC data channels, mediated by PeerJS. Networking enables multi-machine data transfer during operation and multi-machine challenge coordination.

::: section
::: section-title
P2P Buses (F and G)
:::

Bus F (left neighbor) and Bus G (right neighbor) are always-available P2P connections to directly connected machines. When a peer is connected on the F side, Bus F carries data between the two machines. Both buses are bidirectional --- each has its own outbound and inbound channel. Data is assembled into 17-bit word packets before transmission and received one bit per tick into the destination loop\'s W head.
:::

::: section
::: section-title
Net Buses (H and I)
:::

Buses H and I are network-routable. Each has a configurable `peerTarget` (machine ID). When a peer target is set and a connection to that machine exists in the network, Bus H or I carries data specifically to/from that machine --- useful for non-adjacent communication in multi-machine networks.
:::

::: section
::: section-title
Virtual Networks
:::

L21 supports named virtual networks. Machines can join a named network, perform a scan to discover other members, elect a hub (the machine coordinating network operations), and communicate via the network monitor. Chain challenges (like Chain Sum) use the virtual network to coordinate multi-machine computation.
:::

::: section
::: section-title
CBX Protocol
:::

CBX (Chain Bus eXchange) is the internal protocol layer managing chain challenges over P2P connections. CBX handles: sending challenge data to chain participants, receiving partial results, coordinating the chain sum accumulation, and delivering the final answer back to the originating machine for evaluation. CBX message types are defined as constants and dispatched via the CBX receive handler.
:::

::: section
::: section-title
Other Networked Features
:::

-   **Chat**: Unified chat system sends text messages to connected peers via the data channel. [T]{.kbd} opens chat.
-   **FTP (File Transfer)**: Files can be sent between connected machines via the FTP subsystem.
-   **Network Monitor**: Displays connected peers, network topology, and transfer status.
-   **Network Probe**: Diagnostic tool for verifying P2P connection quality.
:::
:::

::: {#ch-logger .chapter}
::: chapter-number
Section 18
:::

::: chapter-title
Session Logger & Statistics
:::

::: section
::: section-title
Session Logger
:::

When the session logger is active (`logger.active = true`), every tick writes a structured line to `logger.lines`. The log format includes tick number, bus state, gate states (O=open, C=closed) for all four loops, and the current word at each loop\'s R head. The complete log can be exported as a `.loop` file.

Individual operator actions and machine events are logged with two detail levels: setup (operator intentions and configuration) and operation (actual data movements and computations). These produce clean Loopscript-compatible records.
:::

::: section
::: section-title
Session Statistics
:::

The `L21.stats` object accumulates counters for the current session. All start at 0 and increment while the logger is active:

  Stat                 What it counts
  -------------------- -----------------------------------------------------
  `operatorActions`    All deliberate operator inputs
  `wordsTransferred`   Complete 17-bit words delivered by buses
  `aluOpsExecuted`     ALU compute calls
  `busActivations`     Times buses toggled on
  `gateToggles`        Gate open/close toggles
  `injects`            Inject channel uses
  `memSlotWrites`      Values written to Memory slots
  `memSlotReads`       Values read from Memory slots (writeback triggered)
  `clockChanges`       Clock speed adjustments
  `aluWritebacks`      ALU result or register writebacks
  `pmRewrites`         PM pattern rewrite operations
  `ctrEjects`          Counter values ejected to buses
  `batchWrites`        Memory batch write operations started
  `pauseMs`            Milliseconds with clock stopped
:::
:::

::: {#ch-skins .chapter}
::: chapter-number
Section 19
:::

::: chapter-title
Skins
:::

L21 has three built-in visual themes (skins). Each skin is defined as an authoritative source string, parsed at init into the SKINS runtime object (`SK`). The current skin is stored in `currentSkinId` (localStorage-persisted). Changing skins updates canvas colors and CSS variables.

  Skin ID     Name      Character
  ----------- --------- ----------------------------------------------------------------------------------------------------------
  `og`        OG        Blue-grey. The default aesthetic. Clean, cool, professional. CSS variables base on `#e8eef4` background.
  `winamp`    Winamp    Dark background with green phosphor text. Evokes a CRT terminal. High contrast.
  `sunrise`   Sunrise   Warm amber and cream. Light, inviting. Softer contrast than OG.

Operators can also author custom skins and register them via the Scripts panel. Custom skins follow the same source string format as built-ins. The skin system supports challenge panel skins and CBX panel skins as well (applied conditionally when those subsystems are active).

Skin state is the only operator preference persisted to localStorage. Everything else resets on page reload unless a snapshot (`.l21` file) is loaded.
:::

::: {#ch-files .chapter}
::: chapter-number
Section 20
:::

::: chapter-title
File System
:::

::: section
::: section-title
Snapshots (.l21 files)
:::

The complete L21 simulation state can be saved to a `.l21` file using the File System Access API (or a download fallback). Saving serializes the entire `L21` namespace --- all loop bits, bus configs, ALU registers, Memory slots, WSCR contents, counter values, PM/TG settings, and all other simulation state.

Restoring a snapshot replaces the current `L21` state with the saved version, then re-initializes all UI elements from the restored state. This enables session continuity across page reloads and state sharing between operators.
:::

::: section
::: section-title
File-Save Bus Destination
:::

`file-save` is a special bus destination. When a bus (A--D) is configured to deliver to file-save and the file save stream is armed, words delivered to this destination are collected into a binary output file. This allows the operator to route a stream of data from any loop directly into a file, one word at a time, at the bus\'s current transfer rate.

The file load process is the reverse: a binary file\'s contents are streamed into Memory slots via the `_fileLoadQueue` mechanism, chained with the Memory writeback pipeline.
:::

::: section
::: section-title
Catalog
:::

The Catalog system provides a library of pre-configured machine states (scenarios, examples, reference setups). Selecting a catalog entry loads its configuration into the current machine. Catalog entries are defined internally and represent useful starting points for common operations.
:::
:::

::: {#ch-annotation .chapter}
::: chapter-number
Section 21
:::

::: chapter-title
Annotation System
:::

The annotation system is an optional note-taking layer that runs alongside the machine without modifying its behavior. It is a pure recording tool --- it records operator intentions and state snapshots. It does not automate anything.

::: {.callout .note}
::: callout-label
Status
:::

The annotation system is specified (complete spec exists in loop21-annotation-spec.html) but as of build v.331 several design questions remain open before implementation. The spec below reflects the intended design.
:::

::: section
::: section-title
Goals
:::

-   Force operators to articulate intentions before acting
-   Create documentation without post-session work
-   Reveal gaps between operator intention and actual machine behavior
-   Generate shareable, teachable operation records
:::

::: section
::: section-title
UI (Specified)
:::

Right sidebar (\~280px) with: enable/disable checkbox, multi-line textarea for note entry, tick display, Save and Clear buttons, recent annotations list (last 5, with tick numbers). Save is also triggered by Ctrl+Enter / Cmd+Enter.
:::

::: section
::: section-title
Two Outputs
:::

**Raw output**: Extended `.loop` format including all annotations with full machine state snapshots at each annotation tick. Complete record for debugging and personal review.

**Polished output**: Clean Loopscript generated by combining operator text with observed state deltas between annotation points. Human-readable, shareable, operator-voice preserved.
:::

::: section
::: section-title
Annotation Object Structure
:::

Each annotation captures: `id` (UUID), `tickNumber`, `timestamp`, `text` (operator\'s note), `machineState` (full L21 snapshot), `operationActive` (current operation name).
:::
:::

::: {#ch-state .chapter}
::: chapter-number
Section 22
:::

::: chapter-title
State Namespace (L21)
:::

All mutable simulation state lives in the `L21` object. This clean boundary enables serialization (snapshots), isolated testing, and a clear separation of simulation vs. UI vs. network state. **UI-only state (DOM refs, canvas contexts, skin colors, resize observers) is intentionally kept outside L21**.

::: section
::: section-title
L21 Top-Level Fields
:::

  Field                   Type        Description
  ----------------------- ----------- ---------------------------------------------------------------------------------------------------------------------------------------------
  `loops`                 Object      Keyed by loop ID. Each entry: {def, bits, flash, lastWord, gateOpen, paused}
  `buses`                 Object      Keys: a--i. Each bus\'s full state (see bus type).
  `alu`                   Object      ALU registers a/b/c/d, result, op, opASrc, opBSrc, route, routeHold, autoWriteback, flags, wbBuf, wbPos, capBuf, capTarget, capPos, ignore3
  `cmp`                   Object      Comparator flags (gt/lt/eq/gte/lte/ne), packed value, wbPos, wbBuf
  `ctr`                   Object      Per-loop counters (working/alu/memory/big) + global. Each: val, rot, readPos, outBuf\*, destructive, triggers
  `wscr`                  Object      slots\[4\], capture, capAddr, capPos, capBuf, wbPos\[4\], wbBuf\[4\]
  `mem`                   Object      Full Memory system state (see Section 9)
  `inj`                   Object      buffer\[17\], pending\[\], flash, active, wbPos
  `clock`                 Object      running, tickCount, hz, lastTick, lastFrame, ledFlash, accuracySamples, lastTimestamp
  `switchBits`            int\[16\]   Input switches: indices 0--15 = bits 15--0 (MSB first)
  `ext`                   Object      External Bus E buffers: outBuf, inQueue
  `operatorActionCount`   int         Total operator actions since session start
  `filterOrder`           string      \'pm_first\' or \'tg_first\'
  `pm`                    Object      PM1 state (see Section 10)
  `pm2`                   Object      PM2 state with cascade fields
  `tg1`                   Object      TG1 state
  `tg2`                   Object      TG2 state with cascade fields
  `logger`                Object      active, lines, tickCount, startTime, sessionStartTime, lastSnapshot
  `stats`                 Object      Session statistics (see Section 18)
:::

::: section
::: section-title
Const Aliases
:::

Short aliases are declared at module scope for hot-path access: `const loops = L21.loops`, `const alu = L21.alu`, `const cmp = L21.cmp`, `const ctr = L21.ctr`, `const wscr = L21.wscr`, `const mem = L21.mem`, `const inj = L21.inj`, `const clock = L21.clock`, `const pm = L21.pm`, etc. These point to the same objects --- mutations through aliases mutate `L21`.
:::

::: section
::: section-title
State Factories
:::

State shapes are defined once in factory functions and used both at initialization and during snapshot restore. This prevents state shape divergence. The factories are:

-   `makeUnidirectionalBus(src, dst)` --- Bus A--D default state
-   `makeDualChannelBus(src, dst, extras)` --- Bus E--I default state
-   `makeCounter(id)` --- Loop counter with correct trigger set for that loop
-   `makePatternMatcher(extras)` --- PM1/PM2 state
-   `makeThresholdGate(extras)` --- TG1/TG2 state
:::
:::

::: {#ch-impl .chapter}
::: chapter-number
Section 23
:::

::: chapter-title
Implementation Notes
:::

For AI instances or human engineers working on the L21 codebase.

::: section
::: section-title
File Structure
:::

Single HTML file. CSS first (\~lines 9--3765 in v.331), then HTML markup (\~3766--3807 as comments, \~1987--3765 as actual HTML), then JavaScript (\~3766+). The JS is organized in functional sections matching the Table of Contents (see Section 3 of the source comments). Each major section is delimited by `// ================================================================` banners with a title comment.
:::

::: section
::: section-title
Hot Path Performance
:::

The tick engine runs up to 144 times per second. Hot-path functions avoid string allocation, DOM access, and expensive operations. Key patterns:

-   `LOOP_IDS_SET`, `BRIDGE_SOURCE_IDS`, `DEF_BY_ID` --- pre-built lookup structures
-   `UNARY_OPS`, `CARRY_OPS` --- Sets for O(1) membership test
-   Parity computed with bit manipulation (no string allocation)
-   DOM element cache in `EL` object --- populated at init, avoids `getElementById` in hot paths
-   Dirty flags (`displayNeedsRefresh`) prevent redundant DOM updates
-   Canvas rendering uses `loopGeometryCache` for cached layout calculations
:::

::: section
::: section-title
Event Delegation
:::

UI interactions use event delegation --- most click/input handlers are registered on container elements and dispatch via `dataset.action` and `dataset.arg` attributes. This avoids per-element event listener proliferation. The main delegation handler is near the end of the file (\~line 18350).
:::

::: section
::: section-title
Drag-to-Set
:::

The `_drag` object manages drag interactions for input switches and PM/TG bit arrays. Dragging across multiple toggle elements sets them all to the value of the first element toggled. The `_drag.handled` flag prevents double-toggling when a drag release event fires on the same element as the mousedown.
:::

::: section
::: section-title
Rendering
:::

Loop visualization uses HTML5 Canvas. The canvas is redrawn each animation frame via `requestAnimationFrame`. Loop bit arrays are rendered as dot grids; flash values (0.0--1.0, decay each frame) drive pulse animations. The main render function is `renderAllComponents()`; canvas-specific drawing is in the Canvas Rendering section (\~line 16940). DOM-based word detail strips (\~line 17670) show the current word at each loop\'s R head.
:::

::: section
::: section-title
Snapshot Restore
:::

Restoring a `.l21` snapshot: deserialize JSON into a plain object, then use state factories to reconstruct typed arrays and class instances where needed, then deep-copy values into `L21`, then call all UI refresh functions to sync display to restored state. The restore function must handle version differences gracefully if the snapshot format evolves.
:::

::: section
::: section-title
Skin System
:::

Each skin is defined as an authoritative source string in the JS (three strings: OG, Winamp, Sunrise). The skin parser converts these strings to a structured color object at init. The runtime `SK` object holds the active skin\'s canvas colors. CSS custom properties (on `:root`) are swapped by adding/removing body class names (`skin-og`, `skin-winamp`, `skin-sunrise`).
:::

::: section
::: section-title
CBX Protocol Layer
:::

CBX message types are defined as constants (\~line 6347). The CBX state object (\~line 6379) tracks connection state, peer ID, availability. Messages are sent via `cbxSendMessage(type, payload)` and received/dispatched via `cbxReceiveMessage(data)`. Availability states control which CBX UI is shown (connected, disconnected, searching, etc.). The network probe (\~line 6503) runs diagnostic tests on the P2P channel.
:::

::: section
::: section-title
Adding a New Operation / Feature
:::

Standard pattern for new features in L21:

1.  Add state to the relevant L21 sub-object (or new sub-object with factory function)
2.  Add tick-phase processing to the appropriate phase function (or a new one called from `tickWritePhase`)
3.  Add UI HTML in the appropriate sidebar section
4.  Add DOM element cache entries to `EL`
5.  Add operator action handlers (functions called from event delegation or keyboard)
6.  Add keyboard bindings to flat/shift/chord maps as appropriate
7.  Add logging calls (`logSetup` for configuration, `logOp` for data movement)
8.  Add snapshot save/restore handling if the new state needs persistence
9.  Update the Table of Contents comment block
:::

::: section
::: section-title
Known Constraints and Design Decisions
:::

-   **Single-file architecture is a hard constraint**. No external files, no build tooling. All new code goes in the one HTML file.
-   **Zero external JS dependencies**. PeerJS (WebRTC) is the only external library and is loaded from CDN only when networking is active.
-   **Synchronous tick engine**. The tick is not async. Web Workers are not used. All processing must complete synchronously within the frame budget at the configured Hz.
-   **L21 namespace boundary**. New simulation state goes in L21. UI state does not. This boundary enables snapshot serialization --- breaking it breaks snapshots.
-   **BPW = 17 is fundamental**. It is woven throughout the bit transfer pipelines, buffer sizes, and word detection logic. Changing it would require updating every pipeline and buffer in the system.
-   **Fixed head positions**. R=bits\[2\], G=bits\[1\], W=bits\[0\] is a global invariant. The visual headPos display property (\'top\') does not change the actual indices.
:::
:::

------------------------------------------------------------------------

All content verified against Loop 2.1 build v.331 source (18,899 lines). Produced April 2026 using the Loop MMT KP Production Method.
:::
:::

::: page-footer
Loop 2.1 Knowledge Pack · v1 · April 2026 Verified against build v.331 · loop2.computer
:::
