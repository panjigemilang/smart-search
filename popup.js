document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scan-btn');
  const radios = document.querySelectorAll('input[name="engine"]');

  // Load saved settings
  chrome.storage.local.get(['searchEngine'], (result) => {
    if (result.searchEngine) {
      const radio = document.querySelector(`input[value="${result.searchEngine}"]`);
      if (radio) radio.checked = true;
    }
  });

  // Save settings on change
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        chrome.storage.local.set({ searchEngine: e.target.value });
      }
    });
  });

  // Start Scan
  scanBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'start_capture' });
    window.close(); // Close popup
  });
});
