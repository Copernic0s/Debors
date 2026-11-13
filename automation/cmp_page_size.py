import re
from urllib.parse import parse_qs, urlparse


_PAGINATION_RANGE = re.compile(r"(\d+)\s*[-–—]\s*(\d+)\s+of\s+([\d,]+)", re.IGNORECASE)


def parse_page_limit(url: str) -> int | None:
    values = parse_qs(urlparse(url).query).get("limit", [])
    try:
        return int(values[0]) if values else None
    except (TypeError, ValueError):
        return None


def parse_pagination_range(text: str) -> tuple[int, int] | None:
    match = _PAGINATION_RANGE.search(text or "")
    if not match:
        return None
    start, end, total = match.groups()
    return int(end) - int(start) + 1, int(total.replace(",", ""))


def page_size_matches(
    requested: int,
    *,
    url: str,
    pagination_text: str = "",
    selected_sizes: tuple[int, ...] = (),
    raw_rows: int = 0,
) -> bool:
    """Verify effective pagination without treating a genuinely small result set as failure."""
    url_limit = parse_page_limit(url)
    page_range = parse_pagination_range(pagination_text)
    selected_size = selected_sizes[0] if selected_sizes else None

    if page_range:
        rows_in_range, total_rows = page_range
        expected_rows = min(requested, total_rows)
        if rows_in_range != expected_rows:
            return False
        if selected_size is not None and selected_size != requested and total_rows > selected_size:
            return False
        return True

    if selected_size is not None:
        return selected_size == requested

    # The query string is the primary signal; row count alone is ambiguous for small/last pages.
    return url_limit == requested


def requested_page_size(url: str, default: int = 500) -> int:
    return parse_page_limit(url) or default
