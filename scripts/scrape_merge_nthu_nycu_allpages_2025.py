import re
import json
from typing import List, Dict, Optional
from urllib.parse import urljoin, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup

try:
    from google.colab import files as colab_files  # type: ignore
except ImportError:  # pragma: no cover
    colab_files = None

THIS_YEAR = 2025

# NTHU
NTHU_BASE_URL = "https://www.nthu.edu.tw/"
NTHU_USE_PASTED_HTML = False
NTHU_PASTED_HTML = ""  # 如需改用你貼的完整首頁 HTML，放這裡並設 True

# NYCU
NYCU_BASE_URL = "https://infonews.nycu.edu.tw/"
# 你要抓的分類起始頁（會自動往下抓所有分頁）
NYCU_START_PAGES = [
    # 學術
    "https://infonews.nycu.edu.tw/index.php?SuperType=6&action=more&categoryid=all&pagekey=1",
    # 藝文
    "https://infonews.nycu.edu.tw/index.php?SuperType=7&action=more&categoryid=all&pagekey=1",
    # 你還要抓其他分類就補在這裡：活動/行政/徵才...
    # "https://infonews.nycu.edu.tw/index.php?SuperType=8&action=more&categoryid=all&pagekey=1",
]


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def fetch_html(url: str) -> str:
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    return resp.text


def year_list(text: str) -> List[int]:
    return [int(y) for y in re.findall(r"\b(20\d{2})\b", text or "")]


def should_keep_this_year(period: Optional[str], date_info: Optional[str]) -> bool:
    py = year_list(period or "")
    dy = year_list(date_info or "")
    if not py and not dy:
        return True
    return (THIS_YEAR in py) or (THIS_YEAR in dy)


# NTHU scraper
def nthu_fetch_html() -> str:
    if NTHU_USE_PASTED_HTML and NTHU_PASTED_HTML.strip():
        return NTHU_PASTED_HTML
    return fetch_html(NTHU_BASE_URL)


def nthu_parse_events(html: str) -> List[Dict]:
    soup = BeautifulSoup(html, "html.parser")
    ul = soup.find("ul", id="flexiselDemo2")
    if not ul:
        return []
    items = []
    for li in ul.find_all("li", recursive=False):
        a = li.find("a")
        if not a:
            continue
        href = urljoin(NTHU_BASE_URL, a.get("href", ""))
        img = a.find("img")
        image = urljoin(NTHU_BASE_URL, img.get("src", "")) if img else None
        p = a.find("p")

        title = None
        description = None
        date_info = None
        location = None

        if p:
            st = p.find("span")
            title = clean_text(st.get_text()) if st else None
            more = p.find("span", class_="more")
            if more:
                more.extract()
            raw = clean_text(p.get_text(separator=" "))
            description = clean_text(raw[len(title):]) if title and raw.startswith(title) else raw

            for pat in [
                r"(時間[:：]\s*[^，。；\n]+)",
                r"(場次[:：]\s*[^，。；\n]+)",
                r"(\d{1,2}/\d{1,2}\s*至\s*\d{1,2}/\d{1,2})",
                r"(\d{1,2}/\d{1,2}(?:、\d{1,2}/\d{1,2})+)",
            ]:
                m = re.search(pat, description)
                if m:
                    date_info = m.group(1).strip()
                    break
            m = re.search(r"(地點[:：]\s*[^，。；\n]+)", description)
            if m:
                location = m.group(1).strip()

        items.append(
            {
                "source": "NTHU",
                "category": None,
                "title": title,
                "period": None,
                "subtitle": None,
                "description": description,
                "date_info": date_info,
                "location": location,
                "href": href,
                "image": image,
            }
        )
    return items


