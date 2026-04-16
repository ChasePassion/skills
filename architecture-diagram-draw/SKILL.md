---
name: architecture-diagram-draw
description: Draw clear, audience-appropriate software architecture diagrams that communicate scope, structure, interfaces, and relationships without mixing abstraction levels.
---

# architecture-diagram-draw

## Purpose

Use this skill to produce software architecture diagrams that are easy to read, accurate enough to support engineering discussion, and scoped to a specific audience and decision.

This skill is for communication first, not for drawing everything that exists. A good architecture diagram should answer a concrete question, at a single abstraction level, with explicit semantics.

---

## When to use

Use this skill when the user asks to:

- draw or redesign a software architecture diagram
- explain a system visually
- prepare a diagram for a report, review, onboarding, design doc, pitch, or presentation
- convert a textual system description into a context / container / component / deployment / runtime diagram
- clean up an existing messy architecture diagram
- decide what to include or omit in an architecture diagram

Do **not** use this skill when the user actually needs:

- a sequence of implementation tasks instead of a diagram
- a full UML class model
- source-code-level documentation
- a product UI wireframe or user flow rather than system architecture

---

## Core objective

Always optimize for these outcomes:

1. The intended audience can understand the diagram quickly.
2. The diagram answers one main question.
3. The diagram uses one primary abstraction level.
4. Every visual element has explicit meaning.
5. The diagram can stand mostly on its own, but is supported by short text where needed.
6. The diagram remains maintainable as the system evolves.

---

## Non-negotiable principles

### 1. Start with audience and question
Before drawing anything, identify:

- who the diagram is for
- what decision / explanation / review it supports
- what the reader should understand after looking at it

If the user does not specify this, infer the most practical audience and state your assumption.

### 2. One diagram, one topic, one level
Do not mix business context, service internals, deployment nodes, runtime flow, and data details into one picture unless the user explicitly needs a hybrid view.

Default to a single dominant level per diagram:

- **System Context**: the system and the world around it
- **Container**: major applications / services / data stores inside the system
- **Component**: important internal building blocks inside one container
- **Dynamic / Runtime**: how interactions happen over time
- **Deployment / Infrastructure**: where software runs and how nodes connect

### 3. Prefer omission over overload
Do not try to be comprehensive. Omit details that do not help the target audience answer the central question.

### 4. Every symbol must mean something
All boxes, colors, borders, arrows, icons, line styles, and group boundaries must have clear semantics.

If semantics are not obvious, add a legend.

### 5. Relationships must be explicit
Every important relationship should show:

- direction
- meaning
- where relevant, technology / protocol / interface type

Prefer unidirectional arrows. Avoid ambiguous double-headed arrows unless the user explicitly needs to emphasize two-way communication and you can label both directions clearly.

### 6. Text is not optional when ambiguity remains
Use short textual support when the diagram alone may be misread:

- assumptions
- element descriptions
- interface notes
- protocol / channel notes
- constraints
- risk / trust boundaries

### 7. Maintainability matters
Choose a diagram structure that can be updated without pain. Do not create visually impressive but brittle diagrams.

Keep the source editable and make assumptions visible.

---

## Required inputs

Collect or infer the following before drawing:

- system name
- diagram goal
- target audience
- desired diagram type, if known
- system scope / boundary
- main actors, neighboring systems, services, stores, or infrastructure
- important relationships and data flows
- important constraints: security, trust boundary, latency, scale, ownership, deployment environment, compliance, etc.
- desired output format: Mermaid, PlantUML, Structurizr DSL, Excalidraw-style description, SVG plan, or natural-language diagram spec

If information is missing, do not stall unnecessarily.
Use this fallback order:

1. infer from user context
2. make minimal reasonable assumptions
3. label assumptions explicitly
4. ask only if the missing information blocks correctness in an important way

---

## Default workflow

### Step 1. Define the communication goal
Write one sentence in this form:

> This diagram is for [audience] to understand [question / decision].

Examples:

