"""Browser checks against `node tests/worker-fixture.mjs --serve` only."""
import base64
import json
import hashlib
import hmac
import os
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:8787"
OUTPUT = Path(os.environ.get("UI_ARTIFACT_DIR", "/tmp/next-dirs-v1-ui"))
OUTPUT.mkdir(parents=True, exist_ok=True)
PASSWORD = "Local-fixture-password-123!"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=")


def isolate(route):
    host = urlparse(route.request.url).hostname
    if host in ("localhost", "127.0.0.1"):
        route.continue_()
    elif route.request.resource_type == "image":
        route.fulfill(status=200, content_type="image/png", body=PNG)
    else:
        route.fulfill(status=401, content_type="application/json", body='{"error":"Local fixture: external network disabled"}')


def visit(page, route):
    response = page.goto(BASE + route, wait_until="load")
    assert response.status < 500, (route, response.status)
    return response


def no_overflow(page, label):
    sizes = page.evaluate("({viewport: innerWidth, content: document.documentElement.scrollWidth})")
    assert sizes["content"] <= sizes["viewport"] + 1, (label, sizes)


def login(page, account):
    visit(page, "/auth/login")
    page.get_by_label("Email", exact=True).fill(account + "@example.invalid")
    page.get_by_label("Password", exact=True).fill(PASSWORD)
    page.get_by_role("button", name="Login", exact=True).click()
    page.wait_for_url("**/dashboard", timeout=30000)
    expect(page.get_by_role("heading", name="Dashboard", exact=True)).to_be_visible()


def server_action(context, name, arguments, route="/submit"):
    manifest = json.loads(Path(".next/server/server-reference-manifest.json").read_text())
    action_id = next(key for key, value in manifest["node"].items() if value.get("exportedName") == name)
    return context.request.post(BASE + route,
        headers={"Origin": BASE, "Next-Action": action_id, "Content-Type": "text/plain;charset=UTF-8"},
        data=json.dumps(arguments))


def action_result(response):
    for line in response.text().splitlines():
        value = line.partition(":")[2]
        if value.startswith("{"):
            result = json.loads(value)
            if "status" in result:
                return result
    raise AssertionError("No action result: " + response.text()[:1000])


def checkout_action(context, listing_id, plan="pro"):
    return server_action(context, "createCheckoutSession", [listing_id, "price_attacker", plan], "/payment/" + listing_id)


def capture_error(errors, page, error):
    result = {"url": page.url, "error": str(error)}
    errors.append(result)
    print(json.dumps(result), flush=True)


