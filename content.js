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
    }
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

    const searchBtn = document.createElement('button');
    searchBtn.className = 'primary';
    searchBtn.innerHTML = checkIcon;
    searchBtn.title = 'Search';
    searchBtn.onclick = performSearch;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.innerHTML = closeIcon;
    cancelBtn.title = 'Close';
    cancelBtn.onclick = closeOverlay;
    
    toolbar.appendChild(cancelBtn);
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
        // Position toolbar logic (avoid going off screen)
        let top = selection.y + selection.h + 10;
        if (top + 60 > window.innerHeight) {
          top = selection.y - 60;
        }
        toolbar.style.top = top + 'px';
        
        let left = selection.x + (selection.w / 2);
        // Center toolbar
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

  function showToast(message, isError = false) {
      const toast = document.createElement('div');
      toast.style.position = 'fixed';
      toast.style.top = '20%';
      toast.style.left = '50%';
      toast.style.transform = 'translate(-50%, -50%)';
      toast.style.background = isError ? 'rgba(220, 38, 38, 0.9)' : 'rgba(15, 23, 42, 0.9)';
      toast.style.color = '#fff';
      toast.style.padding = '12px 24px';
      toast.style.borderRadius = '50px';
      toast.style.zIndex = '2147483647';
      toast.style.fontFamily = 'system-ui, sans-serif';
      toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
      toast.style.border = '1px solid rgba(255,255,255,0.1)';
      toast.style.textAlign = 'center';
      toast.style.fontSize = '14px';
      toast.style.fontWeight = '500';
      toast.innerText = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
  }

  function closeOverlay() {
    if (overlay) {
      overlay.style.display = 'none';
      // Force hide toolbar on close so it doesn't persist
      if (toolbar) {
          toolbar.style.display = 'none';
      }
    }
  }
}
