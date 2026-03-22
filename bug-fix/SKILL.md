---

name: fix-bug
description: Used for locating, reproducing, validating, and fixing software defects. Applicable when the user asks to “fix a bug,” “locate an error,” “analyze and fix an error” “reproduce an issue,” “find the root cause,” and similar scenarios. 

---

# Fix Bug

Goal: Make the bug-fixing process reproducible, verifiable, and regression-safe, reducing speculative changes, fake test passes, fixing only symptoms without addressing root causes, and the problem of fixing one issue while breaking many others.

## Core Principles

* Understand the problem first, then modify the code.
* Reproduce the bug first, then write the fix.
* Make the test fail first, then make it pass.
* Verify that the test is valid first, then trust the test result.
* Prefer minimal, verifiable, and reversible fixes.
* When a structural problem is discovered, clarify the repair level first; do not use the name of a hotfix to perform an unbounded refactor.
* Do not casually delete debug logs, reproduction scripts, or现场 evidence before validation is complete.

## Hard Rules

* No reproduction, no repair.
* No failing test, no modification to business code, unless the user explicitly states that the current project has absolutely no practical automated testing foundation; even in that case, a minimal manual reproduction must still be performed first and evidence must be recorded.
* If you have not seen “red first, then green,” the fix is not considered complete.
* It is not allowed to modify test expectations to accommodate the current incorrect behavior.
* It is not allowed to delete temporary logs that help locate the problem unless the fix has already been proven effective and the cleanup stage has been explicitly entered.

## Output Format

Each time this skill is executed, first output the following structured judgment, then start working:

### 1. Problem Summary

* Expected behavior:
* Actual behavior:
* Scope of impact:
* Risk level:
* Whether it can currently be reproduced stably:

### 2. Three-Layer Analysis

* Symptom layer: What problem did the user see?
* Direct root cause layer: Which logic, state, contract, timing, or data caused this failure?
* Structural layer: Is this a derivative symptom of a larger design problem?

### 3. Repair Level Decision

Choose one of the following three levels and explain the reason:

* Patch: A local patch. Suitable for isolated logic errors, boundary value errors, missing null handling, and simple contract omissions.
* Local Refactor: A local refactor-style fix. Suitable when similar logic is scattered around, local module boundaries are chaotic, and directly applying a patch would continue to rot the code.
* Structural Follow-up: Stop the bleeding first, then register follow-up structural governance. Suitable for obvious systemic problems where it is currently not appropriate to directly launch a major change.

### 4. Execution Plan

* Reproduction method:
* Tests planned to be added or modified:
* Expected minimal repair surface:
* Validation scope that needs to be run:

## Execution Process

## Phase 0: Clarify Context

Prioritize collecting the following information yourself; do not guess:

* Error messages, stack traces, log snippets
* Reproduction steps
* Input data / request parameters / sample files
* Environment information: local, testing, production, system version, dependency versions, configuration differences
* Recent related changes: code, configuration, data, dependencies, deployment

## Phase 1: Preserve the Scene and Reproduce

Goal: Prove that the bug truly exists and that the reproduction path is credible.

Execution requirements:

* Prefer existing reproduction steps.
* Try to construct a minimal reproduction.
* Only add temporary logs, traces, dumps, or extra assertions when necessary.
* Save key evidence: inputs, outputs, stack traces, timelines, environment differences, screenshots, or command outputs.
* Distinguish among three states: stable reproduction, occasional reproduction, and unable to reproduce.
* If it is an occasional problem, prioritize checking concurrency, caching, asynchrony, retries, clocks, external dependencies, and environment differences.

When reproduction fails:

* Do not enter the repair phase.
* Output “currently cannot be reproduced stably.”
* Provide the minimal information needed next or a plan to strengthen observability.

## Phase 2: Choose the Appropriate Test Level

Choose the test that can hit the bug quickly and stably according to the bug type:

* Pure logic / boundary values / pure functions: prioritize unit tests
* Module collaboration / state flow: prioritize integration tests
* Page interaction / user paths: prioritize component tests or end-to-end tests
* API contracts / serialization / parameter validation: prioritize API or contract tests
* Concurrency / timing / retries / idempotency: prioritize controllable integration tests or dedicated concurrency tests

Selection principles:

* Prioritize tests that are fast, stable, and precise in localization.
* If a small test can hit the issue, do not start with a large and slow end-to-end test.
* Avoid excessive mocking that bypasses the real issue.
* Avoid flaky tests; when necessary, eliminate randomness, time dependencies, network dependencies, and shared-state dependencies.

## Phase 3: Write the Failing Test First

Goal: Turn the bug into an automated check.

Requirements:

