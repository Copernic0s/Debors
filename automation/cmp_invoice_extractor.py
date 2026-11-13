"""
CMP global invoicing scraper — portfolio filter from Zoho "Client BY agent".
Writes status to automation/cmp_status.json and POSTs snapshot to ingest API.
"""
from __future__ import annotations

import logging
import os
import re
import socket
import sys
import time
import unicodedata
import uuid
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from datetime import datetime, timedelta
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any
from cmp_agent_scope import ACTIVE_AGENT_NAMES, build_company_agent_map, normalize_company
from cmp_auth import classify_auth_timeout, login_timeout_seconds
from cmp_invoice_window import should_keep_invoice
from cmp_page_size import page_size_matches, requested_page_size
from cmp_scrape_completion import classify_scrape_completion
from cmp_run_status import write_run_status

import pandas as pd
import requests
from selenium import webdriver
from selenium.common.exceptions import (
    InvalidSessionIdException,
    SessionNotCreatedException,
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver import ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

ROOT_DIR = Path(__file__).resolve().parents[1]


def load_dotenv_file() -> None:
    env_path = ROOT_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv_file()
INVOICING_URL = os.getenv(
    "CMP_INVOICING_URL",
    "https://cmp-front.production.united-fuel.com/invoicing?page=1&limit=500",
)
ZOHO_XLSX_URL = os.getenv(
    "CMP_ZOHO_XLSX_URL",
    "https://sheet.zohopublic.com/sheet/published/w0yyac483bf4377414680872e6205cd34447b?download=xlsx",
)
ZOHO_SHEET_NAME = os.getenv("CMP_ZOHO_SHEET_NAME", "Client BY agent")
HISTORY_DAYS = int(os.getenv("CMP_HISTORY_DAYS", "60"))
MAX_PAGES = int(os.getenv("CMP_MAX_PAGES", "40"))
DEFAULT_TIMEOUT = int(os.getenv("CMP_TIMEOUT", "90"))
ATTACH_TIMEOUT_SECONDS = int(os.getenv("CMP_ATTACH_TIMEOUT_SECONDS", "20"))
INGEST_URL = os.getenv("CMP_INGEST_URL", "http://127.0.0.1:3001/api/cmp/ingest").strip()
INGEST_SECRET = os.getenv("CMP_INGEST_SECRET", "").strip()
STATUS_PATH = ROOT_DIR / "automation" / "cmp_status.json"
LOG_PATH = Path(os.getenv("CMP_LOG_PATH", str(ROOT_DIR / "automation" / "cmp_invoice_extractor.log")))
RUN_ID = os.getenv("CMP_RUN_ID", "")
PARENT_RUN_ID = os.getenv("CMP_PARENT_RUN_ID", "")
RUN_TRIGGER = os.getenv("CMP_RUN_TRIGGER", "manual").strip().lower()
if RUN_TRIGGER not in {"manual", "scheduled"}:
    RUN_TRIGGER = "manual"


@dataclass
class ScrapeResult:
    invoices: list[dict[str, Any]]
    pages_scraped: int
    complete: bool
    truncated: bool


def configure_logging() -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

    class RunContextFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            record.run_id = RUN_ID or "unassigned"
            record.parent_run_id = PARENT_RUN_ID or RUN_ID or "unassigned"
            return True

    handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
    handler.addFilter(RunContextFilter())
    console = logging.StreamHandler(sys.stdout)
    console.addFilter(RunContextFilter())
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | run_id=%(run_id)s | parent_run_id=%(parent_run_id)s | %(message)s",
        handlers=[handler, console],
    )


def write_status(
    *,
    running: bool,
    phase: str,
    message: str,
    page: int = 0,
    invoices_found: int = 0,
    error: str | None = None,
    run_status: str | None = None,
    pages_scraped: int | None = None,
    truncated: bool | None = None,
    persisted: bool = False,
    failure_reason: str | None = None,
) -> None:
    write_run_status(
        STATUS_PATH,
        run_id=RUN_ID,
        parent_run_id=PARENT_RUN_ID or RUN_ID,
        running=running,
        phase=phase,
        message=message,
        page=page,
        invoices_found=invoices_found,
        error=error,
        run_status=run_status,
        pages_scraped=pages_scraped,
        truncated=truncated,
        persisted=persisted,
        failure_reason=failure_reason,
        trigger=RUN_TRIGGER,
    )


