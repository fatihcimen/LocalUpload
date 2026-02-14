const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const crypto = require('crypto');

const app = express();
const PORT = 8080;
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const PASSWORD = 'localupload2026';
const TOKEN_SECRET = crypto.randomBytes(32).toString('hex');

// Generate a session token from password
function generateToken() {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(PASSWORD).digest('hex');
}

// Parse cookies
function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [key, val] = c.trim().split('=');
    if (key) cookies[key] = val;
  });
  return cookies;
}

// Auth middleware
function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  if (cookies.token === generateToken()) {
    return next();
  }
  // For API requests return 401
  if (req.path.startsWith('/api/') || req.path.startsWith('/upload') || req.path.startsWith('/download/')) {
    return res.status(401).json({ error: 'Yetkisiz erişim' });
  }
  return res.send(getLoginHTML());
}

// Login endpoint
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.post('/login', (req, res) => {
  if (req.body.password === PASSWORD) {
    res.setHeader('Set-Cookie', `token=${generateToken()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    return res.redirect('/');
  }
  return res.send(getLoginHTML(true));
});

// Apply auth to everything else
app.use(requireAuth);

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOWNLOADS_DIR),
  filename: (req, file, cb) => {
    // Preserve original filename, handle duplicates
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    let finalName = originalName;
    let counter = 1;
    while (fs.existsSync(path.join(DOWNLOADS_DIR, finalName))) {
      const ext = path.extname(originalName);
      const base = path.basename(originalName, ext);
      finalName = `${base} (${counter})${ext}`;
      counter++;
    }
    cb(null, finalName);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 * 1024 } }); // 5GB limit

// API: List files
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR)
      .filter(f => !f.startsWith('.'))
      .map(name => {
        const stat = fs.statSync(path.join(DOWNLOADS_DIR, name));
        return {
          name,
          size: stat.size,
          date: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Dosyalar okunamadı' });
  }
});

// API: Download file
app.get('/download/:filename', (req, res) => {
  const filePath = path.join(DOWNLOADS_DIR, req.params.filename);
  // Prevent path traversal
  if (!filePath.startsWith(DOWNLOADS_DIR)) {
    return res.status(403).json({ error: 'Erişim engellendi' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Dosya bulunamadı' });
  }
  res.download(filePath);
});

// API: Upload file
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Dosya yüklenemedi' });
  }
  res.json({ success: true, name: req.file.filename });
});

// API: Delete file
app.delete('/api/files/:filename', (req, res) => {
  const filePath = path.join(DOWNLOADS_DIR, req.params.filename);
  if (!filePath.startsWith(DOWNLOADS_DIR)) {
    return res.status(403).json({ error: 'Erişim engellendi' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Dosya bulunamadı' });
  }
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Dosya silinemedi' });
  }
});

// Serve UI
app.get('/', (req, res) => {
  res.send(getHTML());
});

app.listen(PORT, '0.0.0.0', () => {
  const interfaces = require('os').networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║       LOCAL UPLOAD - Dosya Paylaşımı     ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  Yerel:   http://localhost:${PORT}          ║`);
  console.log(`  ║  Ağ:      http://${localIP}:${PORT}    ║`);
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  Şifre:   ${PASSWORD}               ║`);
  console.log('  ╠══════════════════════════════════════════╣');
  console.log('  ║  Ağ adresini paylaşarak dosya gönderin   ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});

function getHTML() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LocalUpload</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #0a0a0b;
    --surface: #111113;
    --surface-2: #18181b;
    --border: #27272a;
    --border-hover: #3f3f46;
    --text: #fafafa;
    --text-dim: #a1a1aa;
    --text-muted: #71717a;
    --accent: #22d3ee;
    --accent-dim: rgba(34, 211, 238, 0.12);
    --accent-glow: rgba(34, 211, 238, 0.25);
    --danger: #f43f5e;
    --danger-dim: rgba(244, 63, 94, 0.12);
    --success: #34d399;
    --success-dim: rgba(52, 211, 153, 0.12);
    --radius: 8px;
  }

  html { font-size: 15px; }

  body {
    font-family: 'DM Sans', -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Subtle grid background */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
    z-index: 0;
  }

  .container {
    position: relative;
    z-index: 1;
    max-width: 820px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .logo-icon {
    width: 36px;
    height: 36px;
    background: var(--accent-dim);
    border: 1px solid rgba(34, 211, 238, 0.2);
    border-radius: 8px;
    display: grid;
    place-items: center;
  }

  .logo-icon svg { width: 18px; height: 18px; color: var(--accent); }

  .logo h1 {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .logo h1 span { color: var(--accent); }

  .status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.5);
    animation: pulse 2.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Upload Zone */
  .upload-zone {
    position: relative;
    border: 1.5px dashed var(--border);
    border-radius: var(--radius);
    padding: 2.5rem 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.25s ease;
    background: var(--surface);
    margin-bottom: 2rem;
  }

  .upload-zone:hover, .upload-zone.dragover {
    border-color: var(--accent);
    background: var(--accent-dim);
    box-shadow: 0 0 30px rgba(34, 211, 238, 0.06);
  }

  .upload-zone.dragover {
    transform: scale(1.005);
  }

  .upload-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 1rem;
    border-radius: 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    display: grid;
    place-items: center;
    transition: all 0.25s ease;
  }

  .upload-zone:hover .upload-icon {
    background: var(--accent-dim);
    border-color: rgba(34, 211, 238, 0.3);
  }

  .upload-icon svg { width: 22px; height: 22px; color: var(--text-muted); }
  .upload-zone:hover .upload-icon svg { color: var(--accent); }

  .upload-zone h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 0.35rem;
  }

  .upload-zone p {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .upload-zone input[type="file"] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  /* Progress bar */
  .upload-progress {
    display: none;
    margin-top: 1.25rem;
  }

  .upload-progress.active { display: block; }

  .progress-bar-track {
    width: 100%;
    height: 4px;
    background: var(--surface-2);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    width: 0%;
    transition: width 0.15s linear;
    box-shadow: 0 0 12px var(--accent-glow);
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
  }

  /* Toast */
  .toast-container {
    position: fixed;
    top: 1.25rem;
    right: 1.25rem;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .toast {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.85rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    animation: slideIn 0.3s ease;
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 340px;
  }

  .toast.success { border-color: rgba(52, 211, 153, 0.3); background: var(--success-dim); }
  .toast.error { border-color: rgba(244, 63, 94, 0.3); background: var(--danger-dim); }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }

  /* Section title */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .section-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .file-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--text-muted);
    background: var(--surface-2);
    padding: 0.2rem 0.6rem;
    border-radius: 99px;
    border: 1px solid var(--border);
  }

  /* File list */
  .file-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .file-item {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1rem;
    background: var(--surface);
    transition: background 0.15s ease;
  }

  .file-item:hover { background: var(--surface-2); }

  .file-info { min-width: 0; }

  .file-name {
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-meta {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.2rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-2);
    color: var(--text-dim);
    font-size: 0.78rem;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-dim);
  }

  .btn svg { width: 14px; height: 14px; }

  .btn-danger:hover {
    border-color: var(--danger);
    color: var(--danger);
    background: var(--danger-dim);
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 3.5rem 2rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .empty-state svg {
    width: 40px;
    height: 40px;
    color: var(--text-muted);
    margin-bottom: 1rem;
    opacity: 0.4;
  }

  .empty-state p {
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  /* Loading skeleton */
  .skeleton {
    padding: 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .skeleton-row {
    height: 12px;
    background: var(--surface-2);
    border-radius: 4px;
    margin-bottom: 0.75rem;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-row:nth-child(2) { width: 70%; }
  .skeleton-row:nth-child(3) { width: 50%; margin-bottom: 0; }

  @keyframes shimmer {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }

  /* Mobile */
  @media (max-width: 600px) {
    .container { padding: 1.25rem 1rem 3rem; }
    .header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
    .upload-zone { padding: 2rem 1.25rem; }
    .file-item { grid-template-columns: 1fr auto; gap: 0.5rem; padding: 0.75rem; }
    .file-meta { flex-wrap: wrap; gap: 0.5rem; }
    .btn-text-mobile { display: none; }
    .file-actions { display: flex; gap: 0.35rem; }
  }

  @media (min-width: 601px) {
    .file-actions { display: flex; gap: 0.5rem; }
  }

  /* Fade-in animation for file items */
  .file-item.new {
    animation: fadeInUp 0.3s ease;
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
</head>
<body>

<div class="toast-container" id="toasts"></div>

<div class="container">
  <header class="header">
    <div class="logo">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <h1>Local<span>Upload</span></h1>
    </div>
    <div class="status">
      <div class="status-dot"></div>
      <span>aktif</span>
    </div>
  </header>

  <!-- Upload Zone -->
  <div class="upload-zone" id="uploadZone">
    <input type="file" id="fileInput" multiple>
    <div class="upload-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    </div>
    <h3>Dosya yuklemek icin tikla veya surukle</h3>
    <p>Birden fazla dosya secebilirsiniz</p>
    <div class="upload-progress" id="uploadProgress">
      <div class="progress-bar-track">
        <div class="progress-bar-fill" id="progressFill"></div>
      </div>
      <div class="progress-info">
        <span id="progressText">Yukleniyor...</span>
        <span id="progressPercent">0%</span>
      </div>
    </div>
  </div>

  <!-- File List -->
  <div class="section-header">
    <span class="section-title">Dosyalar</span>
    <span class="file-count" id="fileCount">0 dosya</span>
  </div>
  <div id="fileListContainer"></div>
</div>

<script>
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');
  const fileListContainer = document.getElementById('fileListContainer');
  const fileCount = document.getElementById('fileCount');
  const toasts = document.getElementById('toasts');

  let previousFiles = [];

  // Drag & Drop
  ['dragenter', 'dragover'].forEach(evt => {
    uploadZone.addEventListener(evt, e => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    uploadZone.addEventListener(evt, e => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
    });
  });

  uploadZone.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length) uploadFiles(files);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) uploadFiles(fileInput.files);
  });

  function uploadFiles(files) {
    const fileArray = Array.from(files);
    let completed = 0;
    const total = fileArray.length;

    fileArray.forEach(file => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          progressFill.style.width = pct + '%';
          progressPercent.textContent = pct + '%';
          progressText.textContent = file.name;
        }
      });

      xhr.addEventListener('load', () => {
        completed++;
        if (xhr.status === 200) {
          showToast(file.name + ' yuklendi', 'success');
        } else {
          showToast(file.name + ' yuklenemedi', 'error');
        }
        if (completed === total) {
          setTimeout(() => {
            uploadProgress.classList.remove('active');
            progressFill.style.width = '0%';
          }, 800);
          fetchFiles();
        }
      });

      xhr.addEventListener('error', () => {
        completed++;
        showToast(file.name + ' yuklenemedi', 'error');
        if (completed === total) {
          uploadProgress.classList.remove('active');
        }
      });

      xhr.open('POST', '/upload');
      uploadProgress.classList.add('active');
      xhr.send(formData);
    });

    fileInput.value = '';
  }

  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'az once';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' dk once';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' saat once';

    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
      pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:#f43f5e"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      zip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:#a78bfa"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M12 2v20"/></svg>',
    };

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const audioExts = ['mp3', 'wav', 'flac', 'ogg', 'aac'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];

    if (imageExts.includes(ext)) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:#34d399"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    if (videoExts.includes(ext)) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:#60a5fa"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
    if (audioExts.includes(ext)) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:#fbbf24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    if (archiveExts.includes(ext)) return icons.zip;
    if (ext === 'pdf') return icons.pdf;

    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--text-muted)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  }

  function renderFiles(files) {
    const prevNames = new Set(previousFiles.map(f => f.name));

    if (files.length === 0) {
      fileListContainer.innerHTML = \`
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <p>Henuz dosya yok. Yuklemek icin yukaridaki alani kullanin<br>veya <strong>downloads</strong> klasorune dosya atin.</p>
        </div>
      \`;
      fileCount.textContent = '0 dosya';
      previousFiles = files;
      return;
    }

    fileCount.textContent = files.length + ' dosya';

    const html = '<div class="file-list">' + files.map(f => {
      const isNew = !prevNames.has(f.name);
      const encodedName = encodeURIComponent(f.name);
      return \`
        <div class="file-item\${isNew ? ' new' : ''}">
          <div class="file-info">
            <div class="file-name">\${getFileIcon(f.name)} \${escapeHtml(f.name)}</div>
            <div class="file-meta">
              <span>\${formatSize(f.size)}</span>
              <span>\${formatDate(f.date)}</span>
            </div>
          </div>
          <div class="file-actions">
            <a href="/download/\${encodedName}" class="btn" title="Indir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span class="btn-text-mobile">Indir</span>
            </a>
            <button class="btn btn-danger" onclick="deleteFile('\${encodedName}')" title="Sil">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      \`;
    }).join('') + '</div>';

    fileListContainer.innerHTML = html;
    previousFiles = files;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function fetchFiles() {
    try {
      const res = await fetch('/api/files');
      const files = await res.json();
      renderFiles(files);
    } catch (e) {
      // silent
    }
  }

  async function deleteFile(encodedName) {
    try {
      const res = await fetch('/api/files/' + encodedName, { method: 'DELETE' });
      if (res.ok) {
        showToast('Dosya silindi', 'success');
        fetchFiles();
      } else {
        showToast('Silinemedi', 'error');
      }
    } catch (e) {
      showToast('Hata olustu', 'error');
    }
  }

  function showToast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icon = type === 'success'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    el.innerHTML = icon + '<span>' + msg + '</span>';
    toasts.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // Initial load: show skeleton
  fileListContainer.innerHTML = \`
    <div class="skeleton">
      <div class="skeleton-row" style="width:85%"></div>
      <div class="skeleton-row"></div>
      <div class="skeleton-row"></div>
    </div>
  \`;

  fetchFiles();
  setInterval(fetchFiles, 3000);
</script>
</body>
</html>`;
}

function getLoginHTML(error = false) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LocalUpload - Giriş</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #0a0a0b;
    --surface: #111113;
    --surface-2: #18181b;
    --border: #27272a;
    --text: #fafafa;
    --text-dim: #a1a1aa;
    --text-muted: #71717a;
    --accent: #22d3ee;
    --accent-dim: rgba(34, 211, 238, 0.12);
    --danger: #f43f5e;
    --danger-dim: rgba(244, 63, 94, 0.12);
    --radius: 8px;
  }
  html { font-size: 15px; }
  body {
    font-family: 'DM Sans', -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: grid;
    place-items: center;
  }
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
  }
  .login-box {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 380px;
    padding: 2.5rem 2rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    text-align: center;
  }
  .login-logo {
    width: 48px;
    height: 48px;
    margin: 0 auto 1.25rem;
    background: var(--accent-dim);
    border: 1px solid rgba(34, 211, 238, 0.2);
    border-radius: 12px;
    display: grid;
    place-items: center;
  }
  .login-logo svg { width: 22px; height: 22px; color: var(--accent); }
  .login-box h1 {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.2rem;
    font-weight: 700;
    margin-bottom: 0.35rem;
  }
  .login-box h1 span { color: var(--accent); }
  .login-box p {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin-bottom: 1.75rem;
  }
  .login-input {
    width: 100%;
    padding: 0.7rem 1rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s;
    margin-bottom: 0.75rem;
  }
  .login-input:focus {
    border-color: var(--accent);
  }
  .login-input::placeholder { color: var(--text-muted); }
  .login-btn {
    width: 100%;
    padding: 0.7rem;
    background: var(--accent-dim);
    border: 1px solid rgba(34, 211, 238, 0.25);
    border-radius: var(--radius);
    color: var(--accent);
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .login-btn:hover {
    background: rgba(34, 211, 238, 0.18);
    border-color: var(--accent);
  }
  .error-msg {
    color: var(--danger);
    font-size: 0.8rem;
    margin-bottom: 0.75rem;
    display: ${error ? 'block' : 'none'};
    padding: 0.5rem;
    background: var(--danger-dim);
    border-radius: 6px;
  }
</style>
</head>
<body>
<div class="login-box">
  <div class="login-logo">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  </div>
  <h1>Local<span>Upload</span></h1>
  <p>Devam etmek icin sifre girin</p>
  <form method="POST" action="/login">
    <div class="error-msg">Yanlis sifre, tekrar deneyin</div>
    <input type="password" name="password" class="login-input" placeholder="Sifre" autofocus autocomplete="off">
    <button type="submit" class="login-btn">Giris Yap</button>
  </form>
</div>
</body>
</html>`;
}

module.exports = app;