* Write the test first, then modify the business code.
* The test must fail before the fix.
* The cause of failure must directly correspond to this bug, not to environment issues, errors in the test itself, or irrelevant assertions.
* Test inputs should be as small as possible, but sufficient to hit the issue.
* For production bugs, in addition to the current reproduction case, consider adding missing tests of the same kind.

## Phase 4: Review the Test Itself

Before modifying business code, review the test first:

* Does it really hit the bug path?
* Do the assertions accurately express the expected behavior?
* Does it treat the current incorrect behavior as correct behavior?
* Does excessive mocking bypass the real logic?
* Does it depend on random numbers, system time, or a shared environment, causing instability?
* Does it only cover the current point while missing obvious adjacent boundaries?

Only after confirming that the test is valid is it allowed to enter the repair phase.

## Phase 5: Analyze the Root Cause

Output a brief root-cause explanation first, then modify the code. At a minimum, answer:

* At what layer does the problem occur: input validation, business logic, state management, caching, concurrency, data model, API contract, external dependency, configuration, or deployment?
* Why does the current implementation fail?
* Is this failure an isolated error, or a symptom of a structural problem?
* Why was this level chosen: Patch / Local Refactor / Structural Follow-up?
* If only a local fix is done now, what risks still remain later?

If the root cause cannot be explained clearly, pause the repair and continue observation or narrow the reproduction range.

## Phase 6: Implement the Minimal Fix

Requirements:

* Only modify code directly related to the root cause.
* Keep the repair surface as small as possible.
* Do not casually modify unrelated code.
* Temporary debug logs should be kept by default until validation is complete.
* If it is judged to belong to Local Refactor, local duplicate logic may be reorganized within clearly defined boundaries, but it must be explained why this reduces risk rather than expands it.
* If it is judged to be a structural problem and the current issue is urgent, first apply a stop-the-bleeding fix, then register follow-up governance; do not expand changes without boundaries in a single fix.

## Phase 7: Validate the Fix

At a minimum, complete the following validation:

* The newly added failing test has turned green
* Relevant old tests still pass
* Regression tests for relevant modules pass
* Necessary lint / typecheck / build pass
* When necessary, manually reproduce the original path to confirm that the user-visible problem has truly disappeared
* If the issue is related to logs, monitoring, performance, or concurrency, check whether key metrics or key logs match expectations

If only “that one newly added test” was validated, do not claim that the fix is complete.

## Phase 8: Add Regression Coverage and Expand the Defense Line

After the fix is complete, consider adding:

* Adjacent boundary value tests
* Tests for similar inputs
* Tests for the same root cause at other call sites
* Contract, serialization, and exception-path tests
* Tests for paths that were historically prone to problems

The goal is not to mechanically increase the number of tests, but to fill the defensive gaps exposed by this bug.

## Phase 9: Wrap Up

Finally, do these things:

* Clean up temporary logs, temporary code, and debug switches
* Retain formal logs and monitoring that have long-term value
* Record the root cause, repair level, scope of impact, and testing supplements
* If a structural problem is found but this time only a stop-the-bleeding fix is done, list follow-up items separately instead of treating the problem as “solved by default”

## Criteria for Identifying Structural Problems

When the following signals appear, prioritize suspecting that this is not an isolated bug, but a derivative of a bigger problem:

* Similar bugs appear repeatedly
* The same patch has to be copied to multiple places
* Module responsibilities are chaotic and boundaries are unclear
* Tests are very hard to write and require绕 many dependencies
* One modification often affects a large area
* The same business rule is scattered across multiple files or repeatedly implemented across multiple layers
* There is long-term contract drift among frontend and backend, the database, and interface documentation

Handling method:

* Urgent problems: stop the bleeding first, then record structural governance tasks
* Non-urgent problems: local refactor-style fixes are allowed, but boundaries, risks, and validation scope must be clearly defined

## Common Mistakes That Must Be Avoided

* Seeing an error and directly guessing the code location to modify
* Fixing the code first, then adding a “passing test”
* Tests only verifying that “the function was called,” instead of verifying the behavior the user actually cares about
* Using mock to bypass the problem path
* Weakening assertion strength just to make tests pass
* Performing large-scale refactors without sufficient safety nets
* Not running related regression checks after the fix is complete
* Deleting key logs while locating the issue

## Definition of Done

Only when all of the following conditions are met at the same time can this bug fix be considered complete:

* The bug has been reproduced, or its evidence chain is complete and credible
* There is a failing test that can expose the problem, and it did indeed fail before the fix
* The root cause has been clearly analyzed
* The repair level has been clearly defined
* The newly added test turns green after the fix
* Relevant regression checks pass
* Manual paths or key observational validation pass
* Temporary debugging traces have been handled according to the phase

Finally output the root cause of the bug as well as your actual analysis and handling process.
