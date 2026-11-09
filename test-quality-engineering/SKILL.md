---
description: Design, generate, review, and optimize automated tests with
  high defect-detection value and minimal noise. Use when an AI coding
  agent is asked to add tests, write regression tests, review test
  quality, remove redundant tests, improve test suites, or verify that
  tests catch real defects. Reject tests that merely restate
  implementation, assert superficial text or element presence, over-mock
  behavior, duplicate existing coverage, or manipulate the test
  environment to pass.
name: test-quality-engineering
---

# Test Quality Engineering

## Mission

Produce the **smallest maintainable test suite that gives strong,
independent evidence that important product behavior is correct**.

This skill has two inseparable responsibilities:

1.  **Quality guidance:** teach the agent what is worth testing, which
    test layer to use, how to design a meaningful oracle, and how to
    write stable, diagnosable tests.
2.  **Quality enforcement:** prevent low-value tests from being created;
    detect hollow assertions, implementation echoes, excessive mocks,
    duplicate coverage, test manipulation, and test-suite bloat.

Do not optimize for test count, assertion count, line coverage, branch
coverage, or green CI by themselves.

A test is valuable only when it protects a meaningful contract or risk
and has a credible way to detect a relevant defect.

> A test must not merely demonstrate that the current implementation
> does what the current implementation does. It must independently check
> that the system does what it is supposed to do.

This skill is framework-agnostic. Adapt commands and syntax to the
repository's actual stack.

------------------------------------------------------------------------

## Operating Modes

Select the mode that matches the task. If the user asks for more than
one, combine them.

### `write`

Design and add tests for a feature, change, or bug fix. Inspect existing
tests first, identify the important risks, select the smallest adequate
test layer, and apply every quality gate before adding a test.

### `review`

Audit existing tests without changing them initially. Identify tests
that are hollow, misleading, brittle, duplicated, over-mocked, or
disconnected from an actual contract. Report concrete evidence and
prioritize by impact.

### `optimize`

Reduce test-suite cost and noise while preserving meaningful
defect-detection capability. Merge or remove tests only when their
unique protection is demonstrably redundant. Do not equate similar code
coverage with equivalent test value.

Do not silently switch from `review` to destructive cleanup. Obtain
authorization before deleting or materially weakening existing tests
unless the user explicitly requested cleanup.

------------------------------------------------------------------------

## Non-Negotiable Principles

1.  **Behavior over implementation.** Test externally meaningful
    behavior, stable contracts, invariants, and important side
    effects---not private methods, incidental call order, temporary
    variables, or internal structure.
2.  **Independent oracle.** Expected behavior must come from a source
    independent of the implementation under test.
3.  **Defect hypothesis first.** Every test must name a plausible defect
    it is intended to detect.
4.  **Minimal sufficient coverage.** Add one test for each distinct,
    important failure mode---not one test for every line, branch, field,
    or imaginable input.
5.  **No test for ceremony.** If no meaningful risk or contract needs
    protection, add no test and explain why briefly.
6.  **Real behavior before mocks.** Exercise real code and real
    collaboration where practical; isolate only uncontrollable external
    boundaries.
7.  **No self-certification.** The code authoring agent's interpretation
    is not, by itself, an independent specification.
8.  **No gaming.** Never make a test pass by weakening its oracle,
    hiding failures, skipping execution, or modifying the system under
    test from the test harness.
9.  **Evidence over claims.** Report only test commands that were
    actually run after the latest relevant edits.
10. **Coverage is diagnostic, not a goal.** Coverage can reveal
    unexamined code, but it cannot establish that a test is useful.

------------------------------------------------------------------------

## Workflow for Writing Tests

### Step 1: Inspect before designing

Before writing anything:

-   Read the relevant production code and its public interfaces.
-   Read nearby tests, shared fixtures, test helpers, and repository
    testing conventions.
-   Identify the actual test command and the scope it runs.
-   Search for existing tests that already protect the same behavior.
-   Check project instructions such as `AGENTS.md`, `CLAUDE.md`, and
    local contribution guides.

Do not create a new test file or helper before checking whether an
existing test can be extended.

### Step 2: Establish the source of truth

Derive expected behavior from the strongest available source, in this
order:

1.  Explicit acceptance criteria or user-approved requirements.
2.  Published API, protocol, schema, or domain contract.
3.  Product behavior confirmed by the user or a trusted product
    specification.
4.  A verified historical bug report or regression requirement.
5.  An existing, intentionally maintained contract test.
6.  Existing implementation behavior, only when explicitly writing a
    characterization test for legacy behavior.