if "--access-check" in sys.argv:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        errors = []
        for account in ("other", "admin"):
            context = browser.new_context(viewport={"width": 390, "height": 1000})
            context.route("**/*", isolate)
            page = context.new_page()
            page.on("pageerror", lambda error, source=page: capture_error(errors, source, error))
            login(page, account)
            for index in range(3):
                response = visit(page, "/admin")
                if account == "other":
                    page.wait_for_url("**/dashboard")
                (OUTPUT / f"access-{account}-{index}.html").write_text(response.text())
                print(account, index, response.status, page.locator("h1").all_text_contents(), flush=True)
            context.close()
        browser.close()
        assert not errors, errors
    sys.exit(0)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    errors = []
    report = []
    for width in (1440, 390):
        context = browser.new_context(viewport={"width": width, "height": 1000})
        context.route("**/*", isolate)
        page = context.new_page()
        page.on("pageerror", lambda error, source=page: capture_error(errors, source, error))
        for route in ("/", "/search", "/item/local-published", "/auth/login", "/auth/register"):
            visit(page, route)
            no_overflow(page, route)
        visit(page, "/item/local-published")
        expect(page.get_by_role("heading", name="Local published listing", exact=True)).to_be_visible()
        expect(page.locator("article table")).to_be_visible()
        expect(page.locator("article pre")).to_be_visible()
        assert page.evaluate("globalThis.pwned") is None
        page.screenshot(path=str(OUTPUT / f"public-{width}.png"), full_page=True)

        login(page, "owner")
        no_overflow(page, "dashboard first page")
        visit(page, "/dashboard?page=2")
        expect(page.get_by_role("heading", name="Local published listing", exact=True)).to_be_visible()
        if width == 1440:
            page.get_by_role("button", name="Retry failed sync", exact=True).click()
            expect(page.get_by_text("Sync: pending", exact=False)).to_be_visible()
        no_overflow(page, "dashboard")
        assert page.locator('a[href="/tag/local"]').count() > 0
        assert page.locator('a[href="/tag/tag-local"]').count() == 0
        page.screenshot(path=str(OUTPUT / f"dashboard-{width}.png"), full_page=True)
        visit(page, "/edit/published")
        expect(page.get_by_label("Name", exact=True)).to_have_value("Local published listing")
        page.locator(".CodeMirror").wait_for()
        page.evaluate("document.querySelector('.CodeMirror').CodeMirror.setValue('## Safe preview\\n\\n<img src=x onerror=\"globalThis.pwned=true\">\\n\\n<svg onload=\"globalThis.pwned=true\"></svg>\\n\\n[bad](javascript:alert%281%29)')")
        page.locator("button.preview").click()
        expect(page.locator(".editor-preview-active")).to_contain_text("Safe preview")
        assert page.locator(".editor-preview-active img, .editor-preview-active svg, .editor-preview-active script").count() == 0
        assert page.evaluate("globalThis.pwned") is None
        no_overflow(page, "edit")
        page.screenshot(path=str(OUTPUT / f"edit-preview-{width}.png"), full_page=True)
        page.get_by_role("button", name="Update", exact=True).click()
        page.wait_for_url("**/dashboard", timeout=30000)
        visit(page, "/dashboard?page=2")
        expect(page.get_by_role("heading", name="Local published listing", exact=True)).to_be_visible()
        visit(page, "/edit/hidden")
        expect(page.get_by_text("This listing remains hidden by staff.", exact=False)).to_be_visible()
        visit(page, "/submit")
        no_overflow(page, "submit")
        visit(page, "/admin")
        page.wait_for_url("**/dashboard")
        assert page.get_by_role("heading", name="Directory management").count() == 0
        report.append({"width": width, "checks": "public routes, Markdown, credentials login, dashboard, safe edit preview, hidden notice, submit and admin denial"})
        context.close()

    context = browser.new_context(viewport={"width": 390, "height": 1000})
    context.route("**/*", isolate)
    page = context.new_page()
    page.on("pageerror", lambda error, source=page: capture_error(errors, source, error))
    login(page, "other")
    visit(page, "/edit/published")
    expect(page.get_by_role("heading", name="404", exact=True)).to_be_visible()
    assert page.get_by_label("Name", exact=True).count() == 0
    # The real AI action and image uploader run against local HTTP doubles.
    assisted = action_result(server_action(context, "fetchWebsite", ["https://example.com/local-ai"]))
    assert assisted["status"] == "success", assisted
    ai_data = assisted["data"]
    assert ai_data["categories"] == ["Local category"]
    assert ai_data["tags"] == ["Local tag"]
    assert ai_data["imageId"].startswith("image-") and ai_data["iconId"].startswith("image-")
    draft = {key: ai_data[key] for key in ("name", "description", "introduction", "imageId", "iconId")}
    draft.update({"link": "https://example.com/local-ai", "categories": ["category-local"], "tags": ["tag-local"]})
    saved = action_result(server_action(context, "submit", [draft]))
    assert saved["status"] == "success", saved
    assert action_result(server_action(context, "publish", [saved["id"]], "/dashboard"))["status"] == "error"
    for blocked in ("https://127.0.0.1/private", "https://example.com/local-redirect"):
        assert action_result(server_action(context, "fetchWebsite", [blocked]))["status"] == "error"
    for _ in range(3):
        assert action_result(server_action(context, "fetchWebsite", ["https://example.com/local-ai"]))["status"] == "success"
    assert action_result(server_action(context, "fetchWebsite", ["https://example.com/local-ai"]))["message"] == "Daily AI limit reached"
    context.close()

    context = browser.new_context(viewport={"width": 390, "height": 1000})
    context.route("**/*", isolate)
    page = context.new_page()
    page.on("pageerror", lambda error, source=page: capture_error(errors, source, error))
    login(page, "editor")
    visit(page, "/admin")
    expect(page.get_by_role("heading", name="Directory management")).to_be_visible()
    assert page.get_by_role("heading", name="Account access").count() == 0
    no_overflow(page, "editor administration")
    visit(page, "/edit/published")
    expect(page.get_by_label("Name", exact=True)).to_have_value("Local published listing")
    page.get_by_label("Description", exact=True).fill("Edited by staff without another review")
    page.get_by_role("button", name="Update", exact=True).click()
    page.wait_for_url("**/dashboard", timeout=30000)
    visit(page, "/edit/pending")
    assert page.get_by_label("Name", exact=True).count() == 0
    context.close()

    context = browser.new_context(viewport={"width": 390, "height": 1000})
    context.route("**/*", isolate)
    page = context.new_page()
    page.on("pageerror", lambda error, source=page: capture_error(errors, source, error))
    login(page, "admin")
    visit(page, "/admin")
    expect(page.get_by_role("heading", name="Account access")).to_be_visible()
    no_overflow(page, "admin")
    page.screenshot(path=str(OUTPUT / "admin-390.png"), full_page=True)
    pending = page.locator("section").filter(has=page.get_by_role("heading", name="Local pending listing", exact=True))
    pending.get_by_role("button", name="Approve", exact=True).click()
    expect(pending).to_have_count(0)
    expect(page.get_by_text("admin · approve · 1 → 2", exact=False)).to_be_visible()
    published = page.locator("section").filter(has=page.get_by_role("heading", name="Local published listing", exact=True))
    published.get_by_role("button", name="Hide listing", exact=True).click()
    expect(published).to_contain_text("Hidden by staff")
    assert context.request.get(BASE + "/cdn-cgi/local/scheduled?format=json").status == 200
    visit(page, "/item/local-published")
    assert page.get_by_role("heading", name="Local published listing", exact=True).count() == 0
    sitemap = context.request.get(BASE + "/sitemap.xml").text()
    assert "/item/local-published" not in sitemap
    assert "/item/local-pending" not in sitemap
    context.close()

    context = browser.new_context(viewport={"width": 390, "height": 1000})
    context.route("**/*", isolate)
    page = context.new_page()
    page.on("pageerror", lambda error, source=page: capture_error(errors, source, error))
    login(page, "owner")
    visit(page, "/publish/pending")
    page.get_by_role("button", name="Publish Now", exact=True).click()
    expect(page.get_by_text("Publication requested. Sync is pending.")).to_be_visible()
    assert context.request.get(BASE + "/cdn-cgi/local/scheduled?format=json").status == 200
    visit(page, "/item/local-pending")
    expect(page.get_by_role("heading", name="Local pending listing", exact=True)).to_be_visible()
    visit(page, "/publish/paid?pay=success")
    expect(page.get_by_role("button", name="Publish Now", exact=True)).to_be_visible()
    page.get_by_role("button", name="Publish Now", exact=True).click()
    expect(page.get_by_text("Publication requested. Sync is pending.")).to_be_visible()
    assert context.request.get(BASE + "/cdn-cgi/local/scheduled?format=json").status == 200
    visit(page, "/item/local-paid")
    expect(page.get_by_role("heading", name="Local paid listing", exact=True)).to_be_visible()

    # Create a real draft through the form and authenticated upload route.
    visit(page, "/submit")
    page.get_by_label("Name", exact=True).fill("Local browser submission")
    page.get_by_label("Link", exact=True).fill("https://example.invalid/browser")
    page.get_by_label("Description", exact=True).fill("Created by the local browser flow")
    for kind in ("categories", "tags"):
        page.get_by_text("Select " + kind, exact=True).click()
        page.get_by_role("option", name="Local " + ("category" if kind == "categories" else "tag"), exact=True).click()
        page.keyboard.press("Escape")
    page.locator(".CodeMirror").wait_for()
    page.evaluate("document.querySelector('.CodeMirror').CodeMirror.setValue('## Browser-created listing\\n\\nLocal Markdown content')")
    for kind in ("icon", "image"):
        with page.expect_response(lambda response: response.url.endswith("/api/upload-image")) as upload:
            page.locator("#dropzone-file-" + kind).set_input_files({"name": "local.png", "mimeType": "image/png", "buffer": PNG})
        assert upload.value.status == 200
    page.get_by_role("button", name="Submit", exact=True).click()
    page.wait_for_url("**/payment/*", timeout=30000)
    submission_id = urlparse(page.url).path.split("/")[-1]
    page.get_by_role("button", name="Submit to review", exact=True).click()
    expect(page.get_by_role("button", name="Go dashboard and Wait", exact=True)).to_be_visible()

    staff_context = browser.new_context(viewport={"width": 1440, "height": 1000})
    staff_context.route("**/*", isolate)
    staff = staff_context.new_page()
    staff.on("pageerror", lambda error, source=staff: capture_error(errors, source, error))
    login(staff, "admin")
    visit(staff, "/admin")
    submitted = staff.locator("section").filter(has=staff.get_by_role("heading", name="Local browser submission", exact=True))
    submitted.get_by_role("button", name="Approve", exact=True).click()
    expect(submitted).to_have_count(0)
    visit(page, "/publish/" + submission_id)
    page.get_by_role("button", name="Publish Now", exact=True).click()
    expect(page.get_by_text("Publication requested. Sync is pending.")).to_be_visible()
    assert context.request.get(BASE + "/cdn-cgi/local/scheduled?format=json").status == 200
    visit(page, "/item/local-browser-submission-" + submission_id[:8])
    expect(page.get_by_role("heading", name="Local browser submission", exact=True)).to_be_visible()

    # Call the real action protocol with a forged client price; only server prices reach Stripe.
    assert "Invalid checkout request" in checkout_action(context, submission_id, "forged-plan").text()
    assert "Invalid checkout request" in checkout_action(context, "hidden").text()
    assert "already has paid access" in checkout_action(context, "paid").text()
    first = checkout_action(context, submission_id)
    checkout_location = first.headers.get("x-action-redirect", "").split(";")[0]
    order_id = parse_qs(urlparse(checkout_location).query)["fixtureCheckout"][0]
    second = checkout_action(context, submission_id)
    assert second.headers.get("x-action-redirect") == first.headers.get("x-action-redirect")
    assert "existing checkout" in checkout_action(context, submission_id, "sponsor").text()
    visit(page, "/publish/" + submission_id + "?pay=success")
    expect(page.get_by_role("heading", name="Payment is being confirmed", exact=True)).to_be_visible()
    event = json.dumps({"id": "evt_browser_checkout", "type": "checkout.session.completed", "data": {"object": {
        "id": "cs_" + order_id, "metadata": {"orderId": order_id}, "payment_intent": "pi_browser_checkout",
        "payment_status": "paid", "amount_total": 990, "currency": "usd"}}})
    timestamp = str(int(time.time()))
    signature = hmac.new(b"local-placeholder", (timestamp + "." + event).encode(), hashlib.sha256).hexdigest()
    for _ in range(2):
        assert context.request.post(BASE + "/api/webhook", data=event,
            headers={"stripe-signature": "t=" + timestamp + ",v1=" + signature}).status == 200
    assert "already has paid access" in checkout_action(context, submission_id).text()

    # A role/disable update invalidates an already-issued session immediately.
    visit(staff, "/admin")
    staff.get_by_placeholder("User ID", exact=True).fill("owner")
    staff.get_by_label("Disable account", exact=True).check()
    staff.get_by_role("button", name="Save access", exact=True).click()
    expect(staff.get_by_text("user:owner:role:USER:disabled:1", exact=False)).to_be_visible()
    visit(page, "/dashboard")
    page.wait_for_url("**/auth/login*", timeout=30000)
    staff_context.close()
    context.close()
    assert not errors, errors
    report.append({"checks": "other-owner denial, AI extraction/image ownership/review/URL and cost limits, editor save, first-review approval, administrator hiding, Cron publication, paid author publication, manual upload/submission/review/publication, forged checkout prices/plans, repeated checkout/webhooks and active-session invalidation", "errors": errors})
    (OUTPUT / "report.json").write_text(json.dumps(report, indent=2))
    browser.close()
    print(json.dumps(report, indent=2))
