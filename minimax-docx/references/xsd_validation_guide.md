# Validation Guide

## Recommended Validation Commands

```bash
# 1. Structural validation against the ECMA-376 rules shipped with the OpenXML SDK
dotnet run --project scripts/dotnet/MiniMaxAIDocx.Cli -- validate --input input.docx --openxml

# 2. Business rules (styles, margins, page size, heading hierarchy)
dotnet run --project scripts/dotnet/MiniMaxAIDocx.Cli -- validate --input input.docx --business

# 3. Scenario C hard gate: compare the output against the template DOCX
dotnet run --project scripts/dotnet/MiniMaxAIDocx.Cli -- validate --input output.docx --gate-check template.docx
```

`--openxml` is the authoritative structural check. The SDK validates every
WordprocessingML part (document, styles, headers, footers, footnotes) and
knows the full element ordering and attribute model, so it does not report
false positives on ordinary Word documents.

## Custom XSD Schemas

`--xsd <path>` remains available for project-specific schemas:

```bash
dotnet run --project scripts/dotnet/MiniMaxAIDocx.Cli -- validate --input input.docx --xsd path/to/custom.xsd
```

When a schema imports the OOXML relationships or XML namespaces, the validator
automatically loads `relationships.xsd` and `xml.xsd` from the same directory
as the schema. A schema compilation failure is reported as a validation error
instead of crashing the process.

### About the Bundled `wml-subset.xsd`

`assets/xsd/wml-subset.xsd` is a curated subset, not a complete schema: it
declares the most common elements but only a fraction of their attributes.
Validating a real document against it produces many "attribute is not
declared" errors that are artifacts of the subset, not defects in the
document. Do **not** use it as a delivery gate. Use `--openxml` for that.

The subset is still useful as human-readable documentation of element structure
and as a starting point for a custom schema. `business-rules.xsd` and
`aesthetic-rules.xsd` define fragments only (no `w:document` root), so they are
not directly usable with `--xsd` either; the runtime business rules live in
`BusinessRuleValidator`.

---

## Interpreting `--openxml` Errors

### Element Ordering Error

```
/word/document.xml /w:document[1]/w:body[1]/w:sectPr[1]:
The element has unexpected child element '...:headerReference'.
```

**Cause**: Child elements are in the wrong order. See `references/openxml_element_order.md`.
**Fix**: Run `$CLI fix-order --input doc.docx`, which now repairs
`document.xml`, `styles.xml`, headers, footers, footnotes, and endnotes.

### Missing Required Element

```
The element has incomplete content. Expected 'w:tblGrid'.
```

**Cause**: A required child element is absent.
**Fix**: Add the missing element. Tables require both `w:tblPr` and `w:tblGrid`.

### Invalid Attribute Value

```
The attribute 'w:val' has invalid value 'middle'.
```

**Cause**: An attribute value is not in the allowed enumeration.
**Fix**: Use one of the valid values listed in the error.

### Unexpected Element

```
The element has unexpected child element '...:shadow'.
```

**Cause**: An element is not valid at that position, or belongs to an
unsupported namespace. Vendor extensions (`w14`, `w15`, `w16*`) are reported
by the SDK when the document targets an older file format version; they are
usually harmless if Word opens the file, but they should not be reintroduced
into generated content.

---

## Business Rules

`--business` runs `BusinessRuleValidator` in-process. It checks:

| Rule | What It Checks |
|------|---------------|
| Required styles | `Normal`, `Heading1`-`Heading3`, `TableGrid` exist in the styles part |
| Font consistency | `w:docDefaults` fonts match expected values |
| Margin ranges | Page margins within acceptable bounds |
| Page size | A4 or Letter |
| Heading hierarchy | No size inversions between heading levels |
| Orphaned relationships | Relationship IDs defined but never referenced |

---

## Gate-Check: Scenario C Hard Gate

In Scenario C (Apply Template), the output document **MUST** pass the
gate-check against the template before delivery:

```
1. Apply template  →  output.docx
2. Validate        →  $CLI validate --input output.docx --openxml --business
3. Gate-check      →  $CLI validate --input output.docx --gate-check template.docx
4. PASS?           →  Deliver to user
5. FAIL?           →  Fix issues, re-validate, repeat until PASS
```

The gate-check compares the style set, page size, margins, and default font of
the output against the template. **This is a hard gate.** A document that fails
the gate-check is NOT deliverable, even if it opens correctly in Word.

---

## False Positives

### Vendor Extensions

Extended namespaces (`w14`, `w15`, `w16*`) may be reported when the document
declares a newer conformance version than the validator target. These are
Microsoft extensions for newer features; they are safe to ignore if Word opens
the document correctly.

### Bundled Subset Schema

As noted above, `wml-subset.xsd` errors about undeclared attributes are
expected and must not be treated as document defects.
