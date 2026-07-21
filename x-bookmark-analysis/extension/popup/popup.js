// popup/popup.js
const $ = (sel) => document.querySelector(sel);

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = Date.now();
  const diff = Math.floor((now - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c]
  );
}

function renderEvent(evt) {
  const div = document.createElement('div');
  div.className = `event ${evt.action === 'add' ? 'add' : evt.action === 'remove' ? 'remove' : ''}`;
  const text =
    evt?.domData?.text ||
    evt?.bookmark?.text ||
    (evt.action === 'bookmarks_batch' ? `batch ×${evt.count || 0}` : '') ||
    '(no text)';
  const id = evt.tweetId || '—';
  const op = evt.opName || evt.action || '';
  div.innerHTML = `
    <div class="event-meta">
      <span class="event-action">${escapeHtml(evt.action || '?')}</span>
      <span>${fmtTime(evt.capturedAt)} · <span class="event-id">${escapeHtml(id)}</span></span>
    </div>
    <div class="event-text">${escapeHtml(String(text).slice(0, 160))}</div>
    <div class="event-meta"><span>${escapeHtml(op)}</span></div>
  `;
  return div;
}

function renderBookmark(b) {
  const div = document.createElement('div');
  div.className = 'event';
  const media = (b.mediaCount || 0) > 0 ? ` · media ${b.mediaCount}` : '';
  div.innerHTML = `
    <div class="event-meta">
      <span class="event-action">@${escapeHtml(b.user || '')}</span>
      <span class="event-id">${escapeHtml(b.tweetId || '')}${media}</span>
    </div>
    <div class="event-text">${escapeHtml(b.text || '')}</div>
  `;
  return div;
}

function renderSaveInfo(lastSave) {
  const statusEl = $('#save-status');
  const pathEl = $('#save-path');
  const pathReadableEl = $('#save-path-readable');
  const metaEl = $('#save-meta');
  const copyBtn = $('#btn-copy-path');
  const copyReadableBtn = $('#btn-copy-readable');
  const openBtn = $('#btn-open-folder');

  if (!lastSave) {
    statusEl.textContent = '尚未保存到文件';
    statusEl.className = 'save-status';
    pathEl.textContent = '导入完成后会自动保存完整 JSON';
    pathEl.title = '';
    if (pathReadableEl) {
      pathReadableEl.textContent = '以及人类可读 .readable.jsonl';
      pathReadableEl.title = '';
    }
    metaEl.textContent = '';
    copyBtn.disabled = true;
    if (copyReadableBtn) copyReadableBtn.disabled = true;
    openBtn.disabled = true;
    return;
  }

  const status = lastSave.status || 'unknown';
  if (status === 'saving') {
    statusEl.textContent = '正在保存到本机…';
    statusEl.className = 'save-status saving';
    pathEl.textContent = lastSave.fileName || '写入中…';
    pathEl.title = '';
    if (pathReadableEl) {
      pathReadableEl.textContent = lastSave.readableFileName || '写入可读 JSONL…';
      pathReadableEl.title = '';
    }
    metaEl.textContent = lastSave.count ? `${lastSave.count} 条` : '';
    copyBtn.disabled = true;
    if (copyReadableBtn) copyReadableBtn.disabled = true;
    openBtn.disabled = true;
    return;
  }

  if (status === 'error') {
    statusEl.textContent = `保存失败：${lastSave.error || 'unknown'}`;
    statusEl.className = 'save-status error';
    pathEl.textContent = '—';
    pathEl.title = '';
    if (pathReadableEl) {
      pathReadableEl.textContent = '—';
      pathReadableEl.title = '';
    }
    metaEl.textContent = lastSave.savedAt ? fmtTime(lastSave.savedAt) : '';
    copyBtn.disabled = true;
    if (copyReadableBtn) copyReadableBtn.disabled = true;
    openBtn.disabled = true;
    return;
  }

  // saved
  const reasonLabel =
    lastSave.reason === 'import'
      ? '导入后自动保存'
      : lastSave.reason === 'live'
        ? '实时同步（收藏/取消收藏）'
        : lastSave.reason === 'manual'
          ? '手动导出'
          : '已保存';
  statusEl.textContent = `✓ ${reasonLabel}（JSON + JSONL）`;
  statusEl.className = 'save-status ok';
  const path = lastSave.path || '—';
  const readablePath = lastSave.readablePath || '—';
  pathEl.textContent = path;
  pathEl.title = path;
  if (pathReadableEl) {
    pathReadableEl.textContent = readablePath;
    pathReadableEl.title = readablePath;
  }
  const parts = [];
  if (lastSave.count != null) parts.push(`${lastSave.count} 条`);
  if (lastSave.savedAt) parts.push(fmtTime(lastSave.savedAt));
  metaEl.textContent = parts.join(' · ');
  copyBtn.disabled = !lastSave.path;
  if (copyReadableBtn) copyReadableBtn.disabled = !lastSave.readablePath;
  openBtn.disabled = !lastSave.path && lastSave.downloadId == null;
}