Do not invent requirements from variable names, comments, implementation
branches, or what seems conventional.

If expected behavior is ambiguous and materially affects the test: - Ask
one focused clarification when possible. - Otherwise record the
assumption and do not present it as a confirmed requirement. - Do not
turn an unverified assumption into a permanent regression test.

A characterization test may preserve legacy behavior, but label it as
characterization. It does not prove that the behavior is correct or
desirable.

### Step 3: Identify a small set of high-value risks

Ask:

-   What important contract could break?
-   What realistic defect could violate it?
-   What would the user, caller, or dependent system observe?
-   What is the impact and likelihood of that defect?
-   Is this risk already protected by an existing test?

Prioritize: - Critical business rules and state transitions. - Security,
authorization, isolation, and data-integrity boundaries. - Important
calculations and transformations. - Persistence and externally visible
side effects. - Previously reported defects. - High-risk integration
points. - Boundary conditions with a credible failure mechanism.

Do not mechanically enumerate null, empty, invalid, duplicate, timeout,
permission, and exception cases for every function. Include a case only
when it is relevant to the contract or a credible risk.

### Step 4: Write a test hypothesis before writing test code

For each proposed test, be able to state:

-   **Contract:** what stable behavior or invariant is protected?
-   **Defect hypothesis:** what specific wrong implementation would this
    test catch?
-   **Oracle:** where does the expected result come from, independently
    of the implementation?
-   **Observation:** what externally meaningful result proves the
    behavior?
-   **Uniqueness:** why do existing tests not already provide this
    protection?
-   **Layer:** what is the cheapest reliable test layer?

If these cannot be answered, do not add the test yet.

Keep this planning lightweight. Do not generate a huge scenario matrix
just to look thorough.

### Step 5: Choose the smallest adequate test layer

Use the cheapest layer that can credibly expose the target defect:

-   **Unit:** pure logic, domain rules, calculations, parsers,
    deterministic state transitions.
-   **Integration:** collaboration between owned modules, database
    persistence, transactions, queues, middleware, serialization, and
    configuration wiring.
-   **API/contract:** externally observable request/response and
    compatibility guarantees.
-   **E2E:** a small number of critical user journeys where wiring
    across the real system is itself the risk.

Do not use a unit test when the suspected defect exists only in
integration. Do not use E2E to test every branch of a pure function. Do
not duplicate the same contract at every layer without a distinct
reason.

For a critical workflow, prefer a small number of end-to-end checks plus
focused lower-level tests for complex rules---not a large pyramid of
overlapping tests.

### Step 6: Design a meaningful oracle

The oracle is the independent basis for deciding whether the behavior is
correct.

Good oracle sources include: - Explicit acceptance criteria. -
Independently calculated expected values. - A small, human-reviewed
golden dataset. - Domain invariants. - A protocol or schema
specification. - A separately implemented reference calculation, when
genuinely independent. - A verified historical failure and its expected
correction.

Never derive expected output by calling the function under test, copying
its algorithm, reusing its internal helper, or reading the actual result
and then declaring that result expected.

For calculations, use hand-checked values or independently derived
properties. For complex outputs, verify the important invariant or
contract rather than reproducing the entire implementation in the test.

### Step 7: Implement the smallest useful test

-   Prefer one clear scenario and one core action.
-   Use explicit, minimal, semantically named test data.
-   Use parameterization only for cases that exercise the same rule with
    different data.
-   Keep setup visible; do not hide important behavior in opaque
    helpers.
-   Assert the externally meaningful outcome.
-   Include only the assertions necessary to establish the contract.
-   Keep failure messages diagnostic.

Multiple assertions are acceptable when together they establish one
contract. Do not split one coherent scenario into many trivial tests
merely to increase test count.

### Step 8: Run and verify

-   Run the narrowest relevant test command.
-   Confirm the intended test was collected and executed---not skipped,
    filtered out, or accidentally excluded.
-   Confirm the test fails for the intended reason when testing a known
    defect or using a controlled negative case.
-   Fix the production defect, then confirm the test passes.
-   Run the relevant broader suite after the final code or test edit.
-   Inspect the full exit status and summary; do not infer success from
    partial output.

For a bug fix, prefer a regression test that reproduces the bug before
the fix (RED), then passes after the fix (GREEN).

For a new feature, derive tests from the accepted behavior contract. Do
not require the test to be written after implementation merely to
satisfy a ritual; the critical requirement is that the oracle is
independent of the implementation.

------------------------------------------------------------------------

## Strict Assertion Policy: Reject Shallow Evidence

An assertion is not valuable just because it is an assertion. Its value
depends on the contract it verifies and the defect it can detect.

