# Sleepy Operator Protocol v3.2
## Loop MMT™ · v3.2 · 20 April 2026 · Session 112

---

## About This Document

An end-of-session routing input, shaped for the operator at end of day. Preflight orients a fresh instance at session open; the Sleepy Operator Brief orients the operator for their own between-session routing at session close. The handoff carries state for the next instance. The brief carries the routing the operator needs to make between sessions — tonight's action items, tomorrow's entry point, the reconstruction layer for morning.

The failure mode it prevents: the operator closes the laptop without knowing what needs to happen next, wakes up tomorrow having lost the thread, and spends the first hour of the next session re-reading documents to figure out where they are.

The operator at end-of-day is a degraded receiver. Reduced working memory. Low tolerance for ambiguity. The brief reads like a friend who was in the room all day handing them a note on the way out.

**Provenance:** Session 34b board discussion (10 April 2026), 3 RCR rounds × 2 cycles. v2 added two-layer structure, sensitivity flag, permission line. v3 revised via Lathe Cycle 1, Phase B — added Scope, Sequence Position, Four Corners, History, Pulse Line. Pinned cross-reference versions. v3.2 Chiseled from v3.1 at S112 (20 April 2026) — 6/6 MIGRATE, 0 gaps, 0 additions (zero-gap). Tenth prospective SR99-02 confirmation. Third zero-gap Chisel. First depth-3 composite in series.

**FBD Classification:** FBD-SOP series (Sleepy Operator Protocol).

---

## Scope

**Applies to:** Every session close. The Sleepy Operator Brief is produced alongside (and after) the EOD handoff per Handoff Standard v4.

**Does not apply to:** Mid-session snapshots (governed by Sitrep Protocol v1) or multi-session day summaries (governed by Day Sheet Protocol v2, which the brief can derive from when available).

---

## FBD Controls

| Control | Name | Rule | Era | Verdict |
|---------|------|------|-----|---------|
| FBD-SOP1 | Mandatory Production | The Sleepy Operator Brief is produced at every session close. Not optional. It is cheaper to produce an unnecessary brief than to lose an operator's thread. | v2-base | MIGRATE |
| FBD-SOP2 | Brevity Ceiling | Layer 1 (the action brief) fits on one phone screen. No scrolling. The constraint is "can the operator read this in bed without scrolling," not a line count. Layer 2 (the context mesh) has no length cap but must be skimmable — headers, not prose. | v2-base | MIGRATE |
| FBD-SOP3 | File Manifest Completeness | Every file produced this session appears in the manifest with its destination and delivery status. No "see the handoff for details." The manifest IS the details. | v2-base | MIGRATE |
| FBD-SOP4 | Blocker Flag | Any file or action that blocks the next session is marked `[BLOCKER]`. The operator can scan the brief and see blockers without reading prose. | v2-base | MIGRATE |
| FBD-SOP5 | Sensitivity Flag | First line of the brief, before anything else. Either `CLEAR` or `HEADS UP — [topic]`. Prevents a tired operator from sharing a brief that contains sensitive content without reviewing it. | v2-base | MIGRATE |
| FBD-SOP6 | Permission Line | After the TONIGHT actions, before TOMORROW: an explicit statement that everything else can wait, or an explicit statement of what cannot wait and why. The protocol actively resists false urgency. A tired operator needs to hear "you are allowed to stop." | v2-base | MIGRATE |

---

## Document Structure: Two Layers

The brief is a two-layer document. Layer 1 is the action brief — what to do tonight, what to do tomorrow. Layer 2 is the context mesh — if you wake up with zero memory of today, this gets you back.

Both layers live in one file. The operator reads Layer 1 tonight. If they need Layer 2 tomorrow morning, it's there. If they don't, they never scroll past Layer 1.

---

## Layer 1 — The Action Brief

One phone screen. Read this in bed. Do what it says. Stop.

### Sensitivity Flag

First line. `CLEAR — nothing sensitive this session` or `HEADS UP — this session discussed [topic]. Review before sharing.`

### 1. Where You Are

Three sentences max. Where the *project* is right now — not the session, the project. What phase, what's built, what's next. The operator should read this and know where they are in the larger story without remembering anything about today.

### 2. What Got Made

File manifest. One line per file:
- Filename
- What it is (five words max)
- Where it goes (project files, local path, nowhere yet)
- Delivery status: `[DELIVERED]` (presented for download), `[IN CHAT]` (shown but not presented as downloadable), `[NOT YET]` (exists but not surfaced)
- `[BLOCKER]` if the next session cannot start without it

