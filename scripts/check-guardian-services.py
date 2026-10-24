#!/usr/bin/env python3
"""Read-only deployed-service checks. Supply private configuration on stdin.

No credentials are written to disk or printed. No WhatsApp messages are sent.
The only billable provider probe embeds two short synthetic statements.
"""
import json
import math
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

saved_terminal = None
if sys.stdin.isatty():
    import termios
    saved_terminal = termios.tcgetattr(sys.stdin.fileno())
    terminal = termios.tcgetattr(sys.stdin.fileno())
    terminal[3] &= ~termios.ECHO
    termios.tcsetattr(sys.stdin.fileno(), termios.TCSANOW, terminal)
print("READY_FOR_PRIVATE_CONFIG", flush=True)
try:
    config = json.loads(sys.stdin.readline(65536))
finally:
    if saved_terminal is not None:
        termios.tcsetattr(sys.stdin.fileno(), termios.TCSANOW, saved_terminal)
failures = []


def request(url, headers, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        try:
            body = json.loads(error.read())
        except (ValueError, UnicodeError):
            body = {}
        return error.code, body
    except Exception as error:
        return 0, {"transport_error": type(error).__name__}


def report(stage, **kwargs):
    print(json.dumps({"stage": stage, **kwargs}, ensure_ascii=False), flush=True)
    if kwargs.get("valid") is False and stage in {
        "postgrest_service_rpc", "postgrest_public_rpc_denied", "postgrest_public_table_denied",
        "embedding_provider", "postgrest_vector_rpc", "meta_phone_access",
    }:
        failures.append(stage)


def supabase_headers(key):
    headers = {"apikey": key, "Content-Type": "application/json"}
    if not key.startswith(("sb_secret_", "sb_publishable_")):
        headers["Authorization"] = "Bearer " + key
    return headers


def check_supabase_and_embeddings():
    base = config["SUPABASE_URL"].rstrip("/")
    if base != "https://cawgzodelwchccilqeqr.supabase.co":
        raise SystemExit("Unexpected Supabase target")
    service = supabase_headers(config["SUPABASE_SERVICE_ROLE_KEY"])
    public = supabase_headers(config["SUPABASE_PUBLISHABLE_KEY"])
    status, snapshot = request(base + "/rest/v1/rpc/guardian_snapshot", service, {"p_phone": "000000000000099"})
    report("postgrest_service_rpc", http=status, valid=status == 200 and snapshot.get("active") is None and snapshot.get("properties") == [])
    status, _ = request(base + "/rest/v1/rpc/guardian_snapshot", public, {"p_phone": "000000000000099"})
    report("postgrest_public_rpc_denied", http=status, valid=status in (401, 403))
    status, _ = request(base + "/rest/v1/guardian_properties?select=id&limit=1", public)
    report("postgrest_public_table_denied", http=status, valid=status in (401, 403))

    status, embedded = request("https://api.openai.com/v1/embeddings", {
        "Authorization": "Bearer " + config["OPENAI_API_KEY"], "Content-Type": "application/json",
    }, {"model": config.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large"),
        "input": ["Lote 2: novilhas em observação.", "Atualização do lote 2: as novilhas voltaram a comer."],
        "dimensions": 3072, "encoding_format": "float"})
    vectors = [item.get("embedding", []) for item in embedded.get("data", [])]
    valid_vectors = status == 200 and len(vectors) == 2 and all(len(v) == 3072 and any(v) and all(isinstance(n, (int, float)) and math.isfinite(n) for n in v) for v in vectors)
    report("embedding_provider", http=status, valid=valid_vectors, dimensions=[len(v) for v in vectors], tokens=embedded.get("usage", {}).get("total_tokens"))
    if valid_vectors:
        status, recalled = request(base + "/rest/v1/rpc/recall_whatsapp_semantic", service, {
            "p_phone": "000000000000099", "p_provider": "validation:synthetic:3072",
            "p_embedding": json.dumps(vectors[0]), "p_epoch": "reset-2026-10-14-duk-a91f",
        })
        report("postgrest_vector_rpc", http=status, valid=status == 200 and recalled.get("turns") == [])


if not config.get("meta_only"):
    check_supabase_and_embeddings()

graph = config.get("WHATSAPP_GRAPH_API_VERSION", "v25.0")
if not re.fullmatch(r"v\d+\.\d+", graph) or not re.fullmatch(r"\d+", config["WHATSAPP_PHONE_NUMBER_ID"]):
    raise SystemExit("Invalid Graph configuration")
graph_base = "https://graph.facebook.com/" + graph
meta_headers = {"Authorization": "Bearer " + config["WHATSAPP_ACCESS_TOKEN"]}
status, phone = request(graph_base + "/" + config["WHATSAPP_PHONE_NUMBER_ID"] + "?fields=id", meta_headers)
report("meta_phone_access", http=status, valid=status == 200 and phone.get("id") == config["WHATSAPP_PHONE_NUMBER_ID"], error_code=phone.get("error", {}).get("code"))
status, debug = request(graph_base + "/debug_token?" + urllib.parse.urlencode({"input_token": config["WHATSAPP_ACCESS_TOKEN"]}), meta_headers)
info = debug.get("data", {})
report("meta_token_inspection", http=status, valid=info.get("is_valid") is True, error_code=debug.get("error", {}).get("code"))
candidates = set()
for scope in info.get("granular_scopes", []):
    if scope.get("scope") in ("whatsapp_business_management", "whatsapp_business_messaging"):
        candidates.update(str(i) for i in scope.get("target_ids", []) if re.fullmatch(r"\d+", str(i)))
if config.get("WHATSAPP_BUSINESS_ACCOUNT_ID"):
    candidates.add(config["WHATSAPP_BUSINESS_ACCOUNT_ID"])
if not candidates:
    status, assigned = request(graph_base + "/me/assigned_whatsapp_business_accounts?fields=id&limit=100", meta_headers)
    candidates.update(str(item["id"]) for item in assigned.get("data", []) if re.fullmatch(r"\d+", str(item.get("id", ""))))
    report("meta_business_discovery", http=status, accounts=len(candidates), error_code=assigned.get("error", {}).get("code"))
matched = False
for business in sorted(candidates):
    status, phones = request(graph_base + "/" + business + "/phone_numbers?fields=id&limit=100", meta_headers)
    report("meta_business_phone_match", http=status,
        matches_phone=status == 200 and any(p.get("id") == config["WHATSAPP_PHONE_NUMBER_ID"] for p in phones.get("data", [])),
        error_code=phones.get("error", {}).get("code"))
    if status != 200 or not any(p.get("id") == config["WHATSAPP_PHONE_NUMBER_ID"] for p in phones.get("data", [])):
        continue
    matched = True
    status, templates = request(graph_base + "/" + business + "/message_templates?fields=name,status,language,category,parameter_format,components&limit=100", meta_headers)
    summaries = []
    for template in templates.get("data", []):
        components = template.get("components", [])
        body = next((c.get("text", "") for c in components if c.get("type") == "BODY"), "")
        variables = re.findall(r"{{\s*(.*?)\s*}}", body)
        unsupported = any(c.get("type") == "HEADER" and (c.get("format") != "TEXT" or "{{" in c.get("text", "")) for c in components)
        unsupported = unsupported or any("{{" in json.dumps(c) for c in components if c.get("type") == "BUTTONS")
        compatible = template.get("status") == "APPROVED" and template.get("parameter_format", "POSITIONAL") == "POSITIONAL" and set(variables) == {"1"} and not unsupported
        summaries.append({"name": template.get("name"), "status": template.get("status"), "language": template.get("language"), "category": template.get("category"), "compatible_one_body_parameter": compatible,
            **({"body": re.sub(r"\d{6,}", "[contato]", body)[:400]} if compatible else {})})
    report("meta_templates", http=status, business_id=business, business_matches_phone=True, partial=bool(templates.get("paging", {}).get("next")), templates=summaries)
if not matched:
    report("meta_templates", business_matches_phone=False, reason="business_identifier_or_permission_unavailable")
raise SystemExit(1 if failures else 0)
