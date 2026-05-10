from __future__ import annotations

import json
import logging
import os
import re
import shutil
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
from selenium.common.exceptions import NoSuchElementException, SessionNotCreatedException, TimeoutException
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
DEFAULT_TIMEOUT = int(os.getenv("CMP_TIMEOUT", "25"))
SEARCH_SETTLE_SECONDS = float(os.getenv("CMP_SEARCH_SETTLE_SECONDS", "2.5"))
SEARCH_MAX_WAIT_SECONDS = float(os.getenv("CMP_SEARCH_MAX_WAIT_SECONDS", "10"))
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

    if user_data_dir:
        options.add_argument(f"--user-data-dir={user_data_dir}")
    if profile_dir:
        options.add_argument(f"--profile-directory={profile_dir}")

    return options


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
    clone_profile = os.getenv("CMP_CLONE_PROFILE", "true").strip().lower() != "false"
    service = ChromeService(ChromeDriverManager().install())

    def launch(options: ChromeOptions) -> WebDriver:
        driver = webdriver.Chrome(service=service, options=options)
        driver.implicitly_wait(0)
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
            logging.warning("Failed to clone Chrome profile '%s': %s", profile_dir, error)

    try:
        return launch(build_chrome_options(user_data_dir=user_data_dir, profile_dir=profile_dir))
    except SessionNotCreatedException as error:
        if not user_data_dir:
            raise

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
    driver.get(BASE_URL)
    wait = WebDriverWait(driver, DEFAULT_TIMEOUT)

    email = os.getenv("CMP_EMAIL", "").strip()
    password = os.getenv("CMP_PASSWORD", "").strip()
    if not email or not password:
        logging.info("CMP_EMAIL/CMP_PASSWORD not set. Waiting for manual login...")
        wait.until(lambda current: "/company" in current.current_url or current.current_url.rstrip("/") != BASE_URL.rstrip("/"))
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
    wait.until(lambda current: "/company" in current.current_url)


def ensure_company_screen(driver: WebDriver) -> None:
    driver.get(COMPANY_URL)
    wait_for_any(driver, SELECTORS.search_inputs)


def open_matching_company(driver: WebDriver, client_name: str) -> bool:
    ensure_company_screen(driver)
    wait = WebDriverWait(driver, DEFAULT_TIMEOUT)
    search_input = wait_for_any(driver, SELECTORS.search_inputs)
    search_input.click()
    search_input.send_keys(Keys.CONTROL, "a")
    search_input.send_keys(Keys.DELETE)
    search_input.send_keys(client_name)
    search_input.send_keys(Keys.ENTER)

    normalized_target = normalize_company_name(client_name)
    target_tokens = set(normalized_target.split())

    def result_rows():
        return [row for row in driver.find_elements(By.XPATH, "//table//tbody/tr") if row.is_displayed()]
    no_data_xpath = (
        "//*[contains(translate(normalize-space(text()), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'no data') "
        "or contains(translate(normalize-space(text()), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'no results')]"
    )

    start = time.time()
    stable_rows: list = []
    stable_hits = 0
    last_signature = ""
    while time.time() - start < SEARCH_MAX_WAIT_SECONDS:
        rows = result_rows()
        signature = "||".join([normalize_text(row.text) for row in rows[:3]])
        if signature and signature == last_signature:
            stable_hits += 1
        else:
            stable_hits = 0
            last_signature = signature
        if rows and stable_hits >= 2:
            stable_rows = rows
            break
        if driver.find_elements(By.XPATH, no_data_xpath):
            stable_rows = []
            break
        time.sleep(0.25)

    if SEARCH_SETTLE_SECONDS > 0:
        time.sleep(SEARCH_SETTLE_SECONDS)

    best_match_element = None
    best_score = -1

    rows_for_match = stable_rows if stable_rows else result_rows()

    for row in rows_for_match:
        cells = row.find_elements(By.XPATH, "./td")
        if len(cells) < 2:
            continue

        name_cell = cells[1]
        clickable_candidates = name_cell.find_elements(By.XPATH, ".//a | .//button | .//*[self::span or self::div]")
        clickable_candidates = [element for element in clickable_candidates if normalize_text(element.text)]
        click_target = clickable_candidates[0] if clickable_candidates else name_cell

        candidate_name = normalize_company_name(name_cell.text)
        if not candidate_name:
            continue

        candidate_tokens = set(candidate_name.split())
        shared_tokens = len(target_tokens & candidate_tokens)
        score = 0
        if candidate_name == normalized_target:
            score = 1000
        elif normalized_target in candidate_name or candidate_name in normalized_target:
            score = 700 + shared_tokens
        elif shared_tokens:
            score = shared_tokens * 10

        if score > best_score:
            best_score = score
            best_match_element = click_target

    if not best_match_element and len(rows_for_match) == 1:
        only_row = rows_for_match[0]
        cells = only_row.find_elements(By.XPATH, "./td")
        if len(cells) >= 2:
            name_cell = cells[1]
            clickable_candidates = name_cell.find_elements(By.XPATH, ".//a | .//button | .//*[self::span or self::div]")
            clickable_candidates = [element for element in clickable_candidates if normalize_text(element.text)]
            best_match_element = clickable_candidates[0] if clickable_candidates else name_cell

    if not best_match_element:
        return False

    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", best_match_element)
    wait.until(EC.element_to_be_clickable(best_match_element))
    best_match_element.click()
    wait.until(lambda current: "/company" in current.current_url and current.current_url.rstrip("/") != COMPANY_URL.rstrip("/"))
    return True