def normalize_text(value: str) -> str:
    text = str(value or "").strip()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text).lower()


def normalize_company_key(value: str) -> str:
    return normalize_company(value)


def parse_amount(raw_value: str) -> float | None:
    text = str(raw_value or "").strip()
    if not text:
        return None
    cleaned = re.sub(r"[^0-9,.-]", "", text.replace("$", ""))
    if not cleaned:
        return None
    last_comma = cleaned.rfind(",")
    last_dot = cleaned.rfind(".")
    sep = max(last_comma, last_dot)
    if sep == -1:
        try:
            return float(cleaned)
        except ValueError:
            return None
    int_part = re.sub(r"[.,]", "", cleaned[:sep])
    dec_part = re.sub(r"[.,]", "", cleaned[sep + 1 :])
    try:
        return float(f"{int_part}.{dec_part}")
    except ValueError:
        return None


def parse_date_value(raw_value: str) -> datetime | None:
    text = str(raw_value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None)
    except ValueError:
        return None


def normalize_debtor_status(raw_status: str, due_date: datetime | None) -> str:
    raw = normalize_text(raw_status)
    if "partial" in raw or "unpaid" in raw:
        if due_date and due_date.date() < datetime.now().date():
            return "overdue"
        return "pending"
    if "paid" in raw or "cobrado" in raw:
        return "paid"
    if "overdue" in raw or "mora" in raw:
        return "overdue"
    if "pending" in raw:
        if due_date and due_date.date() < datetime.now().date():
            return "overdue"
        return "pending"
    if due_date and due_date.date() < datetime.now().date():
        return "overdue"
    return "pending"


def load_portfolio_scope() -> tuple[set[str], dict[str, str | None]]:
    write_status(running=True, phase="zoho", message="Loading Client BY agent from Zoho...")
    response = requests.get(ZOHO_XLSX_URL, timeout=60)
    response.raise_for_status()
    workbook = pd.ExcelFile(BytesIO(response.content), engine="openpyxl")
    sheet_name = None
    for name in workbook.sheet_names:
        if name.strip().lower() == ZOHO_SHEET_NAME.strip().lower():
            sheet_name = name
            break
    if not sheet_name:
        raise ValueError(f"Sheet '{ZOHO_SHEET_NAME}' not found. Available: {workbook.sheet_names}")

    frame = pd.read_excel(workbook, sheet_name=sheet_name, engine="openpyxl")
    columns = {str(c).strip().lower(): c for c in frame.columns}
    company_col = columns.get("company name") or columns.get("company")
    if not company_col:
        raise ValueError("Client BY agent sheet must include 'Company Name'")
    agent_col = columns.get("sales rep") or columns.get("agentid") or columns.get("agent")

    scope_entries = []
    for _, row in frame.fillna("").iterrows():
        company = str(row[company_col]).strip()
        agent = row[agent_col] if agent_col else ""
        scope_entries.append((company, agent))
    agents_by_company = build_company_agent_map(scope_entries, ACTIVE_AGENT_NAMES)
    keys = set(agents_by_company)
    logging.info(
        "Portfolio loaded: %d companies from '%s'; %d scoped, %d ambiguous/unassigned.",
        len(keys), sheet_name,
        sum(agent is not None for agent in agents_by_company.values()),
        len(keys) - sum(agent is not None for agent in agents_by_company.values()),
    )
    return keys, agents_by_company


def build_chrome_options() -> ChromeOptions:
    options = ChromeOptions()
    if os.getenv("CMP_HEADLESS", "false").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--disable-notifications")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    debugger = os.getenv("CMP_DEBUGGER_ADDRESS", "").strip()
    if debugger:
        options.debugger_address = debugger
    else:
        user_data = os.getenv("CMP_USER_DATA_DIR", "").strip()
        profile = os.getenv("CMP_PROFILE_DIR", "Profile 8").strip()
        if user_data:
            options.add_argument(f"--user-data-dir={user_data}")
        if profile:
            options.add_argument(f"--profile-directory={profile}")
    return options


def wait_for_debugger(address: str, timeout_seconds: int) -> bool:
    host, port_text = address.split(":")
    port = int(port_text)
    start = time.time()
    while time.time() - start < timeout_seconds:
        try:
            with socket.create_connection((host, port), timeout=1.5):
                return True
        except OSError:
            time.sleep(0.5)
    return False


