import unittest
from datetime import datetime, timedelta

from cmp_invoice_window import should_keep_invoice


class CmpInvoiceWindowTests(unittest.TestCase):
    def setUp(self):
        self.cutoff = datetime(2026, 1, 1)
        self.old_date = self.cutoff - timedelta(days=400)

    def test_keeps_open_balance_older_than_window(self):
        self.assertTrue(should_keep_invoice("overdue", 125, self.old_date, self.cutoff))

    def test_discards_paid_invoice_older_than_window(self):
        self.assertFalse(should_keep_invoice("paid", 0, self.old_date, self.cutoff))

    def test_keeps_paid_invoice_inside_window(self):
        self.assertTrue(should_keep_invoice("paid", 0, self.cutoff, self.cutoff))

    def test_keeps_paid_status_when_balance_is_still_positive(self):
        self.assertTrue(should_keep_invoice("paid", 10, self.old_date, self.cutoff))


if __name__ == "__main__":
    unittest.main()