- This diagram is for new developers to understand the major services and data stores of the budgeting app.
- This diagram is for reviewers to understand trust boundaries and external dependencies.
- This diagram is for a technical report to explain the progression from LLM to multi-agent orchestrator.

### Step 2. Select the right diagram type
Use this quick mapping:

- Need to show system boundary and external actors -> **System Context**
- Need to show major services / apps / databases / queues -> **Container**
- Need to show internals of one service -> **Component**
- Need to show request flow / event flow / handoff -> **Dynamic / Runtime**
- Need to show cloud resources / nodes / networks -> **Deployment**
- Need to show business inputs/outputs across boundaries -> **Business Context / Data Flow flavored context**

If the user says “architecture diagram” without specifying, default to:

1. **System Context**, then
2. **Container**

unless the request clearly points to deployment or runtime behavior.

### Step 3. Determine scope and boundaries
Clearly identify:

- what is in scope
- what is out of scope
- external actors / systems
- trust boundaries, network boundaries, ownership boundaries, or team boundaries when relevant

For context diagrams, distinguish between:

- **business context**: who exchanges what with the system
- **technical context**: through which channels, protocols, or infrastructure the exchange happens

### Step 4. List only the essential elements
Keep only elements necessary for the chosen level.

Good default counts:

- context diagram: roughly 4 to 9 external entities plus the system in scope
- container diagram: roughly 5 to 12 major internal elements
- component diagram: only the components needed to explain the chosen concern

If the element list is too long, split the output into multiple diagrams.

### Step 5. Name elements precisely
Avoid vague names like:

- business logic
- service layer
- processing module
- external API
- data handler

Prefer names that tell the reader what the element is and does.

Examples:

- Auth Service
- Billing API
- Recommendation Worker
- PostgreSQL Orders DB
- User Browser
- Admin Backoffice

Also include short descriptions when possible.

### Step 6. Add relationships deliberately
For each line, define:

- source
- destination
- direction
- relationship meaning
- optional protocol / transport / data type

Good labels:

- submits transaction
- reads account summary
- publishes expense-created event
- syncs profile via HTTPS
- stores receipts in S3

Bad labels:

- uses
- connects
- interacts
- talks to

### Step 7. Add technology only where it helps
Include technology / protocol labels when they add clarity, such as:

- Flutter mobile app
- FastAPI backend
- PostgreSQL
- Redis cache
- WebSocket
- HTTPS/REST
- Kafka topic

Do not turn the diagram into a tool catalog.

### Step 8. Arrange layout for scanability
Apply these layout rules:

- place the main subject near the visual center or obvious starting position
- keep flow consistent, usually left-to-right or top-to-bottom
- minimize crossing lines
- reroute connectors or duplicate symbols when necessary to avoid spaghetti
- align related elements
- cluster by domain, team, boundary, or lifecycle when useful
- reserve whitespace; do not compress everything into one dense block

### Step 9. Add legend, title, and metadata
Every final diagram should have:

- title
- diagram type
- scope
- legend / notation key when needed
- version or last updated date when the diagram is meant to live beyond the conversation

Recommended title format:

> [Diagram Type] for [System Name]

Examples:

- System Context for Budgeting App
- Container Diagram for AI Tutoring Platform
- Deployment Diagram for Multi-Agent Runtime

### Step 10. Add short supporting text
After the diagram, include a short section with:

- purpose of the diagram
- key assumptions
- reading order if non-obvious
- omitted details
- 3 to 5 key insights or design notes

### Step 11. Self-review before delivering
Run the checklist at the end of this file.

---

## Recommended output structure

When producing a diagram, use this structure unless the user asks for something else:

1. **Goal**
2. **Assumptions**
3. **Diagram type chosen**
4. **Diagram source** (Mermaid / PlantUML / Structurizr DSL / text spec)
5. **Short interpretation notes**
6. **Review checklist result**

---

## Output quality bar

A strong output should satisfy all of the following:

- the reader can identify the system in scope within 3 seconds
- the reader can tell what each major box represents
- the reader can follow the main interaction path without guessing
- no important line is unlabeled when the relationship is non-obvious
- no visual encoding is decorative only
- the chosen level matches the user’s real question
- the diagram does not try to explain every possible detail

