from playwright.sync_api import sync_playwright
import time

def verify_walk_warning():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Mobile viewport emulation
        context = browser.new_context(
            viewport={'width': 375, 'height': 812},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            permissions=['geolocation'],
            geolocation={'latitude': 35.6895, 'longitude': 139.6917}
        )
        page = context.new_page()

        # Capture logs
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

        # Block Firebase and Google Maps
        def handle_route(route):
            url = route.request.url
            if "firebase" in url or "maps.googleapis" in url:
                route.abort()
            else:
                route.continue_()

        page.route("**/*", handle_route)

        # Inject Mocks
        page.add_init_script("""
            // Mock Date
            const OriginalDate = Date;
            window.originalDate = OriginalDate;
            let mockTime = new OriginalDate().getTime();

            window.mockDateNow = (offsetMs) => {
                mockTime += offsetMs;
                console.log(`[Mock] Time advanced by ${offsetMs}ms, now: ${new OriginalDate(mockTime).toISOString()}`);
            };

            class MockDate extends OriginalDate {
                constructor(...args) {
                    if (args.length === 0) return new OriginalDate(mockTime);
                    return new OriginalDate(...args);
                }
                static now() {
                    return mockTime;
                }
            }
            window.Date = MockDate;

            // Mock Firebase
            window.firebase = {
                initializeApp: () => {},
                firestore: () => {
                    return {
                        collection: (name) => {
                            return {
                                onSnapshot: (cb) => {
                                    if (name === 'walkers') {
                                        setTimeout(() => {
                                            cb({ docs: [{ id: '1', data: () => ({ name: 'TestWalker', order: 1 }) }] });
                                        }, 100);
                                    }
                                    if (name === 'walks') {
                                        setTimeout(() => cb({ docs: [] }), 100);
                                    }
                                    if (name === 'health') {
                                        setTimeout(() => cb({ docs: [] }), 100);
                                    }
                                    return () => {};
                                },
                                orderBy: function() { return this; },
                                add: () => Promise.resolve(),
                                doc: () => ({ update: () => Promise.resolve(), delete: () => Promise.resolve() })
                            };
                        },
                        Timestamp: { fromDate: (d) => d }
                    };
                },
                storage: () => ({
                    ref: () => ({ put: () => Promise.resolve(), getDownloadURL: () => Promise.resolve('url') })
                }),
                app: () => ({ functions: () => ({ httpsCallable: () => () => Promise.resolve() }) })
            };

            // Mock Google Maps
            window.google = {
                maps: {
                    Map: class{ setCenter(){} fitBounds(){} },
                    Polyline: class{ setMap(){} },
                    LatLngBounds: class{ extend(){} },
                    MapTypeId: { ROADMAP: 'roadmap' }
                }
            };
        """)

        print("Navigating to page...")
        page.goto("http://localhost:3000")

        page.wait_for_load_state("networkidle")
        time.sleep(2)

        # 1. Start Walk
        print("Switching to Health tab...")
        try:
            # Click "お世話" tab
            page.get_by_role("button", name="お世話").click()
            time.sleep(0.5)

            # Click "散歩" button (large icon)
            # It's a button with text "散歩" inside a span, inside the button.
            # Using text="散歩" might match the tab name or other text.
            # The button contains "🚶" and "散歩".
            # Let's try to find the button that contains "🚶"
            page.get_by_text("🚶", exact=False).first.click()
            time.sleep(0.5)

            print("Selecting walker...")
            walker_label = page.get_by_text("TestWalker")
            walker_label.wait_for(timeout=5000)
            walker_label.click()

            print("Clicking Start...")
            start_btn = page.get_by_role("button", name="開始")
            start_btn.click()

        except Exception as e:
            print(f"Failed to start walk: {e}")
            page.screenshot(path="verification/debug_start_fail.png")
            return

        # Verify walking state
        time.sleep(1)
        if page.get_by_text("経過時間").is_visible():
            print("Walk started successfully")
        else:
            print("Failed to start walk state check")
            page.screenshot(path="verification/failed_start_check.png")
            return

        # 2. Advance time
        print("Advancing time...")
        page.evaluate("window.mockDateNow(190000)") # 3m10s

        print("Waiting for interval...")
        page.wait_for_timeout(12000)

        warning_text = page.get_by_text("散歩中ですか？")
        if warning_text.is_visible():
            print("Warning modal visible")
            page.screenshot(path="verification/warning_modal.png")
        else:
            print("Warning modal NOT visible")
            page.screenshot(path="verification/failed_warning.png")
            # Debug: check console for [Stop Check] logs
            return

        # 3. Verify Modal Scroll Lock
        body_overflow = page.evaluate("document.body.style.overflow")
        print(f"Body overflow when warning modal open: {body_overflow}")

        if body_overflow == 'hidden':
             print("SUCCESS: Scroll lock is active")
        else:
             print("FAILURE: Scroll lock is NOT active")

        # 4. Continue
        print("Clicking Continue...")
        if warning_text.is_visible():
            page.get_by_role("button", name="まだ散歩中です").click()
            page.wait_for_timeout(1000)

        if not warning_text.is_visible():
            print("Warning modal dismissed")
        else:
            print("Warning modal still visible")

        browser.close()

if __name__ == "__main__":
    verify_walk_warning()
