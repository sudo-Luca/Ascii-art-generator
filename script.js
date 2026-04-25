// ─── STATE ───
let currentImage = null;
let asciiResult = '';
let currentMode = 'classic';
let currentCharset = 'standard';
let colorMode = false;
let invertMode = false;
let highContrast = false;
let keepRatio = true;
let displayFontSize = 6;
let currentFont = "'Space Mono', monospace";

const CHARSETS = {
  standard: ' .,:;*?%S#@',
  dense:    ' .:-=+*#%@$',
  simple:   ' ░▒▓█',
  binary:   ' 1',
  letters:  ' .=+oXHABMW'
};

// ─── EMPTY STATE ───
const grid = document.getElementById('empty-grid');
const sampleChars = '@#%S*+;:,.'.split('');
for (let i = 0; i < 64; i++) {
  const cell = document.createElement('div');
  cell.className = 'empty-cell';
  cell.textContent = sampleChars[Math.floor(Math.random() * sampleChars.length)];
  grid.appendChild(cell);
}

// ─── MOBILE PANEL ───
const sidebar = document.getElementById('sidebar');

document.getElementById('mobile-open-btn').addEventListener('click', () => {
  sidebar.classList.add('open');
  document.body.style.overflow = 'hidden';
});
document.getElementById('sidebar-close-btn').addEventListener('click', closeSidebar);

function closeSidebar() {
  sidebar.classList.remove('open');
  document.body.style.overflow = '';
}

// ─── UPLOAD ───
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const genBtn = document.getElementById('gen-btn');
const mobileGenBtn = document.getElementById('mobile-gen-btn');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImage(file);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) loadImage(e.target.files[0]); });

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      currentImage = img;
      genBtn.disabled = false;
      mobileGenBtn.disabled = false;
      let preview = uploadZone.querySelector('img');
      if (!preview) {
        preview = document.createElement('img');
        uploadZone.appendChild(preview);
        uploadZone.querySelector('.upload-icon').style.display = 'none';
        uploadZone.querySelector('.upload-text').style.display = 'none';
      }
      preview.src = ev.target.result;
      showToast('Image chargée');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ─── SLIDERS ───
const widthSlider = document.getElementById('width-slider');
const fontSlider = document.getElementById('font-slider');
const widthVal = document.getElementById('width-val');
const fontVal = document.getElementById('font-val');

widthSlider.addEventListener('input', () => { widthVal.value = widthSlider.value; });
widthVal.addEventListener('change', () => {
  let v = parseInt(widthVal.value);
  if (isNaN(v) || v < 20) v = 20;
  widthVal.value = v;
  widthSlider.value = Math.min(v, parseInt(widthSlider.max));
});
fontSlider.addEventListener('input', () => {
  fontVal.value = fontSlider.value;
  displayFontSize = parseInt(fontSlider.value);
  applyFontSize();
});
fontVal.addEventListener('change', () => {
  let v = parseInt(fontVal.value);
  if (isNaN(v) || v < 1) v = 1;
  fontVal.value = v;
  displayFontSize = v;
  fontSlider.value = Math.min(v, parseInt(fontSlider.max));
  applyFontSize();
});

function applyFontSize() {
  document.getElementById('ascii-pre').style.fontSize = displayFontSize + 'px';
}

document.getElementById('font-inc').addEventListener('click', () => {
  displayFontSize = Math.min(20, displayFontSize + 1);
  fontSlider.value = displayFontSize;
  fontVal.value = displayFontSize;
  applyFontSize();
});
document.getElementById('font-dec').addEventListener('click', () => {
  displayFontSize = Math.max(1, displayFontSize - 1);
  fontSlider.value = displayFontSize;
  fontVal.value = displayFontSize;
  applyFontSize();
});

// ─── MODE BUTTONS ───
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    const cs = document.getElementById('charset-section');
    cs.style.opacity = currentMode === 'classic' ? '1' : '0.35';
    cs.style.pointerEvents = currentMode === 'classic' ? 'auto' : 'none';
  });
});

// ─── FONT PICKER ───
document.querySelectorAll('.font-option').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.font-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFont = btn.dataset.font;
    document.getElementById('ascii-pre').style.fontFamily = currentFont;
    if (asciiResult) updateInfo();
  });
});

// ─── CHARSET ───
document.querySelectorAll('.charset-option').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.charset-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCharset = btn.dataset.set;
  });
});

// ─── TOGGLES ───
function initToggle(id, callback) {
  const el = document.getElementById(id);
  const row = el.closest('.toggle-row');
  const handler = () => {
    const on = el.dataset.state === 'on';
    el.dataset.state = on ? 'off' : 'on';
    el.classList.toggle('on', !on);
    callback(!on);
  };
  el.addEventListener('click', e => { e.stopPropagation(); handler(); });
  if (row) row.addEventListener('click', e => { if (e.target !== el) handler(); });
}

