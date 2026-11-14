# Beachouse Health Club app (beta)

- `docs/` is the app itself. GitHub Pages serves it as the web beta (Settings > Pages > main branch, /docs folder).
- `codemagic.yaml` builds the iPhone app on Codemagic and sends it to TestFlight once the Apple developer account is approved.
- `capacitor.config.json` wraps `docs/` as a native iOS app (bundle ID com.beachousebondi.app).
- `coach-worker.js` is the small server that keeps the Anthropic API key private for Ask Coach.
