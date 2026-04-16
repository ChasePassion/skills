---
name: test-best-pratice
description: A general skill for writing high-quality automated tests. Use it to design and implement stable, maintainable, and diagnosable tests for functions, modules, APIs, components, pages, and critical business workflows.
---

# test-best-pratice

## Goal

Write tests with a **high signal-to-noise ratio**:

- Fail when something is actually wrong, and do not fail randomly when nothing is wrong.
- Make it easy to locate the cause after a failure.
- Require minimal changes when internal implementation is refactored.
- Run fast enough for daily development and CI.
- Stay maintainable over time instead of becoming team overhead.

This skill is not tied to any specific framework. It can be used for unit tests, integration tests, API tests, component tests, and end-to-end tests.

---

## Core Principles

### 1. The goal of testing is to build confidence, not to chase coverage

Ask first:

- What are the most important user scenarios for this code?
- Which paths would cause the greatest business impact if they broke?
- Which edge cases are most likely to produce bugs?

Do not start with “I need to test every function and every branch.” Start with **use cases**. Coverage can be a useful signal, but it cannot replace judgment about test value.

### 2. Test behavior and contracts, not implementation details

Prefer testing:

- Public API behavior
- User-observable outcomes
- Input/output contracts between modules
- Whether critical side effects happen, such as database writes, message dispatch, or state changes

Avoid directly testing:

- Private methods
- Internal state layout
- Temporary variables
- Component internals
- Assertions written only to fit the current implementation

Principle: **implementations may be refactored, but contracts should not change casually.**

### 3. Choose the smallest test that gives enough confidence

Test size is not “smaller is always better” or “bigger is always better.” Choose the **cheapest layer that gives enough confidence**.

Default decision order:

1. If a unit test can verify it reliably, do not jump to UI or E2E.
2. If you need to verify collaboration between modules, prefer an integration test.
3. Use a small number of end-to-end tests only for high-value flows such as payments, login, or submission.

Remember: **a large number of slow, brittle high-level tests is worse than a well-layered test suite.**

### 4. Stability matters more than “it looks like we tested a lot”

A flaky test destroys trust in the test suite.

Actively control anything that introduces instability:

- Time
- Time zone
- Randomness
- Network jitter
- Third-party services
- Test execution order
- Shared state across tests
- Uncertain async timing

### 5. A test is both documentation and an alarm

A high-quality test should make it obvious, from its name and assertions alone:

- What guarantee this feature provides
- Which edge case or historical pitfall it protects against
- Which business rule has been broken when it fails

So tests should first be **clear**, and only then “beautifully abstract.”

---

## When to Use

Use this skill when you need to:

- Add tests for a new feature
- Write regression tests for a bug fix
- Build a safety net before refactoring
- Define behavioral contracts for shared modules
- Verify APIs, components, pages, or workflows reliably
- Clean up flaky tests or low-value tests

---

## Output Standards

A finished test should satisfy these standards as much as possible:

1. **Clear purpose**: every test should answer “what does this protect?”
2. **Single failure reason**: a failure should not leave people guessing.
3. **Independent execution**: it should pass alone and in random order.
4. **Repeatability**: the same commit should produce the same result in the same environment.
5. **Readability**: names, data, and assertions should be easy to understand.
6. **Maintainability**: refactoring internals should not require broad test rewrites.
7. **Reasonable speed**: tests should be fast by default; slow tests need a strong reason.

---

## Workflow

### Step 1: Identify the test target and the risk

Before writing a test, clarify:

- What is the target: function, module, API, component, page, or workflow?
- What is its external contract?
- What is the main success path?
- What are the main failure paths?
- Where are the high-risk edges?
- How expensive is failure?

Prioritize coverage for:

- Core success paths
- Boundary conditions most likely to fail
- Previously reported bugs
- Critical rules that refactors could easily break

### Step 2: Choose the test layer

Use the following guidance:

#### Unit tests
Good for:

- Pure functions
- Rule evaluation
- Data transformation
- Validation logic
- Sorting, filtering, aggregation
- Single-step state-machine behavior

Characteristics:

- Fast
- Stable
- Precise diagnosis
- Low cost

Do not use them to verify:

- Real collaboration across many modules
- UI interaction flows
- Real network or database integration

#### Integration tests
Good for:

- Service and database collaboration
- Combined behavior across modules
- API routes with middleware and persistence
- Components working with state management or the data layer

Characteristics:

- More realistic than unit tests
- Higher confidence
- Moderate cost

They are often high leverage because they balance realism and maintenance cost well.

#### End-to-end tests (E2E)
Good for:

- Login
- Registration
- Checkout and payment
- Form submission
- Critical business flows
- Cross-page workflows

Characteristics:

- Closest to the user
- Most expensive, slowest, and easiest to make brittle

Strategy:

- Cover only a small number of critical happy paths
- Do not use E2E as a substitute for lower-level tests

### Step 3: Turn scenarios into a test checklist

For every test target, list at least:

- Valid input
- Boundary input
- Invalid input
- Null or missing values
- Duplicate or conflicting input
- Insufficient permissions
- Timeout, failure, or exception paths
- Idempotency, if relevant
- Sorting, pagination, precision, and time zone, if relevant

Do not start coding immediately. List scenarios first.

### Step 4: Design test data

Test data should be:

- Minimal, containing only what the test needs
- Semantically clear, so the purpose is obvious from the name
- Free from magic numbers and meaningless strings
- Explicit rather than implicitly reused

Prefer:

- Factory functions
- Fixtures
- Builders
- Clearly named test samples

Avoid:

- Oversized shared test datasets
- “Universal” objects created only for reuse
- Implicit dependence on a global seed database

### Step 5: Write tests in AAA structure

Recommended structure:

1. **Arrange**: prepare inputs, dependencies, and initial state
2. **Act**: execute one core action
3. **Assert**: verify externally visible results

Constraints:

- A test should usually perform only one core action
- Do not scatter assertions everywhere
- If there are too many assertions, check whether the scope is too large

### Step 6: Prefer meaningful assertions

Characteristics of good assertions:

- They assert business outcomes rather than procedural noise
- They are easy to understand when they fail
- They are strongly tied to the purpose of the test

Prefer asserting:

- Return values and output structure
- Persisted results
- User-visible text and state
- Clear error types and messages
- Required side effects

Avoid:

- Meaningless “object exists” assertions
- Low-value assertions such as “the page rendered”
- Assertions about intermediate steps that are irrelevant to the business outcome

### Step 7: Handle external dependencies

#### Use real collaboration when practical; do not mock by reflex

For collaboration between modules you control, prefer assembling the real pieces and testing them together. Only consider mocks or stubs when the dependency is:

- Unstable
- Slow
- Expensive
- Hard to construct
- Uncontrollable
- Side-effectful, such as sending real SMS or charging money

#### Mock boundaries

Good places to mock:

- Third-party payment services
- SMS or email services
- Cloud storage
- External HTTP APIs
- Slow dependencies that are irrelevant to the current test

Do not over-mock:

- Large parts of your own internal system
- Everything, just to make the test easier to write

Rule of thumb: **mock at the system boundary, not across the entire inside of the system.**

### Step 8: Control stability

Eliminate these sources of non-determinism whenever possible:

- Freeze the clock or inject a time source
- Fix the random seed
- Create state explicitly before each test and do not rely on someone else to clean up
- Avoid leftover shared database state
- Avoid dependence on execution order
- Do not call real third-party networks
- Do not use arbitrary sleeps or waits

Waiting strategy:

- Wait for a clear condition
- Wait for an element to become visible, text to appear, a request to finish, or state to be persisted
- Do not write “wait 2 seconds and see”

### Step 9: Check whether the test is brittle

After writing the test, ask:

- If I refactor the internals without changing behavior, will this test fail for no good reason?
- If the execution order changes, will this test break?
- If the network or machine is slightly slower, will this test break?
- If the UI copy or DOM structure changes slightly, will this test trigger mass failures?
- If this test fails, can I know the rough cause within one minute?

If the answers are poor, improve the test.

---

## Specific Rules by Test Type

### A. Unit test best practices

1. Prefer testing pure logic and boundary conditions.
2. Test the public API, not private methods.
3. Each test should protect one rule.
4. Use parameterized tests for similar input families.
5. Test error paths too, and assert error type or key message.
6. Name tests as “scenario + expected result.”
7. Do not turn the test into another complicated business program.
8. Avoid using real databases or networks in unit tests.

#### Good naming style

- `returns_discounted_price_for_vip_user`
- `rejects_empty_email`
- `keeps_original_order_when_scores_are_equal`

### B. Integration test best practices

1. Cover key collaboration paths, not every possible combination.
2. Prefer real assembly, mocking only external boundaries.
3. Manage the lifecycle of test data carefully.
4. For databases, use controlled schema setup, cleanup, transaction rollback, or temporary instances.
5. Assert side effects clearly for queues, caches, and file systems.
6. In API tests, verify status code, response body, persisted results, and permission constraints together.

### C. UI and component test best practices

1. Query elements from the user’s perspective, preferring role, label, and text.
2. Do not depend on class names, DOM hierarchy, or `nth-child` unless necessary.
3. Avoid testing only “it renders”; test real interaction and outcomes.
4. Assert user-visible state changes, not component internals.
5. After interactions, wait for a clear result instead of sleeping.
6. Accessible UI is usually easier to test reliably.

#### Recommended query priority

Prefer:

- role
- label text
- placeholder text
- visible text