def open_invoices_tab(driver: WebDriver) -> None:
    if not click_by_visible_text(driver, SELECTORS.invoice_tab_xpaths):
        raise TimeoutException("Invoices tab not found")

    WebDriverWait(driver, DEFAULT_TIMEOUT).until(
        lambda current: any(current.find_elements(By.CSS_SELECTOR, selector) for selector in SELECTORS.table_selectors)
    )


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
        headers = [normalize_text(cell.text) for cell in table.find_elements(By.XPATH, ".//thead//th")]
        if not headers:
            continue

        invoice_index = next((i for i, text in enumerate(headers) if ("invoice" in text and "#" in text) or "invoice" in text), None)
        amount_index = next((i for i, text in enumerate(headers) if "total amount" in text), None)
        date_index = next((i for i, text in enumerate(headers) if "date" in text or "created" in text or "issued" in text), None)
        status_index = next((i for i, text in enumerate(headers) if "status" in text), None)

        if invoice_index is None or amount_index is None:
            continue

        rows = table.find_elements(By.XPATH, ".//tbody/tr")
        for row in rows:
            cells = row.find_elements(By.XPATH, "./td")
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


def process_clients(driver: WebDriver, clients: list[dict]) -> list[dict]:
    results = []

    for index, client in enumerate(clients, start=1):
        client_name = client["client_name"]
        billing_cycle = client["billing_cycle"]
        logging.info("[%s/%s] Processing %s", index, len(clients), client_name)

        try:
            found = open_matching_company(driver, client_name)
            if not found:
                logging.warning("Client not found: %s", client_name)
                results.append(build_result(client_name, billing_cycle, None, "Not Found"))
                continue

            open_invoices_tab(driver)
            invoice_payload = extract_latest_invoice(driver)

            if invoice_payload:
                results.append(build_result(client_name, billing_cycle, invoice_payload, "Captured"))
            else:
                logging.warning("No invoice rows found for: %s", client_name)
                save_debug_screenshot(driver, f"no_invoice_{index:03d}")
                results.append(build_result(client_name, billing_cycle, None, "No Invoice Found"))
        except Exception as error:  # pragma: no cover
            logging.exception("Failed to process %s: %s", client_name, error)
            save_debug_screenshot(driver, f"error_{index:03d}")
            results.append(build_result(client_name, billing_cycle, None, f"Error: {type(error).__name__}"))

    return results


def main() -> int:
    configure_logging()

    input_mode = os.getenv("CMP_INPUT_MODE", "zoho_sheet").strip().lower()
    input_file = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(os.getenv("CMP_INPUT_FILE", "automation/clients.example.csv"))

    if input_mode == "zoho_sheet":
        clients = read_clients_from_zoho_workbook()
    else:
        if not input_file.exists():
            raise FileNotFoundError(f"Input file not found: {input_file}")
        clients = read_clients(input_file)

    if not clients:
        raise ValueError("No clients found in input file")

    driver = create_driver()
    try:
        perform_login(driver)
        results = process_clients(driver, clients)
        export_results(results, OUTPUT_PATH)
        logging.info("Extraction finished. Output saved to %s", OUTPUT_PATH)
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