def create_driver() -> WebDriver:
    debugger = os.getenv("CMP_DEBUGGER_ADDRESS", "").strip()
    if debugger:
        logging.info("Attaching to Chrome debugger at %s", debugger)
        if not wait_for_debugger(debugger, ATTACH_TIMEOUT_SECONDS):
            raise TimeoutException(f"Debugger {debugger} not reachable")
    service = ChromeService(ChromeDriverManager().install())
    try:
        return webdriver.Chrome(service=service, options=build_chrome_options())
    except SessionNotCreatedException as error:
        raise RuntimeError(
            "Could not attach to Chrome. Close other automation sessions or launch run_cmp_bot.ps1 first."
        ) from error


def wait_for_invoicing_table(driver: WebDriver) -> None:
    wait = WebDriverWait(driver, DEFAULT_TIMEOUT)
    wait.until(EC.presence_of_element_located((By.XPATH, "//table | //*[@role='table']")))
    
    last_row_count = -1
    stable_count = 0
    
    for _ in range(30):
        try:
            current_count = int(
                driver.execute_script(
                    """
                    const table = document.querySelector('table, [role="table"]');
                    if (!table) return -1;
                    return table.querySelectorAll('tbody tr, [role="row"]').length;
                    """
                )
            )
        except (StaleElementReferenceException, WebDriverException):
            time.sleep(1)
            continue

        if current_count >= 0:
            if current_count > 1:
                return
            
            # If the row count is stable (usually 0 or 1 for empty table) for 3 consecutive checks (~6s),
            # it means the table is loaded and empty.
            if current_count == last_row_count:
                stable_count += 1
                if stable_count >= 3:
                    logging.info("Table is empty (no invoices found) and has stabilized.")
                    return
            else:
                stable_count = 0
                
            last_row_count = current_count
        time.sleep(2)


class CmpRunFailure(RuntimeError):
    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason


def verify_invoicing_page_size(driver: WebDriver, requested: int) -> bool:
    snapshot = driver.execute_script(
        """
        const visible = (el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const pattern = /\\b\\d+\\s*[-–—]\\s*\\d+\\s+of\\s+[\\d,]+/i;
        const pagination = [...document.querySelectorAll('body *')]
          .map((el) => (el.innerText || el.textContent || '').trim())
          .filter((text) => text.length < 120 && pattern.test(text))
          .sort((a, b) => a.length - b.length)[0] || '';
        const controls = [...document.querySelectorAll('select, [role="combobox"]')]
          .filter(visible)
          .map((el) => {
            const parent = el.closest('label') || el.parentElement;
            const selected = el.selectedOptions?.[0]?.textContent || el.innerText || el.value || '';
            const context = [el.getAttribute('aria-label') || '', parent?.innerText || ''].join(' ').trim();
            return { selected: selected.trim(), context };
          })
          .filter((item) => /per page|rows per page|items per page|page size/i.test(item.context));
        const table = document.querySelector('table, [role="table"]');
        const rawRows = table ? table.querySelectorAll('tbody tr, [role="row"]:not([role="columnheader"])').length : 0;
        return { url: window.location.href, pagination, controls, rawRows };
        """
    )
    selected_sizes = []
    for control in snapshot.get("controls", []):
        match = re.search(r"\b(\d+)\b", control.get("selected", ""))
        if match:
            selected_sizes.append(int(match.group(1)))
    raw_rows = int(snapshot.get("rawRows") or 0)
    valid = page_size_matches(
        requested,
        url=str(snapshot.get("url") or safe_current_url(driver)),
        pagination_text=str(snapshot.get("pagination") or ""),
        selected_sizes=tuple(selected_sizes),
        raw_rows=raw_rows,
    )
    logging.info(
        "Invoicing page-size check: requested=%d url=%s selected=%s raw_rows=%d pagination=%s valid=%s",
        requested,
        snapshot.get("url"),
        selected_sizes,
        raw_rows,
        snapshot.get("pagination"),
        valid,
    )
    return valid


def ensure_invoicing_page_size(driver: WebDriver, requested: int) -> None:
    for attempt in range(2):
        wait_for_invoicing_table(driver)
        deadline = time.time() + 15
        while time.time() < deadline:
            if verify_invoicing_page_size(driver, requested):
                return
            time.sleep(1)
        if attempt == 0:
            logging.warning("Requested page size was not active after navigation; retrying canonical invoicing URL.")
            goto_invoicing_page(driver, 1)
            continue
    raise CmpRunFailure(
        "unexpected_page_size",
        f"CMP did not honor the requested {requested}-row page size after one retry; no invoice snapshot was ingested.",
    )


