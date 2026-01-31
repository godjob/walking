from playwright.sync_api import sync_playwright
import time

def verify(page):
    print("Navigating to page...")
    page.goto("http://localhost:8000/index.html")

    print("Waiting for content...")
    # Wait for the title or some main element to appear
    page.wait_for_selector("h1", timeout=10000)

    # Scroll to bottom to ensure footer is visible
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

    # Wait a bit for any lazy loading or rendering
    time.sleep(1)

    print("Taking screenshot...")
    page.screenshot(path="/home/jules/verification/version_check.png")

    # Check for version text
    content = page.content()
    if "v2.9.3" in content:
        print("SUCCESS: Version v2.9.3 found in page content.")
    else:
        print("FAILURE: Version v2.9.3 NOT found in page content.")

if __name__ == "__main__":
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error during verification: {e}")
        finally:
            browser.close()
