---
name: smart-search-development
description: Project architecture, coding standards, execution commands, and constraints for developing the Smart Search Chrome Extension.
---

# Smart Search Chrome Extension - Development Guide

## Project Architecture & Tech Stack Overview

Smart Search is a futuristic Chrome extension (Manifest V3) that enables screen capturing, crop selection, and visual image searching using Google Lens and Yandex Images.

### Tech Stack
- **Core Platform**: Chrome Extension Manifest V3
- **Languages**: Vanilla JavaScript (ES6+), HTML5, Vanilla CSS3
- **Design & Typography**: Modern glassmorphism dark theme (`backdrop-filter: blur`), Google Font ('Outfit'), SVG icons
- **Browser APIs**: `chrome.tabs`, `chrome.scripting`, `chrome.storage.local`, `chrome.commands`, `chrome.runtime`, `navigator.clipboard`
- **Canvas**: HTML5 Canvas 2D context for full-screen dimming, selection box drawing, and DPR-accurate image cropping

### Extension Component Architecture

```
[ Popup UI (popup.html / popup.js) ]
       │
       ▼ (chrome.runtime.sendMessage: 'start_capture')
[ Service Worker (background.js) ] ◄── (Alt+S shortcut: 'scan_area')
       │
       ├─► 1. Capture screen: chrome.tabs.captureVisibleTab
       ├─► 2. Inject styles/script: chrome.scripting.insertCSS & executeScript
       └─► 3. Send message: chrome.tabs.sendMessage ('init_crop', dataUrl)
              │
              ▼
       [ Injected Overlay (content.js / content.css) ]
              │
              ├─► Google Lens Selected ──► sendMessage ('perform_search', image)
              │                                    │
              │                                    ▼
              │                          [ Service Worker ]
              │                                    │
              │                                    ▼ (opens launcher tab)
              │                          [ Form Launcher (launcher.html / launcher.js) ]
              │                                    │ (POST multipart/form-data)
              │                                    ▼
              │                          https://lens.google.com/upload
              │
              └─► Yandex Selected ────────► Write PNG to Navigator Clipboard
                                                   │
                                                   ▼ (opens Yandex tab)
                                         https://yandex.com/images/
```

---

## Strict Coding Guidelines

### 1. Structure & Naming Conventions
- **JavaScript**:
  - `camelCase` for variables, function names, and state variables (`initCrop`, `performSearch`, `isDragging`, `startX`, `selection`).
  - `snake_case` for Chrome message action names (`'start_capture'`, `'init_crop'`, `'perform_search'`, `'open_url'`, `'scan_area'`) and storage keys (`tempSearchImage`, `searchEngine`).
  - 2-space indentation, explicit semicolons, single-quoted strings in JS.
- **HTML & CSS**:
  - `kebab-case` for class names (`.smart-search-overlay`, `.smart-search-toolbar`, `.scan-btn`) and HTML IDs (`#scan-btn`, `#yandex-hint`).
  - Dark mode glassmorphism UI variables defined in CSS `:root` (`--bg-color`, `--card-bg`, `--primary`, `--glass-border`).

### 2. Double-Injection Guard Pattern
Every content script MUST wrap its code in an injection guard check to prevent redeclaration errors when `chrome.scripting.executeScript` runs multiple times on the same tab:
```javascript
if (!window.smartSearchInjected) {
  window.smartSearchInjected = true;
  // All overlay and listener initialization logic here
}
```

### 3. DPR (Device Pixel Ratio) Scaling Math
When rendering screen captures on `<canvas>` or cropping sub-regions, ALWAYS account for HiDPI/Retina screens by scaling with `window.devicePixelRatio`:
```javascript
const dpr = window.devicePixelRatio || 1;
canvas.width = window.innerWidth * dpr;
canvas.height = window.innerHeight * dpr;

// Crop extraction
cropCanvas.width = selection.w * dpr;
cropCanvas.height = selection.h * dpr;
ctx.drawImage(
  screenshotImage,
  selection.x * dpr, selection.y * dpr, selection.w * dpr, selection.h * dpr,
  0, 0, selection.w * dpr, selection.h * dpr
);
```

### 4. Asynchronous Chrome API & Error Handling
- Check `chrome.runtime.lastError` in API callbacks.
- Use `try / catch` blocks for asynchronous web operations (`fetch`, `navigator.clipboard.write`).
- Provide user feedback (e.g., floating toast notifications) when fallback workflows occur.

---

## Primary Execution & Testing Commands

### 1. Loading into Chrome (Development Mode)
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** ON (top right).
3. Click **Load unpacked** and select the workspace directory (`Smart Search`).

### 2. Debugging Components
- **Service Worker Log**: Go to `chrome://extensions`, locate **Smart Search Image**, and click `service worker` under **Inspect views**.
- **Content Script / Overlay Log**: Open DevTools (`F12` or `Ctrl+Shift+I`) on any webpage being scanned.
- **Popup Log**: Right-click the extension toolbar icon -> select **Inspect Popup**.

### 3. Key Bindings & Shortcuts
- Default Shortcut: `Alt + S` (defined in `manifest.json` under `scan_area`).
- Manage Shortcuts: Navigate to `chrome://extensions/shortcuts` to rebind.

---

## Important Constraints & Pitfalls (Don'ts)

1. ❌ **DON'T remove the `window.smartSearchInjected` check**: Deleting this will cause `Uncaught SyntaxError: Identifier '...' has already been declared` when re-invoking screen capture.
2. ❌ **DON'T use inline event handlers or inline scripts in extension HTML**: Manifest V3 strictly forbids inline JavaScript in `.html` files (`popup.html`, `launcher.html`). Always bind events in external `.js` files.
3. ❌ **DON'T store persistent state in `background.js` variables**: Manifest V3 service workers shut down when idle. Always persist settings or transient data in `chrome.storage.local`.
4. ❌ **DON'T perform direct background `fetch` for Google Lens upload**: Google Lens upload requires form submission behavior. Use the hidden `<form>` submit inside `launcher.html` to avoid CORS and bot verification blocks.
5. ❌ **DON'T forget cleanup in `chrome.storage.local`**: Clear transient storage keys (such as `tempSearchImage`) immediately after consumption to prevent stale state.
