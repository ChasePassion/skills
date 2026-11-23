# Spacing Audit Checklist

Run top to bottom. Record only findings with a current value, a target value, and a reason.

## 1. Scale

- Collect every `padding`, `margin`, `gap`, `row-gap`, `column-gap`, `border-radius`, `width`, `height`, `min-height`, `line-height`.
- Count each distinct value. A value used once is a suspicion; a value used many times is a token candidate.
- Allowed values: the project's spacing tokens. If none, use `2 4 6 8 12 16 24 32 48 64`.
- Allowed exceptions: 0, 1px, 2px, optical nudges, hairlines, content-driven sizes.
- Collapse clusters within 25%: 9/10/11/12 → one step.
- Separate radii: 4/8/12. Do not let a 5/6/7/9/10/11 radius survive without a named reason.
- Check line heights: UI lines should land on 16/20/24/28, not 15.75/16.675/17.05.

## 2. Axes

- Identify the page gutter, card padding, row padding, icon slot, and text gap.
- Compute the text start for each repeated row:
  `gutter + card padding + row padding + icon slot + gap`.
- List every distinct text start on the page. More than three content axes is a defect.
- A decorative axis (timeline rail, tree guide) is allowed. A near-duplicate content axis (39 vs 40 vs 41) is not.
- Check trailing edges: icon buttons, chevrons, counts, and actions end at one inset, not four.

## 3. Padding ownership

- For each container: does it have horizontal padding? Does its child have horizontal padding for the same edge?
- If yes, decide which layer owns the inset and remove the other.
- Check `border + padding`: the sum, not padding alone, is the visible inset.
- Check nested rounded corners: `inner = outer − (padding + border)`, clamp at 0.
- Check full-bleed children: a child that should reach the card edge must not sit inside the card's padding without negative margin or a different structure.
- Check background clipping: hover background paints to the padding box; if the border is transparent, the background may show through it.

## 4. Hover and state

- Draw three boxes for each interactive element: hit area, state shape, content.
- State shape ≤ hit area. Hit area can be invisible and larger.
- Hover must not change height, width, padding, or border-width. Use a transparent border, inset shadow, or pseudo-element.
- One state layer at a time: hover, focus, press, selected. Do not stack two translucent fills.
- For every nested pair, draw the outer state shape and the inner state shape.
- `state gap = outer padding − outer state inset − inner state overhang`; keep it ≥ 4px, 6–8px for rounded shapes.
- Size outer padding from the inner state shape, not from the inner icon or label.
- Nested state radii: `inner = outer − state gap`, clamp at 0.
- Same-color outer and inner hover: suppress the outer fill with `:has()`, or make the inner hover ink-only.
- Inner click target must not trigger the outer row.
- Hover boundary matches click boundary. If only the header toggles, only the header changes on hover.
- Text-only actions get an invisible hit area of at least 24px; visual text stays on its axis.
- Check disabled: no hover, no press, no pointer cursor.

## 5. Icons

- Every icon sits in a fixed slot (16/18/20/24) or a fixed leading column.
- Slot center aligns to the text's optical center, not the line box.
- Two leading icons: each has a slot, or the whole leading group has a fixed width.
- Icon-to-text gap: 4–8px for 16px icons, 8–12px for 24px icons.
- Icon side inset: `(height − icon) / 2 − border`.
- Mixed icon sets: check live area. A 24px icon that fills 22px looks larger than one that fills 20px.
- Optical nudge: 1–2px, named, not repeated as a raw value.

## 6. Targets

- Interactive target ≥ 24×24 CSS px.
- Touch target 44×44 or 48×48.
- Small icon buttons: hit area expanded without enlarging the glyph.
- Adjacent small targets: at least 4px gap, or satisfy the 24px-circle spacing rule.
- Text links inside a sentence are exempt from target size; standalone text actions are not.

## 7. Vertical rhythm

- Row height = line-height + 2 × vertical padding.
- Same list uses one row height.
- Group spacing: inside < between groups < between sections.
- Heading-to-content gap is smaller than content-to-next-section gap.
- Empty states, skeletons, and error states use the same rhythm; they do not invent a new padding set.

## 8. Responsive and density

- Component spacing stays fixed across viewport widths.
- Section spacing may step at breakpoints or container queries.
- Compact density reduces vertical padding and control height, not hit area.
- A compact table inside a comfortable page is valid. A globally compact page is a deliberate choice.
- Check 100% and 125% zoom for fractional pixel drift.

## 9. Verification

- Re-run the inventory. Off-scale raw values remain only for 0/1/2 and named exceptions.
- Screenshot default, hover, active, disabled.
- Test long text, no text, one action, two actions.
- Test the row with the scrollbar present and absent.
- Test 320px, 768px, and desktop widths.
- Confirm no layout shift on hover.
- Confirm no double-dark state layer.
- Confirm no icon touches a border or a state edge.

## Common failure patterns

| Symptom | Cause | Fix |
| --- | --- | --- |
| Content looks 1–2px off across repeated rows | border not counted in inset | set `border + padding` to the scale value |
| Hover background looks cramped | padding on inner wrapper, background on row | one layer owns both |
| Hover background spills into card corner | row state shape not inset | inset state shape 4–8px, use nested radius |
| Nested button hover looks darker | two translucent state layers | suppress outer with `:has()`, or make inner ink-only |
| Nested hover fills touch or merge | outer padding not sized from inner state shape | `padding = gap + outer inset + inner overhang` |
| Icons drift between rows | raw SVG width, no slot | fixed icon slot |
| Two leading icons shift titles | icons not slotted | one slot per icon or fixed leading column |
| Text action hard to click | 17–19px hit area | min-height 24, invisible expansion |
| Card hover suggests whole card is clickable | hover on card, click on header | align both boundaries |
| Section grouping unclear | inside gap equals outside gap | increase outer gap |
| Row heights inconsistent | line-height ratios + ad hoc padding | fixed line-height + control height |
| Corners look wrong inside cards | same radius inside and outside | inner = outer − inset |
| Every value is “almost 8” | no scale or no lint | tokenize, then snap |