def resolve_column_index(headers: list[str], candidates: tuple[str, ...]) -> int | None:
    for candidate in candidates:
        for index, header in enumerate(headers):
            if candidate in header:
                return index
    return None


def safe_current_url(driver: WebDriver) -> str:
    try:
        return str(driver.current_url or "")
    except InvalidSessionIdException as error:
        raise RuntimeError(
            "Chrome closed or lost the debugger connection. "
            "Keep the Profile 8 window open and run Sync All again."
        ) from error


def switch_to_invoicing_tab(driver: WebDriver) -> bool:
    """
    When attached to an existing Chrome profile (remote debugger),
    there may already be an authenticated CMP tab open.
    If navigation gets redirected to /auth, try to locate an existing /invoicing tab
    and switch to it instead of forcing a new navigation.
    """
    try:
        handles = list(driver.window_handles)
    except WebDriverException:
        return False

    for handle in handles:
        try:
            driver.switch_to.window(handle)
            url = safe_current_url(driver)
            if "/invoicing" in url and "/auth" not in url:
                logging.info("Switched to existing invoicing tab: %s", url)
                return True
        except WebDriverException:
            continue
    return False


def navigate_to_invoicing(driver: WebDriver) -> None:
    write_status(running=True, phase="navigate", message="Opening CMP invoicing...")
    logging.info("Navigating to %s", INVOICING_URL)

    try:
        current = safe_current_url(driver)
        if "/invoicing" in current and "/auth" not in current:
            canonical = build_invoicing_page_url(1)
            logging.info("Already on invoicing page: %s. Resetting to %s", current, canonical)
            goto_invoicing_page(driver, 1)
            if "/auth" not in safe_current_url(driver):
                return
    except RuntimeError:
        raise

    # If we're attached to a real Chrome profile, prefer an already-open invoicing tab
    # to avoid triggering fresh auth redirects.
    if switch_to_invoicing_tab(driver):
        return

    try:
        driver.get(INVOICING_URL)
    except WebDriverException as error:
        logging.warning("driver.get failed, trying in-page navigation: %s", error)
        driver.execute_script("window.location.assign(arguments[0]);", INVOICING_URL)

    login_timeout = login_timeout_seconds(RUN_TRIGGER, os.getenv("CMP_LOGIN_TIMEOUT_SECONDS"))
    start = time.time()
    last_status_at = 0.0
    observed_urls: list[str] = []

    while time.time() - start < login_timeout:
        url = safe_current_url(driver)
        observed_urls.append(url)
        if "/invoicing" in url and "/auth" not in url:
            logging.info("Invoicing page ready: %s", url)
            write_status(
                running=True,
                phase="navigate",
                message="CMP invoicing loaded. Starting table scan...",
            )
            return

        # Sometimes the currently selected tab gets redirected to /auth even though
        # another tab in the same profile is still authenticated. Try switching.
        if "/auth" in url and switch_to_invoicing_tab(driver):
            continue

        now = time.time()
        if now - last_status_at >= 5:
            elapsed = int(now - start)
            hint = "complete login or MFA in Chrome" if "/auth" in url else "waiting for invoicing table"
            write_status(
                running=True,
                phase="navigate",
                message=f"Waiting for invoicing ({elapsed}s) of {login_timeout}s — {hint}. URL: {url[:80]}",
            )
            logging.info("Waiting for invoicing (%ss): %s", elapsed, url)
            last_status_at = now

        time.sleep(1)

    reason = classify_auth_timeout(observed_urls)
    message = "CMP MFA was not completed" if reason == "mfa_required" else "CMP authentication did not reach invoicing"
    raise CmpRunFailure(reason, f"{message} within {login_timeout} seconds.")


def build_invoicing_page_url(page: int) -> str:
    """
    CMP supports paging via query param (?page=N&limit=500).
    Navigating by URL is more reliable than clicking Next, because the paging UI
    can be implemented as non-button elements or can change between builds.
    """
    parsed = urlparse(INVOICING_URL)
    qs = parse_qs(parsed.query)
    qs["page"] = [str(max(1, int(page)))]
    if "limit" not in qs:
        qs["limit"] = ["500"]
    new_query = urlencode(qs, doseq=True)
    return urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment)
    )


