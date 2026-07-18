'use strict';

/* ═══ STATE ═══ */
const STATE = { events: [], filtered: [] };
const STORAGE_KEY = 'bookstore_events_v1';

const CATEGORY_LABELS = {
  'author-signing': 'Special Event',
  'book-club':      'Seminar',
  'reading':        'Reading',
  'workshop':       'Exhibition',
  'other':          'Other',
};

const CATEGORY_LOCATIONS = {
  'author-signing': 'Main Hall',
  'book-club':      'Auditorium',
  'reading':        'Kids Corner',
  'workshop':       'Gallery',
  'other':          'Lounge',
};

/* ═══ DOM REFS ═══ */
const $ = (id) => document.getElementById(id);

const dom = {
  openBtn:      $('open-dialog-btn'),
  closeBtn:     $('close-dialog-btn'),
  cancelBtn:    $('cancel-btn'),
  dialog:       $('dialog'),
  dialogPanel:  $('dialog-panel'),
  form:         $('event-form'),
  submitBtn:    $('submit-btn'),
  saveIndicator:$('save-indicator'),

  fTitle:   $('f-title'),
  fDate:    $('f-date'),
  fTime:    $('f-time'),
  fCat:     $('f-category'),
  fLocation:$('f-location'),
  fDesc:    $('f-desc'),

  eTitle:   $('e-title'),
  eDate:    $('e-date'),
  eTime:    $('e-time'),
  eCat:     $('e-category'),
  charCount:$('char-count'),

  searchInput:  $('search-input'),
  catFilter:    $('category-filter'),
  resultsMeta:  $('results-meta'),
  eventsList:   $('events-list'),
  loading:      $('loading'),
  emptyState:   $('empty-state'),
  emptyMsg:     $('empty-msg'),
  emptyHint:    $('empty-hint'),
  toast:        $('toast'),
  yr:           $('yr'),

  detailsDialog: $('details-dialog'),
  detailsPanel:  $('details-panel'),
  closeDetailsBtn:$('close-details-btn'),
  detailsContent:$('details-content'),
};

/* ═══ SECURITY: XSS ESCAPE ═══ */
function esc(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/* ═══ TELEMETRY ═══ */
function log(action) {
  console.log(`[Analytics] User interacted with Independent Bookstore Events Page — ${action}`);
}

/* ═══ STORAGE ═══ */
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.events)); } catch (_) {}
}
function load() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; }
}

/* ═══ SEED DATA ═══ */
function seeds() {
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  return [
    { id: 's1', title: 'Margaux Delacroix — Author Signing', date: d(3),  time: '14:00', category: 'author-signing', description: 'Celebrate the launch of "Letters from the Lighthouse".' },
    { id: 's2', title: 'Saturday Morning Book Club',          date: d(6),  time: '10:30', category: 'book-club',      description: 'Discussing "The Cartographer\'s Daughter". Newcomers welcome!' },
    { id: 's3', title: 'Poetry Afternoon Reading',            date: d(6),  time: '17:00', category: 'reading',        description: 'Local poets share their latest work. Light refreshments provided.' },
    { id: 's4', title: 'Creative Writing Workshop',           date: d(14), time: '13:00', category: 'workshop',       description: 'Two-hour intro workshop on short fiction. Limited to 12 participants.' },
  ];
}

