const sourcesEl = document.getElementById('sources');
const cancelBtn = document.getElementById('cancelBtn');

async function load() {
  const sources = await window.pickerAPI.listSources();
  sourcesEl.innerHTML = '';

  if (!sources.length) {
    sourcesEl.textContent = 'No screens or windows found.';
    return;
  }

  sources.forEach((source) => {
    const card = document.createElement('div');
    card.className = 'source';

    const img = document.createElement('img');
    img.src = source.thumbnail;

    const label = document.createElement('span');
    label.textContent = source.name;

    card.appendChild(img);
    card.appendChild(label);
    card.addEventListener('click', () => window.pickerAPI.choose(source.id));

    sourcesEl.appendChild(card);
  });
}

cancelBtn.addEventListener('click', () => window.close());

load();
