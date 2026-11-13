import re
import unicodedata
import json
from pathlib import Path


ACTIVE_AGENT_NAMES = json.loads(
    (Path(__file__).resolve().parents[1] / "config" / "active-agents.json").read_text(encoding="utf-8")
)


def normalize_agent(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", text).strip().lower()


def normalize_company(value: object) -> str:
    cleaned = normalize_agent(value)
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def build_company_agent_map(
    entries: list[tuple[object, object]],
    active_agents: list[object] | None = None,
) -> dict[str, str | None]:
    allowed_agents = (
        {normalize_agent(agent) for agent in active_agents}
        if active_agents is not None
        else None
    )
    agents_by_company: dict[str, str | None] = {}
    for company, agent in entries:
        company_key = normalize_company(company)
        if not company_key:
            continue

        normalized_agent = normalize_agent(agent) or None
        if allowed_agents is not None and normalized_agent not in allowed_agents:
            continue
        if company_key not in agents_by_company:
            agents_by_company[company_key] = normalized_agent
        elif agents_by_company[company_key] != normalized_agent:
            agents_by_company[company_key] = None

    return agents_by_company