If no files were produced, state "No files this session."

### 3. What To Do

**TONIGHT:** Actions the operator must take before closing the laptop. File uploads that block tomorrow. Decisions that can't wait. If nothing needs to happen tonight, write "Nothing. Go to bed."

**Permission line:** "Everything else can wait until morning." Or if something genuinely can't: "[Specific thing] cannot wait because [specific reason]. Everything else can wait."

**TOMORROW:** The human side of starting the next session. What the operator does before the instance does anything. "Upload X to the project. Open a new session. Load the handoff."

### 4. The Thread

One paragraph. Where the project is right now in narrative form, written so the operator can re-enter the story tomorrow without rereading anything. Include any hanging decisions — what they are, when they're needed, whether they can wait. This is the whiteboard. This is "north wall."

---

## Layer 2 — The Context Mesh

Reconstruction layer. If the operator wakes up tomorrow and cannot remember anything about today, this gets them back. Skimmable — headers first, read the section you need.

### Project State

Where the project stands as of this session's close. Phase, major milestones hit, major milestones ahead. Not a history — a snapshot. What's built, what's not built, what's blocked.

### Session Summary

What happened today. Not the handoff — the handoff carries state for the next instance. This carries the operator's own routing input: what was the plan, what actually happened, what diverged and why. Three to five sentences.

### Trajectory

Where the project has been heading over the last few sessions. Is the work converging on something? Diverging? Stalled? What pattern would the operator see if they looked at the last week of work from a distance?

### Decisions and Open Questions

Every decision made this session, one line each. Every open question that needs operator input, one line each with a deadline or "no deadline" tag. Decisions that can wait are marked `[CAN WAIT]`. Decisions that cannot are marked `[NEEDS ANSWER]` with a reason.

### File State

Complete inventory of project files that changed this session or need to change. Which files are current, which are superseded, which are new. If files need to be removed from the project (superseded versions), say so.

### What the Next Instance Needs

What documents the next session's instance should load. Not the full loading pack — what's different from the default. New files, updated files, files that moved. The operator uses this to prep the next session's uploads.

---

## When to Produce It

At session close, after the EOD handoff (including the Section 8 audit). The instance already has all the information. Layer 1 adds near-zero context cost — it is a compression of what was just written in the handoff. Layer 2 adds moderate cost but is produced from information already in working memory.

The brief can reference the handoff ("full details in the handoff") but Layer 1 must be self-contained for tonight's purpose. The operator should not need to open any other document tonight.

---

## Protocol Interactions

| Protocol | Touchpoint |
|----------|------------|
| Handoff Standard v4 | Brief produced after the handoff. Handoff is for the next instance; brief is for the current operator. |
| Process Audit Protocol v2 | If the audit surfaced something the operator needs to know tonight, it goes in Layer 1. Otherwise the audit is the next instance's problem. |
| Prompt Amplification Protocol v0.2 | No interaction. PAP fires at session open. |
| Let's Go Protocol v1 | Layer 1's TOMORROW section is the human prelude to session opening. Layer 2's "What the Next Instance Needs" tells the operator what to upload before the next session. |

---

## Changes from v1

| Change | Source | Description |
|--------|--------|-------------|
| Two-layer structure | RCR Round 2 | Brief gains Layer 2 (context mesh) for morning reconstruction. Layer 1 unchanged in purpose. |
| Sensitivity flag (FBD-SOP5) | Nyx, Round 1 | First line of brief flags whether sensitive content was discussed. |
| Permission line (FBD-SOP6) | Theo, Round 1 | Explicit permission to stop after TONIGHT actions. Resists false urgency. |
| Download status tags | Renata, Round 2 | Manifest entries tagged `[DELIVERED]`, `[IN CHAT]`, or `[NOT YET]`. |
| Project-level pin | Graham, Round 1 | "Where You Are" reframed from session-level to project-level orientation. |
| Brevity ceiling reframed | Wes, Round 3 | "One phone screen" replaces "30 lines" as Layer 1 constraint. |

---

## Design Notes

Sol noted during design that this is the methodology's first between-session routing closure, shaped for the operator. Opening rituals existed (preflight, handoff loading). Session-internal closure existed for the instance (handoff, audit). No protocol closed the operator's own routing arc — plan-to-actual, actual-to-next-action, carry-forward-to-next-session-entry. This fills that gap. It reads like a friend who was in the room all day because that's the delivery shape that works at end of day; the function underneath is routing.

