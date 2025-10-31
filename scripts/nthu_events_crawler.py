#!/usr/bin/env python3
"""Fetch and persist the latest event list from the NTHU homepage."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.nthu.edu.tw/"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "nthu_events.json"
REQUEST_TIMEOUT = 15


def clean_text(raw: str) -> str:
    """Normalize whitespace and strip leading/trailing spaces."""
    return re.sub(r"\s+", " ", raw).strip()


def fetch_html() -> str:
    resp = requests.get(BASE_URL, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.text


def parse_events(html: str) -> List[Dict[str, Optional[str]]]:
    soup = BeautifulSoup(html, "html.parser")
    ul = soup.find("ul", id="flexiselDemo2")
    if not ul:
        return []

    events: List[Dict[str, Optional[str]]] = []
    for li in ul.find_all("li", recursive=False):
        anchor = li.find("a")
        if not anchor:
            continue

        href = urljoin(BASE_URL, anchor.get("href", ""))
        image = None
        img = anchor.find("img")
        if img:
            image = urljoin(BASE_URL, img.get("src", ""))

        info_block = anchor.find("p")
        title: Optional[str] = None
        description: Optional[str] = None
        date_info: Optional[str] = None
        location: Optional[str] = None

        if info_block:
            span_title = info_block.find("span")
            if span_title:
                title = clean_text(span_title.get_text())

            more_span = info_block.find("span", class_="more")
            if more_span:
                more_span.extract()

            raw_text = clean_text(info_block.get_text(separator=" "))
            if title and raw_text.startswith(title):
                description = clean_text(raw_text[len(title) :])
            else:
                description = raw_text

            if description:
                for pattern in (
                    r"(時間[:：]\s*[^，。；\n]+)",
                    r"(場次[:：]\s*[^，。；\n]+)",
                    r"(\d{1,2}/\d{1,2}\s*至\s*\d{1,2}/\d{1,2})",
                    r"(\d{1,2}/\d{1,2}(?:、\d{1,2}/\d{1,2})+)",
                ):
                    match = re.search(pattern, description)
                    if match:
                        date_info = match.group(1).strip()
                        break

                location_match = re.search(r"(地點[:：]\s*[^，。；\n]+)", description)
                if location_match:
                    location = location_match.group(1).strip()

        events.append(
            {
                "title": title,
                "description": description,
                "date_info": date_info,
                "location": location,
                "href": href,
                "image": image,
            }
        )

    return events


def main() -> None:
    html = fetch_html()
    events = parse_events(html)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as fp:
        json.dump(events, fp, ensure_ascii=False, indent=2)

    try:
        display_path = OUTPUT_PATH.relative_to(Path.cwd())
    except ValueError:
        display_path = OUTPUT_PATH

    print(f"Wrote {len(events)} events to {display_path}")


if __name__ == "__main__":
    main()
