from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # コンソールログを収集
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PageError: {exc}"))

        try:
            print("Navigating to page...")
            page.goto("http://localhost:8000/index.html")

            # Reactがロードされるのを少し待つ
            time.sleep(2)

            print("Clicking 'お世話' tab...")
            # タブ切り替えボタンをクリック
            # ボタンのテキストは "お世話"
            page.get_by_role("button", name="お世話").click()

            # 画面遷移とレンダリングを待つ
            time.sleep(2)

            print("Taking screenshot...")
            page.screenshot(path="verification_health_tab.png")
            print("Screenshot saved to verification_health_tab.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