def goto_invoicing_page(driver: WebDriver, page: int) -> None:
    target = build_invoicing_page_url(page)
    try:
        driver.get(target)
    except WebDriverException:
        driver.execute_script("window.location.assign(arguments[0]);", target)


def clear_visible_table_filters(driver: WebDriver) -> None:
    """
    CMP keeps some table filters/search values in the browser session.
    If a previous manual search was left in place (for example one company name),
    the bot only sees that subset and uploads an incomplete snapshot.
    """
    selectors = (
        "input:not([type]), input[type='text'], input[type='search'], "
        "textarea, [contenteditable='true']"
    )
    try:
        filter_controls = driver.find_elements(By.CSS_SELECTOR, selectors)
    except WebDriverException:
        return

    cleared: list[str] = []
    for control in filter_controls:
        try:
            if not control.is_displayed() or not control.is_enabled():
                continue
            value = str(control.get_attribute("value") or control.get_attribute("textContent") or "")
            if not value.strip():
                continue
            label = (
                control.get_attribute("placeholder")
                or control.get_attribute("aria-label")
                or control.get_attribute("name")
                or control.get_attribute("id")
                or "filter"
            )
            control.click()
            control.send_keys(Keys.CONTROL, "a")
            control.send_keys(Keys.BACKSPACE)
            control.send_keys(Keys.ENTER)
            driver.execute_script(
                """
                const el = arguments[0];
                const setValue = Object.getOwnPropertyDescriptor(
                  el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
                  'value'
                )?.set;
                if (setValue && 'value' in el) setValue.call(el, '');
                else el.textContent = '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                """,
                control,
            )
            control.send_keys(Keys.ENTER)
            cleared.append(f"{label}='{value[:60]}'")
        except WebDriverException:
            continue

    if cleared:
        logging.info("Cleared CMP filters/search before scraping: %s", "; ".join(cleared))
        time.sleep(3)
        for _ in range(10):
            time.sleep(1)
            try:
                remaining = driver.find_elements(By.CSS_SELECTOR, selectors)
                active_values = [
                    str(item.get_attribute("value") or item.get_attribute("textContent") or "").strip()
                    for item in remaining
                    if item.is_displayed() and item.is_enabled()
                ]
                if not any(active_values):
                    return
            except WebDriverException:
                return
        logging.warning("Some CMP filter/search controls still have values after clearing.")


def read_first_row_signature(driver: WebDriver) -> str:
    try:
        return str(
            driver.execute_script(
                """
                const row = document.querySelector('table tbody tr, [role="table"] [role="row"]');
                return row ? row.textContent : '';
                """
            )
            or ""
        )
    except WebDriverException:
        return ""


def wait_for_table_change(driver: WebDriver, first_row_sig: str, timeout_seconds: int = 45) -> bool:
    start = time.time()
    while time.time() - start < timeout_seconds:
        time.sleep(1)
        current_sig = read_first_row_signature(driver)
        if current_sig and current_sig != first_row_sig:
            return True
    return False


def click_next_page_button(driver: WebDriver) -> bool:
    button_xpaths = [
        "//button[not(@disabled) and not(@aria-disabled='true') and not(ancestor::tbody or ancestor::tr) and "
        "(contains(translate(@aria-label,'NEXT','next'),'next') or "
        "contains(translate(@title,'NEXT','next'),'next') or "
        "contains(translate(normalize-space(.),'NEXT','next'),'next'))]",
        "//a[not(@aria-disabled='true') and not(ancestor::tbody or ancestor::tr) and "
        "(contains(translate(@aria-label,'NEXT','next'),'next') or "
        "contains(translate(@title,'NEXT','next'),'next') or "
        "contains(translate(normalize-space(.),'NEXT','next'),'next'))]",
        "//*[self::button or self::a][not(@disabled) and not(@aria-disabled='true') and not(ancestor::tbody or ancestor::tr)]"
        "[.//*[contains(@class,'chevron-right') or contains(@class,'arrow-right')]]",
    ]

    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(0.5)
    for xpath in button_xpaths:
        try:
            candidates = driver.find_elements(By.XPATH, xpath)
        except WebDriverException:
            continue
        for candidate in candidates:
            try:
                if not candidate.is_displayed() or not candidate.is_enabled():
                    continue
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", candidate)
                time.sleep(0.2)
                driver.execute_script("arguments[0].click();", candidate)
                return True
            except WebDriverException:
                continue
    return False