initToggle('toggle-invert', v => invertMode = v);
initToggle('toggle-color', v => colorMode = v);
initToggle('toggle-contrast', v => highContrast = v);
initToggle('toggle-ratio', v => keepRatio = v);

// ─── ASCII GENERATORS ───
function getLuminance(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

function generateClassicASCII(pixels, w, h) {
  const chars = CHARSETS[currentCharset];
  let result = '';
  let colorData = colorMode ? [] : null;
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
      let lum = getLuminance(r, g, b) / 255;
      if (invertMode) lum = 1 - lum;
      if (highContrast) lum = lum < 0.5 ? lum * 0.5 : 0.5 + (lum - 0.5) * 1.5;
      lum = Math.max(0, Math.min(1, lum));
      row += chars[Math.floor(lum * (chars.length - 1))];
      if (colorData) colorData.push(`rgb(${r},${g},${b})`);
    }
    result += row + '\n';
  }
  return { text: result, colorData };
}

function generateEdgeASCII(pixels, w, h) {
  // pixels is w × h where h = charRows * 2 (double-height, square pixels)
  // Output: w × (h/2) chars — no aspect distortion

  // ── 1. Grayscale ──
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    gray[i] = getLuminance(pixels[i*4], pixels[i*4+1], pixels[i*4+2]);

  // ── 2. Gaussian blur 5×5 ──
  const K = [2,4,5,4,2, 4,9,12,9,4, 5,12,15,12,5, 4,9,12,9,4, 2,4,5,4,2];
  const blurred = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let ky = -2; ky <= 2; ky++)
        for (let kx = -2; kx <= 2; kx++) {
          s += gray[Math.max(0,Math.min(h-1,y+ky))*w + Math.max(0,Math.min(w-1,x+kx))]
               * K[(ky+2)*5+(kx+2)];
        }
      blurred[y*w+x] = s / 159;
    }

  // ── 3. Sobel on square pixel grid (NO aspect correction needed) ──
  const Gx = new Float32Array(w * h);
  const Gy = new Float32Array(w * h);
  const Gm = new Float32Array(w * h);
  const G  = new Float32Array(w * h); // raw angle

  const p = (y, x) => blurred[Math.max(0,Math.min(h-1,y))*w + Math.max(0,Math.min(w-1,x))];

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gx = -p(y-1,x-1)+p(y-1,x+1) - 2*p(y,x-1)+2*p(y,x+1) - p(y+1,x-1)+p(y+1,x+1);
      const gy = -p(y-1,x-1)-2*p(y-1,x)-p(y-1,x+1) + p(y+1,x-1)+2*p(y+1,x)+p(y+1,x+1);
      Gx[y*w+x] = gx; Gy[y*w+x] = gy;
      Gm[y*w+x] = Math.sqrt(gx*gx + gy*gy);
      G[y*w+x]  = Math.atan2(gy, gx);
    }

  // ── 4. Non-maximum suppression ──
  const nms = new Float32Array(w * h);
  for (let y = 1; y < h-1; y++)
    for (let x = 1; x < w-1; x++) {
      const mag = Gm[y*w+x];
      const a = ((G[y*w+x] * 180 / Math.PI) % 180 + 180) % 180;
      let m1, m2;
      if      (a < 22.5 || a >= 157.5) { m1 = Gm[y*w+x-1];       m2 = Gm[y*w+x+1]; }
      else if (a < 67.5)               { m1 = Gm[(y-1)*w+x+1];   m2 = Gm[(y+1)*w+x-1]; }
      else if (a < 112.5)              { m1 = Gm[(y-1)*w+x];     m2 = Gm[(y+1)*w+x]; }
      else                             { m1 = Gm[(y-1)*w+x-1];   m2 = Gm[(y+1)*w+x+1]; }
      nms[y*w+x] = (mag >= m1 && mag >= m2) ? mag : 0;
    }

  // ── 5. Auto-threshold (percentile) + hysteresis ──
  const vals = [];
  for (let i = 0; i < w*h; i++) if (nms[i] > 0) vals.push(nms[i]);
  vals.sort((a,b) => a-b);
  const pct = highContrast ? 0.55 : 0.72;
  const tHigh = vals.length ? vals[Math.floor(vals.length * pct)] : 20;
  const tLow  = tHigh * 0.3;

  const STRONG = 2, WEAK = 1;
  const edge = new Uint8Array(w * h);
  for (let i = 0; i < w*h; i++) {
    if (nms[i] >= tHigh) edge[i] = STRONG;
    else if (nms[i] >= tLow) edge[i] = WEAK;
  }
  // Hysteresis (BFS instead of repeated scan — much faster)
  const queue = [];
  for (let i = 0; i < w*h; i++) if (edge[i] === STRONG) queue.push(i);
  let qi = 0;
  while (qi < queue.length) {
    const i = queue[qi++];
    const y = Math.floor(i / w), x = i % w;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const ny = y+dy, nx = x+dx;
        if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
        const ni = ny*w+nx;
        if (edge[ni] === WEAK) { edge[ni] = STRONG; queue.push(ni); }
      }
  }
  for (let i = 0; i < w*h; i++) if (edge[i] === WEAK) edge[i] = 0;

  // ── 6. Aggregate 2 pixel rows → 1 char, pick dominant direction ──
  const charH = Math.floor(h / 2);
  let result = '';

  for (let cy = 0; cy < charH; cy++) {
    let row = '';
    for (let cx = 0; cx < w; cx++) {
      // Each char covers pixels at rows [cy*2, cy*2+1], col cx
      // Collect all edge pixels in this block
      let sumSin = 0, sumCos = 0, totalMag = 0;
      let hasEdge = false;
      for (let dy = 0; dy < 2; dy++) {
        const py = cy*2 + dy;
        if (py >= h) continue;
        if (edge[py*w+cx]) {
          hasEdge = true;
          const m = Gm[py*w+cx];
          const a = G[py*w+cx];
          // Circular mean of gradient angles (weighted by magnitude)
          sumSin += Math.sin(2*a) * m; // ×2 for 180° periodicity
          sumCos += Math.cos(2*a) * m;
          totalMag += m;
        }
      }

      if (!hasEdge) { row += invertMode ? '.' : ' '; continue; }

      // Recover mean gradient angle
      const meanGrad = Math.atan2(sumSin, sumCos) / 2;
      const gradDeg = ((meanGrad * 180 / Math.PI) % 360 + 360) % 360;
      const edgeDeg = (gradDeg + 90) % 180; // edge direction 0–179°

      let ch;
      if      (edgeDeg < 22.5 || edgeDeg >= 157.5) ch = '-';
      else if (edgeDeg < 67.5)                      ch = '\\';
      else if (edgeDeg < 112.5)                     ch = '|';
      else                                           ch = '/';

      row += ch;
    }
    result += row + '\n';
  }
  return { text: result, colorData: null };
}