### Default-reject assertions

Do not create a test whose only meaningful check is any of the
following:

-   A page, component, button, object, record, or string merely exists.
-   A function does not throw for an uninteresting input.
-   A response has status `200` without checking the relevant response
    contract or effect.
-   A mock was called, without verifying the required behavior at the
    boundary.
-   A value is merely truthy, non-null, non-empty, or defined.
-   A static label, heading, placeholder, or arbitrary phrase appears in
    the page.
-   A log line, console message, or debug string contains a keyword.
-   A snapshot matches a large output without a clear reason why that
    output is a stable contract.
-   The result equals a value computed by the same implementation or the
    same logic being tested.

Examples of low-value tests:

``` ts
expect(screen.getByText("Dashboard")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
expect(result).toBeTruthy();
expect(result).not.toBeNull();
expect(() => run()).not.toThrow();
expect(response.status).toBe(200);
expect(mockService.save).toHaveBeenCalled();
expect(output).toContain("success");
```

These checks are not universally forbidden in every context. They are
rejected when they are the entire test or when they do not establish a
meaningful contract.

### Text and copy assertions: especially strict

**Do not generate text-presence tests by default.**

Tests such as "the page contains `xxx`", "the response includes
`success`", or "the heading `Welcome` exists" are usually low-value.
They often verify static copy rather than product behavior, break on
harmless wording changes, and provide little evidence that the feature
works.

For UI tests, prefer verifying: - The user can perform the intended
action. - The system transitions to the correct state. - The correct
data is submitted or persisted. - The expected workflow completes. - The
user receives the necessary accessible feedback when that feedback is
part of the contract.

For example, instead of only checking that a "Saved" label exists,
perform the save operation and verify the resulting persisted state or a
meaningful state transition. A success message may be a secondary
assertion if it is part of the user contract.

For AI-generated or dynamic natural-language content: - Do not use
exact-string, substring, keyword-presence, or phrase-presence checks as
the primary quality test. - Do not assume that the presence of a
required word proves relevance, correctness, completeness, or
usefulness. - Prefer structured output contracts, factual consistency
against supplied sources, task completion criteria, domain invariants,
and a small human-reviewed evaluation set. - Use semantic or model-based
judges only as supplemental evaluation. Define a stable rubric and known
failure examples; do not make a nondeterministic judge the sole
pass/fail gate for ordinary CI. - Test exact wording only when exact
wording is genuinely contractual.

Text assertions are justified when the text itself is the product
contract, for example: - Legally or regulatorily required wording. - A
protocol-defined error message or machine-readable response. - A stable
CLI output consumed by another program. - A specified template or
deterministic formatter. - A critical accessibility label or instruction
whose exact wording is required. - A localization key or translation
requirement under explicit acceptance criteria.

Even then, test the smallest relevant text contract. Do not snapshot an
entire page or response when a focused assertion is sufficient.

### Stronger assertion examples

Weak:

``` ts
expect(screen.getByText("Saved")).toBeInTheDocument();
```

Stronger, when persistence is the actual contract:

``` ts
await user.click(screen.getByRole("button", { name: "Save" }));

const savedRecord = await repository.findById(recordId);

expect(savedRecord).toMatchObject({
  id: recordId,
  title: "Quarterly plan",
  status: "saved",
});
```

Weak:

``` ts
expect(response.status).toBe(200);
```

Stronger, when the API contract includes authorization and persisted
state:

``` ts
expect(response.status).toBe(201);
expect(response.body.id).toEqual(expect.any(String));
expect(await repository.findById(response.body.id)).toMatchObject({
  ownerId: authenticatedUser.id,
  amount: 1250,
});
```

These examples are illustrative. Do not copy them if the repository's
actual contract differs.

------------------------------------------------------------------------

## Anti-Patterns the Agent Must Not Introduce

### 1. Implementation echo / confirmation tests

A test repeats the implementation's branches, constants, or algorithm
and therefore shares its mistakes.

Reject tests whose expected result is generated by the same code path as
the actual result.

### 2. Tautological or hollow tests

Examples: - Comparing a value with itself. - Asserting only that setup
completed. - No meaningful assertion. - Catching an exception and then
passing. - Asserting only that a mock returned the value configured by
the test.

### 3. Text-presence and render-only tests

Examples: - "The page contains this heading." - "The button exists." -
"The response contains the word success." - "The component renders."

These are not sufficient tests of a feature. Test the meaningful
interaction, state transition, contract, or side effect instead.

### 4. Mock theatre

