#!/usr/bin/env python3
"""Generate RSS feed XML from a JSON list of posts.

Input JSON format:
[
  {"title":"...", "link":"https://...", "published":"2026-03-15T16:00:00Z", "summary":"..."}
]
"""

from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import json
from pathlib import Path
from xml.sax.saxutils import escape


def to_rfc2822(value: str) -> str:
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        parsed = dt.datetime.now(dt.timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return email.utils.format_datetime(parsed)


def build_rss(items: list[dict], title: str, link: str, description: str) -> str:
    channel_items = []
    for item in items:
        item_title = escape(str(item.get("title", "ללא כותרת")))
        item_link = escape(str(item.get("link", link)))
        item_summary = escape(str(item.get("summary", "")))
        item_date = to_rfc2822(str(item.get("published", dt.datetime.now(dt.timezone.utc).isoformat())))
        channel_items.append(
            f"""
      <item>
        <title>{item_title}</title>
        <link>{item_link}</link>
        <guid>{item_link}</guid>
        <pubDate>{item_date}</pubDate>
        <description>{item_summary}</description>
      </item>"""
        )

    return f"""<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<rss version=\"2.0\">
  <channel>
    <title>{escape(title)}</title>
    <link>{escape(link)}</link>
    <description>{escape(description)}</description>
    {''.join(channel_items)}
  </channel>
</rss>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate RSS XML from JSON posts")
    parser.add_argument("--input", required=True, help="Input JSON file")
    parser.add_argument("--output", required=True, help="Output RSS XML file")
    parser.add_argument("--title", required=True, help="Channel title")
    parser.add_argument("--link", required=True, help="Channel link")
    parser.add_argument("--description", default="Generated RSS feed", help="Channel description")
    args = parser.parse_args()

    items = json.loads(Path(args.input).read_text(encoding="utf-8"))
    if not isinstance(items, list):
        raise SystemExit("Input JSON must be a list of post objects")

    rss = build_rss(items, title=args.title, link=args.link, description=args.description)
    Path(args.output).write_text(rss, encoding="utf-8")
    print(f"Wrote RSS: {args.output} ({len(items)} items)")


if __name__ == "__main__":
    main()