async function copyText(text, feedbackEl) {
  if (!text || text === '—') return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (feedbackEl) {
    const prev = feedbackEl.textContent;
    feedbackEl.textContent = '路径已复制';
    setTimeout(() => {
      feedbackEl.textContent = prev;
    }, 1500);
  }
}

function setImportButton(state, unique) {
  const btn = $('#btn-import');
  if (!btn) return;
  if (state === 'running') {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = unique != null ? `导入中… ${unique} 条` : '导入中…';
    return;
  }
  if (state === 'saving') {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = '保存文件中…';
    return;
  }
  btn.disabled = false;
  btn.classList.remove('loading');
  if (state === 'done') {
    btn.textContent = '重新全量导入';
  } else if (state === 'error') {
    btn.textContent = '重试全量导入';
  } else {
    btn.textContent = '开始全量导入';
  }
}

async function refresh() {
  const resp = await chrome.runtime.sendMessage({ type: 'popup_get_full_state' });
  if (!resp) return;

  const imp = resp.importState || {};
  const statusMap = {
    idle: 'idle',
    running: '导入中',
    done: '完成',
    error: '失败',
  };

  const isRunning = imp.status === 'running';
  const isSaving = resp.lastSave?.status === 'saving';

  $('#status').textContent =
    isRunning
      ? `导入中 · ${imp.unique || 0} 条`
      : isSaving
        ? '正在保存文件…'
        : resp.bookmarkCount
          ? `ready · ${resp.bookmarkCount} bookmarks`
          : 'idle — open x.com/i/bookmarks';

  $('#bookmark-count').textContent = resp.bookmarkCount ?? 0;
  $('#total-events').textContent = resp.totalEvents ?? 0;
  $('#import-status').textContent = statusMap[imp.status] || imp.status || '—';

  const prog = [];
  if (imp.status === 'running' || imp.status === 'done') {
    prog.push(`pages ${imp.pages || 0}`);
    prog.push(`unique ${imp.unique || 0}`);
  }
  if (imp.error) prog.push(`err: ${imp.error}`);
  if (imp.finishedAt) prog.push(`finished ${fmtTime(imp.finishedAt)}`);
  $('#import-progress').textContent = prog.length ? prog.join(' · ') : '尚未开始';

  if (isRunning) setImportButton('running', imp.unique || 0);
  else if (isSaving) setImportButton('saving');
  else setImportButton(imp.status || 'idle');

  // Highlight do-not-close-tab tip while importing / saving
  const warnTip = $('#import-warn-tip');
  if (warnTip) {
    warnTip.classList.toggle('active', isRunning || isSaving);
  }

  renderSaveInfo(resp.lastSave);

  const blist = $('#bookmark-list');
  blist.innerHTML = '';
  const samples = resp.sampleBookmarks || [];
  if (!samples.length) {
    blist.innerHTML = '<div class="empty">No bookmarks imported yet.</div>';
  } else {
    for (const b of samples) blist.appendChild(renderBookmark(b));
  }

  const list = $('#event-list');
  list.innerHTML = '';
  if (!resp.recentEvents?.length) {
    list.innerHTML = '<div class="empty">No events yet.</div>';
    return;
  }
  for (const e of resp.recentEvents) list.appendChild(renderEvent(e));
}

$('#btn-import').addEventListener('click', async () => {
  setImportButton('running', 0);
  $('#import-progress').textContent = 'starting…';
  const warnTip = $('#import-warn-tip');
  if (warnTip) warnTip.classList.add('active');
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'start_import' });
    if (!resp?.ok) {
      $('#import-progress').textContent = `failed: ${resp?.error || 'unknown'}`;
      setImportButton('error');
    }
  } catch (e) {
    $('#import-progress').textContent = `failed: ${e.message || e}`;
    setImportButton('error');
  } finally {
    refresh();
  }
});

$('#btn-export').addEventListener('click', async () => {
  $('#btn-export').disabled = true;
  $('#save-status').textContent = '正在保存到本机…';
  $('#save-status').className = 'save-status saving';
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'save_bookmarks_file',
      reason: 'manual',
    });
    if (!resp?.ok && !resp?.pending) {
      $('#save-status').textContent = `保存失败：${resp?.error || 'unknown'}`;
      $('#save-status').className = 'save-status error';
    }
  } catch (e) {
    $('#save-status').textContent = `保存失败：${e.message || e}`;
    $('#save-status').className = 'save-status error';
  } finally {
    $('#btn-export').disabled = false;
    // path may arrive a moment later via downloads.onChanged
    setTimeout(refresh, 400);
    setTimeout(refresh, 1200);
  }
});

$('#btn-copy-path').addEventListener('click', async () => {
  await copyText($('#save-path').textContent, $('#save-meta'));
});

$('#btn-copy-readable').addEventListener('click', async () => {
  await copyText($('#save-path-readable').textContent, $('#save-meta'));
});

$('#btn-open-folder').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'open_save_folder' });
});

refresh();
setInterval(refresh, 1200);
