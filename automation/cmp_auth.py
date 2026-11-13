DEFAULT_MANUAL_LOGIN_TIMEOUT_SECONDS = 300
DEFAULT_SCHEDULED_LOGIN_TIMEOUT_SECONDS = 60


def login_timeout_seconds(trigger: str, configured: str | None = None) -> int:
    default = DEFAULT_SCHEDULED_LOGIN_TIMEOUT_SECONDS if trigger == "scheduled" else DEFAULT_MANUAL_LOGIN_TIMEOUT_SECONDS
    try:
        value = int(configured) if configured is not None else default
    except (TypeError, ValueError):
        value = default
    return value if value > 0 else default


def classify_auth_timeout(urls: list[str]) -> str:
    normalized = [str(url).lower() for url in urls]
    if any("/auth/mfa/challenge" in url for url in normalized):
        return "mfa_required"
    return "session_expired"