/* ═══ HELPERS ═══ */
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
function fmtCardDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
}
function getTodayStr() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function uid() { return `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function delay() { return new Promise(r => setTimeout(r, 1200 + Math.random() * 600)); }

/* ═══ TOAST ═══ */
let toastTimer = null;
function toast(msg, type = 'success') {
  clearTimeout(toastTimer);
  dom.toast.textContent = msg;
  dom.toast.className = `toast${type === 'error' ? ' toast-error' : ''}`;
  dom.toast.hidden = false;
  toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 3500);
}

/* ═══ RENDER — date-grouped card grid ═══ */
function render() {
  dom.eventsList.innerHTML = '';

  if (STATE.filtered.length === 0) {
    dom.emptyState.hidden = false;
    dom.resultsMeta.textContent = '';
    return;
  }

  dom.emptyState.hidden = true;

  const todayStr = getTodayStr();

  // Group by date
  const groups = {};
  STATE.filtered.forEach(ev => {
    if (!groups[ev.date]) groups[ev.date] = [];
    groups[ev.date].push(ev);
  });

  // Sort dates ascending
  const sortedDates = Object.keys(groups).sort();

  sortedDates.forEach(dateKey => {
    const group = document.createElement('div');
    group.className = 'date-group';

    const heading = document.createElement('p');
    heading.className = 'date-heading';
    heading.textContent = (dateKey === todayStr) ? 'TODAY' : fmtDate(dateKey).toUpperCase();
    group.appendChild(heading);

    // Grid wrapper
    const grid = document.createElement('div');
    grid.className = 'events-grid';

    // Sort events within date by time
    groups[dateKey]
      .sort((a, b) => a.time.localeCompare(b.time))
      .forEach(ev => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.setAttribute('role', 'listitem');
        card.setAttribute('data-cat', esc(ev.category));
        card.innerHTML = `
          <div class="card-accent-bar"></div>
          <div class="card-body">
            <div class="card-top-row">
              <span class="card-time-badge">${esc(fmtTime(ev.time))}</span>
              <span class="event-badge">${esc(CATEGORY_LABELS[ev.category] || ev.category)}</span>
            </div>
            <span class="card-date-label">${(ev.date === todayStr) ? 'TODAY' : esc(fmtCardDate(ev.date))}</span>
            <h4 class="card-event-title">${esc(ev.title)}</h4>
            ${ev.description ? `<p class="card-event-desc">${esc(ev.description)}</p>` : ''}
          </div>
          <div class="card-divider"></div>
          <div class="card-bottom-row">
            <div class="card-location">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span>${esc(ev.location || CATEGORY_LOCATIONS[ev.category] || 'Auditorium')}</span>
            </div>
            <div class="card-actions">
              <button class="btn-card-action btn-edit-icon" aria-label="View Details">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </button>
              <button class="btn-card-action btn-delete" data-id="${esc(ev.id)}" aria-label="Delete: ${esc(ev.title)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });

    group.appendChild(grid);
    dom.eventsList.appendChild(group);
  });

  const shown = STATE.filtered.length;
  dom.resultsMeta.textContent = `${shown} events scheduled`;
}

/* ═══ FILTER ═══ */
function applyFilters() {
  const q   = dom.searchInput.value.trim().toLowerCase();
  const cat = dom.catFilter.value;

  STATE.filtered = STATE.events.filter(ev => {
    const matchQ   = !q || ev.title.toLowerCase().includes(q) || (ev.description && ev.description.toLowerCase().includes(q));
    const matchCat = !cat || ev.category === cat;
    return matchQ && matchCat;
  });

  if (STATE.filtered.length === 0) {
    if (q || cat) {
      dom.emptyMsg.textContent  = 'No events match your search.';
      dom.emptyHint.textContent = 'Try different keywords or clear filters.';
    } else {
      dom.emptyMsg.textContent  = 'No events yet.';
      dom.emptyHint.textContent = 'Add your first event using the button above.';
    }
  }

  render();
}

/* ═══ VALIDATION ═══ */
function setErr(field, errEl, msg) {
  if (msg) {
    field.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');
    errEl.textContent = msg;
    errEl.hidden = false;
  } else {
    field.classList.remove('is-invalid');
    field.removeAttribute('aria-invalid');
    errEl.textContent = '';
    errEl.hidden = true;
  }
}

