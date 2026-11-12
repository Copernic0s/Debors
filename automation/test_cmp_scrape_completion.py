import unittest

from cmp_scrape_completion import classify_scrape_completion


class ScrapeCompletionTests(unittest.TestCase):
    def test_natural_pagination_end_is_complete(self):
        self.assertEqual(classify_scrape_completion(4, 100, "pagination_end"), (True, False))

    def test_hitting_max_pages_is_truncated(self):
        self.assertEqual(classify_scrape_completion(5, 5, "max_pages"), (False, True))

    def test_pagination_error_is_incomplete_not_truncated(self):
        self.assertEqual(classify_scrape_completion(3, 5, "pagination_error"), (False, False))


if __name__ == "__main__":
    unittest.main()
