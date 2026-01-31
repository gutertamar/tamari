#!/usr/bin/env python3
"""Analyze Telegram groups/channels using Telethon.

Usage:
  python main.py --group "group name or @username" --limit 1000

Env:
  TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION
"""

from __future__ import annotations

import argparse
import os

from telethon import TelegramClient
from telethon.errors import RPCError

from analyzer import (
    extract_group_identifier,
    load_keywords,
    message_matches,
    summarize,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze Telegram groups.")
    parser.add_argument("--group", required=True, help="Group name or @username")
    parser.add_argument(
        "--limit",
        type=int,
        default=1000,
        help="How many recent messages to analyze",
    )
    parser.add_argument(
        "--top-words",
        type=int,
        default=20,
        help="How many top words to display",
    )
    parser.add_argument(
        "--keywords",
        help="Comma-separated keywords to match (defaults to Iran-related keywords).",
    )
    parser.add_argument(
        "--require-link",
        action="store_true",
        help="Only include messages that contain a link (helps filter reliable analyses).",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    api_id = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")
    session = os.getenv("TELEGRAM_SESSION", "telegram-analytics")
    keywords = load_keywords(args.keywords)

    if not api_id or not api_hash:
        raise SystemExit("Missing TELEGRAM_API_ID/TELEGRAM_API_HASH env vars.")

    async with TelegramClient(session, int(api_id), api_hash) as client:
        try:
            entity = await client.get_entity(extract_group_identifier(args.group))
        except RPCError as exc:
            raise SystemExit(f"Failed to resolve group: {exc}") from exc

        messages = client.iter_messages(entity, limit=args.limit)
        filtered = [
            message
            async for message in messages
            if message_matches(message, keywords, args.require_link)
        ]
        stats = summarize(filtered, args.top_words)

    print(f"Total messages: {stats.total_messages}")
    print("\nTop senders:")
    for user, count in sorted(stats.by_user.items(), key=lambda i: i[1], reverse=True)[:10]:
        print(f"  {user}: {count}")

    print("\nMessages per day:")
    for day, count in sorted(stats.by_day.items()):
        print(f"  {day}: {count}")

    print("\nTop words:")
    for word, count in stats.top_words:
        print(f"  {word}: {count}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