Reject tests that: - Mock the unit's own core logic. - Mock every
internal collaborator until no real behavior remains. - Assert only that
mocks were called. - Configure a mock to return the expected result and
then assert that same result. - Use a fake implementation that
duplicates the production algorithm.

Mock only at genuine external boundaries (payment providers, email/SMS
gateways, third-party APIs, uncontrollable services, or expensive
infrastructure). Prefer real owned components and realistic integration
tests when practical.

A call assertion is acceptable only when the call itself is the stable
external contract---for example, a message must be dispatched to a
specific boundary---and the assertion verifies meaningful arguments or
effects.

### 5. Implementation-coupled tests

Do not test private methods, incidental helper calls, exact internal
call order, class names, DOM hierarchy, or internal state layout unless
that detail is itself a documented contract.

A harmless refactor should not require rewriting a large portion of the
suite.

### 6. Duplicate and combinatorial test bloat

Do not: - Add another test for a contract already adequately
protected. - Create a separate test for every value in a large matrix
without a distinct risk. - Repeat the same assertion at controller,
service, and repository layers without layer-specific value. - Generate
tests for getters, trivial constructors, simple pass-throughs, or
constants without a real risk.

Use parameterized tests for equivalent cases. Keep separate tests when
they protect different failure modes or produce materially better
diagnosis.

### 7. Spec hallucination

Do not invent product requirements, validation rules, error messages,
roles, or workflows because they seem conventional. Ask, record an
assumption, or leave the behavior untested until its contract is known.

### 8. Flaky and environment-dependent tests

Avoid arbitrary sleeps, uncontrolled clocks, random values, shared
mutable state, real third-party networks, order dependence, and implicit
global fixtures.

Wait for observable conditions. Control time and randomness. Make setup
and cleanup explicit.

### 9. Test manipulation / green-at-any-cost behavior

Never silently: - Weaken an assertion to match incorrect implementation
behavior. - Change expected values merely because the current code
returns something else. - Skip, disable, quarantine, or delete a failing
test to obtain a green run. - Add broad `try/catch` blocks that hide
failures. - Lower coverage thresholds or change runner configuration to
conceal failures. - Patch the application, DOM, runtime state, or
production module from an E2E test to make the feature appear to work. -
Intercept the very behavior under test and return a fabricated success.

A test may be corrected or removed when it is demonstrably wrong,
obsolete, or outside the approved contract. Explain the evidence and
impact. If the change materially weakens protection, request
authorization.

Controlled stubbing of unrelated external services is allowed. It must
not replace the product behavior being verified.

### 10. False test-completion claims

Never claim tests passed unless: - The relevant command actually ran. -
It ran after the latest relevant edit. - The intended tests were
collected and executed. - The exit status and summary support the claim.

Clearly distinguish `passed`, `failed`, `skipped`, `not run`, and
`inconclusive`.

------------------------------------------------------------------------

## Reviewing Existing Tests

For each suspicious test, inspect its purpose and behavior before
labeling it garbage.

Ask:

1.  Which contract does it protect?
2.  What realistic defect makes it fail?
3.  Is its expected result independent of the implementation?
4.  Does it verify an observable outcome or only an implementation
    detail?
5.  Does it add unique protection beyond existing tests?
6.  Is its mock boundary justified?
7.  Is it deterministic and diagnosable?
8.  Is its maintenance and execution cost justified by the risk?

Classify findings:

-   **KEEP:** meaningful, unique, stable protection.
-   **IMPROVE:** valid intent, but weak oracle, excessive mock, brittle
    setup, or poor diagnosis.
-   **MERGE:** overlaps another test and adds no distinct failure
    detection; preserve any unique scenario in the surviving test.
-   **REMOVE CANDIDATE:** no traceable contract or risk, no meaningful
    assertion, or demonstrably redundant.
-   **INVESTIGATE:** intent or expected behavior is unclear; do not
    delete based on guesswork.

Do not classify a test as redundant solely because it covers the same
lines, calls the same method, has a similar name, or looks structurally
similar. Different tests can protect different contracts and catch
different bugs.

When reporting a finding, include the test location, the concrete
problem, the likely consequence, and a minimal correction.

------------------------------------------------------------------------

## Optimizing an Existing Test Suite

### Safe optimization process

1.  Establish a baseline: test command, runtime, pass/fail/skip counts,
    and current coverage if available.
2.  Group tests by protected contract and defect hypothesis---not merely
    by file or code coverage.
3.  Identify duplicate setup, duplicate assertions, overlapping
    scenarios, flaky tests, and slow tests.
4.  For each proposed merge or deletion, identify what protection would
    be lost.
