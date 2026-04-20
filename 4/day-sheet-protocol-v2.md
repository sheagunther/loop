# Day Sheet Protocol v2
## Loop MMT™ · 12 April 2026

---

## About This Document

The Day Sheet is a CMFP-derived inline mesh that captures a full day's work across all sessions. Five analytical positions, one document. The positions map to independent dimensions of a day's work: what happened, what was made, what was decided, what's still owed, and where the project is heading. Each position can be updated without invalidating the others. Together they produce a reconstruction property no individual session handoff provides: any instance loading the Day Sheet can reconstruct the full day without having been present for any session.

The Day Sheet is to a day what the session handoff is to a session — the same structural pattern applied one level up. This is called **fractal summarization**: each scale of the methodology compresses the one below it. Session handoff → Day Sheet → (future levels as needed). The Sleepy Operator Brief (Sleepy Operator Protocol v2), when a Day Sheet exists, derives from the Day Sheet rather than the last session's handoff alone.

This protocol was designed because the operator ran twelve sessions on April 10, 2026, and the last session's instance produced a deliverable that conflicted with an earlier session's output. Twelve single-position documents don't compose. A mesh does.

**Provenance:** Session 41 board deliberation (2 RCR rounds), 10 April 2026. v2 revised via Lathe Cycle 1, Phase B — added Scope, Sequence Position, Four Corners, History, Pulse Line. Pinned cross-reference versions. Fixed superseded "AIP active" reference.

**FBD Classification:** FBD-DS series (Day Sheet).

---

## Scope

**Applies to:** Multi-session days within Loop MMT. Any day where two or more substantive sessions ran.

**Does not apply to:** Single-session days (the session handoff is sufficient), mid-session snapshots (governed by Sitrep Protocol v1), or session-level mesh documents (governed by Context Mesh Factoring Protocol v1).

---

## Section 1 — When It Fires

The Day Sheet is produced at the close of any day where **two or more substantive sessions** ran. A substantive session is one that produced at least one deliverable or recorded at least one decision.

Single-session days do not need a Day Sheet. The session handoff and Sleepy Operator Brief are sufficient — a mesh of one position is not a mesh.

The Day Sheet is produced **after** the final session's EOD handoff (including its Section 8 audit). The producing instance already has the information. The Day Sheet adds the cross-session synthesis that no individual handoff contains.

---

## Section 2 — FBD Controls

| Control | Name | Rule |
|---------|------|------|
| **FBD-DS1** | Mandatory on Trigger | If two or more substantive sessions ran today, the Day Sheet is produced. Not optional. It is cheaper to produce an unnecessary Day Sheet than to lose the cross-session picture. |
| **FBD-DS2** | All Handoffs Required | Every session handoff from the day must be loaded or its structured fields extracted. A Day Sheet produced from partial inputs must flag what's missing in each position where the gap affects completeness. The instance states which sessions it has and which it doesn't. |
| **FBD-DS3** | Conflict Detection Is Structural | Version conflicts in P2 (Material) are detected by filename stem comparison, not by instance judgment. If two sessions touched the same document stem with different version numbers, the Day Sheet flags the conflict regardless of whether the instance believes they conflict. The operator resolves; the instance detects. |
| **FBD-DS4** | Debt Triage Is Proposed | The instance proposes Active/Parked/Fossil classifications for carried items. The operator confirms or overrides. No item changes triage status without operator action. The instance's proposal is a recommendation, not a decision. |
| **FBD-DS5** | Completion Is Verifiable | Each position has a completeness check. P1: every session from the day appears. P2: every deliverable from every session appears. P3: every decision from every session appears. P4: every carried item from every session appears (deduplicated). P5: day-open and day-close states are both stated. If any check fails, the Day Sheet declares itself incomplete and names the gap. |
| **FBD-DS6** | Sensitivity Inheritance | If any session during the day flagged sensitivity, the Day Sheet inherits the flag. The Day Sheet's sensitivity flag is the logical OR of all session flags. The producing instance cannot clear a sensitivity flag — only the operator can. |
| **FBD-DS7** | FWW(C) Boundary | FWW(C) is permitted in P1 (Chronology) and P5 (Trajectory), permitted at section-introduction level in P4 (Debt), and forbidden in P2 (Material) and P3 (Decisions). This boundary is structural. Instances do not judge when FWW(C) is appropriate within permitted zones — if the position permits it, deploy it. If the position forbids it, no amount of cleverness justifies it. P2 and P3 are the bones. P1 and P5 are the skin. |

---

## Section 3 — The Five Positions

### Sensitivity Flag

First line of the document, before any position. Either:

`CLEAR — no session flagged sensitive content today`

or:

`HEADS UP — Session [N] discussed [topic]. Review before sharing.`

This is inherited from session-level sensitivity flags per FBD-DS6.

---

### P1 — Chronology

*What happened today, in what order, including what almost happened.*

**Independence basis:** Resequencing events doesn't change what was produced, what was decided, or what's owed. The timeline is a dimension of the day that the other positions don't contain.

**Contents:**