# NYCU table parser (三列一組)
def nycu_parse_table(html: str) -> List[Dict]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="category-style")
    if not table:
        return []
    rows = table.find_all("tr")
    out: List[Dict] = []

    i = 0
    while i < len(rows):
        r1 = rows[i] if i < len(rows) else None
        r2 = rows[i + 1] if i + 1 < len(rows) else None
        r3 = rows[i + 2] if i + 2 < len(rows) else None
        if not (r1 and r2 and r3):
            i += 1
            continue

        img = r1.find("img")
        category = clean_text(img["alt"]) if img and img.has_attr("alt") else None

        a = r1.find("a")
        title = clean_text(a.get_text()) if a else None
        href = urljoin(NYCU_BASE_URL, a.get("href")) if a and a.get("href") else None

        period = clean_text(r2.get_text()) or None
        subtitle = clean_text(r3.get_text()) or None

        if title or href:
            out.append(
                {
                    "source": "NYCU_Infonews",
                    "category": category,
                    "title": title,
                    "period": period,
                    "subtitle": subtitle,
                    "description": None,
                    "date_info": None,
                    "location": None,
                    "href": href,
                    "image": None,
                }
            )
            i += 3
        else:
            i += 1
    return out


# 解析分頁列 [1][2][3] → 回傳所有分頁 URL
def nycu_find_pagination_urls(html: str, current_url: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls = set()
    # 頁面底部 category 區塊附近通常包含分頁
    cat = soup.find(id="category")
    if cat:
        for a in cat.find_all("a"):
            href = a.get("href")
            if not href:
                continue
            full = urljoin(NYCU_BASE_URL, href)
            # 只抓同分類的列表頁（有 SuperType & action=more）
            qs = parse_qs(urlparse(full).query)
            if qs.get("action", [""])[0] == "more":
                urls.add(full)
    # 確保包含目前頁
    urls.add(current_url)
    return sorted(urls)


# 抓一個起始分類的所有分頁
def nycu_collect_all_pages(start_url: str) -> List[Dict]:
    first_html = fetch_html(start_url)
    page_urls = nycu_find_pagination_urls(first_html, start_url)
    items: List[Dict] = []
    for u in page_urls:
        html = first_html if u == start_url else fetch_html(u)
        items.extend(nycu_parse_table(html))
    return items


def unique_key(item: Dict) -> str:
    return f"{item.get('source','')}|{item.get('title','')}|{item.get('href','')}"


def merge_items(groups: List[List[Dict]]) -> List[Dict]:
    merged: Dict[str, Dict] = {}
    for group in groups:
        for item in group:
            key = unique_key(item)
            if key not in merged:
                merged[key] = item
            else:
                for k, v in item.items():
                    if not merged[key].get(k) and v:
                        merged[key][k] = v
    return list(merged.values())


def filter_this_year(items: List[Dict]) -> List[Dict]:
    keep: List[Dict] = []
    for it in items:
        period = it.get("period")
        date_info = it.get("date_info")
        if should_keep_this_year(period, date_info):
            keep.append(it)
    return keep


def main():
    # NTHU
    nthu_html = nthu_fetch_html()
    nthu_items = nthu_parse_events(nthu_html)

    # NYCU 所有指定分類分頁
    nycu_items_all: List[Dict] = []
    for start in NYCU_START_PAGES:
        nycu_items_all.extend(nycu_collect_all_pages(start))

    merged = merge_items([nthu_items, nycu_items_all])
    filtered = filter_this_year(merged)

    # 排序：period/date_info/title
    def sort_key(x: Dict) -> str:
        return clean_text(x.get("period") or x.get("date_info") or x.get("title") or "")

    filtered.sort(key=sort_key)

    print(
        f"NTHU: {len(nthu_items)} NYCU(all pages): {len(nycu_items_all)} → merged: {len(merged)} → 2025: {len(filtered)}"
    )
    print(json.dumps(filtered, ensure_ascii=False, indent=2))

    out = "merged_events_2025.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(filtered, f, ensure_ascii=False, indent=2)

    if colab_files:  # pragma: no cover
        colab_files.download(out)


if __name__ == "__main__":
    main()

