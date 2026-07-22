if (!window.smartSearchInjected) {
  window.smartSearchInjected = true;

  let overlay = null;
  let canvas = null;
  let ctx = null;
  let toolbar = null;
  let screenshotImage = null;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let selection = { x: 0, y: 0, w: 0, h: 0 };

  // Listeners
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'init_crop') {
      initCrop(request.image);
      sendResponse({ status: 'ok' });
    }
    return true;
  });

  function createOverlay() {
    if (overlay) return; // Prevent duplicates if logic fails
    
    overlay = document.createElement('div');
    overlay.className = 'smart-search-overlay';
    
    canvas = document.createElement('canvas');
    canvas.className = 'smart-search-canvas';
    overlay.appendChild(canvas);
    
    // Create Toolbar with Icon buttons
    toolbar = document.createElement('div');
    toolbar.className = 'smart-search-toolbar';
    toolbar.style.display = 'none'; // hidden initially
    
    // SVGs
    const checkIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const closeIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    const translateIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6M4 14l6-6 2 2M2 5h12M7 2v3M22 22l-5-10-5 10M14 18h6"/></svg>`;

    const searchBtn = document.createElement('button');
    searchBtn.className = 'primary';
    searchBtn.innerHTML = checkIcon;
    searchBtn.title = 'Search';
    searchBtn.onclick = performSearch;

    const translateBtn = document.createElement('button');
    translateBtn.className = 'translate';
    translateBtn.innerHTML = translateIcon;
    translateBtn.title = 'Translate Text';
    translateBtn.onclick = performTranslate;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.innerHTML = closeIcon;
    cancelBtn.title = 'Close';
    cancelBtn.onclick = closeOverlay;
    
    toolbar.appendChild(cancelBtn);
    toolbar.appendChild(translateBtn);
    toolbar.appendChild(searchBtn);
    overlay.appendChild(toolbar);
    
    // Dimensions label
    const dimLabel = document.createElement('div');
    dimLabel.className = 'smart-search-dimensions';
    dimLabel.style.display = 'none';
    overlay.appendChild(dimLabel);
    
    document.body.appendChild(overlay);
    
    ctx = canvas.getContext('2d');
    
    // Events
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      closeOverlay();
    }
  }

  function initCrop(dataUrl) {
    // Ensure overlay is created
    if (!overlay) createOverlay();
    
    screenshotImage = new Image();
    screenshotImage.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      // Update canvas size
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      
      // Reset transform before scaling to avoid accumulating scales if re-using context
      ctx.setTransform(1, 0, 0, 1, 0, 0); 
      ctx.scale(dpr, dpr);
      
      // Show overlay
      overlay.style.display = 'block';
      
      // Reset selection and UI
      selection = { x: 0, y: 0, w: 0, h: 0 };
      if (toolbar) {
          toolbar.style.display = 'none';
          toolbar.style.left = '50%'; // Reset to default center if needed, or keeping it hidden is enough
          toolbar.style.top = '';     // Clear top override
          toolbar.style.bottom = '30px'; // Reset to default bottom
          toolbar.style.transform = 'translateX(-50%)';
      }
      
      const dim = document.querySelector('.smart-search-dimensions');
      if (dim) dim.style.display = 'none';
      
      draw();
    };
    screenshotImage.src = dataUrl;
  }

  function draw() {
    if (!ctx || !screenshotImage) return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // 1. Draw Background (Darkened)
    ctx.drawImage(screenshotImage, 0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);
    
    // 2. Draw Selection (Clear)
    if (selection.w > 0 && selection.h > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(selection.x, selection.y, selection.w, selection.h);
      ctx.clip();
      // Draw original image clearly
      ctx.drawImage(screenshotImage, 0, 0, width, height);
      ctx.restore();
      
      // Dotted Border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]); // Dashed
      ctx.strokeRect(selection.x, selection.y, selection.w, selection.h);
      ctx.setLineDash([]); // Reset
      
      // Dimensions
      const dimLabel = document.querySelector('.smart-search-dimensions');
      if (dimLabel) {
        dimLabel.style.display = 'block';
        dimLabel.style.left = selection.x + 'px';
        // If close to top, show below?
        let top = selection.y - 30;
        if (top < 0) top = selection.y + 10;
        dimLabel.style.top = top + 'px';
        dimLabel.innerText = `${Math.round(selection.w)} x ${Math.round(selection.h)}`;
      }
    }
  }

  function onMouseDown(e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selection = { x: startX, y: startY, w: 0, h: 0 };
    toolbar.style.display = 'none';
    draw();
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    let w = currentX - startX;
    let h = currentY - startY;
    
    // Handle dragging backwards
    let x = startX;
    let y = startY;
    
    if (w < 0) {
      x = currentX;
      w = Math.abs(w);
    }
    
    if (h < 0) {
      y = currentY;
      h = Math.abs(h);
    }
    
    selection = { x, y, w, h };
    draw();
  }

  function onMouseUp(e) {
    if (isDragging) {
      isDragging = false;
      if (selection.w > 10 && selection.h > 10) {
        // Show toolbar near selection
        toolbar.style.display = 'flex';
        
        const toolbarHeight = 50;
        const toolbarHalfWidth = 100; // Half width (~200px / 2)
        
        // Vertical position: prefer below selection, fallback to above
        let top = selection.y + selection.h + 10;
        if (top + toolbarHeight > window.innerHeight) {
          top = selection.y - toolbarHeight - 10;
        }
        // Clamp top strictly inside viewport boundaries [10px, window.innerHeight - toolbarHeight - 10px]
        top = Math.max(10, Math.min(top, window.innerHeight - toolbarHeight - 10));
        toolbar.style.top = top + 'px';
        
        // Horizontal position: center of selection, clamped within viewport boundaries
        let left = selection.x + (selection.w / 2);
        left = Math.max(toolbarHalfWidth + 10, Math.min(left, window.innerWidth - toolbarHalfWidth - 10));
        toolbar.style.transform = 'translateX(-50%)'; 
        toolbar.style.left = left + 'px';
      }
    }
  }

  function performSearch() {
    if (selection.w <= 0 || selection.h <= 0) return;
    
    const dpr = window.devicePixelRatio || 1;
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = selection.w * dpr;
    cropCanvas.height = selection.h * dpr;
    const cctx = cropCanvas.getContext('2d');
    
    cctx.drawImage(
      screenshotImage,
      selection.x * dpr, selection.y * dpr, selection.w * dpr, selection.h * dpr,
      0, 0, selection.w * dpr, selection.h * dpr
    );
    
    const croppedDataUrl = cropCanvas.toDataURL('image/jpeg');
    
    // Check engine setting
    chrome.storage.local.get(['searchEngine'], (result) => {
        const engine = result.searchEngine || 'google';
        
        if (engine === 'yandex') {
            // Use PNG for maximal clipboard compatibility
            cropCanvas.toBlob(async (blob) => {
                try {
                    // Ensure window is focused for clipboard access
                    window.focus();
                    
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            'image/png': blob
                        })
                    ]);
                    
                    // Show success toast
                    showToast('Image Copied! Press Ctrl+V in the new tab.');
                    
                } catch (err) {
                    console.error('Clipboard write failed', err);
                    showToast('Copy failed. Please manually drag the image or use Google Lens.', true);
                }
                
                // Open Yandex regardless after delay
                setTimeout(() => {
                    chrome.runtime.sendMessage({
                        action: 'open_url',
                        url: 'https://yandex.com/images/'
                    });
                }, 1500);
            }, 'image/png');

        } else {
            // Google Lens (Automated)
            chrome.runtime.sendMessage({
                action: 'perform_search',
                image: croppedDataUrl
            });
        }
    });

    closeOverlay();
  }

  async function performTranslate() {
    if (selection.w <= 0 || selection.h <= 0) return;
    
    const dpr = window.devicePixelRatio || 1;
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = selection.w * dpr;
    cropCanvas.height = selection.h * dpr;
    const cctx = cropCanvas.getContext('2d');
    
    cctx.drawImage(
      screenshotImage,
      selection.x * dpr, selection.y * dpr, selection.w * dpr, selection.h * dpr,
      0, 0, selection.w * dpr, selection.h * dpr
    );
    
    const croppedDataUrl = cropCanvas.toDataURL('image/jpeg', 0.9);
    closeOverlay();

    const loadingToast = showToast('🔍 Analyzing image and extracting text...', false, true);

    try {
      const ocrResult = await doOcrParse(croppedDataUrl);
      if (loadingToast && loadingToast.remove) loadingToast.remove();

      if (!ocrResult || !ocrResult.lines || ocrResult.lines.length === 0) {
        if (ocrResult && ocrResult.fullText) {
          const initialTranslation = await fetchTranslation(ocrResult.fullText, 'en');
          showTranslationModal(ocrResult.fullText, initialTranslation, 'en');
        } else {
          showNoTextModal(croppedDataUrl);
        }
        return;
      }

      showLensTranslateViewer(croppedDataUrl, cropCanvas.width, cropCanvas.height, ocrResult.lines, 'en');

    } catch (err) {
      console.error('OCR / Translate failed:', err);
      if (loadingToast && loadingToast.remove) loadingToast.remove();
      showToast('OCR extraction failed. Opening Google Lens Translate...', true);
      chrome.runtime.sendMessage({
        action: 'perform_translate',
        image: croppedDataUrl
      });
    }
  }

  async function doOcrParse(croppedDataUrl) {
    const parseResult = (data) => {
      if (!data || !data.ParsedResults || data.ParsedResults.length === 0) return null;
      const res = data.ParsedResults[0];
      const fullText = (res.ParsedText || '').trim();
      const lines = [];

      if (res.TextOverlay && res.TextOverlay.Lines) {
        for (const line of res.TextOverlay.Lines) {
          const text = (line.LineText || '').trim();
          if (text) {
            lines.push({
              text: text,
              left: line.Left || 0,
              top: line.MinTop || 0,
              width: line.Width || 0,
              height: line.MaxHeight || 0
            });
          }
        }
      }

      return { fullText, lines };
    };

    // Pass 1: Engine 2 with auto language detection & TextOverlay
    try {
      const formData = new URLSearchParams();
      formData.append('base64Image', croppedDataUrl);
      formData.append('OCREngine', '2');
      formData.append('language', 'auto');
      formData.append('scale', 'true');
      formData.append('detectOrientation', 'true');
      formData.append('isOverlayRequired', 'true');

      const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          'apikey': 'helloworld',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      const data = await res.json();
      const result = parseResult(data);
      if (result && (result.lines.length > 0 || result.fullText)) return result;
    } catch (e) {
      console.warn('OCR Engine 2 auto-detect failed:', e);
    }

    // Pass 2: Engine 1 fallback with Japanese (jpn)
    try {
      const formData = new URLSearchParams();
      formData.append('base64Image', croppedDataUrl);
      formData.append('OCREngine', '1');
      formData.append('language', 'jpn');
      formData.append('scale', 'true');
      formData.append('isOverlayRequired', 'true');

      const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          'apikey': 'helloworld',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      const data = await res.json();
      const result = parseResult(data);
      if (result && (result.lines.length > 0 || result.fullText)) return result;
    } catch (e) {
      console.warn('OCR Engine 1 fallback failed:', e);
    }

    return null;
  }

  async function fetchTranslation(text, targetLang) {
    if (!text) return '';
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data[0]) {
        return data[0].map(item => item[0]).filter(Boolean).join(' ');
      }
    } catch (err) {
      console.error('Translation fetch failed:', err);
    }
    return '';
  }

  async function showLensTranslateViewer(croppedDataUrl, imgWidth, imgHeight, lines, initialLang = 'en') {
    const existing = document.querySelector('.smart-search-lens-overlay, .smart-search-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'smart-search-lens-overlay';

    const viewer = document.createElement('div');
    viewer.className = 'smart-search-lens-viewer';

    const closeIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    viewer.innerHTML = `
      <div class="smart-search-lens-header">
        <div class="smart-search-lens-title">
          <span>✨ Lens Translate</span>
        </div>
        <div class="smart-search-lens-controls">
          <select class="smart-search-lang-select" id="lens-lang-select">
            <option value="en" ${initialLang === 'en' ? 'selected' : ''}>Translate to English</option>
            <option value="id" ${initialLang === 'id' ? 'selected' : ''}>Translate to Indonesian</option>
            <option value="es" ${initialLang === 'es' ? 'selected' : ''}>Translate to Spanish</option>
            <option value="ja" ${initialLang === 'ja' ? 'selected' : ''}>Translate to Japanese</option>
            <option value="zh-CN" ${initialLang === 'zh-CN' ? 'selected' : ''}>Translate to Chinese</option>
            <option value="fr" ${initialLang === 'fr' ? 'selected' : ''}>Translate to French</option>
            <option value="de" ${initialLang === 'de' ? 'selected' : ''}>Translate to German</option>
          </select>
          <button class="smart-search-btn smart-search-btn-secondary" id="lens-toggle-btn" style="padding: 6px 12px; font-size: 12px;">Show Original</button>
          <button class="smart-search-btn smart-search-btn-secondary" id="lens-google-btn" style="padding: 6px 12px; font-size: 12px;">🔍 Google Lens</button>
          <button class="smart-search-modal-close" id="lens-close-btn" title="Close">${closeIcon}</button>
        </div>
      </div>
      <div class="smart-search-lens-body">
        <div class="smart-search-lens-img-wrapper" id="lens-img-wrapper">
          <img src="${croppedDataUrl}" alt="Cropped Image" id="lens-main-img">
        </div>
      </div>
      <div class="smart-search-lens-footer">
        <div class="lens-detail-text" id="lens-detail-box">
          <span>Click or hover any text pill on the image to view original & copy.</span>
        </div>
        <button class="smart-search-btn smart-search-btn-secondary" id="lens-copy-all-btn" style="padding: 6px 14px; font-size: 12px;">📋 Copy All Text</button>
      </div>
    `;

    overlay.appendChild(viewer);
    document.body.appendChild(overlay);

    const imgWrapper = viewer.querySelector('#lens-img-wrapper');
    const mainImg = viewer.querySelector('#lens-main-img');
    const langSelect = viewer.querySelector('#lens-lang-select');
    const toggleBtn = viewer.querySelector('#lens-toggle-btn');
    const googleBtn = viewer.querySelector('#lens-google-btn');
    const closeBtn = viewer.querySelector('#lens-close-btn');
    const detailBox = viewer.querySelector('#lens-detail-box');
    const copyAllBtn = viewer.querySelector('#lens-copy-all-btn');

    closeBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    let isOriginalMode = false;
    let translatedPillsData = [];

    const renderPills = async (targetLang) => {
      imgWrapper.querySelectorAll('.lens-text-pill').forEach(p => p.remove());
      translatedPillsData = [];

      detailBox.innerHTML = `<span>Translating ${lines.length} text regions to <strong>${targetLang.toUpperCase()}</strong>...</span>`;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const translation = await fetchTranslation(line.text, targetLang);
        
        translatedPillsData.push({
          original: line.text,
          translated: translation || line.text,
          line: line
        });

        const leftPct = (line.left / imgWidth) * 100;
        const topPct = (line.top / imgHeight) * 100;
        const widthPct = Math.max((line.width / imgWidth) * 100, 6);
        const heightPct = Math.max((line.height / imgHeight) * 100, 4);

        const pill = document.createElement('div');
        pill.className = 'lens-text-pill';
        pill.dataset.index = i;
        pill.style.left = leftPct.toFixed(2) + '%';
        pill.style.top = topPct.toFixed(2) + '%';
        pill.style.minWidth = widthPct.toFixed(2) + '%';
        pill.style.minHeight = heightPct.toFixed(2) + '%';

        const fontSizePx = Math.max(11, Math.min(22, (line.height / imgHeight) * (mainImg.clientHeight || 400) * 0.75));
        pill.style.fontSize = Math.round(fontSizePx) + 'px';

        pill.innerText = translation || line.text;
        pill.style.display = isOriginalMode ? 'none' : 'flex';

        const updateDetail = () => {
          imgWrapper.querySelectorAll('.lens-text-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          detailBox.innerHTML = `
            <span><strong>Original:</strong> ${escapeHtml(line.text)}</span>
            <span><strong>Translated:</strong> ${escapeHtml(translation || line.text)}</span>
          `;
        };

        pill.onmouseenter = updateDetail;
        pill.onclick = updateDetail;

        imgWrapper.appendChild(pill);
      }

      detailBox.innerHTML = `<span>Hover or click any text pill above on the image to view details.</span>`;
    };

    mainImg.onload = () => renderPills(initialLang);
    if (mainImg.complete) renderPills(initialLang);

    langSelect.onchange = () => {
      renderPills(langSelect.value);
    };

    toggleBtn.onclick = () => {
      isOriginalMode = !isOriginalMode;
      toggleBtn.innerText = isOriginalMode ? 'Show Translated' : 'Show Original';
      imgWrapper.querySelectorAll('.lens-text-pill').forEach((pill) => {
        pill.style.display = isOriginalMode ? 'none' : 'flex';
      });
    };

    googleBtn.onclick = () => {
      chrome.runtime.sendMessage({
        action: 'perform_translate',
        image: croppedDataUrl
      });
      overlay.remove();
    };

    copyAllBtn.onclick = async () => {
      const allText = translatedPillsData.map(d => isOriginalMode ? d.original : d.translated).join('\n');
      if (allText) {
        await navigator.clipboard.writeText(allText);
        showToast('All text copied to clipboard!');
      }
    };
  }

  function showTranslationModal(originalText, translatedText, currentLang = 'en') {
    const existing = document.querySelector('.smart-search-modal-overlay');
    if (existing) existing.remove();

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'smart-search-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'smart-search-modal';

    const closeIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    modal.innerHTML = `
      <div class="smart-search-modal-header">
        <h3>Smart Translate</h3>
        <button class="smart-search-modal-close" id="st-close-btn" title="Close">${closeIcon}</button>
      </div>
      <div class="smart-search-field-group">
        <label>Extracted Text (Selectable / Editable)</label>
        <textarea class="smart-search-textarea" id="st-original-text" placeholder="Extracted text...">${escapeHtml(originalText)}</textarea>
      </div>
      <div class="smart-search-field-group">
        <label>
          <span>Translation</span>
          <select class="smart-search-lang-select" id="st-lang-select">
            <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English (en)</option>
            <option value="id" ${currentLang === 'id' ? 'selected' : ''}>Indonesian (id)</option>
            <option value="es" ${currentLang === 'es' ? 'selected' : ''}>Spanish (es)</option>
            <option value="ja" ${currentLang === 'ja' ? 'selected' : ''}>Japanese (ja)</option>
            <option value="zh-CN" ${currentLang === 'zh-CN' ? 'selected' : ''}>Chinese (zh)</option>
            <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>French (fr)</option>
            <option value="de" ${currentLang === 'de' ? 'selected' : ''}>German (de)</option>
          </select>
        </label>
        <textarea class="smart-search-textarea" id="st-translated-text" readonly placeholder="Translating...">${escapeHtml(translatedText)}</textarea>
      </div>
      <div class="smart-search-modal-actions">
        <button class="smart-search-btn smart-search-btn-secondary" id="st-copy-btn">📋 Copy Text</button>
        <button class="smart-search-btn smart-search-btn-primary" id="st-google-btn">🌐 Open in Google Translate</button>
      </div>
    `;

    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);

    const closeBtn = modal.querySelector('#st-close-btn');
    const originalInput = modal.querySelector('#st-original-text');
    const translatedInput = modal.querySelector('#st-translated-text');
    const langSelect = modal.querySelector('#st-lang-select');
    const copyBtn = modal.querySelector('#st-copy-btn');
    const googleBtn = modal.querySelector('#st-google-btn');

    closeBtn.onclick = () => modalOverlay.remove();
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) modalOverlay.remove(); };

    const updateTranslation = async () => {
      const text = originalInput.value.trim();
      const lang = langSelect.value;
      if (text) {
        translatedInput.value = 'Translating...';
        const newTrans = await fetchTranslation(text, lang);
        translatedInput.value = newTrans;
      } else {
        translatedInput.value = '';
      }
    };

    langSelect.onchange = updateTranslation;
    let debounceTimer;
    originalInput.oninput = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateTranslation, 400);
    };

    copyBtn.onclick = async () => {
      const textToCopy = translatedInput.value || originalInput.value;
      if (textToCopy) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          showToast('Text copied to clipboard!');
        } catch (e) {
          showToast('Failed to copy text', true);
        }
      }
    };

    googleBtn.onclick = () => {
      const text = originalInput.value.trim();
      const lang = langSelect.value;
      const url = `https://translate.google.com/?sl=auto&tl=${lang}&text=${encodeURIComponent(text)}&op=translate`;
      chrome.runtime.sendMessage({ action: 'open_url', url: url });
      modalOverlay.remove();
    };
  }

  function showNoTextModal(croppedDataUrl) {
    const existing = document.querySelector('.smart-search-modal-overlay');
    if (existing) existing.remove();

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'smart-search-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'smart-search-modal';

    const closeIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    modal.innerHTML = `
      <div class="smart-search-modal-header">
        <h3>No Text Detected</h3>
        <button class="smart-search-modal-close" id="st-close-btn">${closeIcon}</button>
      </div>
      <p style="color: #cbd5e1; font-size: 14px; margin: 8px 0 16px; line-height: 1.5;">
        No readable text was detected in the selected cropped area. You can try selecting an area with clearer text or open the image in Google Lens Translate.
      </p>
      <div class="smart-search-modal-actions">
        <button class="smart-search-btn smart-search-btn-secondary" id="st-cancel-btn">Close</button>
        <button class="smart-search-btn smart-search-btn-primary" id="st-lens-btn">🔍 Open in Google Lens</button>
      </div>
    `;

    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);

    modal.querySelector('#st-close-btn').onclick = () => modalOverlay.remove();
    modal.querySelector('#st-cancel-btn').onclick = () => modalOverlay.remove();
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) modalOverlay.remove(); };

    modal.querySelector('#st-lens-btn').onclick = () => {
      chrome.runtime.sendMessage({
        action: 'perform_translate',
        image: croppedDataUrl
      });
      modalOverlay.remove();
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(message, isError = false, isPersistent = false) {
      const toast = document.createElement('div');
      toast.style.position = 'fixed';
      toast.style.top = '20%';
      toast.style.left = '50%';
      toast.style.transform = 'translate(-50%, -50%)';
      toast.style.background = isError ? 'rgba(220, 38, 38, 0.9)' : 'rgba(15, 23, 42, 0.95)';
      toast.style.color = '#fff';
      toast.style.padding = '12px 24px';
      toast.style.borderRadius = '50px';
      toast.style.zIndex = '2147483647';
      toast.style.fontFamily = 'system-ui, sans-serif';
      toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
      toast.style.border = '1px solid rgba(255,255,255,0.15)';
      toast.style.textAlign = 'center';
      toast.style.fontSize = '14px';
      toast.style.fontWeight = '500';
      toast.innerText = message;
      document.body.appendChild(toast);
      if (!isPersistent) {
        setTimeout(() => toast.remove(), 4000);
      }
      return toast;
  }

  function closeOverlay() {
    if (overlay) {
      overlay.style.display = 'none';
      if (toolbar) {
          toolbar.style.display = 'none';
      }
    }
  }
}