function validate() {
  let ok = true;
  const t  = dom.fTitle.value.trim();
  const d  = dom.fDate.value;
  const tm = dom.fTime.value;
  const c  = dom.fCat.value;

  if (!t || t.length < 3) { setErr(dom.fTitle, dom.eTitle, t ? 'Title must be at least 3 characters.' : 'Event title is required.'); ok = false; }
  else setErr(dom.fTitle, dom.eTitle, null);

  if (!d) { setErr(dom.fDate, dom.eDate, 'Please pick a date.'); ok = false; }
  else setErr(dom.fDate, dom.eDate, null);

  if (!tm) { setErr(dom.fTime, dom.eTime, 'Please set a start time.'); ok = false; }
  else setErr(dom.fTime, dom.eTime, null);

  if (!c) { setErr(dom.fCat, dom.eCat, 'Please select a category.'); ok = false; }
  else setErr(dom.fCat, dom.eCat, null);

  if (!ok) { const first = dom.form.querySelector('.is-invalid'); if (first) first.focus(); }
  return ok;
}

/* ═══ DIALOG ═══ */
let prevFocus = null;

function openDialog() {
  prevFocus = document.activeElement;
  dom.dialog.hidden = false;
  requestAnimationFrame(() => dom.dialogPanel.focus());
  document.addEventListener('keydown', trapFocus);
  log('Opened Add Event dialog');
}

function closeDialog() {
  dom.dialog.hidden = true;
  resetForm();
  document.removeEventListener('keydown', trapFocus);
  if (prevFocus) prevFocus.focus();
}

function openDetailsDialog(ev) {
  dom.detailsContent.innerHTML = `
    <div class="details-popup-body">
      <span class="event-badge">${esc(CATEGORY_LABELS[ev.category] || ev.category)}</span>
      <h3 class="event-title" style="font-size: 20px; font-weight: 800; margin-top: 4px;">${esc(ev.title)}</h3>
      <div class="details-datetime-display">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div class="details-large-time">${esc(fmtTime(ev.time))}</div>
          <div class="details-large-date">${esc(fmtDate(ev.date))}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); margin-top: 4px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        <span><strong>Location:</strong> ${esc(ev.location || CATEGORY_LOCATIONS[ev.category] || 'Auditorium')}</span>
      </div>
      <div class="details-description-text">${ev.description ? esc(ev.description) : '<i>No description provided.</i>'}</div>
    </div>
  `;
  prevFocus = document.activeElement;
  dom.detailsDialog.hidden = false;
  requestAnimationFrame(() => dom.detailsPanel.focus());
  document.addEventListener('keydown', trapDetailsFocus);
  log(`Opened details dialog for "${ev.title}"`);
}

function closeDetailsDialog() {
  dom.detailsDialog.hidden = true;
  document.removeEventListener('keydown', trapDetailsFocus);
  if (prevFocus) prevFocus.focus();
}

function trapDetailsFocus(e) {
  if (e.key === 'Escape') { closeDetailsDialog(); return; }
  if (e.key !== 'Tab') return;
  const els = Array.from(dom.detailsPanel.querySelectorAll(
    'button:not([disabled]),[tabindex="0"]'
  ));
  const first = els[0], last = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function resetForm() {
  dom.form.reset();
  dom.charCount.textContent = '0 / 500';
  dom.saveIndicator.hidden = true;
  dom.submitBtn.disabled = false;
  dom.submitBtn.textContent = 'Save Event';
  [
    [dom.fTitle, dom.eTitle],
    [dom.fDate,  dom.eDate],
    [dom.fTime,  dom.eTime],
    [dom.fCat,   dom.eCat],
  ].forEach(([f, e]) => setErr(f, e, null));
}

function trapFocus(e) {
  if (e.key === 'Escape') { closeDialog(); return; }
  if (e.key !== 'Tab') return;
  const els = Array.from(dom.dialogPanel.querySelectorAll(
    'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'
  ));
  const first = els[0], last = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ═══ SUBMIT ═══ */
async function handleSubmit(e) {
  e.preventDefault();
  if (!validate()) return;

  dom.saveIndicator.hidden = false;
  dom.submitBtn.disabled   = true;
  dom.submitBtn.textContent = 'Saving…';

  await delay();

  const ev = {
    id:          uid(),
    title:       dom.fTitle.value.trim(),
    date:        dom.fDate.value,
    time:        dom.fTime.value,
    category:    dom.fCat.value,
    location:    dom.fLocation.value.trim(),
    description: dom.fDesc.value.trim(),
  };

  STATE.events.unshift(ev);
  save();
  applyFilters();
  closeDialog();
  toast(`✓ "${ev.title}" added.`);
  log(`Added event: "${ev.title}" [${ev.category}]`);
}

/* ═══ DELETE ═══ */
function handleDelete(id) {
  const ev = STATE.events.find(e => e.id === id);
  if (!ev) return;
  STATE.events = STATE.events.filter(e => e.id !== id);
  save();
  applyFilters();
  toast(`Removed "${ev.title}".`);
  log(`Deleted event: "${ev.title}"`);
}

/* ═══ SEARCH (debounced) ═══ */
let searchTimer = null;
function handleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    applyFilters();
    if (dom.searchInput.value.trim()) log(`Searched: "${dom.searchInput.value.trim()}"`);
  }, 250);
}

