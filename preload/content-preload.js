const { ipcRenderer } = require('electron');

// Runs in the browsing pane (the content BrowserView). Watches every click
// and forwards it to the main process; main decides whether step-guide
// recording is actually on and takes the screenshot itself via
// event.sender.capturePage() (no chrome extension APIs needed at all here —
// that's the whole point of moving this out of a browser extension and into
// a BrowserView we own directly).

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

window.addEventListener(
  'click',
  (event) => {
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

    ipcRenderer.invoke('step:capture', step);
  },
  true
);