Use only as a fallback:

- test id

### D. E2E best practices

1. Keep them few and high value.
2. Protect only critical main flows, not every branch.
3. Every test must be independent and must not depend on earlier tests.
4. Manage login state, test accounts, and seed data explicitly.
5. Wait for system state, not fixed time.
6. Use stable selectors that align with user semantics.
7. Do not validate every detail in E2E.
8. Preserve enough diagnostic information on failure: logs, screenshots, traces, HAR files, and error responses.

---

## Flaky Test Handling Rules

If a test sometimes passes and sometimes fails on the same code, investigate in this order:

1. Is it using arbitrary sleep or wait?
2. Does it depend on execution order or shared state?
3. Does it depend on the real network or third-party services?
4. Is the assertion happening too early?
5. Is the selector too brittle?
6. Is there a problem with time, time zone, or randomness?
7. Is the scope too large, mixing several possible failure sources?

Treatment principles:

- Fix it first; do not normalize rerunning.
- If it cannot be fixed immediately, isolate it temporarily and record the reason.
- Do not tolerate flaky tests sitting on the main branch long term.

---

## Coverage Strategy

Do not focus only on code coverage numbers. Care more about these forms of coverage:

- Use-case coverage
- Risk coverage
- Boundary coverage
- Permission coverage
- Exception-path coverage
- Regression coverage

Recommended priority:

1. Core main flows
2. High-risk edges
3. Regression tests for historical bugs
4. Permission and security logic
5. Contracts likely to break during refactors

---

## Maintainability Rules

### Tests should be DAMP, not excessively DRY

Some duplication in tests is acceptable if it makes intent clearer.

Prefer:

- Clear readability
- Explicit data
- Independent scenarios

Abstract carefully:

- Extract helpers only when the repetition is truly stable and improves understanding
- Do not hide test data, test behavior, and assertions inside black-box helpers

Rule of thumb:

If the abstraction forces the reader to jump through many layers just to understand what the test does, the abstraction has probably gone too far.

### Test failures should be diagnosable

When an assertion fails, it should ideally show:

- The expected value
- The actual value
- The current scenario
- The key inputs

When needed, also provide:

- Request and response snapshots
- Database state summaries
- Page screenshots
- Traces or logs

---

## Anti-Patterns

Common bad smells:

1. **Writing tests only for coverage numbers**
2. **Testing private implementation details**
3. **Using lots of fixed sleep or wait calls**
4. **Tests depending on one another**
5. **Sharing dirty data or shared account state**
6. **Too many actions and intentions inside a single test**
7. **Assertions that only check “exists” or “does not throw”**
8. **Too many E2E tests and too few unit or integration tests**
9. **Mocking everything until the test no longer reflects the real system**
10. **Over-abstracted helpers that hide test intent**
11. **Vague names such as `should work`**
12. **Fixing a bug without adding a regression test**
13. **Rerunning flaky tests instead of finding the root cause**

---

## Recommended Working Templates

### Template 1: Writing tests for a new feature

1. List the core use cases
2. Choose the test layer
3. Write the main success path first
4. Add high-risk boundary cases
5. Add exception paths
6. Run locally multiple times to check stability
7. Before merging, verify that failure messages are clear

### Template 2: Writing regression tests for a bug fix

1. Reproduce the bug first
2. Write a failing test first
3. Fix the code
4. Confirm the test turns green
5. Add nearby boundary cases to prevent the same class of issue from returning

### Template 3: Adding tests to existing code

1. Start from the clearest external contract
2. Cover the most critical success path first
3. Then add the most fragile boundaries
4. Avoid diving into private internals at the beginning
5. If the code is hard to test, record the design smell and refactor in small steps

---

## Expected Output

When using this skill to produce tests, the default output should include:

1. **Test strategy explanation**
   - Why this test layer was chosen
   - Which scenarios are covered
   - Which scenarios are intentionally not covered, and why

2. **Test code**
   - Runnable as-is
   - Clearly structured
   - Clearly named

3. **Stability notes**
   - How flakiness is avoided
   - How test data, time, randomness, and network dependencies are controlled

4. **Follow-up suggestions**
   - Whether integration or E2E tests should be added later
   - Whether the design could be improved to make the code more testable

---

## Short Checklist

Before submitting, quickly check:

- Which business rule does this test protect?
- Does it test behavior or implementation details?
- Can it run independently?
- Does it rely on fixed sleep?
- Does it rely on shared state?
- If it fails, can the cause be located quickly?
- Is it worth maintaining long term?

If you cannot answer two or more of these clearly, do not submit it yet.

---

## One-Sentence Principle

> Write tests that provide real confidence. Prefer user behavior and system contracts, cover the highest-risk scenarios with the smallest sufficient test layer, and reject brittle, vague, and flaky tests.