- **Session timeline.** Chronological. One line per session: session number, type (board / production / KP / hybrid), summary in ten words or fewer. Parallel sessions noted inline (e.g., "Sessions 33–34 ran concurrently, board and KP tabs").
- **Day metrics header.** Total session count. Total hours if known.
- **Notable overrides and near-misses.** Moments where the operator overrode an instance recommendation, or where a deliverable was argued against and the argument lost. One line each, session-tagged. These are chronological events — they happened during the day. They are invisible in the deliverables manifest because near-misses produce nothing. The Day Sheet is the only place they're captured at the day level.

**FWW(C):** Permitted. The ten-word summaries can have voice. The day had a shape — let the timeline reflect it. "Session 38: Baked self-improvement into the system's DNA" is better than "Session 38: Process Audit Protocol designed and produced."

**Completeness check (FBD-DS5):** Every session from the day appears in the timeline.

---

### P2 — Material

*What was made, where it goes, what it replaces.*

**Independence basis:** File state is a fact about artifacts. It exists independently of why they were made (P3), when they were made (P1), or what remains to be made (P4).

**Contents:**

- **Consolidated deliverables manifest.** Every file produced today across all sessions. One entry per unique file, deduplicated. Each entry: filename, producing session, delivery status (`[DELIVERED]` / `[IN CHAT]` / `[NOT YET]`), destination (project files / local path / operator files / archive).
- **File state delta.** Three lists:
  - **Needs uploading:** Files that should be added to project files. Tagged with priority if multiple files compete for the operator's time.
  - **Now superseded:** Files in the project that are replaced by today's output. These should be retired (removed or archived).
  - **Version conflicts detected:** Files where two or more sessions produced different versions of the same document stem. Flagged per FBD-DS3. Not resolved — the operator decides which version is authoritative.

**FWW(C):** Forbidden. Filenames and delivery status are reference data. No decoration. No commentary. The manifest is a ledger. Ledgers are clean.

**Completeness check (FBD-DS5):** Every deliverable from every session's handoff appears in the manifest.

---

### P3 — Decisions

*What was chosen, what was rejected, and by whom.*

**Independence basis:** Decisions have consequences in P2 (they produce artifacts) and P4 (they close or open debt items), but they are not reducible to either. A decision to *not* do something appears nowhere else. Rejected approaches are invisible in every other position.

**Contents:**

- **Decision log.** Every decision made today, one line each. Each entry: session number, category tag (`[METH]` for methodology decisions, `[PROJ]` for project decisions), decision statement. Rejected approaches included where consequential — tagged `[REJECTED]` with the session number and a brief reason.

The decision log is an index. Rationale lives in the source session's handoff. The Day Sheet points; the handoffs explain.

**FWW(C):** Forbidden. Decision entries are index lines. Scannable. Unadorned. The reader looking for "did we decide X today?" needs to find the answer fast, not enjoy the prose.

**Completeness check (FBD-DS5):** Every decision recorded in every session's handoff appears in the log.

---

### P4 — Debt

*What the project still owes — the accumulated obligation set with today's delta.*

**Independence basis:** Debt persists across days regardless of what P1–P3 contain. An item carried since Session 6 appears in P4 whether or not any session today touched it. The backlog is a dimension of the project that the day's activity doesn't determine.

**Contents:**

- **Triage categories.** Every carried item appears once, classified:
  - `[ACTIVE]` — Will be worked soon. The operator has expressed intent or the item blocks near-term work.
  - `[PARKED]` — Deliberately deferred. Not forgotten, not urgent. The operator knows it exists and has chosen not to work on it yet.
  - `[FOSSIL]` — Carried for three or more consecutive Day Sheets (or 5+ sessions) without action. May no longer be relevant. Proposed for operator review: re-activate, park with reason, or archive.
- **Today's delta.** Items completed today tagged `[DONE · Session N]`. Items added today tagged `[NEW · Session N]`. Items whose triage changed today note the change.
- **Fossil decay rule.** Any item that appears in P4 across three consecutive Day Sheets without being touched is automatically proposed as `[FOSSIL]` on the fourth. This is the evaporation mechanism — the methodology's equivalent of pheromone decay in ant colony optimization. Items that nobody touches slowly lose priority until they're explicitly re-activated or archived by the operator.

**FWW(C):** Permitted at section-introduction level. The opening line of P4 can have voice — "The fossil pile grew again" or "Three items cleared the board today." Individual item entries are clean and scannable.

**Completeness check (FBD-DS5):** Every carried item from every session's handoff appears, deduplicated.

---

### P5 — Trajectory

*Where the project was, where it is, and where it's heading — the interpretive position.*

**Independence basis:** Trajectory is the synthetic position. It draws from P1–P4 but adds evaluative content they don't contain: what the day *meant*, what pattern the work is following, whether the project is converging or diverging. No factual position contains this. It exists only as interpretation.

**Contents:**

- **Day-open state.** Where the project stood when the first session of the day loaded its handoff. Three sentences max.
- **Day-close state.** Where the project stands now. Three sentences max.
- **Movement.** What moved today. What didn't. What's next. One paragraph.
- **Aggregate metrics block:**

