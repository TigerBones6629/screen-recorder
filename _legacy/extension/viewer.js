const stepsContainer = document.getElementById('steps');

function renderSteps(steps) {
  stepsContainer.innerHTML = '';

  if (!steps.length) {
    stepsContainer.innerHTML =
      '<p class="empty">No steps captured yet. Start recording from the extension popup and click through your workflow.</p>';
    return;
  }

  steps.forEach((step, index) => {
    const card = document.createElement('section');
    card.className = 'step-card';

    const heading = document.createElement('h2');
    heading.textContent = `Step ${index + 1}`;
    card.appendChild(heading);

    const captionInput = document.createElement('input');
    captionInput.className = 'caption';
    captionInput.value = step.caption;
    captionInput.addEventListener('change', () => updateCaption(index, captionInput.value));
    card.appendChild(captionInput);

    const frame = document.createElement('div');
    frame.className = 'screenshot-frame';

    const img = document.createElement('img');
    img.src = step.screenshot;
    frame.appendChild(img);

    if (step.box && step.viewport) {
      const highlight = document.createElement('div');
      highlight.className = 'highlight-box';
      highlight.style.left = (step.box.x / step.viewport.width) * 100 + '%';
      highlight.style.top = (step.box.y / step.viewport.height) * 100 + '%';
      highlight.style.width = (step.box.width / step.viewport.width) * 100 + '%';
      highlight.style.height = (step.box.height / step.viewport.height) * 100 + '%';
      frame.appendChild(highlight);
    }

    card.appendChild(frame);

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = step.pageTitle || step.url;
    card.appendChild(meta);

    stepsContainer.appendChild(card);
  });
}

function updateCaption(index, value) {
  chrome.storage.local.get(['steps'], ({ steps }) => {
    steps[index].caption = value;
    chrome.storage.local.set({ steps });
  });
}

function load() {
  chrome.storage.local.get(['steps'], ({ steps }) => {
    renderSteps(steps || []);
  });
}

document.getElementById('printBtn').addEventListener('click', () => window.print());

document.getElementById('exportHtmlBtn').addEventListener('click', () => {
  chrome.storage.local.get(['steps'], ({ steps }) => {
    const html = buildExportHtml(steps || []);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'step-guide.html';
    a.click();
    URL.revokeObjectURL(url);
  });
});

function buildExportHtml(steps) {
  const stepsHtml = steps
    .map((step, i) => {
      const hasBox = step.box && step.viewport;
      const boxStyle = hasBox
        ? `left:${(step.box.x / step.viewport.width) * 100}%;` +
          `top:${(step.box.y / step.viewport.height) * 100}%;` +
          `width:${(step.box.width / step.viewport.width) * 100}%;` +
          `height:${(step.box.height / step.viewport.height) * 100}%;`
        : '';

      return `
    <section class="step-card">
      <h2>Step ${i + 1}</h2>
      <p class="caption">${escapeHtml(step.caption)}</p>
      <div class="screenshot-frame">
        <img src="${step.screenshot}" />
        ${hasBox ? `<div class="highlight-box" style="${boxStyle}"></div>` : ''}
      </div>
      <p class="meta">${escapeHtml(step.pageTitle || step.url)}</p>
    </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Step-by-Step Guide</title>
<style>
  body { font-family: -apple-system, "Segoe UI", sans-serif; background: #0f1115; color: #e8e8e8; margin: 0; padding: 24px; }
  h1 { font-size: 20px; }
  .step-card { background: #181b21; border: 1px solid #262b33; border-radius: 10px; padding: 16px; margin-bottom: 20px; max-width: 720px; }
  .caption { font-size: 16px; font-weight: 600; margin: 0 0 12px; }
  .screenshot-frame { position: relative; border-radius: 6px; overflow: hidden; border: 1px solid #262b33; }
  .screenshot-frame img { display: block; width: 100%; }
  .highlight-box { position: absolute; border: 3px solid #ff5c5c; border-radius: 4px; box-shadow: 0 0 0 4px rgba(255,92,92,0.25); pointer-events: none; }
  .meta { font-size: 12px; color: #8a8f98; margin: 10px 0 0; }
</style>
</head>
<body>
<h1>Step-by-Step Guide</h1>
${stepsHtml}
</body>
</html>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

load();
