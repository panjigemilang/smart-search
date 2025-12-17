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

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['tempSearchImage', 'searchEngine'], (data) => {
    if (!data.tempSearchImage) {
      document.body.innerHTML = '<h2>Error: No image info found.</h2>';
      return;
    }

    const blob = dataURItoBlob(data.tempSearchImage);
    const file = new File([blob], "screenshot.jpg", { type: "image/jpeg" });
    const dt = new DataTransfer();
    dt.items.add(file);
    const fileList = dt.files;

    const form = document.createElement('form');
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    form.style.display = 'none';

    // Different endpoints based on engine
    if (data.searchEngine === 'yandex') {
        form.action = 'https://yandex.com/images/search?rpt=imageview';
        // Yandex expects the file input name to be 'upfile'
        const input = document.createElement('input');
        input.type = 'file';
        input.name = 'upfile'; // Yandex specific
        input.files = fileList;
        form.appendChild(input);
    } else {
        // Default Google Lens
        form.action = 'https://lens.google.com/upload?ep=cc&s=&st=' + Date.now();
        const input = document.createElement('input');
        input.type = 'file';
        input.name = 'encoded_image'; // Google specific
        input.files = fileList;
        form.appendChild(input);
    }

    document.body.appendChild(form);
    
    // Clear storage to free memory
    chrome.storage.local.remove('tempSearchImage');

    form.submit();
  });
});
