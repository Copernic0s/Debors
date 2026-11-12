import unittest

from cmp_agent_scope import build_company_agent_map


class CompanyAgentMapTests(unittest.TestCase):
    def test_normalizes_company_and_agent_values(self):
        mapping = build_company_agent_map([
            ("Acme Logistics, LLC", " José Rivera "),
        ])
        self.assertEqual(mapping, {"acme logistics": "jose rivera"})

    def test_same_company_with_conflicting_agents_fails_closed(self):
        mapping = build_company_agent_map([
            ("Acme Logistics LLC", "Alex Agent"),
            ("ACME LOGISTICS", "Morgan Agent"),
        ])
        self.assertEqual(mapping, {"acme logistics": None})

    def test_missing_agent_remains_unassigned(self):
        mapping = build_company_agent_map([("Acme Logistics", "")])
        self.assertEqual(mapping, {"acme logistics": None})


if __name__ == "__main__":
    unittest.main()
