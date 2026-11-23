# CSS Patterns

## Tokens

```css
:root {
  --space-0: 0;
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 6px;
  --space-4: 8px;
  --space-5: 12px;
  --space-6: 16px;
  --space-7: 24px;
  --space-8: 32px;
  --space-9: 48px;
  --space-10: 64px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --line-1: 16px;
  --line-2: 20px;
  --line-3: 24px;
  --line-4: 28px;
}
```

Consume tokens in component CSS. Do not consume primitives directly when a semantic token exists.

## State layer

Draw hover on a pseudo-element so the state shape is independent of content and padding.

```css
.row {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  min-height: 36px;
  padding-inline: var(--space-5);
  border-radius: var(--radius-md);
}

.row::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  background: var(--row-hover);
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.row:hover::before {
  opacity: 1;
}
```

Inset the state shape when the row sits inside a card:

```css
.row::before {
  inset: 2px 4px;
  border-radius: calc(var(--radius-lg) - 4px);
}
```

Do not animate `padding`, `border-width`, `width`, or `height` on hover.

## Hover without layout shift

Changing `border-width` moves neighbors. Reserve the space:

```css
.card {
  border: 1px solid transparent;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.card:hover {
  border-color: var(--border-hover);
}
```

Or draw the edge on the existing border color. If the border must grow, use `outline` or an inset shadow:

```css
.card:hover {
  box-shadow: inset 0 0 0 2px var(--border-hover);
}
```

## Icon slot

```css
.iconSlot {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  flex: none;
}

.iconSlot svg {
  width: 16px;
  height: 16px;
}
```

Icon side inset:

```css
.control {
  --control-height: 34px;
  --icon-size: 16px;
  --border-width: 1px;

  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  min-height: var(--control-height);
  padding-inline-start: calc(
    (var(--control-height) - var(--icon-size)) / 2 - var(--border-width)
  );
}
```

Two leading icons:

```css
.treeRow {
  display: grid;
  grid-template-columns: 16px 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
}
```

The title edge then stays fixed regardless of icon width.

## Text action hit area

Keep the text on its axis; expand the hit area outward:

```css
.textAction {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding-inline: var(--space-2);
  margin-inline: calc(var(--space-2) * -1);
  border: 0;
  background: transparent;
}
```

On touch screens, raise `min-height` to 44px.

## Nested radius

```css
.card {
  --card-radius: var(--radius-lg);
  --card-padding: var(--space-5);
  border-radius: var(--card-radius);
  padding: var(--card-padding);
}

.cardInner {
  border-radius: max(
    0px,
    calc(var(--card-radius) - var(--card-padding))
  );
}
```

If the outer element has a border, add it to the inset:

```css
border-radius: max(
  0px,
  calc(var(--outer-radius) - var(--padding) - var(--border-width))
);
```

## Border compensation

`border + padding` is the visible inset. To keep an icon on a 6px line with a 1px border:

```css
.search {
  border: 1px solid var(--border);
  padding-inline: 5px;
}
```

Do not write `padding-inline: 6px` and then wonder why the icon sits 1px right of the other rows.

## Gap over margins

Use `gap` on the container for siblings. Margins on children create uneven first/last edges and collapse in ways that are hard to audit.

```css
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
```

Use logical properties:

```css
padding-inline: var(--space-6);
padding-block: var(--space-4);
margin-inline-start: var(--space-4);
```

## Vertical rhythm

```css
.row {
  min-height: 36px;
  padding-block: 6px;
  line-height: 24px;
}
```

`36 = 24 + 2 × 6`. Changing the font size without changing the line height breaks the rhythm; change both together.

If the browser supports it, trim the line box for precise icon/text centering:

```css
.label {
  text-box: trim-both cap alphabetic;
}
```

## Nested state layers

Draw the outer state shape and the inner state shape first. The outer padding is the budget for the inner control plus the gap between state shapes.

```css
.row {
  --outer-state-inset: 4px;
  --inner-state-overhang: 0px;
  --state-gap: 4px;

  padding-inline: calc(
    var(--state-gap) + var(--outer-state-inset) + var(--inner-state-overhang)
  );
}

.row::before {
  content: "";
  position: absolute;
  inset: 0 var(--outer-state-inset);
  border-radius: var(--radius-md);
  background: var(--state-hover);
  opacity: 0;
  pointer-events: none;
}

.row:hover::before {
  opacity: 1;
}

.rowAction::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: max(0px, calc(var(--radius-md) - var(--state-gap)));
  background: var(--state-hover);
  opacity: 0;
  pointer-events: none;
}
```

`inner-state-overhang` is positive when the inner state shape is larger than the control, negative when the shape is inset. Keep `state-gap` at 4px minimum, 6–8px for rounded shapes.

Suppress the outer fill when the inner action is hovered:

```css
.row:has(.rowAction:hover)::before {
  opacity: 0;
}
```

Or keep one layer and change only the inner ink:

```css
.row:hover .rowAction,
.rowAction:hover {
  color: var(--text-strong);
}
```

Do not nest a `<button>` inside a `<button>`. Make the inner action a sibling of the row target, or stop propagation so the inner click does not trigger the row.

## State layer size vs target

```css
.iconButton {
  position: relative;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  background: transparent;
}

.iconButton::before {
  content: "";
  position: absolute;
  inset: 4px;
  border-radius: var(--radius-md);
  background: var(--state-hover);
  opacity: 0;
  pointer-events: none;
}

.iconButton:hover::before {
  opacity: 1;
}
```

The visible state shape is 32px; the target is 40px. Both are intentional.

## Optical nudge

Use a named utility, not a raw value repeated across components:

```css
.opticalUp1 {
  transform: translateY(-1px);
}
```

Apply only to glyphs whose visual mass sits low (play, send, some chevrons). Do not apply globally.
