#!/usr/bin/env python3
"""Shared Telegram analysis utilities."""

from __future__ import annotations

import collections
import datetime as dt
import re
from dataclasses import dataclass
from typing import Iterable

from telethon.tl.types import Message

WORD_RE = re.compile(r"[\w']+", re.UNICODE)
URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
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
    match = re.search(r"(?:https?://)?t\.me/([\w_]+)", group)
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
