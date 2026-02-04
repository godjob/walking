from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # ページにアクセス
    try:
        response = page.goto("http://localhost:8000/index.html")
        print(f"Page load status: {response.status}")
    except Exception as e:
        print(f"Failed to load page: {e}")
        return

    # マニフェストのリンクタグ確認
    manifest_link = page.locator('link[rel="manifest"]')
    if manifest_link.count() > 0:
        print("Manifest link tag found.")
        href = manifest_link.get_attribute('href')
        print(f"Manifest href: {href}")

        # マニフェストファイルへのアクセス確認
        try:
            manifest_response = page.request.get(f"http://localhost:8000/{href}")
            if manifest_response.status == 200:
                print("Manifest file loaded successfully.")
                try:
                    print(manifest_response.json())
                except:
                    print("Manifest is not valid JSON")
            else:
                print(f"Failed to load manifest: {manifest_response.status}")
        except Exception as e:
             print(f"Error requesting manifest: {e}")
    else:
        print("Manifest link tag NOT found.")

    # Service Workerの登録コードが動いているか（コンソールログなどで確認できると良いが、ここではファイルの存在確認）
    try:
        sw_response = page.request.get("http://localhost:8000/service-worker.js")
        if sw_response.status == 200:
            print("Service Worker file loaded successfully.")
        else:
            print(f"Failed to load Service Worker: {sw_response.status}")
    except Exception as e:
        print(f"Error requesting SW: {e}")

    # スクリーンショット
    page.screenshot(path="verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
