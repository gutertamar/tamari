#!/usr/bin/env python3
"""Streamlit dashboard for Telegram group analysis."""

from __future__ import annotations

import asyncio
import os
from typing import Sequence

import pandas as pd
import streamlit as st
from telethon import TelegramClient
from telethon.errors import RPCError

from analyzer import (
    DEFAULT_IRAN_KEYWORDS,
    extract_group_identifier,
    load_keywords,
    message_matches,
    summarize,
)


def get_api_credentials() -> tuple[str, str, str]:
    api_id = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")
    session = os.getenv("TELEGRAM_SESSION", "telegram-analytics")
    if not api_id or not api_hash:
        raise RuntimeError("Missing TELEGRAM_API_ID/TELEGRAM_API_HASH env vars.")
    return api_id, api_hash, session


async def analyze_group(
    client: TelegramClient,
    group: str,
    limit: int,
    keywords: set[str],
    require_link: bool,
    top_words: int,
):
    entity = await client.get_entity(extract_group_identifier(group))
    messages = client.iter_messages(entity, limit=limit)
    filtered = [
        message
        async for message in messages
        if message_matches(message, keywords, require_link)
    ]
    return summarize(filtered, top_words)


async def analyze_groups(
    groups: Sequence[str],
    limit: int,
    keywords: set[str],
    require_link: bool,
    top_words: int,
):
    api_id, api_hash, session = get_api_credentials()
    async with TelegramClient(session, int(api_id), api_hash) as client:
        results = {}
        for group in groups:
            results[group] = await analyze_group(
                client, group, limit, keywords, require_link, top_words
            )
        return results


def render_group(group: str, stats) -> None:
    st.subheader(group)
    st.metric("Total messages", stats.total_messages)

    if stats.by_user:
        df_users = (
            pd.DataFrame(stats.by_user.items(), columns=["user", "count"])
            .sort_values("count", ascending=False)
            .head(10)
        )
        st.bar_chart(df_users.set_index("user"))

    if stats.by_day:
        df_days = (
            pd.DataFrame(stats.by_day.items(), columns=["day", "count"])
            .sort_values("day")
            .set_index("day")
        )
        st.line_chart(df_days)

    if stats.top_words:
        df_words = pd.DataFrame(stats.top_words, columns=["word", "count"]).head(15)
        st.bar_chart(df_words.set_index("word"))


def main() -> None:
    st.set_page_config(page_title="Telegram Group Dashboard", layout="wide")
    st.title("Telegram Group Analysis Dashboard")
    st.write("ניתוח קבוצות טלגרם עם סינון ממוקד לאיראן וגרפים מתעדכנים.")

    with st.sidebar:
        st.header("Inputs")
        groups_raw = st.text_area(
            "Telegram groups (one per line)",
            value="https://t.me/SeniaWaldberg",
        )
        limit = st.number_input("Message limit", min_value=100, max_value=5000, value=1000)
        top_words = st.number_input("Top words", min_value=5, max_value=50, value=20)
        require_link = st.checkbox(
            "Only messages with links (more reliable)", value=True
        )
        keywords_raw = st.text_input(
            "Keywords (comma-separated)",
            value=",".join(sorted(DEFAULT_IRAN_KEYWORDS)),
        )
        run = st.button("Run analysis")

    groups = [group.strip() for group in groups_raw.splitlines() if group.strip()]
    if not groups:
        st.warning("Please enter at least one Telegram group.")
        return

    if run:
        try:
            keywords = load_keywords(keywords_raw)
            results = asyncio.run(
                analyze_groups(groups, int(limit), keywords, require_link, int(top_words))
            )
        except RuntimeError as exc:
            st.error(str(exc))
            return
        except RPCError as exc:
            st.error(f"Telegram error: {exc}")
            return

        for group, stats in results.items():
            render_group(group, stats)


if __name__ == "__main__":
    main()
