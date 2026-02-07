from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Listen to console
    page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

    # Block real firebase scripts to avoid conflict and errors
    # Also block google maps api if needed, or mock it?
    # The script loads maps api too.
    page.route("**/firebase*.js", lambda route: route.abort())

    # Mock firebase BEFORE page load
    mock_script = """
    console.log("Initializing Mock Firebase...");
    window.firebase = {
      initializeApp: () => { console.log("Firebase initialized"); },
      firestore: () => {
        console.log("Firestore called");
        return {
        collection: (name) => {
          console.log("Collection called: " + name);
          const mockCollection = {
            orderBy: (field, dir) => { console.log("OrderBy " + field); return mockCollection; },
            onSnapshot: (cb) => {
               console.log('Snapshot called for ' + name);
               setTimeout(() => {
                   if (name === 'walks') {
                     const fakeDocs = [
                         { id: '1', data: () => ({ startTime: { toDate: () => new Date() }, walkers: ['太郎'], distance: 1500, duration: 15, photos: [] }) },
                         { id: '2', data: () => ({ startTime: undefined, walkers: ['BuggyRecord'], distance: 0, duration: 0 }) },
                         { id: '3', data: () => ({ startTime: { toDate: () => new Date(Date.now() - 86400000) }, walkers: ['次郎'], distance: 2000, duration: 20, photos: [] }) }
                     ];
                     console.log("Sending walk docs: " + fakeDocs.length);
                     cb({ docs: fakeDocs });
                   } else if (name === 'health') {
                     cb({ docs: [] });
                   } else if (name === 'walkers') {
                     cb({ docs: [{id: 'w1', data: () => ({name: '母', order: 1})}] });
                   }
               }, 100);
               return () => {};
            },
            add: () => Promise.resolve(),
            doc: () => ({ update: () => Promise.resolve(), delete: () => Promise.resolve() })
          };
          return mockCollection;
        },
        Timestamp: { fromDate: (d) => d, now: () => new Date() }
      }},
      storage: () => ({ ref: () => ({ put: () => {}, getDownloadURL: () => '' }) }),
      app: () => ({ functions: () => ({ httpsCallable: () => () => Promise.resolve() }) })
    };
    // Need to set Timestamp on the function object too, as app might use firebase.firestore.Timestamp
    window.firebase.firestore.Timestamp = { fromDate: (d) => d, now: () => new Date() };
    console.log("Mock Firebase Ready");
    """

    page.add_init_script(mock_script)

    try:
        page.goto("http://localhost:8080/index.html")
    except Exception as e:
        print(f"Navigation failed: {e}")

    page.wait_for_timeout(5000)

    page.screenshot(path="verification_frontend.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