def advance_to_next_invoicing_page(driver: WebDriver, page: int, first_row_sig: str) -> bool:
    if click_next_page_button(driver):
        if wait_for_table_change(driver, first_row_sig):
            return True
        logging.warning("Next button clicked for page %d but table did not refresh.", page + 1)

    goto_invoicing_page(driver, page + 1)
    if "/auth" in safe_current_url(driver):
        if switch_to_invoicing_tab(driver):
            goto_invoicing_page(driver, page + 1)
        else:
            navigate_to_invoicing(driver)
            goto_invoicing_page(driver, page + 1)

    return wait_for_table_change(driver, first_row_sig)


def scrape_global_invoices(
    driver: WebDriver,
    portfolio_keys: set[str],
    agents_by_company: dict[str, str | None] | None = None,
    cutoff: datetime | None = None,
) -> ScrapeResult:
    cutoff = cutoff or datetime.now() - timedelta(days=HISTORY_DAYS)
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    pages_scraped = 0
    end_reason = "incomplete"

    navigate_to_invoicing(driver)
    requested_size = requested_page_size(INVOICING_URL)
    wait_for_invoicing_table(driver)
    clear_visible_table_filters(driver)
    wait_for_invoicing_table(driver)
    ensure_invoicing_page_size(driver, requested_size)

    for page in range(1, MAX_PAGES + 1):
        write_status(
            running=True,
            phase="scraping",
            message=f"Scanning invoicing page {page}...",
            page=page,
            invoices_found=len(results),
        )
        wait_for_invoicing_table(driver)
        tables = driver.find_elements(By.CSS_SELECTOR, "table, [role='table']")
        if not tables:
            break
        table = tables[0]

        header_cells = table.find_elements(
            By.XPATH, ".//thead//th | .//*[@role='columnheader'] | .//th"
        )
        if not header_cells:
            header_cells = table.find_elements(
                By.XPATH,
                "(.//tr | .//*[@role='row'])[1]//*[self::td or self::th or @role='cell' or @role='columnheader']",
            )
        headers = [normalize_text(cell.get_attribute("textContent") or "") for cell in header_cells]
        if page == 1:
            logging.info("CMP headers: %s", headers)

        company_i = resolve_column_index(headers, ("company name",))
        invoice_i = resolve_column_index(headers, ("invoice number", "invoice #"))
        amount_i = resolve_column_index(headers, ("total amount",))
        status_i = next((i for i, h in enumerate(headers) if h == "status"), None)
        if status_i is None:
            status_i = resolve_column_index(headers, ("payment status",))
        invoice_date_i = resolve_column_index(headers, ("invoice date",))
        due_date_i = resolve_column_index(headers, ("due date",))
        remaining_amount_i = resolve_column_index(headers, ("remaining amount",))
        total_paid_i = resolve_column_index(headers, ("total paid",))
        billing_type_i = resolve_column_index(headers, ("billing type",))

        if company_i is None or invoice_i is None or amount_i is None or status_i is None:
            raise ValueError(f"Missing required columns on page {page}: {headers}")

        script = """
        const table = arguments[0];
        const cIdx = arguments[1], iIdx = arguments[2], aIdx = arguments[3], sIdx = arguments[4];
        const dIdx = arguments[5], ddIdx = arguments[6];
        const remIdx = arguments[7], paidIdx = arguments[8], btIdx = arguments[9];
        const rows = table.querySelectorAll('tbody tr, [role="row"]:not([role="columnheader"])');
        const out = [];
        for (const row of rows) {
          const cells = row.querySelectorAll('td, [role="cell"]');
          if (cells.length <= Math.max(cIdx, iIdx, aIdx, sIdx)) continue;
          out.push([
            cells[cIdx].innerText.trim(),
            cells[iIdx].innerText.trim(),
            cells[aIdx].innerText.trim(),
            cells[sIdx].innerText.trim(),
            dIdx !== null && dIdx < cells.length ? cells[dIdx].innerText.trim() : '',
            ddIdx !== null && ddIdx < cells.length ? cells[ddIdx].innerText.trim() : '',
            remIdx !== null && remIdx < cells.length ? cells[remIdx].innerText.trim() : '',
            paidIdx !== null && paidIdx < cells.length ? cells[paidIdx].innerText.trim() : '',
            btIdx !== null && btIdx < cells.length ? cells[btIdx].innerText.trim() : ''
          ]);
        }
        return out;
        """
        raw_rows = driver.execute_script(
            script, table, company_i, invoice_i, amount_i, status_i, invoice_date_i, due_date_i,
            remaining_amount_i, total_paid_i, billing_type_i
        )
        pages_scraped = page

        page_dates: list[datetime] = []
        page_matched = 0
        raw_row_count = len(raw_rows or [])

        for row in raw_rows or []:
            company, invoice_no, amount_text, status_raw, inv_date_text, due_text, remaining_text, paid_text, billing_type_text = row
            if not company or not invoice_no:
                continue

            company_key = normalize_company_key(company)
            if company_key not in portfolio_keys:
                continue

            invoice_date = parse_date_value(inv_date_text)
            if invoice_date:
                page_dates.append(invoice_date)

            due_date = parse_date_value(due_text)
            if not due_date and invoice_date:
                due_date = invoice_date + timedelta(days=1)

            dedupe_key = f"{company_key}|{normalize_text(invoice_no)}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            amount = parse_amount(amount_text) or 0.0
            remaining_amount = parse_amount(remaining_text)
            total_paid = parse_amount(paid_text) or 0.0
            billing_type = str(billing_type_text or "").strip()
            
            # Use remaining_amount as the primary amount field to represent outstanding debt correctly.
            final_amount = remaining_amount if remaining_amount is not None else amount

            status = normalize_debtor_status(status_raw, due_date)
            if not should_keep_invoice(status, final_amount, invoice_date, cutoff):
                continue

            results.append(
                {
                    "companyName": company.strip(),
                    "agentId": (agents_by_company or {}).get(company_key),
                    "invoiceNumber": invoice_no.strip(),
                    "amount": round(final_amount, 2),
                    "totalAmount": round(amount, 2),
                    "remainingAmount": round(final_amount, 2),
                    "totalPaid": round(total_paid, 2),
                    "billingType": billing_type,
                    "invoiceDate": invoice_date.strftime("%Y-%m-%d") if invoice_date else None,
                    "dueDate": due_date.strftime("%Y-%m-%d") if due_date else None,
                    "status": status,
                    "cmpStatusRaw": str(status_raw or "").strip(),
                }
            )
            page_matched += 1

        date_summary = ""
        if page_dates:
            date_summary = f" Date range: {min(page_dates).date()} to {max(page_dates).date()}."
        logging.info(
            "Page %d: %d raw rows, %d portfolio matches (total %d).%s",
            page,
            raw_row_count,
            page_matched,
            len(results),
            date_summary,
        )

        # CMP pages are not guaranteed to be sorted strictly by invoice date.
        # A single old invoice on page 1 used to stop the sync and skip newer invoices
        # on later pages, which is especially visible on Thursday's second billing cycle.

        rows = table.find_elements(By.XPATH, ".//tbody/tr | .//*[@role='row']")
        if len(rows) <= 1:
            end_reason = "pagination_end"
            break

        if page >= MAX_PAGES:
            end_reason = "max_pages"
            break

        first_row_sig = read_first_row_signature(driver)
        if not advance_to_next_invoicing_page(driver, page, first_row_sig):
            logging.warning("Pagination did not refresh; stopping.")
            end_reason = "pagination_error"
            break

    complete, truncated = classify_scrape_completion(pages_scraped, MAX_PAGES, end_reason)
    return ScrapeResult(results, pages_scraped, complete, truncated)


