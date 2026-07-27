# BP Tracker Bunny

A mobile-friendly, installable blood pressure tracking PWA.

## Upload to GitHub

Upload the **contents of this folder** to the root of your repository:

- `index.html`
- `styles.css`
- `script.js`
- `manifest.webmanifest`
- `service-worker.js`
- `icon-192.png`
- `icon-512.png`
- `rabbit-head.png`

Do not upload the ZIP itself as the website.

## Enable GitHub Pages

1. Open the repository.
2. Go to **Settings** → **Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose the `main` branch and `/ (root)`.
5. Tap **Save**.
6. Wait a few minutes for the website link to appear.

## Install on Android

Open the GitHub Pages website in Chrome, then use **Add to Home screen** or the in-app **Install app** button when it appears.

## Privacy

Readings are stored in the browser on the current device using local storage. Export a JSON backup before clearing browser data or changing phones.


Update: Replaced hypertension stage labels with calmer target-based status wording while keeping all other features unchanged.

Update: Pulse entry and pulse displays were removed. Existing saved blood-pressure readings remain compatible; any old pulse values are simply ignored by the interface.

Update: Renamed the app to **BP Tracker Bunny**, fixed root icon paths, refreshed the app icons, and bumped the service-worker cache.
