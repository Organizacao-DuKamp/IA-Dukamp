#!/usr/bin/env python3
"""Read-only PostgREST checks; private configuration is supplied through stdin."""
import json
import sys
import urllib.error
import urllib.request

terminal = None
if sys.stdin.isatty():
    import termios
    terminal = termios.tcgetattr(sys.stdin.fileno())
    hidden = termios.tcgetattr(sys.stdin.fileno())
    hidden[3] &= ~termios.ECHO
    termios.tcsetattr(sys.stdin.fileno(), termios.TCSANOW, hidden)
print("READY_FOR_PRIVATE_CONFIG", flush=True)
try:
    config = json.loads(sys.stdin.readline(65536))
finally:
    if terminal is not None:
        termios.tcsetattr(sys.stdin.fileno(), termios.TCSANOW, terminal)

base = config["SUPABASE_URL"].rstrip("/")
if base != "https://cawgzodelwchccilqeqr.supabase.co":
    raise SystemExit("Unexpected Supabase target")


def request(path, key, payload=None):
    headers = {"apikey": key, "Content-Type": "application/json"}
    if not key.startswith(("sb_secret_", "sb_publishable_")):
        headers["Authorization"] = "Bearer " + key
    data = None if payload is None else json.dumps(payload).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(base + "/rest/v1/" + path, data=data, headers=headers), timeout=15) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, None
    except Exception:
        return 0, None


failures = 0
service = config["SUPABASE_SERVICE_ROLE_KEY"]
public = config["SUPABASE_PUBLISHABLE_KEY"]
checks = [
    ("service_list", "rpc/guardian_observed_profiles", service, {"p_limit": 1}, lambda status, data: status == 200 and isinstance(data, dict) and isinstance(data.get("profiles"), list)),
    ("service_current", "guardian_observed_current?select=id&phone_number=eq.000000000000096", service, None, lambda status, data: status == 200 and data == []),
    ("service_memory_json_filter", "whatsapp_user_memory_facts?select=id&phone_number=eq.000000000000096&metadata->>kind=in.(reported,correction,answer)", service, None, lambda status, data: status == 200 and data == []),
    ("public_rpc_denied", "rpc/guardian_observed_profiles", public, {"p_limit": 1}, lambda status, data: status in (401, 403)),
    ("public_table_denied", "guardian_observed_properties?select=id&limit=1", public, None, lambda status, data: status in (401, 403)),
]
for name, path, key, payload, validate in checks:
    status, result = request(path, key, payload)
    valid = validate(status, result)
    failures += not valid
    print(json.dumps({"stage": name, "http": status, "valid": valid}), flush=True)
raise SystemExit(1 if failures else 0)
