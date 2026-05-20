"""
CMP global invoicing scraper — portfolio filter from Zoho "Client BY agent".
Writes status to automation/cmp_status.json and POSTs snapshot to ingest API.
"""
from __future__ import annotations

import json
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
from io import BytesIO
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from selenium import webdriver
from selenium.common.exceptions import (
    InvalidSessionIdException,
    SessionNotCreatedException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver import ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
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
LOG_PATH = ROOT_DIR / "automation" / "cmp_invoice_extractor.log"


def configure_logging() -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        handlers=[
            logging.FileHandler(LOG_PATH, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )


def write_status(
    *,
    running: bool,
    phase: str,
    message: str,
    page: int = 0,
    invoices_found: int = 0,
    error: str | None = None,
) -> None:
    payload = {
        "running": running,
        "phase": phase,
        "message": message,
        "page": page,
        "invoicesFound": invoices_found,
        "error": error,
        "updatedAt": datetime.utcnow().isoformat() + "Z",
    }
    STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATUS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def normalize_text(value: str) -> str:
    text = str(value or "").strip()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text).lower()


def normalize_company_key(value: str) -> str:
    cleaned = normalize_text(value)
    cleaned = re.sub(r"\b(llc|inc|corp|co|ltd|limited)\b", "", cleaned)
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


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


def load_portfolio_keys() -> set[str]:
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

    keys: set[str] = set()
    for _, row in frame.fillna("").iterrows():
        company = str(row[company_col]).strip()
        key = normalize_company_key(company)
        if key:
            keys.add(key)
    logging.info("Portfolio loaded: %d companies from '%s'", len(keys), sheet_name)
    return keys


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
        tables = driver.find_elements(By.CSS_SELECTOR, "table, [role='table']")
        if tables:
            rows = tables[0].find_elements(By.XPATH, ".//tbody/tr | .//*[@role='row']")
            current_count = len(rows)
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
            logging.info("Already on invoicing page: %s", current)
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

    manual_timeout = int(os.getenv("CMP_MANUAL_LOGIN_TIMEOUT_SECONDS", "300"))
    start = time.time()
    last_status_at = 0.0

    while time.time() - start < manual_timeout:
        url = safe_current_url(driver)
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
            hint = "log in on the Chrome window" if "/auth" in url else "waiting for invoicing table"
            write_status(
                running=True,
                phase="navigate",
                message=f"Waiting for invoicing ({elapsed}s) — {hint}. URL: {url[:80]}",
            )
            logging.info("Waiting for invoicing (%ss): %s", elapsed, url)
            last_status_at = now

        time.sleep(1)

    raise TimeoutException(
        f"Timed out after {manual_timeout}s waiting for CMP invoicing. "
        "Open Chrome Profile 8 on the invoicing page while logged in."
    )


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


def scrape_global_invoices(driver: WebDriver, portfolio_keys: set[str]) -> list[dict[str, Any]]:
    cutoff = datetime.now() - timedelta(days=HISTORY_DAYS)
    results: list[dict[str, Any]] = []
    seen: set[str] = set()

    navigate_to_invoicing(driver)

    stop_for_age = False
    for page in range(1, MAX_PAGES + 1):
        if stop_for_age:
            break

        # Ensure we are on the expected paging URL. This avoids brittle "Next" selectors.
        if page > 1:
            goto_invoicing_page(driver, page)

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

        if company_i is None or invoice_i is None or amount_i is None or status_i is None:
            raise ValueError(f"Missing required columns on page {page}: {headers}")

        script = """
        const table = arguments[0];
        const cIdx = arguments[1], iIdx = arguments[2], aIdx = arguments[3], sIdx = arguments[4];
        const dIdx = arguments[5], ddIdx = arguments[6];
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
            ddIdx !== null && ddIdx < cells.length ? cells[ddIdx].innerText.trim() : ''
          ]);
        }
        return out;
        """
        raw_rows = driver.execute_script(
            script, table, company_i, invoice_i, amount_i, status_i, invoice_date_i, due_date_i
        )

        page_dates: list[datetime] = []
        page_matched = 0

        for row in raw_rows or []:
            company, invoice_no, amount_text, status_raw, inv_date_text, due_text = row
            if not company or not invoice_no:
                continue

            company_key = normalize_company_key(company)
            if company_key not in portfolio_keys:
                continue

            invoice_date = parse_date_value(inv_date_text)
            if invoice_date:
                page_dates.append(invoice_date)
                if invoice_date < cutoff:
                    continue

            due_date = parse_date_value(due_text)
            if not due_date and invoice_date:
                due_date = invoice_date + timedelta(days=1)

            dedupe_key = f"{company_key}|{normalize_text(invoice_no)}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            amount = parse_amount(amount_text) or 0.0
            status = normalize_debtor_status(status_raw, due_date)

            results.append(
                {
                    "companyName": company.strip(),
                    "invoiceNumber": invoice_no.strip(),
                    "amount": round(amount, 2),
                    "invoiceDate": invoice_date.strftime("%Y-%m-%d") if invoice_date else None,
                    "dueDate": due_date.strftime("%Y-%m-%d") if due_date else None,
                    "status": status,
                    "cmpStatusRaw": str(status_raw or "").strip(),
                }
            )
            page_matched += 1

        logging.info(
            "Page %d: %d portfolio matches (total %d).",
            page,
            page_matched,
            len(results),
        )

        if page_dates and min(page_dates) < cutoff:
            logging.info("Reached invoices older than %d days. Stopping pagination.", HISTORY_DAYS)
            break

        rows = table.find_elements(By.XPATH, ".//tbody/tr | .//*[@role='row']")
        if len(rows) <= 1:
            break

        if page >= MAX_PAGES:
            break

        first_row_sig = (rows[0].get_attribute("textContent") or "") if rows else ""
        # Navigate by URL to next page. If we get redirected to /auth for any reason,
        # try switching back to an existing authenticated invoicing tab or wait for login.
        goto_invoicing_page(driver, page + 1)
        if "/auth" in safe_current_url(driver):
            if switch_to_invoicing_tab(driver):
                # If we successfully switched to another authenticated tab, navigate it to the target page.
                goto_invoicing_page(driver, page + 1)
            else:
                # If no other authenticated tab is open, wait for the user to log in on the current tab, then navigate.
                navigate_to_invoicing(driver)
                goto_invoicing_page(driver, page + 1)

        refreshed = False
        for _ in range(60):
            time.sleep(1)
            try:
                new_rows = driver.find_elements(
                    By.XPATH, "//table//tbody/tr | //*[@role='table']//*[@role='row']"
                )
                if len(new_rows) > 1 and (new_rows[0].get_attribute("textContent") or "") != first_row_sig:
                    refreshed = True
                    break
            except WebDriverException:
                pass
        if not refreshed:
            logging.warning("Pagination did not refresh; stopping.")
            break

    return results


def post_ingest(invoices: list[dict[str, Any]], sync_run_id: str) -> None:
    if not INGEST_URL:
        logging.warning("CMP_INGEST_URL not set; skipping upload.")
        return

    write_status(
        running=True,
        phase="upload",
        message=f"Uploading {len(invoices)} invoices to Debors...",
        invoices_found=len(invoices),
    )
    headers = {"Content-Type": "application/json"}
    if INGEST_SECRET:
        headers["Authorization"] = f"Bearer {INGEST_SECRET}"

    is_fast_sync = os.getenv("CMP_FAST_SYNC", "false").lower() == "true"
    response = requests.post(
        INGEST_URL,
        headers=headers,
        json={"syncRunId": sync_run_id, "invoices": invoices, "isFastSync": is_fast_sync},
        timeout=120,
    )
    if not response.ok:
        raise RuntimeError(f"Ingest failed ({response.status_code}): {response.text[:500]}")


def main() -> int:
    configure_logging()
    sync_run_id = str(uuid.uuid4())
    attached = bool(os.getenv("CMP_DEBUGGER_ADDRESS", "").strip())
    driver: WebDriver | None = None

    try:
        write_status(running=True, phase="init", message="Starting CMP sync...")
        portfolio_keys = load_portfolio_keys()
        driver = create_driver()
        invoices = scrape_global_invoices(driver, portfolio_keys)

        if not invoices:
            logging.warning("No invoices extracted for portfolio.")

        post_ingest(invoices, sync_run_id)
        write_status(
            running=False,
            phase="done",
            message=f"Done. {len(invoices)} invoices synced.",
            invoices_found=len(invoices),
        )
        logging.info("CMP sync complete: %d invoices", len(invoices))
        return 0
    except Exception as error:
        logging.exception("CMP sync failed")
        write_status(
            running=False,
            phase="error",
            message="CMP sync failed",
            error=str(error),
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
