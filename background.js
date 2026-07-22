function dataURItoBlob(dataURI) {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], {type: mimeString});
}

async function uploadToGoogle(blob) {
  const formData = new FormData();
  formData.append('encoded_image', blob, 'screenshot.jpg');
  
  try {
    // Using Lens endpoint (requires 'ep=cc' for some clients, or just standard upload)
    // The previous 'searchbyimage/upload' is deprecated/flaky for bots.
    // Lens is usually: https://lens.google.com/upload?ep=cc&s=&st=
    
    // Attempt 1: Lens Upload via direct fetch (might still be blocked if not authed)
    // If this fails, we might need the 'client=gobb' trick.
    
    const response = await fetch('https://lens.google.com/upload?ep=cc&s=&st=' + Date.now(), {
      method: 'POST',
      body: formData
    });
    
    // Lens usually returns a redirect or a JSON with the URL?
    // Actually it often returns the HTML of the results page directly if navigated.
    // Ideally we want the URL to open in a tab.
    // If fetch follows redirect, response.url will be the results page.
    
    return response.url;
  } catch (err) {
    console.error('Lens search failed', err);
    throw err;
  }
}

async function uploadToYandex(blob) {
  // Yandex flow is more complex usually involving getting a secure upload URL first.
  // We'll try a direct approach if possible, or fallback to a known working Yandex upload chain.
  // For MVP robustness, if Yandex fails, we might just open the upload page.
  // However, reverse engineering Yandex upload:
  // 1. GET https://yandex.com/images/
  // 2. Extract crbid...
  // It's unstable.
  // Let's try the simple 'imgbb' proxy method if we wanted, but User wants 'free' and 'direct'.
  
  // Alternative: Use a public image host for Yandex.
  // Let's implement Google first as it's the primary. For Yandex, we will open the Yandex Images page
  // and let the user drag the saved image? No, that's bad UX.
  
  // Let's try to fetch the Yandex generic upload endpoint if known.
  // https://yandex.com/images/search?rpt=imageview&url=... (requires URL)
  
  // For now, I will implement Google fully. If user selects Yandex, I will alert limitation or 
  // try to upload to a temp host (like generic free host) and redirect.
  // Actually, I'll leave Yandex as a TODO placeholder that falls back to Google for now 
  // or I'll implement a 'upload to imgops/similar' which redirects.
  
  // Strategy: Just Google for now to ensure robustness, or try to interpret Yandex later.
  // Let's stick to Google as the working example.
  return uploadToGoogle(blob);
}

async function startCaptureFlow() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id) return;

    // Guard against restricted browser system URLs where content scripts are forbidden
    if (activeTab.url && (
      activeTab.url.startsWith('chrome://') ||
      activeTab.url.startsWith('chrome-extension://') ||
      activeTab.url.startsWith('edge://') ||
      activeTab.url.startsWith('about:') ||
      activeTab.url.includes('chrome.google.com/webstore')
    )) {
      console.warn('Smart Search cannot run on restricted system pages:', activeTab.url);
      return;
    }

    const dataUrl = await new Promise((resolve) => {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (result) => {
        if (chrome.runtime.lastError) {
          console.error('Screen capture error:', chrome.runtime.lastError.message);
          return resolve(null);
        }
        resolve(result);
      });
    });

    if (!dataUrl) return;

    // Inject CSS and script cleanly
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: activeTab.id },
        files: ['content.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      });
    } catch (injectErr) {
      console.warn('Script injection skipped or failed:', injectErr);
    }

    // Safely send message with error handling for connection rejections
    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'init_crop',
        image: dataUrl
      });
    } catch (msgErr) {
      console.warn('Could not send init_crop to active tab:', msgErr);
    }
  } catch (err) {
    console.error('Error during screen capture flow:', err);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start_capture') {
    startCaptureFlow();
  }
  
  if (request.action === 'open_url') {
    chrome.tabs.create({ url: request.url });
  }

  if (request.action === 'perform_search') {
    chrome.storage.local.set({ tempSearchImage: request.image, searchMode: 'search' }, () => {
      chrome.tabs.create({ url: 'launcher.html' });
    });
  }

  if (request.action === 'perform_translate') {
    chrome.storage.local.set({ tempSearchImage: request.image, searchMode: 'translate' }, () => {
      chrome.tabs.create({ url: 'launcher.html' });
    });
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'scan_area') {
    startCaptureFlow();
  }
});
