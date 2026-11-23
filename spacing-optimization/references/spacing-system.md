# Spacing System

## Scale

A spacing scale is a short list of allowed distances. Its job is to remove per-instance judgement.

Use a 4px base with 8px preference. A working scale:

| Token | Value | Use |
| --- | --- | --- |
| `space-0` | 0 | deliberate zero |
| `space-1` | 2 | hairline separation, optical nudge |
| `space-2` | 4 | icon-to-label, tight inline gap |
| `space-3` | 6 | compact control padding |
| `space-4` | 8 | default inline gap, small padding |
| `space-5` | 12 | control padding, label-to-field |
| `space-6` | 16 | card padding, default block gap |
| `space-7` | 24 | card padding on large surfaces, section gap |
| `space-8` | 32 | gap between components |
| `space-9` | 48 | gap between sections |
| `space-10` | 64 | page region separation |

Rules:

- Adjacent steps must be visibly different. If two values are within 25% (9/10/11/12), they are one step, not four.
- Use every multiple of 4 only if each step has a role. A 12-step scale with 6 used steps is a 6-step scale.
- Hairlines, focus rings, and optical alignment need 1–2px. Keep these as named exceptions.
- Font sizes do not belong on the spacing scale. Line heights do: 16/20/24.

Reference scales:

- Carbon: 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 160.
- Material 3: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 36, 40, 48, 56, 64, 72. Main steps are multiples of 8; small nested steps cover component internals.
- Atlassian: 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.

## Token layers

Three layers, each with one job:

1. **Primitive** — raw values. `--space-4: 16px`.
2. **Semantic** — role. `--space-inset-md`, `--space-stack-lg`, `--space-inline-sm`.
3. **Component** — a component's own decision. `--button-padding-inline`.

Component CSS consumes semantic or component tokens. It does not consume primitives directly. This keeps a density or theme change to one layer.

Semantic roles by distance type:

| Role | Property | Meaning |
| --- | --- | --- |
| inset | `padding` | container edge to content |
| stack | `margin-block`, column `gap` | vertical distance between blocks |
| inline | row `gap` | horizontal distance between siblings |
| section | `margin-block`, page `gap` | rhythm between page sections |
| gutter | `padding-inline` | page or panel side breathing room |
| text | `margin-block` | paragraph-to-paragraph, heading-to-text |

The property determines the role, the role determines the token family, and the step is the only remaining choice.

Component spacing is fixed. A button's padding, an icon-to-label gap, a field-to-help-text gap do not change with viewport width. Page spacing can step at breakpoints or with container queries. Use fixed steps inside components; use responsive steps between sections.

## Proximity and hierarchy

Space encodes relationships:

- Related elements sit closer than unrelated elements.
- Space inside a group is smaller than space around the group.
- A section title is closer to its content than to the previous section.
- A label is closer to its field than to the previous field.
- Buttons sit near the content they affect.

Use this hierarchy:

```
inside a control  <  between related controls  <  between groups  <  between sections
```

If the values are equal, grouping is ambiguous even when every value is on the scale. Add space or a divider only when space alone cannot separate the groups.

## Vertical rhythm

UI text uses fixed line-height tokens:

| Text | Line height |
| --- | --- |
| 10–11px | 16 |
| 12–14px | 20 |
| 15–16px | 24 |
| 18–20px | 28 |

Control height = line-height + 2 × vertical padding. Choose the height first, then derive padding:

| Control height | Text line | Vertical padding |
| --- | --- | --- |
| 28 | 20 | 4 |
| 32 | 20 | 6 |
| 36 | 24 | 6 |
| 40 | 24 | 8 |

A 30px row and a 34px row in the same list read as an error, not a hierarchy. Pick one height per list.

Font metrics add invisible space above and below text. A button with `padding: 12px` can look top-heavy because the line box includes ascent and descent that the letters do not fill. Modern CSS fixes this with `text-box: trim-both cap alphabetic`; without it, a 1–2px optical nudge is legitimate.

## Icons

An icon is a drawing inside a box. The box is the layout unit; the drawing is not.

- Use fixed slots: 16, 18, 20, 24.
- Center the slot, not the SVG edge, on the text's optical center.
- Size icons next to text at the text's line height or one step below. 14px text pairs with 16px icons; 16px text pairs with 20px icons; 20px text pairs with 24px icons.
- Gap: 4–8px for 16px icons, 8–12px for 24px icons.
- Different icon sets have different live areas. A 24px Material icon draws inside roughly 20px; a 24px icon from another set may fill 22px. Do not mix sets without normalizing the live area.
- Asymmetric glyphs (play, send, chevron) need a 1–2px optical offset. Put the offset in a named utility or comment.
- In a control with a visible edge: `icon-side inset = (control height − icon size) / 2 − border`. This keeps the icon square in the end of the control.

## State layers

Hover, focus, press, and drag are state layers over the component.

Material 3 values:

| State | Opacity |
| --- | --- |
| hover | 0.08 |
| focus | 0.10 |
| press | 0.10 |
| drag | 0.16 |

Rules:

