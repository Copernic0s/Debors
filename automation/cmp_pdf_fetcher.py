from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any

import requests
from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

ROOT_DIR = Path(__file__).resolve().parents[1]
DOWNLOAD_DIR = ROOT_DIR / "automation" / "downloads" / "cmp-pdfs"
DEFAULT_INVOICING_URL = "https://cmp-front.production.united-fuel.com/invoicing?page=1&limit=500"


def load_dotenv_file() -> None:
    env_path = ROOT_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        if key.strip() and key.strip() not in os.environ:
            os.environ[key.strip()] = value.strip().strip('"').strip("'")


def normalize_key(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").strip())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"\b(llc|inc|corp|co|ltd|limited)\b", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return re.sub(r"-+", "-", text).strip("-") or "company"


def make_driver() -> webdriver.Chrome:
    debugger = os.getenv("CMP_DEBUGGER_ADDRESS", "localhost:9222").strip()
    options = Options()
    options.debugger_address = debugger
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    driver.execute_cdp_cmd(
        "Page.setDownloadBehavior",
        {"behavior": "allow", "downloadPath": str(DOWNLOAD_DIR)},
    )
    return driver


def find_search_input(driver: webdriver.Chrome):
    selectors = "input[type='search'], input[placeholder*='Search'], input[type='text'], input:not([type])"
    for item in driver.find_elements(By.CSS_SELECTOR, selectors):
        try:
            if item.is_displayed() and item.is_enabled():
                return item
        except WebDriverException:
            continue
    raise TimeoutException("CMP search input was not found")


def search_invoice(driver: webdriver.Chrome, invoice_number: str) -> None:
    driver.get(os.getenv("CMP_INVOICING_URL", DEFAULT_INVOICING_URL))
    WebDriverWait(driver, 90).until(EC.presence_of_element_located((By.XPATH, "//table | //*[@role='table']")))
    search = find_search_input(driver)
    search.click()
    search.send_keys(Keys.CONTROL, "a")
    search.send_keys(Keys.BACKSPACE)
    search.send_keys(invoice_number)
    search.send_keys(Keys.ENTER)
    time.sleep(4)


def locate_invoice_row(driver: webdriver.Chrome, invoice_number: str, company_name: str):
    normalized_invoice = invoice_number.lower()
    normalized_company = normalize_key(company_name)
    rows = driver.find_elements(By.XPATH, "//table//tbody/tr | //*[@role='table']//*[@role='row']")
    for row in rows:
        text = str(row.text or row.get_attribute("textContent") or "")
        if normalized_invoice not in text.lower():
            continue
        if normalized_company and normalized_company not in normalize_key(text):
            # Invoice number is usually unique; keep this as a soft preference by trying exact matches first.
            continue
        return row
    for row in rows:
        text = str(row.text or row.get_attribute("textContent") or "")
        if normalized_invoice in text.lower():
            return row
    raise TimeoutException(f"Invoice {invoice_number} was not found in CMP search results")


def click_summary_pdf(driver: webdriver.Chrome, row: Any) -> None:
    before = {path.name for path in DOWNLOAD_DIR.glob("*")}
    xpaths = [
        ".//button[contains(translate(@title,'SUMMARY','summary'),'summary')]",
        ".//button[.//*[contains(@class,'file') or contains(@class,'document')]]",
        ".//button[position()=last()]",
    ]
    clicked = False
    for xpath in xpaths:
        try:
            buttons = row.find_elements(By.XPATH, xpath)
            for button in buttons:
                if button.is_displayed() and button.is_enabled():
                    driver.execute_script("arguments[0].click();", button)
                    clicked = True
                    break
            if clicked:
                break
        except WebDriverException:
            continue
    if not clicked:
        raise TimeoutException("Summary action button was not found")

    time.sleep(1)
    pdf_items = driver.find_elements(
        By.XPATH,
        "//*[self::button or @role='menuitem' or self::div or self::span]"
        "[contains(translate(normalize-space(.),'PDF','pdf'),'pdf')]",
    )
    for item in pdf_items:
        try:
            if item.is_displayed() and item.is_enabled():
                driver.execute_script("arguments[0].click();", item)
                return wait_for_download(before)
        except WebDriverException:
            continue
    raise TimeoutException("PDF menu item was not found")


def wait_for_download(before: set[str]) -> Path:
    deadline = time.time() + 90
    while time.time() < deadline:
        partials = list(DOWNLOAD_DIR.glob("*.crdownload"))
        pdfs = [path for path in DOWNLOAD_DIR.glob("*.pdf") if path.name not in before]
        if pdfs and not partials:
            return max(pdfs, key=lambda path: path.stat().st_mtime)
        time.sleep(1)
    raise TimeoutException("Timed out waiting for CMP PDF download")


def upload_pdf(pdf_path: Path, invoice_number: str, company_name: str) -> str:
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")

    storage_path = f"{normalize_key(company_name)}/{normalize_key(invoice_number)}.pdf"
    endpoint = f"{supabase_url.rstrip('/')}/storage/v1/object/cmp-invoices/{storage_path}"
    response = requests.put(
        endpoint,
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        },
        data=pdf_path.read_bytes(),
        timeout=120,
    )
    if not response.ok:
        raise RuntimeError(f"Supabase Storage upload failed ({response.status_code}): {response.text[:300]}")
    return storage_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--invoice-number", required=True)
    parser.add_argument("--company-name", required=True)
    args = parser.parse_args()

    load_dotenv_file()
    driver = None
    try:
        driver = make_driver()
        search_invoice(driver, args.invoice_number)
        row = locate_invoice_row(driver, args.invoice_number, args.company_name)
        pdf_path = click_summary_pdf(driver, row)
        storage_path = upload_pdf(pdf_path, args.invoice_number, args.company_name)
        print(json.dumps({"ok": True, "storagePath": storage_path, "downloadPath": str(pdf_path)}))
        return 0
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
        return 1
    finally:
        # Do not quit attached Chrome; it belongs to the runner session.
        driver = None


if __name__ == "__main__":
    raise SystemExit(main())