function generateBlockASCII(pixels, w, h) {
  const blocks = ' ░▒▓█';
  let result = '';
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let lum = getLuminance(pixels[i], pixels[i+1], pixels[i+2]) / 255;
      if (invertMode) lum = 1 - lum;
      row += blocks[Math.floor(lum * (blocks.length - 1))];
    }
    result += row + '\n';
  }
  return { text: result, colorData: null };
}

function generateBrailleASCII(pixels, w, h) {
  const bw = Math.floor(w / 2), bh = Math.floor(h / 4);
  let result = '';
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = getLuminance(pixels[i*4], pixels[i*4+1], pixels[i*4+2]);
  const positions = [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[0,3],[1,3]];
  const bitOrder = [0,1,2,6,3,4,5,7];
  for (let by = 0; by < bh; by++) {
    let row = '';
    for (let bx = 0; bx < bw; bx++) {
      const px = bx * 2, py = by * 4;
      let code = 0x2800;
      for (let d = 0; d < 8; d++) {
        const [dx, dy] = positions[d];
        const sx = px + dx, sy = py + dy;
        if (sx < w && sy < h) {
          const v = gray[sy * w + sx];
          if (invertMode ? v > 128 : v < 128) code |= (1 << bitOrder[d]);
        }
      }
      row += String.fromCodePoint(code);
    }
    result += row + '\n';
  }
  return { text: result, colorData: null };
}