5.  Preserve unique cases and failure diagnosis when merging.
6.  Run the affected tests and relevant suite after changes.
7.  Use mutation testing or other defect-injection techniques on
    high-risk contracts when practical.
8.  Compare runtime and evidence before and after.
9.  Report removed, merged, retained, and unresolved tests with reasons.

### Mutation testing

Mutation testing is useful evidence, not a proof of correctness.

Use it selectively for critical business rules, security checks,
calculations, and regression-sensitive logic. Mutations may be
equivalent or irrelevant; inspect survivors rather than blindly
maximizing a score.

A surviving mutant may indicate: - A missing test. - A weak assertion. -
An unreachable or equivalent mutation. - A behavior not covered by the
contract.

A killed mutant only shows that some test detects that code change. It
does not prove that the expected behavior was specified correctly.

Never delete a test merely because another test kills the same
line-level mutant. Compare the actual failure modes and protected
contracts.

------------------------------------------------------------------------

## Mocking and Test Boundaries

Prefer real implementations for components owned by the project.

Mock or stub a dependency only when it is: - External and outside the
team's control. - Expensive, slow, or unreliable. - Side-effectful in a
way that must not happen in tests. - Irrelevant to the behavior being
verified.

When mocking: - Mock at the boundary, not throughout the internal call
graph. - Keep the mock behavior minimal and explicit. - Assert
meaningful boundary effects only when they are part of the contract. -
Do not let the mock supply the very behavior the test claims to
verify. - Use contract or integration tests to verify assumptions about
external interfaces where appropriate.

------------------------------------------------------------------------

## Stability and Diagnosis

A high-value test must be repeatable and useful when it fails.

-   Control time, time zones, randomness, locale, and environment
    variables.
-   Isolate test data and shared state.
-   Avoid execution-order dependencies.
-   Avoid arbitrary sleeps; wait for a specific condition.
-   Do not rely on live third-party services in routine CI.
-   Keep failure scope narrow enough to identify the likely cause.
-   Include useful expected/actual values and scenario context.
-   Capture logs, traces, screenshots, or request details only when they
    materially help diagnose the relevant failure.

If a test is flaky, investigate the root cause. Re-running can help
diagnose flakiness but cannot turn an intermittent failure into a valid
pass.

------------------------------------------------------------------------

## Test Quality Gate

Before adding or retaining a test, evaluate these mandatory questions:

  -----------------------------------------------------------------------
  Gate                                Required answer
  ----------------------------------- -----------------------------------
  Contract                            Can the protected behavior be
                                      stated precisely?

  Risk                                Is there a credible defect or
                                      meaningful regression to catch?

  Oracle                              Is the expected result independent
                                      of the implementation?

  Observation                         Does the test verify a meaningful
                                      outcome, not superficial presence?

  Uniqueness                          Does it add protection not already
                                      adequately provided?

  Boundary                            Is the chosen test layer and mock
                                      boundary appropriate?

  Stability                           Is it deterministic, isolated, and
                                      diagnosable?

  Evidence                            Can execution prove that the test
                                      actually ran and detects the target
                                      defect?
  -----------------------------------------------------------------------

If a critical gate fails, do not add the test. Explain the missing
contract, evidence, or justification instead of inventing a test to fill
a quota.

Not every test needs a mutation tool run. For ordinary tests, a concrete
defect hypothesis and a sound independent oracle are required. For
high-risk tests, add executable mutation or negative-control evidence
where feasible.

------------------------------------------------------------------------

## Expected Output

Keep the explanation concise. Do not produce a long test plan unless
requested.

For `write`: 1. State the important risks and chosen test layer briefly.
2. Add only tests that pass the quality gate. 3. Report what was tested
and what was intentionally omitted. 4. Report the exact command run and
truthful result. 5. Mention unresolved assumptions or unavailable
verification.

For `review`: 1. Report high-impact findings first. 2. Cite test file
and test name. 3. Explain why each test is low-value or risky. 4.
Suggest the smallest useful correction. 5. Do not rewrite the suite
unless asked.

For `optimize`: 1. Report baseline and final runtime/results when
available. 2. List tests kept, improved, merged, removed, or requiring
investigation. 3. Explain why each deletion or merge preserves the
intended contract. 4. State any coverage or mutation evidence and its
limitations.

Never pad the output with a large list of hypothetical tests.

------------------------------------------------------------------------

## Final Rule

**Write fewer, stronger tests.** Every test must protect a real contract
or meaningful risk, use an independent oracle, observe a consequential
outcome, and add unique value. Reject tests written for ceremony,
coverage numbers, textual presence, mock activity, or green status
alone.
