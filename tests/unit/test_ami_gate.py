import importlib.util
import os
import pathlib
import unittest

os.environ.update(PBX_TENANT="33333333-3333-4333-8333-333333333333", EXT_A="211", EXT_B="212", EXT_C="213")
path = pathlib.Path(__file__).resolve().parents[2] / "infra/asterisk/ami_gate.py"
spec = importlib.util.spec_from_file_location("ami_gate", path)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def frame(*lines):
    return ("\r\n".join(lines) + "\r\n\r\n").encode()


class Policy(unittest.TestCase):
    def test_known_queries_and_local_member(self):
        self.assertEqual(gate.check(frame("Action: PJSIPShowContacts", "ActionID: contacts"), "observer"), "observer")
        self.assertEqual(gate.check(frame(
            "Action: QueuePause", "Queue: t33333333-3333-4333-8333-333333333333-301",
            "Interface: PJSIP/212", "Paused: false",
        ), "queue-controller"), "queue-controller")

    def test_other_tenant_and_other_technology(self):
        for queue, interface in [
            ("t11111111-1111-4111-8111-111111111111-301", "PJSIP/212"),
            ("t33333333-3333-4333-8333-333333333333-301", "PJSIP/202"),
            ("t33333333-3333-4333-8333-333333333333-301", "Local/212@default"),
        ]:
            with self.assertRaises(ValueError):
                gate.check(frame("Action: QueueAdd", "Queue: " + queue, "Interface: " + interface, "Paused: true"), "queue-controller")

    def test_duplicate_fields_and_admin_actions_denied(self):
        for role in gate.ROLES:
            for action in ("Reload", "GetConfig", "ModuleLoad", "Originate", "Command", "Hangup"):
                with self.assertRaises(ValueError):
                    gate.check(frame("Action: " + action), role)
            with self.assertRaises(ValueError):
                gate.check(frame("Action: CoreShowChannels", "aCtIoN: Command"), role)


if __name__ == "__main__":
    unittest.main()