def post_ingest(
    invoices: list[dict[str, Any]],
    sync_run_id: str,
    *,
    run_status: str,
    pages_scraped: int,
    truncated: bool,
    cutoff_date: datetime,
    scope_agent_ids: list[str],
    started_at: str,
    failure_reason: str | None = None,
) -> dict[str, Any] | None:
    if not INGEST_URL:
        logging.warning("CMP_INGEST_URL not set; skipping upload.")
        return None

    write_status(
        running=True,
        phase="upload",
        message=f"Uploading {len(invoices)} invoices to Debors...",
        invoices_found=len(invoices),
    )
    headers = {"Content-Type": "application/json"}
    if INGEST_SECRET:
        headers["Authorization"] = f"Bearer {INGEST_SECRET}"

    dry_run = os.getenv("CMP_INGEST_DRY_RUN", "false").lower() == "true"
    response = requests.post(
        INGEST_URL,
        headers=headers,
        json={
            "syncRunId": sync_run_id,
            "startedAt": started_at,
            "invoices": invoices,
            "runStatus": run_status,
            "mode": os.getenv("CMP_SYNC_MODE", "normal"),
            "pagesScraped": pages_scraped,
            "rowsExtracted": len(invoices),
            "truncated": truncated,
            "cutoffDate": cutoff_date.date().isoformat(),
            "scopeAgentIds": scope_agent_ids,
            "dryRun": dry_run,
            "failureReason": failure_reason,
            "trigger": RUN_TRIGGER,
        },
        timeout=120,
    )
    if not response.ok:
        raise RuntimeError(f"Ingest failed ({response.status_code}): {response.text[:500]}")
    return response.json()


