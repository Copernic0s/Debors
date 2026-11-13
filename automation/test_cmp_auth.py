import unittest

from cmp_auth import classify_auth_timeout, login_timeout_seconds


class CmpAuthTests(unittest.TestCase):
    def test_manual_and_scheduled_timeouts_default_separately(self):
        self.assertEqual(login_timeout_seconds("manual"), 300)
        self.assertEqual(login_timeout_seconds("scheduled"), 60)

    def test_positive_configured_timeout_overrides_trigger_default(self):
        self.assertEqual(login_timeout_seconds("scheduled", "90"), 90)

    def test_invalid_timeout_uses_trigger_default(self):
        self.assertEqual(login_timeout_seconds("manual", "bad"), 300)
        self.assertEqual(login_timeout_seconds("scheduled", "0"), 60)

    def test_mfa_takes_precedence_over_generic_auth_redirect(self):
        self.assertEqual(classify_auth_timeout([
            "https://cmp.test/auth", "https://cmp.test/auth/mfa/challenge"
        ]), "mfa_required")

    def test_auth_redirect_without_mfa_is_session_expired(self):
        self.assertEqual(classify_auth_timeout(["https://cmp.test/auth"]), "session_expired")


if __name__ == "__main__":
    unittest.main()