// ─── GENERATE ───
function generate() {
  if (!currentImage) return;
  const targetW = Math.max(20, parseInt(widthVal.value) || 100);
  const canvas = document.getElementById('source-canvas');
  const ctx = canvas.getContext('2d');
  const ar = currentImage.height / currentImage.width;
  let sw, sh, output;

  if (currentMode === 'braille') {
    sw = targetW * 2;
    sh = keepRatio ? Math.floor(sw * ar) : Math.floor(targetW * 2);
    sh = Math.max(4, Math.floor(sh / 4) * 4);
    canvas.width = sw; canvas.height = sh;
    ctx.drawImage(currentImage, 0, 0, sw, sh);
    output = generateBrailleASCII(ctx.getImageData(0,0,sw,sh).data, sw, sh);
  } else if (currentMode === 'edge') {
    // Sample at DOUBLE vertical resolution: chars are ~2x taller than wide,
    // so we need 2 pixel rows per char row to avoid aspect distortion.
    sw = targetW;
    const charRows = keepRatio ? Math.max(1, Math.floor(sw * ar * 0.5)) : Math.max(1, Math.floor(sw * 0.5));
    sh = charRows * 2;
    canvas.width = sw; canvas.height = sh;
    ctx.drawImage(currentImage, 0, 0, sw, sh);
    output = generateEdgeASCII(ctx.getImageData(0,0,sw,sh).data, sw, sh);
  } else {
    sw = targetW;
    sh = keepRatio ? Math.max(1, Math.floor(sw * ar * 0.5)) : Math.max(1, Math.floor(sw * 0.5));
    canvas.width = sw; canvas.height = sh;
    ctx.drawImage(currentImage, 0, 0, sw, sh);
    const pixels = ctx.getImageData(0,0,sw,sh).data;
    if (currentMode === 'classic') output = generateClassicASCII(pixels, sw, sh);
    else output = generateBlockASCII(pixels, sw, sh);
  }

  asciiResult = output.text;
  renderOutput(output);
  updateInfo();
  document.getElementById('empty-state').style.display = 'none';
  if (window.innerWidth <= 768) closeSidebar();
}

genBtn.addEventListener('click', generate);
mobileGenBtn.addEventListener('click', generate);

function renderOutput({ text, colorData }) {
  const pre = document.getElementById('ascii-pre');
  pre.style.fontSize = displayFontSize + 'px';
  pre.style.fontFamily = currentFont;

  if (colorData && colorData.length > 0) {
    pre.innerHTML = '';
    const lines = text.split('\n');
    let idx = 0;
    lines.forEach((line, li) => {
      for (let c = 0; c < line.length; c++) {
        const span = document.createElement('span');
        span.textContent = line[c];
        if (colorData[idx]) span.style.color = colorData[idx];
        pre.appendChild(span);
        idx++;
      }
      if (li < lines.length - 1) pre.appendChild(document.createTextNode('\n'));
    });
  } else {
    pre.textContent = text;
    pre.style.color = '';
  }
}

function updateInfo() {
  const lines = asciiResult.split('\n').filter(l => l).length;
  const cols = asciiResult.split('\n')[0]?.length || 0;
  const fontName = document.querySelector('.font-option.active .font-name')?.textContent || '';
  document.getElementById('info-bar').textContent = `${cols}×${lines} — ${currentMode} — ${fontName}`;
}

// ─── TOOLBAR ───
document.getElementById('btn-copy').addEventListener('click', () => {
  if (!asciiResult) { showToast('Rien à copier'); return; }
  navigator.clipboard.writeText(asciiResult).then(() => showToast('Copié !'));
});

document.getElementById('btn-save-txt').addEventListener('click', () => {
  if (!asciiResult) { showToast('Génère d\'abord'); return; }
  downloadBlob(new Blob([asciiResult], { type: 'text/plain' }), 'ascii-art.txt');
});

document.getElementById('btn-save-svg').addEventListener('click', () => {
  if (!asciiResult) { showToast('Génère d\'abord'); return; }
  const lines = asciiResult.split('\n').filter(l => l.length);
  const lh = displayFontSize * 1.2, cw = displayFontSize * 0.6;
  const svgW = (lines[0]?.length || 0) * cw + 20, svgH = lines.length * lh + 20;
  const fontStack = currentFont.replace(/'/g, '"');
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" style="background:#080808">`;
  svg += `<style>text{font-family:${fontStack};fill:#f0f0e8;font-size:${displayFontSize}px;}</style>`;
  lines.forEach((line, i) => {
    const esc = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    svg += `<text x="10" y="${10 + (i+1)*lh}">${esc}</text>`;
  });
  svg += '</svg>';
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'ascii-art.svg');
});

document.getElementById('btn-save-png').addEventListener('click', () => {
  if (!asciiResult) { showToast('Génère d\'abord'); return; }
  const lines = asciiResult.split('\n').filter(l => l.length);
  const fs = Math.max(displayFontSize * 2, 12);
  const lh = fs * 1.2, cw = fs * 0.6;
  const c = document.createElement('canvas');
  c.width = (lines[0]?.length || 0) * cw + 20;
  c.height = lines.length * lh + 20;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#f0f0e8'; ctx.font = `${fs}px ${currentFont}`; ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, 10, 10 + i * lh));
  c.toBlob(blob => downloadBlob(blob, 'ascii-art.png'));
});

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
  showToast('Téléchargement...');
}

// ─── TOAST ───
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}