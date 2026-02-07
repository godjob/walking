from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Block real firebase scripts to avoid conflict and errors
    page.route("**/firebase*.js", lambda route: route.abort())

    # Mock script
    mock_script = """
    window.firebase = {
      initializeApp: () => {},
      firestore: () => ({
        collection: (name) => {
          const mockCollection = {
            orderBy: (field, dir) => mockCollection,
            onSnapshot: (cb) => {
               console.log('Snapshot called for', name);
               if (name === 'walks') {
                 cb({
                   docs: [
                     { id: '1', data: () => ({ startTime: { toDate: () => new Date() }, walkers: ['太郎'], distance: 1500, duration: 15, photos: [] }) },
                     { id: '2', data: () => ({ startTime: undefined, walkers: ['BuggyRecord'], distance: 0, duration: 0 }) },
                     { id: '3', data: () => ({ startTime: { toDate: () => new Date(Date.now() - 86400000) }, walkers: ['次郎'], distance: 2000, duration: 20, photos: [] }) }
                   ]
                 });
               } else if (name === 'health') {
                 cb({ docs: [] });
               } else if (name === 'walkers') {
                 cb({ docs: [{id: 'w1', data: () => ({name: '母', order: 1})}] });
               }
               return () => {};
            },
            add: () => Promise.resolve(),
            doc: () => ({ update: () => Promise.resolve(), delete: () => Promise.resolve() })
          };
          return mockCollection;
        },
        Timestamp: { fromDate: (d) => d, now: () => new Date() }
      }),
      storage: () => ({ ref: () => ({ put: () => {}, getDownloadURL: () => '' }) }),
      app: () => ({ functions: () => ({ httpsCallable: () => () => Promise.resolve() }) })
    };
    window.firebase.firestore.Timestamp = window.firebase.firestore().Timestamp;
    """

    page.add_init_script(mock_script)

    page.goto("http://localhost:8080/index.html")

    # Wait for the "福のお世話" list to populate
    try:
        page.wait_for_selector("text=太郎", timeout=5000)
        print("Found valid record")
    except:
        print("Failed to find valid record")

    try:
        page.wait_for_selector("text=BuggyRecord", timeout=5000)
        print("Found buggy record (displayed)")
    except:
        print("Buggy record not displayed (or crashed)")

    page.screenshot(path="verification_frontend.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
