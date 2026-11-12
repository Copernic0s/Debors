def classify_scrape_completion(pages_scraped: int, max_pages: int, end_reason: str) -> tuple[bool, bool]:
    if end_reason in {"pagination_end", "safe_stop"}:
        return True, False
    if end_reason == "max_pages" and pages_scraped >= max_pages:
        return False, True
    return False, False