---

## Common anti-patterns to avoid

### Anti-pattern 1. Mixed abstraction soup
One drawing mixes users, services, classes, queues, server nodes, and SQL tables.

Fix: split into separate views.

### Anti-pattern 2. Comprehensive but unreadable
Trying to include everything “for completeness”.

Fix: optimize for comprehension, not exhaustiveness.

### Anti-pattern 3. Unexplained colors and shapes
Red boxes, blue boxes, dashed lines, and shaded groups with no legend.

Fix: remove non-semantic styling or explain it.

### Anti-pattern 4. Generic labels
Names like module, processor, manager, engine, handler, middleware, or system without role clarity.

Fix: rename to concrete responsibilities.

### Anti-pattern 5. Ambiguous arrows
Lines with no direction, no labels, or double-headed arrows hiding two different interactions.

Fix: use single-direction relations and clear labels.

### Anti-pattern 6. Wrong diagram type
Using a deployment diagram to explain product context, or a component diagram to explain business partners.

Fix: choose the view that matches the question.

### Anti-pattern 7. Over-decorated diagram
Using icons, gradients, logos, or color noise that add visual weight but no information.

Fix: prefer clean, functional visuals.

### Anti-pattern 8. No boundary thinking
Forgetting trust boundaries, ownership boundaries, or external interfaces when they are central to the discussion.

Fix: draw and label the relevant boundaries.

### Anti-pattern 9. Diagram without companion explanation
The image is shown with no assumptions, no context, and no explanation of what was intentionally omitted.

Fix: add a short textual note.

### Anti-pattern 10. Diagram that cannot be maintained
The output is visually polished but difficult to edit, update, or version.

Fix: prefer source-first representations such as Mermaid, PlantUML, Structurizr DSL, or a clearly structured textual diagram spec.

---

## Heuristics for choosing what to omit

Omit an element if all of the following are true:

- it is not needed to answer the main question
- it does not change the main flow or boundary understanding
- it does not materially affect risk, ownership, or constraints
- removing it makes the diagram easier to parse

Keep an element if any of the following are true:

- it is part of the core user/system interaction
- it is a major store, service, queue, or external dependency
- it defines a boundary or architectural decision
- it explains a risk, bottleneck, protocol, or trust issue

---

## Diagram-type guidance

### System Context
Show:

- system in scope
- people / external systems
- major incoming/outgoing interactions
- optionally business inputs/outputs

Do not show:

- internal microservices
- class/module internals
- low-level deployment details

Use when:

- onboarding
- project overview
- stakeholder communication
- report introductions

### Container Diagram
Show:

- major applications/services/workers/data stores inside the system
- how they communicate
- key protocols and technologies where useful

Do not show:

- detailed classes/functions
- all internal implementation details

Use when:

- engineering overview
- architecture review
- planning service boundaries

### Component Diagram
Show:

- significant internal building blocks inside one container
- only the components needed for the chosen concern

Do not show:

- every class or utility
- cross-system details that belong in a context/container view

Use when:

- explaining one service
- reviewing internal decomposition

### Dynamic / Runtime Diagram
Show:

- ordered interactions
- triggers, handoffs, events, calls, responses

Use when:

- explaining request lifecycle
- event-driven behavior
- agent orchestration / tool invocation / workflow execution

### Deployment Diagram
Show:

- environments, nodes, networks, clusters, regions, devices, cloud resources
- where containers/services run
- infrastructure channels and boundaries

Use when:

- ops, infra, security, latency, availability, compliance discussions

---

## Handling business context vs technical context

When drawing a context-level view, decide whether the user needs:

### Business context
Focus on:

- actors
- neighboring systems
- domain inputs/outputs
- who exchanges what with whom

Prefer labels that read like data or business interactions.

### Technical context
Focus on:

- protocols
- channels
- networks
- hardware / runtime environment
- interface realization

Prefer labels such as HTTPS, gRPC, WebSocket, SMTP, Kafka, S3, VPN, browser, mobile app, batch file, webhook, etc.

