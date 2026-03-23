---
name: compact
description: Create a structured continuation handoff checkpoint for long coding or technical conversations when context is tight, the user asks to compact, another model will continue the task, or a clean resume point is needed. Preserve exact technical state, decisions, file paths, commands, blockers, failed attempts, validation status, and next steps. Do not use for generic summaries, meeting notes, or polished end-user documentation.
compatibility: agent-skills standard; suitable for Codex, Claude Code, OpenCode, and other SKILL.md-compatible agents
metadata:
  category: context-management
  purpose: continuation-handoff
  style: structured
---

# Compact

Create a structured context checkpoint summary that another LLM / coding agent will use to continue the work with minimal loss.

This is a continuation handoff, not a general summary.

## When to use this skill

Use this skill when any of the following is true:

- The conversation is long and context headroom is getting tight.
- The user asks to compact, checkpoint, create a handoff, or prepare a continuation summary.
- Another model / agent / future session will resume the work.
- There is meaningful technical state that must be preserved across context boundaries.
- The task involves implementation, debugging, validation, design decisions, or multi-step work that would be expensive to reconstruct.

## When not to use this skill

Do not use this skill when:

- The user wants a normal summary, executive summary, meeting note, or polished explanation for humans.
- The conversation is too short to justify a checkpoint.
- There is no meaningful work state, decision history, or technical context to preserve.
- The request is primarily non-technical and does not require exact continuation state.

## Operating rules

- Optimize for continuation, not readability or elegance.
- Preserve exact file paths, function names, class names, commands, config keys, API names, identifiers, and error text.
- Distinguish clearly between confirmed facts and assumptions / unverified conclusions.
- Preserve the user's explicit requirements and preferences exactly.
- Keep blockers, failed attempts, abandoned approaches, and validation gaps so the next model does not repeat work.
- Remove chit-chat, repetition, motivational text, and low-signal discussion.
- Compress repeated iterations into a single accurate statement when the differences do not matter.
- Do not invent missing details.
- Prefer omission over fabrication.
- If multiple tasks or threads exist, separate them clearly.
- If a section has no content, write `(none)` where appropriate.
- Output only the checkpoint summary, with no intro or outro outside the required format.

## Compression priorities

Prioritize preserving, in this order:

1. Goal and success criteria
2. Constraints, preferences, and environment limits
3. Current implementation / debugging / research state
4. Key decisions and rejected approaches
5. Important files, symbols, commands, errors, and config
6. Validation status and known gaps
7. Risks, open questions, and exact next steps

Compress aggressively only in these areas:

- Small talk
- Repetition
- Generic explanations
- Speculation that never affected the work
- Duplicate command logs whose differences do not matter

## Required output contract

Use the following EXACT format:

## Goal
- Primary task:
- Secondary task(s):
- Success criteria:

## Constraints & Preferences
- [User requirements, environment constraints, coding preferences, platform limits]
- [If none, write "(none)"]

## Current State
### Done
- [x] [Completed work / confirmed findings]

### In Progress
- [ ] [Work currently underway]

### Blocked
- [Blockers, unresolved errors, missing info, failed dependencies]
- [If none, write "(none)"]

## Key Decisions
- **[Decision]**: [Why this decision was made]
- **[Rejected / avoided approach]**: [Why it was rejected]

## Important Files & Code Locations
- `path/to/file`: [Why it matters]
- `path/to/file`: [Why it matters]

## Critical Technical Context
- Key functions / classes / modules:
  - `[symbol]`: [role]
- Important commands:
  - `[command]`: [purpose / result]
- Important errors:
  - `[exact error message]`
- Important config / API / environment details:
  - [detail]
- Important data / examples / references needed later:
  - [detail]
- If none, write "(none)"

## Validation Status
- Verified:
  - [What was tested / confirmed]
- Not yet verified:
  - [What still needs testing]
- Test / validation gaps:
  - [Any risky unverified areas]

## Risks & Open Questions
- [Known risks]
- [Unknowns that may affect next steps]
- [Potential places easy to make mistakes]

## Next Steps
1. [Most logical next action]
2. [Next action after that]
3. [Next action after that]

## Handoff Instructions for the Next Model
- Read first:
- Do not repeat:
- Check / verify first:
- Then continue with:

## Final output requirements

- Keep the summary concise but do not omit anything that affects future implementation, debugging, validation, or decisions.
- Preserve exact technical strings when they matter.
- Do not rename, reorder, or remove any required sections above.
- Do not add extra sections outside the required format.
- Use checkboxes exactly as shown.
- Make the checkpoint immediately actionable for the next model.