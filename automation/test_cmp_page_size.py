import unittest

from cmp_page_size import page_size_matches, parse_page_limit, parse_pagination_range, requested_page_size


class CmpPageSizeTests(unittest.TestCase):
    def test_reads_requested_limit_and_defaults_to_500(self):
        self.assertEqual(parse_page_limit("https://cmp.test/invoicing?page=1&limit=500"), 500)
        self.assertEqual(requested_page_size("https://cmp.test/invoicing?page=1"), 500)

    def test_parses_pagination_range_with_formatted_total(self):
        self.assertEqual(parse_pagination_range("1-10 of 69,184 items"), (10, 69184))

    def test_detects_default_ten_rows_when_more_pages_exist(self):
        self.assertFalse(page_size_matches(
            500, url="https://cmp.test/invoicing", pagination_text="1-10 of 69,184 items",
            selected_sizes=(10,), raw_rows=10
        ))

    def test_accepts_requested_500_rows(self):
        self.assertTrue(page_size_matches(
            500, url="https://cmp.test/invoicing?page=1&limit=500",
            pagination_text="1-500 of 69,184 items", selected_sizes=(500,), raw_rows=500
        ))

    def test_accepts_small_complete_result_set(self):
        self.assertTrue(page_size_matches(
            500, url="https://cmp.test/invoicing?page=1&limit=500",
            pagination_text="1-7 of 7 items", selected_sizes=(10,), raw_rows=7
        ))

    def test_does_not_fail_on_ten_rows_without_total_evidence(self):
        self.assertTrue(page_size_matches(
            500, url="https://cmp.test/invoicing?page=1&limit=500", raw_rows=10
        ))

    def test_missing_query_limit_can_be_verified_by_page_size_control(self):
        self.assertTrue(page_size_matches(
            500, url="https://cmp.test/invoicing", selected_sizes=(500,), raw_rows=500
        ))


if __name__ == "__main__":
    unittest.main()
