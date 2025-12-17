document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scan-btn');
  const radios = document.querySelectorAll('input[name="engine"]');

  // Load saved settings
  chrome.storage.local.get(['searchEngine'], (result) => {
    if (result.searchEngine) {
      const radio = document.querySelector(`input[value="${result.searchEngine}"]`);
      if (radio) radio.checked = true;
      updateToggles(result.searchEngine); // Call updateToggles after loading settings
    } else {
      // If no engine is saved, check the default (e.g., the first one) and update toggles
      if (radios.length > 0) {
        radios[0].checked = true;
        updateToggles(radios[0].value);
      }
    }
  });

  // Helper function to update toggle styles and hints
  function updateToggles(selectedEngine) {
    // Assuming 'toggles' refers to the radio buttons or their containers
    // If there are actual toggle switch elements, 'toggles' would need to be defined
    // For now, we'll assume it's related to the radio buttons themselves or their visual representation.
    // The original snippet for updateToggles seems to imply a structure like:
    // const toggles = document.querySelectorAll('.toggle-switch');
    // Since 'toggles' is not defined in the original document, I'll adapt the hint part.

    // Update radio button styles if needed (based on the original snippet's intent)
    radios.forEach(radio => {
      const isChecked = radio.value === selectedEngine;
      // If there were associated sliders or visual elements, their styles would be updated here.
      // For example, if each radio button had a parent div with class 'toggle-switch'
      // and a child with class 'slider', the logic from the snippet would apply.
      // As the original document doesn't show this structure, I'll focus on the hint.
    });

    // Show hint for Yandex
    const hint = document.getElementById('yandex-hint');
    if (hint) {
        hint.style.display = selectedEngine === 'yandex' ? 'block' : 'none';
    }
  }

  // Save settings on change
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        chrome.storage.local.set({ searchEngine: e.target.value });
        updateToggles(e.target.value); // Call updateToggles on change
      }
    });
  });

  // Start Scan
  scanBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'start_capture' });
    window.close(); // Close popup
  });
});