/* ═══ CLEANUP EXPIRED EVENTS ═══ */
function cleanupExpiredEvents() {
  const todayStr = getTodayStr();
  const beforeCount = STATE.events.length;
  STATE.events = STATE.events.filter(ev => ev.date >= todayStr);
  if (STATE.events.length !== beforeCount) {
    save();
  }
}

/* ═══ INITIAL LOAD ═══ */
async function initialLoad() {
  dom.loading.hidden = false;
  dom.emptyState.hidden = true;

  await delay();

  const stored = load();
  STATE.events = (stored && stored.length > 0) ? stored : seeds();
  cleanupExpiredEvents();
  if (!stored || stored.length === 0) save();

  dom.loading.hidden = true;
  applyFilters();
}

/* ═══ INIT ═══ */
function init() {
  dom.yr.textContent = new Date().getFullYear();

  // Dialog
  dom.openBtn.addEventListener('click', openDialog);
  dom.closeBtn.addEventListener('click', closeDialog);
  dom.cancelBtn.addEventListener('click', closeDialog);
  dom.dialog.addEventListener('click', e => { if (e.target === dom.dialog) closeDialog(); });

  // Details Dialog
  dom.closeDetailsBtn.addEventListener('click', closeDetailsDialog);
  dom.detailsDialog.addEventListener('click', e => { if (e.target === dom.detailsDialog) closeDetailsDialog(); });

  // Form
  dom.form.addEventListener('submit', handleSubmit);

  // Char counter
  dom.fDesc.addEventListener('input', () => {
    dom.charCount.textContent = `${dom.fDesc.value.length} / 500`;
  });

  // Clear errors inline
  [[dom.fTitle, dom.eTitle],[dom.fDate, dom.eDate],[dom.fTime, dom.eTime],[dom.fCat, dom.eCat]]
    .forEach(([f, e]) => f.addEventListener('input', () => { if (f.value.trim()) setErr(f, e, null); }));

  // Search & filter
  dom.searchInput.addEventListener('input', handleSearch);
  dom.catFilter.addEventListener('change', () => {
    applyFilters();
    if (dom.catFilter.value) log(`Filtered: "${dom.catFilter.value}"`);
  });

  // Click delegation (Delete button vs Card details popup)
  dom.eventsList.addEventListener('click', e => {
    const btn = e.target.closest('.btn-delete');
    if (btn && btn.dataset.id) {
      handleDelete(btn.dataset.id);
      return;
    }
    const card = e.target.closest('.event-card');
    if (card) {
      const deleteBtn = card.querySelector('.btn-delete');
      if (deleteBtn && deleteBtn.dataset.id) {
        const ev = STATE.events.find(item => item.id === deleteBtn.dataset.id);
        if (ev) openDetailsDialog(ev);
      }
    }
  });

  initialLoad();
}

document.addEventListener('DOMContentLoaded', init);
