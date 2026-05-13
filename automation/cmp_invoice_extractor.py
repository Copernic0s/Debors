from __future__ import annotations

import json
import logging
import os
import re
import shutil
import socket
import sys
import tempfile
import time
import unicodedata
from io import BytesIO
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

import pandas as pd
import requests
from selenium import webdriver
from selenium.common.exceptions import (
    InvalidSessionIdException,
    NoSuchElementException,
    NoSuchWindowException,
    SessionNotCreatedException,
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


BASE_URL = "https://cmp-front.production.united-fuel.com/"
COMPANY_URL = f"{BASE_URL.rstrip('/')}/company"
ZOHO_XLSX_URL = os.getenv(
    "CMP_ZOHO_XLSX_URL",
    "https://sheet.zohopublic.com/sheet/published/w0yyac483bf4377414680872e6205cd34447b?download=xlsx",
)
ZOHO_SHEET_NAME = os.getenv("CMP_ZOHO_SHEET_NAME", "CS by Agent")
DEFAULT_TIMEOUT = int(os.getenv("CMP_TIMEOUT", "90"))
SEARCH_SETTLE_SECONDS = float(os.getenv("CMP_SEARCH_SETTLE_SECONDS", "2.5"))
SEARCH_MAX_WAIT_SECONDS = float(os.getenv("CMP_SEARCH_MAX_WAIT_SECONDS", "10"))
SEARCH_KEYSTROKE_DELAY = float(os.getenv("CMP_SEARCH_KEYSTROKE_DELAY", "0.06"))
DEBUG_NOT_FOUND = os.getenv("CMP_DEBUG_NOT_FOUND", "true").strip().lower() == "true"
ATTACH_TIMEOUT_SECONDS = int(os.getenv("CMP_ATTACH_TIMEOUT_SECONDS", "20"))
OUTPUT_PATH = Path(os.getenv("CMP_OUTPUT_JSON", "invoices_actualizados.json"))
LOG_PATH = Path(os.getenv("CMP_LOG_FILE", "cmp_invoice_extractor.log"))
SCREENSHOT_DIR = Path(os.getenv("CMP_SCREENSHOT_DIR", "cmp_screenshots"))
TEMP_PROFILE_PREFIX = "cmp_chrome_profile_"
CLONED_PROFILE_PREFIX = "cmp_chrome_clone_"
TEMP_DIRECTORIES_TO_CLEAN: list[str] = []


@dataclass(frozen=True)
class SelectorCandidates:
    email_inputs: tuple[str, ...] = (
        "input[type='email']",
        "input[name='email']",
        "input[placeholder*='Email']",
        "input[placeholder*='email']",
    )
    password_inputs: tuple[str, ...] = (
        "input[type='password']",
        "input[name='password']",
        "input[placeholder*='Password']",
        "input[placeholder*='password']",
    )
    login_buttons: tuple[str, ...] = (
        "button[type='submit']",
        "button",
        "[role='button']",
    )
    search_inputs: tuple[str, ...] = (
        "input[placeholder='Search...']",
        "input[placeholder*='Search']",
        "input[type='search']",
    )
    invoice_tab_xpaths: tuple[str, ...] = (
        "//button[normalize-space()='Invoices']",
        "//a[normalize-space()='Invoices']",
        "//*[self::button or self::a or self::div][normalize-space()='Invoices']",
    )
    table_selectors: tuple[str, ...] = (
        "table",
        "[role='table']",
        ".table",
    )


SELECTORS = SelectorCandidates()


def configure_logging() -> None:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        handlers=[
            logging.FileHandler(LOG_PATH, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )


def normalize_text(value: str) -> str:
    text = str(value or "").strip()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(character for character in text if not unicodedata.combining(character))
    return re.sub(r"\s+", " ", text).lower()


def normalize_company_name(value: str) -> str:
    cleaned = normalize_text(value)
    cleaned = re.sub(r"\b(llc|inc|corp|co|ltd|limited)\b", "", cleaned)
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def build_search_queries(client_name: str) -> list[str]:
    raw = str(client_name or "").strip()
    if not raw:
        return []

    primary = re.sub(r"\s+", " ", raw).upper()
    stripped_parenthetical = re.sub(r"\s*\([^)]*\)", "", primary).strip()
    stripped_symbols = re.sub(r"[^A-Z0-9 ]+", " ", stripped_parenthetical)
    stripped_symbols = re.sub(r"\s+", " ", stripped_symbols).strip()
    
    # Strip LLC, INC, CORP, etc for a broader search
    stripped_llc = re.sub(r"\b(LLC|INC|CORP|CO|LTD|LIMITED)\b", "", stripped_symbols, flags=re.IGNORECASE)
    stripped_llc = re.sub(r"\s+", " ", stripped_llc).strip()

    queries = [primary]
    if stripped_parenthetical and stripped_parenthetical not in queries:
        queries.append(stripped_parenthetical)
    if stripped_symbols and stripped_symbols not in queries:
        queries.append(stripped_symbols)
    if stripped_llc and stripped_llc not in queries:
        queries.append(stripped_llc)
        
    return queries


def type_like_human(element, text: str) -> None:
    for character in text:
        element.send_keys(character)
        if SEARCH_KEYSTROKE_DELAY > 0:
            time.sleep(SEARCH_KEYSTROKE_DELAY)


def parse_amount(raw_value: str) -> float | None:
    text = str(raw_value or "").strip()
    if not text:
        return None

    cleaned = re.sub(r"[^0-9,.-]", "", text)
    if not cleaned:
        return None

    last_comma = cleaned.rfind(",")
    last_dot = cleaned.rfind(".")
    decimal_index = max(last_comma, last_dot)

    if decimal_index == -1:
        try:
            return float(cleaned)
        except ValueError:
            return None

    integer_part = re.sub(r"[.,]", "", cleaned[:decimal_index])
    decimal_part = re.sub(r"[.,]", "", cleaned[decimal_index + 1 :])
    normalized = f"{integer_part}.{decimal_part}"
    try:
        return float(normalized)
    except ValueError:
        return None


def parse_date(raw_value: str) -> datetime:
    text = str(raw_value or "").strip()
    known_formats = (
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%m/%d/%y",
        "%b %d, %Y",
        "%B %d, %Y",
        "%d/%m/%Y",
    )

    for date_format in known_formats:
        try:
            return datetime.strptime(text, date_format)
        except ValueError:
            continue

    return datetime.min


def read_clients(input_path: Path) -> list[dict]:
    suffix = input_path.suffix.lower()
    if suffix == ".csv":
        frame = pd.read_csv(input_path)
    elif suffix == ".json":
        frame = pd.read_json(input_path)
    else:
        raise ValueError(f"Unsupported input file: {input_path}")

    expected = {"client_name", "billing_cycle"}
    missing = expected - set(frame.columns)
    if missing:
        raise ValueError(f"Input file is missing required columns: {sorted(missing)}")

    records = (
        frame.fillna("")
        .to_dict(orient="records")
    )
    return [
        {
            "client_name": str(item.get("client_name", "")).strip(),
            "billing_cycle": str(item.get("billing_cycle", "")).strip(),
        }
        for item in records
        if str(item.get("client_name", "")).strip()
    ]


def read_clients_from_zoho_workbook() -> list[dict]:
    logging.info("Loading clients from Zoho workbook sheet '%s'", ZOHO_SHEET_NAME)
    response = requests.get(ZOHO_XLSX_URL, timeout=45)
    response.raise_for_status()

    frame = pd.read_excel(
        BytesIO(response.content),
        sheet_name=ZOHO_SHEET_NAME,
        engine="openpyxl",
    )

    normalized_columns = {str(column).strip().lower(): column for column in frame.columns}
    company_column = normalized_columns.get("company name")
    cycle_column = normalized_columns.get("billing cycle")

    if not company_column or not cycle_column:
        raise ValueError(
            f"Sheet '{ZOHO_SHEET_NAME}' must include 'Company Name' and 'Billing Cycle' columns"
        )

    records = []
    for _, row in frame.fillna("").iterrows():
        company = str(row[company_column]).strip()
        cycle = str(row[cycle_column]).strip()
        if company:
            records.append(
                {
                    "client_name": company,
                    "billing_cycle": cycle,
                }
            )

    deduped = []
    seen = set()
    for item in records:
        key = normalize_company_name(item["client_name"])
        if key and key not in seen:
            seen.add(key)
            deduped.append(item)

    return deduped


def build_chrome_options(*, user_data_dir: str = "", profile_dir: str = "") -> ChromeOptions:
    options = ChromeOptions()
    if os.getenv("CMP_HEADLESS", "false").lower() == "true":
        options.add_argument("--headless=new")

    options.add_argument("--start-maximized")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-features=RendererCodeIntegrity")
    options.add_argument("--disable-backgrounding-occluded-windows")
    options.add_argument("--disable-renderer-backgrounding")
    options.add_argument("--remote-debugging-port=9222")
    options.add_argument("--disable-extensions")

    if user_data_dir:
        options.add_argument(f"--user-data-dir={user_data_dir}")
    if profile_dir:
        options.add_argument(f"--profile-directory={profile_dir}")

    debugger_address = os.getenv("CMP_DEBUGGER_ADDRESS", "").strip()
    if debugger_address:
        options.debugger_address = debugger_address

    return options


def safe_get(driver: WebDriver, url: str, retries: int = 2) -> None:
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            driver.get(url)
            return
        except WebDriverException as error:
            last_error = error
            if attempt >= retries:
                break
            logging.warning("Navigation failed for %s (attempt %s/%s): %s", url, attempt + 1, retries + 1, error)
            time.sleep(1.2)
    if last_error:
        raise last_error


def clone_chrome_profile(user_data_dir: str, profile_dir: str) -> tuple[str, str]:
    source_root = Path(user_data_dir)
    source_profile = source_root / profile_dir
    if not source_profile.exists():
        raise FileNotFoundError(f"Chrome profile not found: {source_profile}")

    clone_root = Path(tempfile.mkdtemp(prefix=CLONED_PROFILE_PREFIX))
    target_profile = clone_root / profile_dir
    TEMP_DIRECTORIES_TO_CLEAN.append(str(clone_root))

    local_state = source_root / "Local State"
    if local_state.exists():
        shutil.copy2(local_state, clone_root / "Local State")

    def ignore_profile_files(_directory: str, names: list[str]) -> set[str]:
        ignored = {
            "lockfile",
            "singletoncookie",
            "singletonlock",
            "singletonsocket",
            "Crashpad",
            "ShaderCache",
            "Code Cache",
            "GrShaderCache",
            "GraphiteDawnCache",
            "DawnGraphiteCache",
        }
        return {name for name in names if name in ignored}

    shutil.copytree(source_profile, target_profile, dirs_exist_ok=True, ignore=ignore_profile_files)
    logging.info("Cloned Chrome profile '%s' into temporary workspace '%s'", profile_dir, clone_root)
    return str(clone_root), profile_dir


def create_driver() -> WebDriver:
    user_data_dir = os.getenv("CMP_USER_DATA_DIR", "").strip()
    profile_dir = os.getenv("CMP_PROFILE_DIR", "").strip()
    if not user_data_dir:
        local_app_data = os.getenv("LOCALAPPDATA", "").strip()
        if local_app_data:
            user_data_dir = str(Path(local_app_data) / "Google" / "Chrome" / "User Data")
    if not profile_dir:
        profile_dir = "Profile 8"
    clone_profile = os.getenv("CMP_CLONE_PROFILE", "true").strip().lower() != "false"
    require_exact_profile = os.getenv("CMP_REQUIRE_EXACT_PROFILE", "true").strip().lower() != "false"
    logging.info(
        "Chrome profile config | user_data_dir='%s' | profile_dir='%s' | clone_profile=%s | strict_profile=%s",
        user_data_dir or "<empty>",
        profile_dir or "<empty>",
        clone_profile,
        require_exact_profile,
    )
    service = ChromeService(ChromeDriverManager().install())

    def launch(options: ChromeOptions) -> WebDriver:
        driver = webdriver.Chrome(service=service, options=options)
        driver.implicitly_wait(0)
        return driver

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

    debugger_address = os.getenv("CMP_DEBUGGER_ADDRESS", "").strip()
    if debugger_address:
        logging.info("Attaching Selenium to existing Chrome debugger at %s", debugger_address)
        if not wait_for_debugger(debugger_address, ATTACH_TIMEOUT_SECONDS):
            raise TimeoutException(
                f"Chrome debugger {debugger_address} did not become reachable within {ATTACH_TIMEOUT_SECONDS}s"
            )
        logging.info("Chrome debugger is reachable, creating attached WebDriver...")
        driver = launch(build_chrome_options())
        logging.info("Attached WebDriver session created successfully.")
        return driver

    if user_data_dir and profile_dir and clone_profile:
        try:
            cloned_user_data_dir, cloned_profile_dir = clone_chrome_profile(user_data_dir, profile_dir)
            return launch(
                build_chrome_options(
                    user_data_dir=cloned_user_data_dir,
                    profile_dir=cloned_profile_dir,
                )
            )
        except Exception as error:
            logging.warning(
                "Failed to clone required Chrome profile '%s': %s. "
                "Will attempt direct launch with the same profile.",
                profile_dir,
                error,
            )

    try:
        return launch(build_chrome_options(user_data_dir=user_data_dir, profile_dir=profile_dir))
    except SessionNotCreatedException as error:
        if not user_data_dir:
            raise
        if require_exact_profile and profile_dir:
            raise RuntimeError(
                "Could not launch required Chrome profile. "
                "Set CMP_REQUIRE_EXACT_PROFILE=false if you intentionally want temporary fallback."
            ) from error

        fallback_profile_dir = tempfile.mkdtemp(prefix=TEMP_PROFILE_PREFIX)
        logging.warning(
            "Chrome could not start with CMP_USER_DATA_DIR='%s' and CMP_PROFILE_DIR='%s'. "
            "This usually means the profile is locked by another Chrome window. "
            "Retrying with a temporary clean profile at '%s'. Original error: %s",
            user_data_dir,
            profile_dir or "<default>",
            fallback_profile_dir,
            error,
        )
        logging.info(
            "If you need to reuse your real Chrome session, close all Chrome windows first or use a dedicated automation profile."
        )
        return launch(build_chrome_options(user_data_dir=fallback_profile_dir))


def wait_for_any(driver: WebDriver, css_selectors: Iterable[str], timeout: int = DEFAULT_TIMEOUT):
    wait = WebDriverWait(driver, timeout)
    last_error = None
    for selector in css_selectors:
        try:
            return wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
        except TimeoutException as error:
            last_error = error
    raise last_error or TimeoutException("No selector matched")


def click_by_visible_text(driver: WebDriver, xpaths: Iterable[str], timeout: int = DEFAULT_TIMEOUT) -> bool:
    wait = WebDriverWait(driver, timeout)
    for xpath in xpaths:
        try:
            element = wait.until(EC.element_to_be_clickable((By.XPATH, xpath)))
            element.click()
            return True
        except TimeoutException:
            continue
    return False


def save_debug_screenshot(driver: WebDriver, prefix: str) -> None:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = SCREENSHOT_DIR / f"{prefix}_{timestamp}.png"
    try:
        driver.save_screenshot(str(path))
        logging.info("Saved screenshot: %s", path)
    except Exception as error:  # pragma: no cover
        logging.warning("Failed to save screenshot: %s", error)


def perform_login(driver: WebDriver) -> None:
    attached_mode = bool(os.getenv("CMP_DEBUGGER_ADDRESS", "").strip())
    
    # Always navigate to /company first
    logging.info("Navigating to %s", COMPANY_URL)
    safe_get(driver, COMPANY_URL)
    
    wait = WebDriverWait(driver, DEFAULT_TIMEOUT)

    email = os.getenv("CMP_EMAIL", "").strip()
    password = os.getenv("CMP_PASSWORD", "").strip()
    if not email or not password:
        logging.info("CMP_EMAIL/CMP_PASSWORD not set. Waiting for authenticated CMP session...")
        logging.info("Current URL: %s", driver.current_url)
        wait.until(lambda current: "/company" in current.current_url and "/auth" not in current.current_url)
        logging.info("Login check passed! Proceeding...")
        return

    if attached_mode and "/auth" not in driver.current_url:
        logging.info("Attached mode already authenticated. Skipping credential login.")
        return

    email_input = wait_for_any(driver, SELECTORS.email_inputs)
    password_input = wait_for_any(driver, SELECTORS.password_inputs)
    email_input.clear()
    email_input.send_keys(email)
    password_input.clear()
    password_input.send_keys(password)

    for selector in SELECTORS.login_buttons:
        try:
            for candidate in driver.find_elements(By.CSS_SELECTOR, selector):
                label = normalize_text(candidate.text)
                html = normalize_text(candidate.get_attribute("innerText"))
                if any(term in f"{label} {html}" for term in ("sign in", "login", "log in", "entrar")):
                    candidate.click()
                    wait.until(lambda current: "/company" in current.current_url)
                    return
        except NoSuchElementException:
            continue

    password_input.send_keys(Keys.ENTER)
    wait.until(lambda current: "/company" in current.current_url and "/auth" not in current.current_url)
    wait_for_any(driver, SELECTORS.search_inputs)


def ensure_company_screen(driver: WebDriver) -> None:
    safe_get(driver, COMPANY_URL)
    wait_for_any(driver, SELECTORS.search_inputs)


def open_matching_company(driver: WebDriver, client_name: str) -> bool:
    ensure_company_screen(driver)
    wait = WebDriverWait(driver, DEFAULT_TIMEOUT)
    search_input = wait_for_any(driver, SELECTORS.search_inputs)
    search_input.click()
    search_input.send_keys(Keys.CONTROL, "a")
    search_input.send_keys(Keys.DELETE)
    normalized_target = normalize_company_name(client_name)
    target_tokens = set(normalized_target.split())

    def result_rows_snapshot() -> list[dict]:
        script = r"""
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        return rows.map((row, index) => {
          const cells = Array.from(row.querySelectorAll('td'));
          let candidateName = '';
          for (const cell of cells) {
            const text = (cell.innerText || '').trim();
            if (!text) continue;
            if (/^\d+$/.test(text)) continue;
            if (/@/.test(text)) continue;
            if (/^\+?\d[\d\s-]{7,}$/.test(text)) continue;
            if (/^\d{4}-\d{2}-\d{2}/.test(text)) continue;
            candidateName = text;
            break;
          }
          return {
            index: index + 1,
            rowText: (row.innerText || '').trim(),
            nameText: candidateName,
          };
        }).filter(item => item.rowText);
        """
        return driver.execute_script(script) or []

    def wait_for_stable_results() -> list:
        start = time.time()
        stable_rows: list[dict] = []
        stable_hits = 0
        last_signature = ""
        while time.time() - start < SEARCH_MAX_WAIT_SECONDS:
            rows = result_rows_snapshot()
            
            # Check if it looks like a "no data" placeholder
            is_no_data = False
            if len(rows) == 1:
                text = rows[0].get("rowText", "").lower()
                if "no data" in text or "no results" in text or "nothing found" in text:
                    is_no_data = True
                    
            if is_no_data:
                # If it's been less than 7 seconds, keep waiting in case it's just loading
                if time.time() - start < 7.0:
                    time.sleep(0.5)
                    continue
                else:
                    stable_rows = []
                    break

            signature = "||".join([normalize_text(row.get("rowText", "")) for row in rows[:3]])
            if signature and signature == last_signature:
                stable_hits += 1
            else:
                stable_hits = 0
                last_signature = signature
                
            if rows and stable_hits >= 3:
                stable_rows = rows
                break

            time.sleep(0.5)
            
        if SEARCH_SETTLE_SECONDS > 0:
            time.sleep(SEARCH_SETTLE_SECONDS)
        return stable_rows if stable_rows else result_rows_snapshot()

    def best_match_from_rows(rows_for_match: list[dict]):
        best_row_index = None
        best_score = -1
        for row in rows_for_match:
            # Prefer full row text for matching because CMP column order can vary by viewport.
            row_text = normalize_company_name(row.get("rowText", ""))
            if not row_text:
                continue

            candidate_tokens = set(row_text.split())
            shared_tokens = len(target_tokens & candidate_tokens)
            score = 0
            if row_text == normalized_target:
                score = 1000
            elif normalized_target in row_text or row_text in normalized_target:
                score = 700 + shared_tokens
            elif shared_tokens:
                score = shared_tokens * 10

            if score > best_score:
                best_score = score
                best_row_index = row.get("index")

        if not best_row_index and len(rows_for_match) == 1:
            best_row_index = rows_for_match[0].get("index")
        return best_row_index, best_score

    baseline_signature = "||".join([normalize_text(row.get("rowText", "")) for row in result_rows_snapshot()[:3]])

    attempted_queries: list[str] = []
    for query in build_search_queries(client_name):
        attempted_queries.append(query)
        search_input.click()
        search_input.clear()
        # Fallback to ensure it's empty
        search_input.send_keys(Keys.CONTROL, "a")
        search_input.send_keys(Keys.BACKSPACE)
        
        # We send the entire query at once. Character-by-character typing can cause
        # React's onChange handler to re-render and move the cursor, interleaving characters.
        search_input.send_keys(query.upper())
        time.sleep(0.35)
        search_input.send_keys(Keys.ENTER)
        search_input.send_keys(Keys.TAB)

        # Some CMP builds only commit search when the search icon is clicked.
        icon_candidates = driver.find_elements(
            By.XPATH,
            "//*[self::button or self::span or self::i][contains(@class,'search') or contains(@aria-label,'Search') or contains(@title,'Search')]",
        )
        for icon in icon_candidates[:2]:
            try:
                if icon.is_displayed():
                    icon.click()
                    break
            except Exception:
                continue

        # Hard wait to allow slow network requests to complete before checking results
        logging.info("Waiting 5 seconds for results to load for '%s'...", query)
        time.sleep(5.0)

        rows = wait_for_stable_results()
        if rows:
            current_signature = "||".join([normalize_text(row.get("rowText", "")) for row in rows[:3]])
            if current_signature == baseline_signature:
                logging.debug("Search grid did not refresh for query '%s' on '%s'", query, client_name)
                continue
        if not rows:
            continue

        best_row_index, best_score = best_match_from_rows(rows)
        if not best_row_index or best_score < 1:
            continue

        row_xpath = f"(//table//tbody/tr)[{int(best_row_index)}]"
        name_click_xpath = f"{row_xpath}//a[1] | {row_xpath}//button[1]"
        candidates = driver.find_elements(By.XPATH, name_click_xpath)
        target = candidates[0] if candidates else driver.find_element(By.XPATH, row_xpath)
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", target)
        wait.until(EC.element_to_be_clickable(target))
        target.click()
        wait.until(lambda current: "/company" in current.current_url and current.current_url.rstrip("/") != COMPANY_URL.rstrip("/"))
        return True

    if DEBUG_NOT_FOUND:
        try:
            snapshot_rows = result_rows_snapshot()
            preview = [normalize_text(row.get("rowText", "")) for row in snapshot_rows[:3]]
            logging.warning(
                "Not found debug | client='%s' | queries=%s | top_rows=%s",
                client_name,
                attempted_queries,
                preview,
            )
            save_debug_screenshot(driver, f"not_found_{re.sub(r'[^A-Za-z0-9]+', '_', client_name)[:40]}")
        except Exception:
            pass

    return False


def open_invoices_tab(driver: WebDriver) -> None:
    if not click_by_visible_text(driver, SELECTORS.invoice_tab_xpaths):
        raise TimeoutException("Invoices tab not found")

    WebDriverWait(driver, DEFAULT_TIMEOUT).until(
        lambda current: any(current.find_elements(By.CSS_SELECTOR, selector) for selector in SELECTORS.table_selectors)
    )
    
    # Hard wait to allow the network request for invoice rows to complete
    logging.info("Waiting 5 seconds for invoice rows to populate...")
    time.sleep(5.0)


def scroll_invoice_table_horizontally(driver: WebDriver) -> None:
    script = """
    const candidates = Array.from(document.querySelectorAll('div, section'));
    const scrollable = candidates.find((element) => {
      const style = window.getComputedStyle(element);
      return (
        element.scrollWidth > element.clientWidth + 80 &&
        (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'overlay')
      );
    });

    if (!scrollable) return false;
    scrollable.scrollLeft = scrollable.scrollWidth;
    return true;
    """

    try:
        driver.execute_script(script)
        time.sleep(0.35)
    except Exception as error:  # pragma: no cover
        logging.warning("Horizontal scroll failed: %s", error)


def extract_latest_invoice(driver: WebDriver) -> dict | None:
    scroll_invoice_table_horizontally(driver)
    tables = []
    for selector in SELECTORS.table_selectors:
        tables.extend(driver.find_elements(By.CSS_SELECTOR, selector))

    best_invoice = None

    for table in tables:
        # Some tables use standard th, others use role=columnheader
        header_cells = table.find_elements(By.XPATH, ".//thead//th | .//*[@role='columnheader'] | .//th")
        if not header_cells:
            # If still nothing, try the first row's td
            header_cells = table.find_elements(By.XPATH, "(.//tr | .//*[@role='row'])[1]//*[self::td or self::th or @role='cell' or @role='columnheader']")

        headers = [normalize_text(cell.text) for cell in header_cells]
        if not headers:
            continue

        invoice_index = next((i for i, text in enumerate(headers) if text in ["invoice number", "invoice #", "invoice_number"]), None)
        if invoice_index is None:
            invoice_index = next((i for i, text in enumerate(headers) if "invoice num" in text), None)

        amount_index = next((i for i, text in enumerate(headers) if text in ["total amount", "amount"]), None)
        if amount_index is None:
            amount_index = next((i for i, text in enumerate(headers) if "total amount" in text), None)

        date_index = next((i for i, text in enumerate(headers) if text in ["invoice date", "created at", "date"]), None)
        if date_index is None:
            date_index = next((i for i, text in enumerate(headers) if "date" in text or "created" in text), None)

        status_index = next((i for i, text in enumerate(headers) if text == "status"), None)
        if status_index is None:
            status_index = next((i for i, text in enumerate(headers) if "status" in text and "company" not in text), None)

        if invoice_index is None or amount_index is None:
            logging.debug("Skipping table because required columns are missing. Found headers: %s", headers)
            continue

        rows = table.find_elements(By.XPATH, ".//tbody/tr | .//*[@role='row']")
        for row in rows:
            cells = row.find_elements(By.XPATH, "./td | .//*[@role='cell']")
            if len(cells) <= max(invoice_index, amount_index):
                continue

            invoice_id = cells[invoice_index].text.strip()
            amount = parse_amount(cells[amount_index].text)
            date_value = parse_date(cells[date_index].text if date_index is not None and date_index < len(cells) else "")
            status = cells[status_index].text.strip() if status_index is not None and status_index < len(cells) else ""

            if not invoice_id:
                continue

            candidate = {
                "invoice_id": invoice_id,
                "amount": amount,
                "status": status,
                "date": date_value,
            }

            if best_invoice is None or candidate["date"] >= best_invoice["date"]:
                best_invoice = candidate

            # For CMP the most recent invoice is the first row, so we can stop early.
            return best_invoice

    return best_invoice


def build_result(client_name: str, billing_cycle: str, invoice_payload: dict | None, status: str) -> dict:
    result = {
        "client_name": client_name,
        "billing_cycle": billing_cycle,
        "invoice_id": "",
        "amount": "",
        "status": status,
        "last_update": datetime.now().strftime("%Y-%m-%d"),
    }

    if invoice_payload:
        result["invoice_id"] = invoice_payload.get("invoice_id", "")
        result["amount"] = (
            f"{invoice_payload['amount']:.2f}"
            if invoice_payload.get("amount") is not None
            else ""
        )
        result["invoice_status"] = invoice_payload.get("status", "")

    return result


def export_results(results: list[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(results, handle, ensure_ascii=False, indent=2)


def process_global_invoices(driver: WebDriver) -> list[dict]:
    results = []
    
    url = "https://cmp-front.production.united-fuel.com/invoicing?limit=500"
    logging.info("Loading global invoices base URL: %s", url)
    driver.get(url)
    
    for page in range(1, 16):
        logging.info("Scanning global invoices page %d (Items %d to %d)...", page, (page-1)*500, page*500)
        
        wait = WebDriverWait(driver, DEFAULT_TIMEOUT)
        try:
            wait.until(EC.presence_of_element_located((By.XPATH, "//table | //*[@role='table']")))
            logging.info("Table shell detected. Polling for data rows to render (up to 120 seconds)...")
            
            # Smart polling for rows
            for _ in range(24): # 120 seconds max
                tables = []
                for selector in SELECTORS.table_selectors:
                    tables.extend(driver.find_elements(By.CSS_SELECTOR, selector))
                
                if tables:
                    current_rows = tables[0].find_elements(By.XPATH, ".//tbody/tr | .//*[@role='row']")
                    if len(current_rows) > 1:
                        logging.info("Data rows rendered successfully!")
                        break
                time.sleep(5)
            else:
                logging.warning("Timeout waiting for rows to render. It might actually be empty.")
                
        except TimeoutException:
            logging.warning("Table not found on page %d, stopping pagination.", page)
            if page > 1 and len(results) > 0:
                logging.error("Network dropped on page %d! Aborting extraction to prevent partial data corruption.", page)
                return []
            break
            
        tables = []
        for selector in SELECTORS.table_selectors:
            tables.extend(driver.find_elements(By.CSS_SELECTOR, selector))
            
        if not tables:
            logging.warning("No tables found on page %d.", page)
            break
            
        table = tables[0]
        
        header_cells = table.find_elements(By.XPATH, ".//thead//th | .//*[@role='columnheader'] | .//th")
        if not header_cells:
            header_cells = table.find_elements(By.XPATH, "(.//tr | .//*[@role='row'])[1]//*[self::td or self::th or @role='cell' or @role='columnheader']")
            
        headers = [normalize_text(cell.text) for cell in header_cells]
        if not headers:
            logging.warning("Could not find headers in table.")
            break
            
        if page == 1:
            logging.info("Headers found: %s", headers)
            
        company_index = next((i for i, text in enumerate(headers) if "company name" in text), None)
        invoice_index = next((i for i, text in enumerate(headers) if text in ["invoice number", "invoice #", "invoice_number"]), None)
        amount_index = next((i for i, text in enumerate(headers) if text in ["total amount", "amount", "total due"]), None)
        date_index = next((i for i, text in enumerate(headers) if text in ["invoice date", "created at", "date"]), None)
        status_index = next((i for i, text in enumerate(headers) if text == "status" or "payment status" in text), None)
        billing_cycle_index = next((i for i, text in enumerate(headers) if "billing cycle" in text), None)
        due_date_index = next((i for i, text in enumerate(headers) if "due date" in text), None)
            
        if company_index is None or invoice_index is None or amount_index is None or status_index is None:
            logging.error("Missing required columns. Found: %s", headers)
            break
            
        rows = table.find_elements(By.XPATH, ".//tbody/tr | .//*[@role='row']")
        if len(rows) <= 1:
            if page > 1 and len(results) >= 490: # If we got a full page before, page 2 shouldn't be completely empty out of nowhere
                logging.error("Page %d has no data rows but previous page was full! Network dropped. Aborting to prevent data corruption.", page)
                return []
            logging.info("No data rows found on page %d. Stopping.", page)
            break
            
        valid_rows_found = len(rows)
        pending_found_this_page = 0
        
        js_script = """
        var table = arguments[0];
        var cIdx = arguments[1], iIdx = arguments[2], aIdx = arguments[3], sIdx = arguments[4], dIdx = arguments[5], bcIdx = arguments[6], ddIdx = arguments[7];
        var rows = table.querySelectorAll('tbody tr, [role="row"]:not([role="columnheader"])');
        var extracted = [];
        for (var i = 0; i < rows.length; i++) {
            var cells = rows[i].querySelectorAll('td, [role="cell"]');
            if (cells.length > Math.max(cIdx, iIdx, aIdx, sIdx)) {
                var company = cells[cIdx].innerText.trim();
                var invoice = cells[iIdx].innerText.trim();
                var amount = cells[aIdx].innerText.trim();
                var status = cells[sIdx].innerText.trim();
                var date = (dIdx !== null && dIdx < cells.length) ? cells[dIdx].innerText.trim() : "";
                var billing_cycle = (bcIdx !== null && bcIdx < cells.length) ? cells[bcIdx].innerText.trim() : "";
                var due_date = (ddIdx !== null && ddIdx < cells.length) ? cells[ddIdx].innerText.trim() : "";
                
                var status_upper = status.toUpperCase();
                if (status_upper.includes("PENDING") || status_upper.includes("PARTIAL")) {
                    extracted.push([company, invoice, amount, status, date, billing_cycle, due_date]);
                }
            }
        }
        return extracted;
        """
        
        raw_rows = driver.execute_script(js_script, table, company_index, invoice_index, amount_index, status_index, date_index, billing_cycle_index, due_date_index)
        
        for row_data in raw_rows:
            company_name, invoice_id, amount_text, status, date_text, billing_cycle, due_date_text = row_data
            if not company_name or not invoice_id:
                continue
                
            amount = parse_amount(amount_text)
            date_value = parse_date(date_text)
            due_date_value = parse_date(due_date_text) if due_date_text else None
            
            pending_found_this_page += 1
            results.append({
                "client_name": company_name,
                "billing_cycle": billing_cycle,
                "invoice_id": invoice_id,
                "amount": f"{amount:.2f}" if amount is not None else "",
                "invoice_status": status,
                "status": "Captured",
                "date": date_value.strftime("%Y-%m-%d") if hasattr(date_value, "strftime") else str(date_value),
                "due_date": due_date_value.strftime("%Y-%m-%d") if hasattr(due_date_value, "strftime") else str(due_date_value),
                "last_update": datetime.now().strftime("%Y-%m-%d"),
            })
                
        logging.info("Scanned %d total rows on page %d. Found %d pending/partial (Total stored: %d).", valid_rows_found, page, pending_found_this_page, len(results))
        if valid_rows_found <= 1:
            break
            
        # --- NEW PAGINATION LOGIC: CLICK NEXT BUTTON ---
        if page < 15:
            try:
                next_btns = driver.find_elements(By.XPATH, "//div[contains(@class, 'MuiTablePagination-actions')]//button[@title='Go to next page'] | //button[contains(., 'Next')] | //li[contains(., 'Next')] | //a[contains(., 'Next')]")
                
                # Filter out obvious wrong matches if any, usually taking the last one works best
                if not next_btns:
                    logging.info("Could not find a 'Next' button on page %d. Assuming end of pages.", page)
                    break
                    
                next_btn = next_btns[-1]
                
                # Check if button is disabled
                if not next_btn.is_enabled() or next_btn.get_attribute("disabled") or "disabled" in str(next_btn.get_attribute("class")).lower():
                    logging.info("Next button is disabled. Reached the last page.")
                    break
                    
                logging.info("Clicking 'Next >' button to load page %d...", page + 1)
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'}); arguments[0].click();", next_btn)
                
                logging.info("Waiting 10 seconds for React to fetch and render the next page...")
                time.sleep(10) # Give React time to remove the old rows and load the new ones before the next loop iteration starts polling
            except Exception as e:
                logging.warning("Failed to click Next Page button: %s. Stopping pagination.", e)
                break
        
    return results

def main() -> int:
    configure_logging()
    driver = create_driver()
    try:
        perform_login(driver)
        logging.info("Login complete. Starting global extraction...")
        results = process_global_invoices(driver)
        export_results(results, OUTPUT_PATH)
        logging.info("Extraction finished. Extracted %d pending invoices. Output saved to %s", len(results), OUTPUT_PATH)
        return 0
    finally:
        driver.quit()
        for temp_directory in TEMP_DIRECTORIES_TO_CLEAN:
            try:
                shutil.rmtree(temp_directory, ignore_errors=True)
            except Exception:
                pass

if __name__ == "__main__":
    raise SystemExit(main())
