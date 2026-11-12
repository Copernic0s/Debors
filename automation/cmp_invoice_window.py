from datetime import datetime


def should_keep_invoice(status: str, balance: float, invoice_date: datetime | None, cutoff: datetime) -> bool:
    normalized_status = str(status or "pending").strip().lower()
    if normalized_status != "paid" or balance > 0:
        return True
    if invoice_date is None:
        return True
    return invoice_date.date() >= cutoff.date()
