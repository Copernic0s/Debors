import re
import unicodedata


def normalize_agent(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", text).strip().lower()


def normalize_company(value: object) -> str:
    cleaned = normalize_agent(value)
    cleaned = re.sub(r"\b(llc|inc|corp|co|ltd|limited)\b", "", cleaned)
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def build_company_agent_map(entries: list[tuple[object, object]]) -> dict[str, str | None]:
    agents_by_company: dict[str, str | None] = {}
    for company, agent in entries:
        company_key = normalize_company(company)
        if not company_key:
            continue

        normalized_agent = normalize_agent(agent) or None
        if company_key not in agents_by_company:
            agents_by_company[company_key] = normalized_agent
        elif agents_by_company[company_key] != normalized_agent:
            agents_by_company[company_key] = None

    return agents_by_company