If both are important, either:

- produce two diagrams, or
- keep one primary diagram and add a compact mapping note

---

## Advice for agent / AI / LLM system diagrams

When the system involves LLMs, agents, tools, memory, orchestrators, or MCP-like capability layers, make sure to separate these concerns clearly:

- user-facing client / channel
- orchestrator / supervisor / runtime
- model provider(s)
- tool layer / MCP / external integrations
- memory / state / vector store / file system
- event bus / queue / workflow runtime
- safety / policy / approval boundary if relevant

Common mistake: collapsing “LLM”, “agent”, “orchestrator”, “memory”, and “tools” into one box called AI.

Do not do that.

---

## Advice for diagrams in reports or presentations

When the output is for a report, deck, or public-facing explanation:

- optimize for narrative clarity first
- reduce text density inside shapes
- keep a small number of dominant visual paths
- make the title informative, not generic
- ensure the central message can be understood from a quick glance

The diagram should support a story, not just inventory components.

---

## Preferred output formats

Choose in this order unless the user specifies otherwise:

1. **Mermaid** for quick editable docs and markdown workflows
2. **PlantUML** for more controlled diagramming in text form
3. **Structurizr DSL** for C4-style modeling
4. **Excalidraw-style textual layout spec** when a hand-drawn presentation feel is desired
5. **Plain structured description** when the user wants the thinking but not the code

If the user wants a rendered image, still prefer producing an editable source representation first.

---

## Delivery template

Use this template when replying.

```md
## Goal
[One-sentence goal of the diagram]

## Assumptions
- [...]

## Diagram type
[System Context / Container / Component / Dynamic / Deployment]

## Diagram source
```mermaid
[diagram code]
```

## Notes
- [How to read it]
- [Why some details were omitted]
- [Important boundaries / protocols / risks]

## Self-check
- [x] One main topic
- [x] One main abstraction level
- [x] Labels are explicit
- [x] Key relationships are directional
- [x] No unnecessary visual noise
```

---

## Final review checklist

Before delivering, verify all items below.

### Goal and audience
- [ ] I know who this diagram is for.
- [ ] I know what question this diagram answers.
- [ ] The chosen diagram type matches that question.

### Scope and abstraction
- [ ] The system in scope is explicit.
- [ ] Out-of-scope items are not accidentally mixed in.
- [ ] The diagram stays at one primary abstraction level.
- [ ] If multiple views are needed, I split them.

### Elements
- [ ] Every important element has a precise name.
- [ ] Important elements have short descriptions where useful.
- [ ] Technology is shown where it adds clarity.
- [ ] Vague buckets were removed or renamed.

### Relationships
- [ ] Every important relationship has direction.
- [ ] Labels are consistent with the direction.
- [ ] Protocols/channels are named when useful.
- [ ] I avoided ambiguous double arrows.

### Visual semantics
- [ ] Colors, borders, line types, and icons have meaning.
- [ ] A legend is included when needed.
- [ ] Layout is readable.
- [ ] Line crossing is minimized.
- [ ] The visual flow is easy to follow.

### Communication quality
- [ ] The diagram can mostly stand on its own.
- [ ] Ambiguities are handled with short text.
- [ ] I stated assumptions.
- [ ] I stated intentional omissions.
- [ ] The result is understandable quickly.

### Maintainability
- [ ] The source format is editable.
- [ ] The diagram is not overfit to this exact moment.
- [ ] Version / date is included if the diagram will be reused.

---

## Compression rule

If the system is too complex for one clean diagram, do not force it.
Compress by using this sequence:

1. remove irrelevant details
2. cluster similar elements
3. split into multiple views
4. move detail into notes/table
5. only then redraw

Never solve complexity by making the diagram denser.

---

## Success criterion

This skill succeeds when the output is not merely “technically correct”, but when a new reader can look at it and quickly answer:

- What is the system?
- What is inside it?
- What is outside it?
- How do the important parts interact?
- What is the main point this diagram is trying to communicate?
