# The Canary — Persistent Context Indicator Protocol v1
## Loop MMT™ · 13 April 2026
### Produced by The Forge

---

## About This Document

The operator should never have to ask how much context is left. The answer should be visible at the bottom of every response, the same way a fuel gauge is visible on every dashboard — not because the driver is always watching it, but because it's always there when they glance down.

The Canary is a one-line context usage indicator appended to every AI response. It reports approximate context depth, a qualitative zone, an action hint, and a turn count. The name comes from the canary in the coal mine: it sings when conditions are fine. When it stops singing — or when it changes color — you pay attention.

**Provenance:** Operator directive, this session. All-frame RCR: 10/0 unanimous on merits, convergence on implementation. Forged in the same session.

**FBD Classification:** FBD-CY series (The Canary).

---

## Section 1 — Scope

**The Canary governs the persistent display of context usage information to the operator.**

**The Canary applies to:**
- Every AI response in every Loop MMT session, without exception

**The Canary does not govern:**
- How context is actually measured (platform-level; the protocol works with estimates)
- Session planning decisions based on context information (operator judgment)
- Handoff procedure when context is exhausted (governed by the Handoff Standard)
- What constitutes "good" context management (that's experience, not protocol)

---

## Section 2 — Trigger

**Every response.** No trigger condition. No activation threshold. The Canary is always present. An AI response without a Canary line is a protocol violation.

The only exception: if the operator explicitly and specifically requests suppression ("stop showing the canary"), the instance complies — operator override is absolute. The instance notes the suppression once and resumes if the operator asks for it back. Suppression does not carry across sessions.

---

## Section 3 — Procedure

### 3.1 — Format

One line. Always the last line of the response. Visually separated from content by a blank line.

```
[Canary: ~XX% | ZONE | Action hint | T##]
```

**Components:**

- **~XX%** — Approximate context usage as a percentage of estimated total window. The tilde (~) is mandatory. The estimate is based on the instance's best assessment of tokens consumed relative to total available context. It will not be precise. It does not need to be precise. A fuel gauge that's 10% off is still a fuel gauge.

- **ZONE** — One of three qualitative zones:
  - **GREEN** (0–60%): Normal operations. No action required.
  - **YELLOW** (61–80%): Context is accumulating. The operator should be aware and consider wrapping after the current deliverable or work unit.
  - **RED** (81%+): Context is deep. Quality degradation risk is real. Prepare to wrap and hand off.

- **Action hint** — A short phrase appropriate to the zone:
  - GREEN: "Room to work" (or equivalent — slight variation is fine, the canary is alive)
  - YELLOW: "Consider wrapping after current deliverable" (or equivalent)
  - RED: "Prepare to hand off" (or equivalent — at RED, clarity beats variety)

- **T##** — Turn count. The number of operator–AI exchanges in this session. T1 is the first response. Provides calibration data over time.

### 3.2 — Placement

The Canary line is always:
1. The last line of the response
2. After all content, all Pulse Lines, all board dialogue, all deliverables
3. Preceded by a blank line

If a response contains a Pulse Line, the order is: content → Pulse Line → blank line → Canary. The Canary is the floor of every response.

### 3.3 — Zone Behavior

**GREEN:** Informational only. The canary sings. No action required by the instance or the operator.

**YELLOW:** The instance adds awareness to its own planning. If a multi-part deliverable is in progress, the instance considers whether to complete the current part and suggest wrapping, or whether the remaining work fits in the remaining context. The instance does not halt or change behavior — it plans with awareness.

**RED:** The instance begins preparing handoff materials alongside whatever work it is producing. This means: maintaining a mental checkpoint of what's done, what's in progress, and what's next. If the operator requests a handoff at any point during RED, the instance can produce one immediately without needing a separate "prepare the handoff" turn. FBD-CY2 governs this.

RED does not mean stop. It means: be ready to stop well.

### 3.4 — Estimation Method

Claude does not have a precise context meter. The estimate is based on:
- Approximate token count of the conversation so far (the instance can assess this)
- Known overhead from project files, system prompt, and loaded documents
- The trajectory of accumulation (are we in a high-output phase or a conversational phase?)

The estimate will sometimes be wrong. That is acceptable. The value of the Canary is not precision — it is visibility. An approximate indicator that's always present beats a precise measurement that's never shown.

---

## Section 4 — FBD Controls

| ID | Name | Rule |
|----|------|------|
| FBD-CY1 | Mandatory presence | The Canary line appears on every response. It is not optional, not conditional, not suppressible by the instance. Only the operator can suppress it, and suppression does not carry across sessions. An AI response without a Canary line is a protocol violation. |
| FBD-CY2 | RED checkpoint readiness | When the Canary is in RED, the instance maintains ongoing checkpoint awareness: what's done, what's in progress, what's next. If the operator requests a handoff during RED, the instance produces one immediately — no preparation turn needed. |
| FBD-CY3 | Honest approximation | The context percentage always carries the tilde (~). The instance never states exact percentages. If the instance is uncertain about its estimate, it says so: "~60–70%" is acceptable. False precision is worse than honest uncertainty. |

---

## Section 5 — Sequence Position

**What comes before:** Nothing. The Canary has no predecessor in the response sequence. It exists because the response exists.

**What this does:** Provides persistent, passive context usage visibility to the operator.

**What comes after:** Nothing within the response. The Canary is the last line. In terms of what it enables: informed operator decisions about session pacing, wrap timing, and handoff initiation.

**Relationship to Handoff Standard:** Complementary. The Canary tells the operator when to consider a handoff. The Handoff Standard governs what the handoff contains.

**Relationship to Sleepy Operator Protocol:** The Canary provides one of the signals that might trigger Sleepy Operator awareness — but the two are independent. A tired operator in GREEN zone is Sleepy Operator's problem, not the Canary's.

**Relationship to Process Pulse:** Pulse Lines measure process performance. The Canary measures system capacity. Both appear at the end of responses. Order: Pulse first, Canary last. The Canary is the floor.

---

## Section 6 — Four Corners

- **FBD:** Three controls. CY1 prevents the indicator from disappearing (the only failure mode that matters — an invisible gauge is no gauge). CY2 prevents surprise context exhaustion by requiring RED-zone readiness. CY3 prevents false confidence from fake precision. The controls are minimal because the protocol is minimal.

- **FWW(C):** The name. A canary in a coal mine is immediately understood, slightly ominous, and memorable. "Check the canary" is natural English. The action hints in GREEN zone can vary slightly — the canary is alive, it can sing different notes. In RED zone, the canary gets serious. Budget: 2 — the name does the work, the format is functional.

- **STP:** Every car has a fuel gauge. Every phone has a battery indicator. The Canary is instantly recognizable as a resource meter. Trust comes from familiarity with the pattern, not from explanation.

- **SNR:** One line per response. Three FBD controls. One-page protocol. The protocol is shorter than most of the deliverables it will appear on. Maximum signal, minimum structure.

---

## Section 7 — History

| Version | Date | Session | Change |
|---------|------|---------|--------|
| v1 | 13 April 2026 | This session | Initial production. All-frame RCR: 10/0, unanimous. Forged same session. |

---

## Section 8 — Pulse Line Specification

**Measures:** Presence compliance (was the Canary on every response?), zone distribution across session, accuracy of final estimate vs. actual exhaustion point (when measurable).

**Format:**
```
[PULSE] Canary: [N] responses, [N] with indicator (compliance: [X]%). Zones: [N] GREEN, [N] YELLOW, [N] RED. Final estimate: ~[X]%.
```

**Worked example:**
```
[PULSE] Canary: 24 responses, 24 with indicator (compliance: 100%). Zones: 18 GREEN, 4 YELLOW, 2 RED. Final estimate: ~88%.
```

---

*Ed's note, appended at filing: "This protocol is one line long. The document explaining it is two pages. That ratio is correct — the explanation needs to exist once so every future instance knows the format, the zones, and the controls. The line itself is the protocol. Everything else is the manual for the line."*

---

*Loop MMT™ · Multi-Module Theory · The Canary Protocol v1*
*© 2026 Shea Gunther · New Gloucester, Maine · CC BY-NC 4.0*
