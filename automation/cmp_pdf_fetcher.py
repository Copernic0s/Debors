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
    import subprocess
    debugger = os.getenv("CMP_DEBUGGER_ADDRESS", "localhost:9222").strip()
    
    # 1. Check if Chrome debugger is already running on the target port
    host_port = debugger.split(":")
    port = "9222"
    if len(host_port) > 1:
        port = host_port[1]
    
    debugger_url = f"http://127.0.0.1:{port}/json/version"
    chrome_ready = False
    try:
        r = requests.get(debugger_url, timeout=2)
        if r.status_code == 200:
            chrome_ready = True
    except requests.RequestException:
        pass

    # 2. If not running, launch Chrome automatically
    if not chrome_ready:
        chrome_paths = [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        ]
        pf = os.environ.get("ProgramFiles")
        if pf:
            chrome_paths.append(os.path.join(pf, "Google", "Chrome", "Application", "chrome.exe"))
        pf86 = os.environ.get("ProgramFiles(x86)")
        if pf86:
            chrome_paths.append(os.path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"))
            
        found_chrome = None
        for path in chrome_paths:
            if os.path.exists(path):
                found_chrome = path
                break
                
        if not found_chrome:
            raise RuntimeError("Chrome executable not found on standard Windows paths. Please launch Chrome on port 9222 manually.")
            
        user_data_dir = os.getenv("CMP_USER_DATA_DIR") or str(ROOT_DIR / "automation" / "chrome_user_data")
        profile_dir = os.getenv("CMP_PROFILE_DIR") or "Default"
        invoicing_url = os.getenv("CMP_INVOICING_URL") or DEFAULT_INVOICING_URL
        
        chrome_args = [
            found_chrome,
            f"--remote-debugging-port={port}",
            f"--user-data-dir={user_data_dir}",
            f"--profile-directory={profile_dir}",
            "--no-first-run",
            "--no-default-browser-check",
            "--window-position=20,20",
            invoicing_url
        ]
        
        subprocess.Popen(chrome_args, creationflags=subprocess.CREATE_NEW_CONSOLE if hasattr(subprocess, "CREATE_NEW_CONSOLE") else 0)
        
        # Wait up to 15 seconds for debugger to become active
        for _ in range(15):
            time.sleep(1)
            try:
                r = requests.get(debugger_url, timeout=1)
                if r.status_code == 200:
                    chrome_ready = True
                    break
            except requests.RequestException:
                pass
                
        if not chrome_ready:
            raise RuntimeError("Launched Chrome but debugger was not reachable on port " + port)

    # 3. Connect Selenium driver
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


def clear_all_filters(driver: webdriver.Chrome) -> None:
    selectors = (
        "input:not([type]), input[type='text'], input[type='search'], "
        "textarea, [contenteditable='true']"
    )
    try:
        filter_controls = driver.find_elements(By.CSS_SELECTOR, selectors)
    except WebDriverException:
        return

    for control in filter_controls:
        try:
            if not control.is_displayed() or not control.is_enabled():
                continue
            value = str(control.get_attribute("value") or control.get_attribute("textContent") or "")
            if not value.strip():
                continue
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
        except WebDriverException:
            continue
    time.sleep(2)


def search_invoice(driver: webdriver.Chrome, invoice_number: str) -> None:
    driver.get(os.getenv("CMP_INVOICING_URL", DEFAULT_INVOICING_URL))
    WebDriverWait(driver, 90).until(EC.presence_of_element_located((By.XPATH, "//table | //*[@role='table']")))
    
    # 1. Clear any existing filters/searches first to avoid conflicts
    clear_all_filters(driver)
    
    # 2. Find search input and type the invoice number
    search = find_search_input(driver)
    search.click()
    search.send_keys(Keys.CONTROL, "a")
    search.send_keys(Keys.BACKSPACE)
    search.send_keys(invoice_number)
    
    # Dispatch standard input/change events to ensure React registers it perfectly
    driver.execute_script(
        """
        const el = arguments[0];
        const val = arguments[1];
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setValue) setValue.call(el, val);
        else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        """,
        search,
        invoice_number
    )
    search.send_keys(Keys.ENTER)
    
    # Wait for the table rows to update and contain the invoice number
    deadline = time.time() + 15
    while time.time() < deadline:
        try:
            rows = driver.find_elements(By.XPATH, "//table//tbody/tr | //*[@role='table']//*[@role='row']")
            if rows:
                first_row_text = str(rows[0].text or rows[0].get_attribute("textContent") or "").lower()
                if invoice_number.lower() in first_row_text:
                    break
        except WebDriverException:
            pass
        time.sleep(0.5)



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
    
    clicked = False
    
    # Helper to execute native or action click on a button
    def trigger_click(btn_element: Any) -> bool:
        # Try native .click() first (highly recognized by React/Radix-UI)
        try:
            btn_element.click()
            return True
        except Exception:
            pass
        # Fallback 1: ActionChains hover and click
        try:
            from selenium.webdriver.common.action_chains import ActionChains
            actions = ActionChains(driver)
            actions.move_to_element(btn_element).click().perform()
            return True
        except Exception:
            pass
        # Fallback 2: JS Click executor
        try:
            driver.execute_script("arguments[0].click();", btn_element)
            return True
        except Exception:
            pass
        return False

    # 1. Try CSS selectors targeting standard download/file-down icons inside buttons
    css_selectors = [
        "button svg.lucide-file-down",
        "button svg[class*='file-down']",
        "button svg.lucide-download",
        "button svg[class*='download']",
        "button[title*='summary' i]",
        "button[title*='download' i]",
        "button[title*='pdf' i]",
        "button[id*='radix'] svg.lucide-file-down",
    ]
    
    for sel in css_selectors:
        try:
            elements = row.find_elements(By.CSS_SELECTOR, sel)
            for el in elements:
                btn = el
                if el.tag_name.lower() in ("svg", "path"):
                    btn = el.find_element(By.XPATH, "./ancestor::button")
                if btn.is_displayed() and btn.is_enabled():
                    if trigger_click(btn):
                        clicked = True
                        break
            if clicked:
                break
        except WebDriverException:
            continue

    # 2. Fall back to standard XPaths if CSS selectors did not match
    if not clicked:
        xpaths = [
            ".//button[contains(translate(@title,'SUMMARY','summary'),'summary')]",
            ".//button[.//*[contains(@class,'file') or contains(@class,'document')]]",
            ".//button[position()=last() - 2]", # Third from last (usually download is first, edit second, delete last)
            ".//button[position()=last()]",
        ]
        for xpath in xpaths:
            try:
                buttons = row.find_elements(By.XPATH, xpath)
                for button in buttons:
                    if button.is_displayed() and button.is_enabled():
                        if trigger_click(button):
                            clicked = True
                            break
                if clicked:
                    break
            except WebDriverException:
                continue

    if not clicked:
        raise TimeoutException("Summary action button was not found")

    time.sleep(1.5)
    candidates = driver.find_elements(
        By.XPATH,
        "//*[self::a or self::button or self::li or self::span or self::div or @role='menuitem']"
        "[contains(translate(normalize-space(.), 'PDF', 'pdf'), 'pdf')]"
    )
    
    pdf_items = []
    for item in candidates:
        try:
            if not item.is_displayed() or not item.is_enabled():
                continue
            text = str(item.text or item.get_attribute("textContent") or "").strip().lower()
            if "excel" in text:
                # Skip Excel as PDF and similar options
                continue
            if "pdf" in text:
                pdf_items.append((item, len(text)))
        except WebDriverException:
            continue

    if pdf_items:
        # Sort by text length to select the shortest/most exact match (e.g. "PDF" over longer variants)
        pdf_items.sort(key=lambda x: x[1])
        target_item = pdf_items[0][0]
        if trigger_click(target_item):
            return wait_for_download(before)
        raise TimeoutException("Failed to click the PDF menu item")

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
        # Clear search filter before leaving so subsequent runs or the scraper don't find empty tables
        if driver:
            try:
                clear_all_filters(driver)
            except Exception:
                pass
        driver = None


if __name__ == "__main__":
    raise SystemExit(main())