```
Total sessions:              [N]
Total deliverables:          [N]
Total self-review findings:  [N] ([breakdown by severity])
Sessions with planned deviation:    [N] of [N]
Aggregate productive deviation:     [percentage]
Chaos signature:             [LOW / MODERATE / HIGH]
Audit findings (if applicable):     [summary]
```

- **Pattern note.** Optional. If the day's work reveals a pattern across sessions — convergence toward a milestone, growing debt, accelerating production — state it here. This is the observation the operator needs to hear that no individual session can make because no individual session sees the full day.

**FWW(C):** Permitted and encouraged. This is the cognitive load peak — the end of the document, the end of the day, the moment the operator decides whether to keep reading or close the laptop. The trajectory should read like the day felt. Chaos (the C in FWW(C)) is considered internally during drafting — the day's shape, its surprises, its near-misses — but never named explicitly in the output. The reader feels it. The writer knows it's there.

**Completeness check (FBD-DS5):** Day-open and day-close states are both stated.

---

## Section 4 — Production

### Who Produces It

The Day Sheet is produced by the **last instance of the day** or by a **dedicated rollup instance** if the last instance lacks sufficient context. All prior session handoffs from the day must be available as input.

If the last instance has all handoffs loaded (via uploads or project files), it produces the Day Sheet after its own EOD handoff. If not, the operator opens a dedicated rollup instance, loads all day's handoffs, and directs production.

### Minimum Viable Input

The Day Sheet doesn't require full handoff prose from every session. It requires the **structured fields** from each: deliverables table, decisions, carried items, metrics, warnings. If an instance is producing the Day Sheet from handoffs it didn't generate, it extracts these fields without needing to absorb full session narratives.

On high-session days where context is constrained, the instance loads the structured fields from each handoff and flags any position where the prose context (session summaries, room reports, chaos reports) would have added information it doesn't have.

### Format

Markdown by default. L21 HTML on operator request. The Day Sheet is a working document, not a publication. Markdown keeps production cost low and context footprint small.

---

## Sequence Position

**What comes before:** All sessions for the day have completed and produced EOD handoffs per Handoff Standard v4.

**What the Day Sheet does:** Synthesizes all session handoffs from a multi-session day into a five-position mesh document with cross-session reconstruction properties.

**What comes after:** The Day Sheet is available to the next day's first instance as context. The Sleepy Operator Protocol v2 derives from the Day Sheet when one exists.

**Relationship to other protocols:**
- **Context Mesh Factoring Protocol v1:** The Day Sheet is a CMFP product — five independent positions, inline mesh topology.
- **Handoff Standard v4:** Session handoffs are the Day Sheet's inputs. The Day Sheet is the day-level analog of the session handoff.
- **Sleepy Operator Protocol v2:** Derives the Sleepy Operator Brief from the Day Sheet rather than the last session's handoff alone.
- **Process Audit Protocol v2:** Day-level audit findings (if any) are captured in P5 metrics.

---

## Four Corners

- **FBD:** Seven controls (FBD-DS1 through DS7). FBD-DS3 (conflict detection is structural) is load-bearing — it catches version conflicts mechanically rather than relying on instance judgment. FBD-DS7 (FWW(C) boundary) prevents play from contaminating reference data.

- **FWW(C):** Deployed according to FBD-DS7's structural boundary. P1 (Chronology) and P5 (Trajectory) carry voice. P2 (Material) and P3 (Decisions) are clean ledgers. The fossil decay rule in P4 is itself an FWW mechanism — naming carried items "fossils" makes debt visible through language.

- **STP:** The completeness checks (FBD-DS5) show the path — each position declares what it must contain, and the Day Sheet self-reports gaps. The reader knows exactly what's present and what's missing.

- **SNR:** The five-position structure separates concerns. A reader looking for decisions goes to P3. A reader checking file state goes to P2. No position contains information that belongs in another. Independence is the SNR mechanism.

---

## Pulse Line Specification

**Measures:** Session count, position completeness, conflicts detected, debt items by triage category.

**Format:**
```
[PULSE] Day Sheet: [Date]. [N] sessions synthesized. Positions: [N]/5 complete. Conflicts: [N]. Debt: [N] ACTIVE, [N] PARKED, [N] FOSSIL.
```

**Example:**
```
[PULSE] Day Sheet: 10 April 2026. 12 sessions synthesized. Positions: 5/5 complete. Conflicts: 1. Debt: 4 ACTIVE, 2 PARKED, 1 FOSSIL.
```

---

## History

| Version | Date | Session | Change |
|---------|------|---------|--------|
| v1 | 10 April 2026 | S41 | Initial production via board RCR. Five positions, seven FBD-DS controls, CMFP-derived inline mesh. |
| v2 | 12 April 2026 | S51 | Lathe Cycle 1 revision. Added Scope, Sequence Position, Four Corners, History, Pulse Line. Pinned cross-references (CMFP v1, Handoff Standard v4, Sleepy Operator Protocol v2, Sitrep v1). Fixed superseded "AIP active" reference in P5 metrics. |

---

*Loop MMT™ · Day Sheet Protocol · v2 · © 2026 Shea Gunther · CC BY-NC 4.0*