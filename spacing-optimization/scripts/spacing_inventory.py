#!/usr/bin/env python3
"""Inventory spacing values in CSS and CSS-in-JS source files.

Usage:
    python spacing_inventory.py <path> [--scale 4,6,8,12,16,24,32,48,64]
                               [--ext .css,.scss,.less,.sass]
                               [--top 40] [--json]

The script counts margin, padding, gap, radius, width, height and line-height
values, then flags values that are not on the supplied scale. It does not change
files.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

DEFAULT_EXTENSIONS = (".css", ".scss", ".less", ".sass")
DEFAULT_SCALE = (4.0, 6.0, 8.0, 12.0, 16.0, 24.0, 32.0, 48.0, 64.0)
ALWAYS_ALLOWED = {0.0, 1.0, 2.0}
SPACING_PROPERTIES = {
    "margin", "padding", "gap", "row-gap", "column-gap",
    "border-radius", "line-height",
}
SKIP_DIRS = {
    "node_modules", ".git", ".hg", ".svn", "dist", "build", "out",
    ".next", ".nuxt", "coverage", "vendor", "__pycache__",
}

PROPERTY_RE = re.compile(
    r"(?<![\w-])"
    r"(margin|padding|gap|row-gap|column-gap|border-radius|"
    r"width|height|min-height|max-height|line-height)"
    r"(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?"
    r"\s*:\s*([^;{}]+)"
)
DIMENSION_RE = re.compile(r"(-?\d*\.?\d+)(px|rem|em|pt)\b", re.IGNORECASE)
UNITLESS_RE = re.compile(r"^-?\d*\.?\d+$")


@dataclass
class Record:
    prop: str
    raw: str
    px: float
    unit: str
    file: str
    line: int


@dataclass
class Inventory:
    files_scanned: int = 0
    declarations: int = 0
    skipped: int = 0
    records: list[Record] = field(default_factory=list)
    unitless_line_heights: list[Record] = field(default_factory=list)


def iter_files(root: Path, extensions: Iterable[str]) -> Iterable[Path]:
    if root.is_file():
        yield root
        return
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() in extensions:
            yield path


def to_px(value: float, unit: str) -> float:
    unit = unit.lower()
    if unit == "px":
        return value
    if unit == "rem":
        return value * 16
    if unit == "em":
        return value * 16
    if unit == "pt":
        return value * 4 / 3
    return value


def parse_value(raw: str, prop: str, file: str, line: int) -> tuple[list[Record], Record | None]:
    value = raw.strip()
    if not value:
        return [], None
    if "var(" in value or "calc(" in value or "clamp(" in value or "%" in value:
        return [], None
    if "auto" in value or "fit-content" in value or "min-content" in value or "max-content" in value:
        return [], None

    if prop == "line-height" and UNITLESS_RE.match(value):
        return [], Record(prop, value, float(value), "", file, line)

    records: list[Record] = []
    for token in re.split(r"\s+", value):
        token = token.strip()
        if token == "0":
            records.append(Record(prop, "0", 0.0, "px", file, line))
            continue
        match = DIMENSION_RE.search(token)
        if not match:
            continue
        number = float(match.group(1))
        unit = match.group(2).lower()
        records.append(Record(prop, token, to_px(number, unit), unit, file, line))
    return records, None


def scan(root: Path, extensions: Iterable[str]) -> Inventory:
    inventory = Inventory()
    for path in iter_files(root, extensions):
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        inventory.files_scanned += 1
        relative = str(path)
        for line_number, line in enumerate(text.splitlines(), start=1):
            for match in PROPERTY_RE.finditer(line):
                prop = match.group(1)
                raw_value = match.group(2)
                inventory.declarations += 1
                records, unitless = parse_value(raw_value, prop, relative, line_number)
                if unitless is not None:
                    inventory.unitless_line_heights.append(unitless)
                    continue
                if not records:
                    inventory.skipped += 1
                inventory.records.extend(records)
    return inventory


def nearest_step(value: float, scale: list[float]) -> float:
    return min(scale, key=lambda step: (abs(step - value), step))


def build_summary(inventory: Inventory, scale: list[float], top: int) -> dict:
    allowed = set(scale) | ALWAYS_ALLOWED
    counts: Counter[float] = Counter()
    props: dict[float, set[str]] = defaultdict(set)
    examples: dict[float, list[Record]] = defaultdict(list)

    for record in inventory.records:
        value = round(record.px, 4)
        counts[value] += 1
        props[value].add(record.prop)
        if len(examples[value]) < 3:
            examples[value].append(record)

    rows = []
    off_scale = []
    for value, count in counts.most_common():
        row = {
            "px": value,
            "count": count,
            "properties": sorted(props[value]),
            "examples": [
                f"{Path(item.file).name}:{item.line} {item.prop}: {item.raw}"
                for item in examples[value]
            ],
        }
        rows.append(row)
        if value not in allowed and props[value] & SPACING_PROPERTIES:
            off_scale.append({
                **row,
                "nearest": nearest_step(value, scale),
            })

    off_scale.sort(key=lambda row: (-row["count"], abs(row["px"])))
    unitless = [
        {
            "value": item.raw,
            "count": 1,
            "example": f"{Path(item.file).name}:{item.line} line-height: {item.raw}",
        }
        for item in inventory.unitless_line_heights
    ]
    return {
        "files_scanned": inventory.files_scanned,
        "declarations": inventory.declarations,
        "numeric_values": len(inventory.records),
        "skipped": inventory.skipped,
        "scale": sorted(allowed),
        "values": rows[:top],
        "off_scale": off_scale[:top],
        "unitless_line_heights": unitless,
    }


def print_text(summary: dict, top: int) -> None:
    print(f"files: {summary['files_scanned']}")
    print(f"declarations: {summary['declarations']}")
    print(f"numeric values: {summary['numeric_values']}")
    print(f"skipped (var/calc/percent/auto): {summary['skipped']}")
    print(f"scale: {', '.join(f'{value:g}' for value in summary['scale'])}")
    print()

    print("values")
    print(f"{'px':>7}  {'count':>5}  properties")
    for row in summary["values"][:top]:
        print(
            f"{row['px']:>7g}  {row['count']:>5}  "
            f"{', '.join(row['properties'])}"
        )
        for example in row["examples"][:1]:
            print(f"{'':>15}{example}")
    print()

    if summary["off_scale"]:
        print("off scale (margin/padding/gap/radius/line-height only)")
        print(f"{'px':>7}  {'count':>5}  {'nearest':>7}  properties")
        for row in summary["off_scale"]:
            print(
                f"{row['px']:>7g}  {row['count']:>5}  {row['nearest']:>7g}  "
                f"{', '.join(row['properties'])}"
            )
            for example in row["examples"][:1]:
                print(f"{'':>15}{example}")
    else:
        print("off scale: none")
    print()

    if summary["unitless_line_heights"]:
        print("unitless line-height")
        for row in summary["unitless_line_heights"][:top]:
            print(f"  {row['example']}")
    else:
        print("unitless line-height: none")


def parse_scale(raw: str) -> list[float]:
    values = []
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        values.append(float(item))
    if not values:
        raise argparse.ArgumentTypeError("scale cannot be empty")
    return sorted(set(values))


def parse_extensions(raw: str) -> tuple[str, ...]:
    values = []
    for item in raw.split(","):
        item = item.strip().lower()
        if not item:
            continue
        if not item.startswith("."):
            item = "." + item
        values.append(item)
    if not values:
        raise argparse.ArgumentTypeError("extensions cannot be empty")
    return tuple(values)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path, help="file or directory to scan")
    parser.add_argument(
        "--scale",
        type=parse_scale,
        default=list(DEFAULT_SCALE),
        help="comma-separated allowed scale, e.g. 4,6,8,12,16,24,32,48,64",
    )
    parser.add_argument(
        "--ext",
        type=parse_extensions,
        default=DEFAULT_EXTENSIONS,
        help="comma-separated extensions, e.g. .css,.scss,.less",
    )
    parser.add_argument("--top", type=int, default=40, help="rows per table")
    parser.add_argument("--json", action="store_true", help="emit JSON")
    args = parser.parse_args()

    if not args.path.exists():
        print(f"path not found: {args.path}", file=sys.stderr)
        return 2

    inventory = scan(args.path, args.ext)
    summary = build_summary(inventory, args.scale, args.top)

    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print_text(summary, args.top)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
