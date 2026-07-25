// content.js
// Runs on every page. Watches for clicks while recording is active, and sends
// each one to the background service worker to be screenshotted and saved.
(function () {
  let isRecording = false;

  chrome.storage.local.get(['isRecording'], (result) => {
    isRecording = !!result.isRecording;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.isRecording) {
      isRecording = changes.isRecording.newValue;
    }
  });

  // Walk up a few levels to find the nearest "clickable" ancestor, so a click
  // on an icon inside a <button> is described as the button, not the icon.
  function findLabelTarget(el) {
    let node = el;
    for (let i = 0; i < 3 && node; i++) {
      if (['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)) {
        return node;
      }
      node = node.parentElement;
    }
    return el;
  }

  function describeElement(el) {
    const aria = el.getAttribute('aria-label');
    if (aria) return `Click "${aria.trim()}"`;

    const title = el.getAttribute('title');
    if (title) return `Click "${title.trim()}"`;

    if (el.tagName === 'IMG' && el.alt) {
      return `Click the "${el.alt.trim()}" image`;
    }

    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.placeholder) {
      return `Click the "${el.placeholder.trim()}" field`;
    }

    const text = (el.innerText || el.value || '').trim().replace(/\s+/g, ' ');
    if (text) {
      const short = text.length > 50 ? text.slice(0, 47) + '...' : text;
      return `Click "${short}"`;
    }

    return `Click the ${el.tagName.toLowerCase()} element`;
  }

  document.addEventListener(
    'click',
    (event) => {
      if (!isRecording) return;

      const target = findLabelTarget(event.target);
      const rect = target.getBoundingClientRect();

      const step = {
        caption: describeElement(target),
        url: location.href,
        pageTitle: document.title,
        timestamp: Date.now(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      };

      chrome.runtime.sendMessage({ type: 'CAPTURE_STEP', step });
    },
    true // capture phase, so this fires even if the page stops propagation
  );
})();
