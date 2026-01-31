#!/usr/bin/env python3
"""Analyze Telegram groups/channels using Telethon.

Usage:
  python main.py --group "group name or @username" --limit 1000

Env:
  TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import os
import re
from dataclasses import dataclass
from typing import Iterable

from telethon import TelegramClient
from telethon.errors import RpcError
from telethon.tl.types import Message

WORD_RE = re.compile(r"[\w']+", re.UNICODE)
URL_RE = re.compile(r"https?://\\S+", re.IGNORECASE)
DEFAULT_IRAN_KEYWORDS = {
    "iran",
    "iranian",
    "tehran",
    "isfahan",
    "shiraz",
    "irgc",
    "iran's",
    "iranian's",
    "איראן",
    "אירני",
    "אירנית",
    "טהרן",
    "שיראז",
}


@dataclass
class Stats:
    total_messages: int
    by_user: dict[str, int]
    by_day: dict[str, int]
    top_words: list[tuple[str, int]]


def tokenize(text: str) -> Iterable[str]:
    for match in WORD_RE.finditer(text.lower()):
        yield match.group(0)


def summarize(messages: Iterable[Message], top_words: int) -> Stats:
    by_user: dict[str, int] = collections.Counter()
    by_day: dict[str, int] = collections.Counter()
    word_counts: dict[str, int] = collections.Counter()
    total = 0

    for message in messages:
        if message is None:
            continue
        total += 1
        sender = getattr(message.sender, "username", None) or getattr(
            message.sender, "first_name", None
        ) or "unknown"
        by_user[sender] += 1
        date_key = message.date.astimezone(dt.timezone.utc).strftime("%Y-%m-%d")
        by_day[date_key] += 1
        if message.message:
            for word in tokenize(message.message):
                word_counts[word] += 1

    top_word_list = sorted(word_counts.items(), key=lambda item: item[1], reverse=True)[
        :top_words
    ]
    return Stats(
        total_messages=total,
        by_user=dict(by_user),
        by_day=dict(by_day),
        top_words=top_word_list,
    )


def extract_group_identifier(group: str) -> str:
    match = re.search(r"(?:https?://)?t\\.me/([\\w_]+)", group)
    if match:
        return match.group(1)
    return group


def load_keywords(raw_keywords: str | None) -> set[str]:
    if not raw_keywords:
        return set(DEFAULT_IRAN_KEYWORDS)
    return {item.strip().lower() for item in raw_keywords.split(",") if item.strip()}


def message_matches(message: Message, keywords: set[str], require_link: bool) -> bool:
    if not message.message:
        return False
    text = message.message.lower()
    if require_link and not URL_RE.search(text):
        return False
    return any(keyword in text for keyword in keywords)


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
        except RpcError as exc:
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
