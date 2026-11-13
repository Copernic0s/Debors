import unittest

from cmp_agent_scope import ACTIVE_AGENT_NAMES, build_company_agent_map


class CompanyAgentMapTests(unittest.TestCase):
    def test_normalizes_company_and_agent_values(self):
        mapping = build_company_agent_map([
            ("Acme Logistics, LLC", " José Rivera "),
        ])
        self.assertEqual(mapping, {"acme logistics llc": "jose rivera"})

    def test_same_company_with_conflicting_agents_fails_closed(self):
        mapping = build_company_agent_map([
            ("Acme Logistics LLC", "Alex Agent"),
            ("ACME LOGISTICS LLC", "Morgan Agent"),
        ])
        self.assertEqual(mapping, {"acme logistics llc": None})

    def test_missing_agent_remains_unassigned(self):
        mapping = build_company_agent_map([("Acme Logistics", "")])
        self.assertEqual(mapping, {"acme logistics": None})

    def test_distinguishes_distinct_legal_entities(self):
        mapping = build_company_agent_map([
            ("RV Transport LLC", "Juan Manuel Enciso"),
            ("RV Transport Inc", "Ricardo Llanos"),
        ])
        self.assertEqual(mapping, {
            "rv transport llc": "juan manuel enciso",
            "rv transport inc": "ricardo llanos",
        })

    def test_ignores_rows_for_agents_outside_active_roster(self):
        mapping = build_company_agent_map([
            ("San Miguel Express LLC", "Francesco Rinaldelli"),
            ("SAN MIGUEL EXPRESS LLC", "Juan Manuel Enciso"),
            ("Former Agent Co", "John Escobar"),
        ], ACTIVE_AGENT_NAMES)
        self.assertEqual(mapping, {
            "san miguel express llc": "juan manuel enciso",
        })


if __name__ == "__main__":
    unittest.main()