The two-layer structure mirrors the methodology's pattern: compressed surface, detailed substrate. The handoff does this. The KPs do this. Layer 1 is the surface the tired operator reads tonight. Layer 2 is the substrate the refreshed operator reads tomorrow if they need to re-enter the story.

---

## Sequence Position

**What comes before:** Session work is complete. The EOD handoff (Handoff Standard v4) and Process Audit entry (Process Audit Protocol v2) have been produced.

**What the Sleepy Operator Protocol does:** Produces a two-layer brief — action layer (tonight/tomorrow) and context layer (reconstruction) — as operator routing input at end of session.

**What comes after:** The operator reads Layer 1 tonight, acts on TONIGHT items, and uses TOMORROW items to prep the next session. Layer 2 is available for morning reconstruction if needed.

**Relationship to other protocols:**
- **Handoff Standard v4:** The handoff is for the next instance. The brief is for the current operator. Produced after the handoff, from the same information.
- **Day Sheet Protocol v2:** On multi-session days, the brief can derive from the Day Sheet rather than the last session's handoff alone.
- **Let's Go Protocol v1:** Layer 1's TOMORROW section is the human prelude to session opening.
- **Walk Home Protocol v2:** Walk Home closes the session's exploratory work. The brief closes the operator's day. Walk Home feeds into the brief's file manifest and thread summary.

---

## Four Corners

- **FBD:** Six controls (FBD-SOP1 through SOP6), all v2-base, all MIGRATE at v3.2 Chisel (S112 — zero-gap, tenth prospective SR99-02 confirmation). FBD-SOP2 (brevity ceiling — one phone screen) is load-bearing — it prevents the brief from becoming a second handoff. FBD-SOP6 (permission line) prevents false urgency from keeping a tired operator working.

- **FWW(C):** "The Thread" (Layer 1, §4) is FWW doing structural work — it's a narrative paragraph, not a list, because narrative is how tired humans re-enter a story. The brief's framing as "a friend handing you a note on the way out" is itself FWW in the protocol's own voice.

- **STP:** The file manifest (Layer 1, §2) shows exactly what was produced, where it goes, and what blocks the next session. No hidden state. The operator sees everything.

- **SNR:** Layer 1 is maximum compression — one phone screen. Layer 2 is available but optional. The two-layer structure means the operator never reads more than they need tonight.

---

## Pulse Line Specification

**Measures:** Layer 1 length (phone screens), blocker count, file count, sensitivity flag status.

**Format:**
```
[PULSE] Sleepy Operator: [N] files manifested, [N] blockers. Sensitivity: [CLEAR/HEADS UP]. Layer 1: [N] phone screen(s).
```

**Example:**
```
[PULSE] Sleepy Operator: 5 files manifested, 1 blocker. Sensitivity: CLEAR. Layer 1: 1 phone screen.
```

---

## History

| Version | Date | Session | Change |
|---------|------|---------|--------|
| v1 | 10 April 2026 | S34 | Initial production. Single-layer action brief. |
| v2 | 10 April 2026 | S34b | RCR redesign. Added Layer 2 (context mesh), sensitivity flag (FBD-SOP5), permission line (FBD-SOP6), delivery status tags, project-level pin, phone-screen brevity ceiling. |
| v3 | 12 April 2026 | S51 | Lathe Cycle 1 revision. Added Scope, Sequence Position, Four Corners, History, Pulse Line. Pinned cross-references (Handoff Standard v4, Process Audit Protocol v2, Day Sheet Protocol v2, Let's Go Protocol v1, Walk Home Protocol v2). Updated superseded AIP/PAP/Preflight references to current protocol names. |
| v3.1 | 19 April 2026 | S91 | F4 service-layer adjudication (Path A). Self-description reframed to state program-function as purpose (end-of-session routing input) with warmth preserved as delivery shape. Four edits: opening paragraph, Layer 1 framing (line 96), Sol's design note, Sequence Position function line. No procedural changes. Forged via RCR Heavy · 24-lens Full Frame · 13 takes · Convergence (devil's advocate Dara, shifted in collision). |
| v3.2 | 20 April 2026 | S112 | Chisel (SR99-02). 6/6 MIGRATE, 0 gaps, 0 additions (zero-gap). All FBDs v2-base. Tenth prospective SR99-02 confirmation. Third zero-gap Chisel in series. First depth-3 composite. Sixth authoring-circumstance class (moderate RCR, 3×2). Finding 39 strengthened at N=4. FR1 0, RF4 0, Parallax four-angle CLEAN. |

---

*Loop MMT™ · Sleepy Operator Protocol · v3.2 · © 2026 Shea Gunther · CC BY-NC 4.0*