def main() -> int:
    global RUN_ID, PARENT_RUN_ID
    sync_run_id = os.getenv("CMP_RUN_ID") or str(uuid.uuid4())
    RUN_ID = sync_run_id
    PARENT_RUN_ID = os.getenv("CMP_PARENT_RUN_ID") or sync_run_id
    configure_logging()
    started_at = os.getenv("CMP_RUN_STARTED_AT") or datetime.utcnow().isoformat() + "Z"
    cutoff = datetime.now() - timedelta(days=HISTORY_DAYS)
    attached = bool(os.getenv("CMP_DEBUGGER_ADDRESS", "").strip())
    driver: WebDriver | None = None
    pages_scraped = 0
    scope_agent_ids: list[str] = []

    try:
        write_status(running=True, phase="init", message="Starting CMP sync...")
        portfolio_keys, agents_by_company = load_portfolio_scope()
        scope_agent_ids = sorted({agent for agent in agents_by_company.values() if agent})
        driver = create_driver()
        scrape_result = scrape_global_invoices(driver, portfolio_keys, agents_by_company, cutoff)
        invoices = scrape_result.invoices
        pages_scraped = scrape_result.pages_scraped

        if not invoices:
            logging.warning("No invoices extracted for portfolio.")

        ingest_result = post_ingest(
            invoices,
            sync_run_id,
            run_status="complete" if scrape_result.complete else "incomplete",
            pages_scraped=pages_scraped,
            truncated=scrape_result.truncated,
            cutoff_date=cutoff,
            scope_agent_ids=scope_agent_ids,
            started_at=started_at,
            failure_reason="scrape_truncated" if scrape_result.truncated else None,
        )
        final_message = (
            f"Dry run: {ingest_result.get('rowsThatWouldClose', 0)} rows would be closed."
            if ingest_result and ingest_result.get("dryRun")
            else f"Run {sync_run_id} stored {len(invoices)} invoices."
        )
        write_status(
            running=False,
            phase="done",
            message=f"{final_message} Pages={pages_scraped}; complete={scrape_result.complete}; truncated={scrape_result.truncated}.",
            invoices_found=len(invoices),
            run_status="complete" if scrape_result.complete else "incomplete",
            pages_scraped=pages_scraped,
            truncated=scrape_result.truncated,
            persisted=bool(ingest_result and not ingest_result.get("dryRun")),
            failure_reason="scrape_truncated" if scrape_result.truncated else None,
        )
        logging.info("CMP run %s finished: %d invoices, %d pages, complete=%s, truncated=%s, ingest=%s",
                     sync_run_id, len(invoices), pages_scraped, scrape_result.complete,
                     scrape_result.truncated, ingest_result)
        return 0
    except Exception as error:
        logging.exception("CMP sync failed")
        try:
            post_ingest(
                [],
                sync_run_id,
                run_status="failed",
                pages_scraped=pages_scraped,
                truncated=False,
                cutoff_date=cutoff,
                scope_agent_ids=scope_agent_ids,
                started_at=started_at,
                failure_reason=getattr(error, "reason", None),
            )
        except Exception:
            logging.warning("Could not persist failed CMP run metadata.")
        write_status(
            running=False,
            phase="error",
            message="CMP sync failed",
            error=str(error),
            failure_reason=getattr(error, "reason", None),
            run_status="failed",
            pages_scraped=pages_scraped,
            truncated=False,
        )
        return 1
    finally:
        if driver and not attached:
            try:
                driver.quit()
            except WebDriverException:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
