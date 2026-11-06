# DocScan Pro

A free, browser-based document scanner. Photograph or import a document and it is automatically
detected, flattened, straightened, cleaned up and framed like a proper scan, then exported as
PDF, JPG or PNG. No account, no subscription. Everything runs on your device; nothing is uploaded.

## Features
- Extra-clear output: pages are upscaled to print size, paper is made pure white, ink deep black (colored ink keeps its color) and text edges are sharpened
- Desktop web layout: sidebar, drag-and-drop or paste-to-upload panel, tool row, and recent documents as large previews, grid or list
- Mobile-first dark design: Home with tools and recent scans, Files, Tools and Me tabs, and a big camera button
- Share straight to Gmail, Messenger, Viber, Drive or any app through the phone's share menu, as one PDF or as JPG images
- Camera modes: Single (scan then review), Batch (many pages in a row) and ID Card (front and back on one A4 page)
- Merge several documents into one
- Live camera scanning with automatic capture when the page is steady, plus a manual shutter
- Import one or many photos
- Automatic edge detection and perspective correction, with draggable corners, undo/redo and reset
- Automatic text straightening and edge/margin tidying
- Structure alignment: detects table borders, ruled lines and columns, squares the table frame (rotation, slant, leftover keystone) and flattens bowed lines from curled paper. It only moves pixels, so text, numbers, signatures and stamps are preserved exactly
- Looks: Smart, Clean, Original color, Gray, High contrast, Untouched; brightness, contrast, sharpen
- Quality score per page with warnings (blur, cut-off, dark, shadows, low resolution, blank, duplicate)
- Multi-page documents: reorder, rotate, duplicate, replace, delete
- Export PDF/JPG/PNG on A3, A4, A5, A6, Letter, Long bond, Legal or custom paper
- Local library with search, favorites, trash and restore (stored in the browser)

## Run it
It is a single file. Open `index.html` in a browser, or host it with GitHub Pages
(Settings → Pages → deploy from the `main` branch). The camera needs HTTPS, which GitHub Pages provides.

## Android app
[**Download DocScan Pro for Android (APK)**](https://github.com/jaycee055/docscan-pro/releases/latest/download/DocScanPro.apk)

Open the file on your phone and allow installing from your browser if Android asks. Each update to the app is built automatically by GitHub Actions (`.github/workflows/android.yml`) and published on the [Releases page](https://github.com/jaycee055/docscan-pro/releases). Installing a newer APK over an older one keeps your scans.

## iPhone
- **App Store:** `.github/workflows/ios.yml` builds the iPhone app on GitHub's Mac runners. Without Apple keys it only checks that the app builds. After joining the Apple Developer Program, add the repository secrets `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_P8`, and every update is uploaded to TestFlight / App Store Connect.

[Privacy policy](https://jaycee055.github.io/docscan-pro/privacy.html)