- One state layer at a time. Do not stack hover and press additively; use the strongest active state.
- The state layer uses the component's content color, not an arbitrary grey.
- The state layer follows the component shape. If the component has a radius, the layer has the same radius.
- A state layer can be smaller than the interactive target (Material: 40dp layer, 48dp target). It cannot be larger.
- Hover must not move layout. Do not animate padding, border-width, width, or height. Animate background-color, opacity, or transform on a pseudo-element.
- A hovered row and a hovered button inside it are two interactive elements. Treat them as two state shapes, not one.

## Nested hover surfaces

When an outer component and an inner control both have hover states, draw both state shapes before choosing padding.

Definitions:

- `outer state inset` — how far the outer state shape is inset from the outer component edge.
- `inner state overhang` — how far the inner state shape extends beyond the inner control box. Positive when the state layer is larger than the control; negative when it is inset.
- `state gap` — visible distance between the outer state shape and the inner state shape.

Formula:

```
state gap = outer padding − outer state inset − inner state overhang
```

Solve for the outer padding:

```
outer padding = state gap + outer state inset + inner state overhang
```

Rules:

- Minimum state gap is 4px. Use 6–8px when both shapes have rounded corners or borders.
- Size the outer padding from the inner state shape, not from the inner icon or label. A 16px icon with a 32px hit/state shape needs 32px + gap of layout room, not 16px + gap.
- If the outer state shape is inset from the outer component, subtract that inset from the available gap. Inset 4px on both shapes is not free space.
- If the inner state shape overhangs its control box, add that overhang to the outer padding. Overhang eats the gap.
- Keep the two shapes concentric: `inner state radius = outer state radius − state gap`, clamped at 0.
- Do not paint two identical translucent layers over the same pixels. Use one of these:
  - outer hover only, inner hover changes ink color;
  - inner hover only, outer hover suppressed with `:has()`;
  - outer and inner use different, pre-composited colors.
- The inner control is its own click target. Clicking it must not trigger the outer row. Do not nest a `<button>` inside a `<button>`; use siblings with a stretched row target or stop propagation.

Example:

```
outer padding       8px
outer state inset   4px
inner state overhang 0px
state gap           4px
```

The outer fill and inner fill are 4px apart. Change the outer state inset to 8px without changing padding, and the gap becomes 0: the two fills touch. Increase outer padding to 12px to restore a 4px gap.

## Targets

| Standard | Minimum |
| --- | --- |
| WCAG 2.2 AA (pointer) | 24 × 24 CSS px |
| WCAG 2.2 AAA | 44 × 44 CSS px |
| Material (touch) | 48 × 48 dp |
| Carbon (icon touch target) | 44 × 44 px |

A 16px icon button needs an invisible hit area of at least 24px; 32–40px is comfortable on desktop; 44–48px on touch. Expand the hit area with padding, a pseudo-element, or a wrapper. Do not enlarge the glyph to meet the target.

When an undersized target sits next to another target, WCAG 2.2 allows a spacing exception: a 24px-diameter circle centered on each target must not intersect another target. In practice, leave at least 4px between small targets.

## Nested radii

When two rounded corners are adjacent:

```
inner radius = outer radius − (padding + border)
```

Use `max(0px, calc(...))`. If the result is 0, the inner corner is square.

Examples:

- Card 16, padding 8 → inner 8.
- Card 12, padding 4 → inner 8.
- Card 12, padding 12 → inner 0.

The formula only applies when the inner element reaches the outer corner. A full-width alert inside a card's padded content area does not share the card's corner; do not force the formula there.

## Density

Density changes semantic roles, not primitives.

| Density | Typical use |
| --- | --- |
| compact | dense tables, logs, admin tools |
| comfortable | default product UI |
| spacious | reading, onboarding, marketing |

- Compact reduces vertical padding and control height; it does not shrink the smallest inset below 4px.
- Keep touch targets at 44/48 even in compact layouts; reduce visual size, not hit area.
- A data table can be compact inside a comfortable page. Apply density at the component or region, not globally by default.
- Do not use viewport width to change component spacing. Use container queries or a density attribute when a component genuinely needs it.

## Sources

- Carbon spacing: https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview
- Carbon icons: https://www.carbondesignsystem.com/building-blocks/foundations/icons/guidelines
- Material 3 spacing: https://m3.material.io/styles/spacing/tokens
- Material 3 grids and spacing: https://m3.material.io/foundations/layout/grids-spacing/spacing
- Material 3 lists: https://m3.material.io/components/lists/specs
- Material 3 states: https://m3.material.io/foundations/interaction/states/state-layers
- Atlassian spacing: https://atlassian.design/foundations/spacing/
- WCAG 2.2 target size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- Refactoring UI notes: https://phlip9.com/notes/design/refactoring%20ui/
- Nested radius: https://interactively.info/article/perfect-nested-rounded-corners
- Arcadia spacing: https://arcadia.is/design/foundations/spacing
- Raft list spacing: https://raft-design.botiverse.build/patterns/lists.md
- UI Polish list states: https://uipolish.com/docs/list
- Chrome text-box: https://developer.chrome.com/docs/modern-web-guidance/guides/visual-design/precise-text-alignment
