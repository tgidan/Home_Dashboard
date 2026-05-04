"use strict";

/* 
 * OSINT DASHBOARD: rendering, filter logic, tool subview
 * Depends on: osint-data.js
 */

const IMPORTANCE_LABEL = {
  red:     'Critical',
  orange:  'Relevant',
  yellow:  'Occasional',
  default: 'Standard',
};

const TAG_PREVIEW_MAX = 4;

/* Filter state */
const osintFilter = {
  importance: 'all',
  goal:       'all',
  tag:        'all',
  query:      '',
};

/* Helpers */
function impBadgeClass(imp) { return `badge-imp-${imp}`; }
function cardImpClass(imp)  { return `imp-${imp}`; }

function makeGoalChip(goalName) {
  const chip = document.createElement('span');
  chip.className   = 'osint-goal-badge';
  chip.textContent = goalName;
  return chip;
}

function makeTagChip(tag) {
  const chip = document.createElement('span');
  chip.className   = 'osint-tag';
  chip.textContent = tag;
  return chip;
}

/* Build filter UI */
function buildFilterUI() {
  /* Importance buttons */
  const group = $('importance-group');
  const impOptions = [
    { val: 'all',     label: 'All' },
    { val: 'red',     label: '● Critical' },
    { val: 'orange',  label: '● Relevant' },
    { val: 'yellow',  label: '● Occasional' },
    { val: 'default', label: '● Standard' },
  ];
  group.innerHTML = '';
  for (const { val, label } of impOptions) {
    const btn = document.createElement('button');
    btn.className   = 'imp-btn' + (val === 'all' ? ' active' : '');
    btn.dataset.imp = val;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      osintFilter.importance = val;
      document.querySelectorAll('.imp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderOsintGrid();
    });
    group.appendChild(btn);
  }

  /* Goal select */
  const goalSelect = $('osint-goal-select');
  goalSelect.innerHTML = '<option value="all">All Goals</option>';
  for (const t of OSINT_TABLES) {
    const opt = document.createElement('option');
    opt.value       = t.id;
    opt.textContent = t.name;
    goalSelect.appendChild(opt);
  }
  goalSelect.addEventListener('change', () => {
    osintFilter.goal = goalSelect.value;
    populateTagSelect();
    renderOsintGrid();
  });

  /* Tag select */
  populateTagSelect();
  $('osint-tag-select').addEventListener('change', () => {
    osintFilter.tag = $('osint-tag-select').value;
    renderOsintGrid();
  });

  /* Search bar */
  $('osint-search').addEventListener('input', () => {
    osintFilter.query = $('osint-search').value.trim();
    renderOsintGrid();
  });
}

/* Rebuild tag options scoped to the current goal filter */
function populateTagSelect() {
  const sel     = $('osint-tag-select');
  const prevVal = sel.value;

  let tags;
  if (osintFilter.goal === 'all') {
    tags = OSINT_ALL_TAGS;
  } else {
    const set = new Set();
    for (const e of OSINT_DEDUPED) {
      if (e.goals.some(g => g.id === osintFilter.goal)) {
        for (const t of e.tags) set.add(t);
      }
    }
    tags = [...set].sort();
  }

  sel.innerHTML = '<option value="all">All Applications</option>';
  for (const tag of tags) {
    const opt = document.createElement('option');
    opt.value       = tag;
    opt.textContent = tag;
    sel.appendChild(opt);
  }

  if ([...sel.options].some(o => o.value === prevVal)) {
    sel.value       = prevVal;
    osintFilter.tag = prevVal;
  } else {
    osintFilter.tag = 'all';
  }
}

/* Filtering  */
function filteredEntries() {
  const q = osintFilter.query.toLowerCase();
  return OSINT_DEDUPED.filter(e => {
    if (osintFilter.importance !== 'all' && e.importance !== osintFilter.importance) return false;
    if (osintFilter.goal !== 'all' && !e.goals.some(g => g.id === osintFilter.goal)) return false;
    if (osintFilter.tag  !== 'all' && !e.tags.includes(osintFilter.tag))             return false;
    if (q) {
      const haystack = [e.name, ...e.tags, ...e.goals.map(g => g.name), ...e.goals.map(g => g.comment)].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/* Grid render */
function renderOsintGrid() {
  const grid    = $('osint-grid');
  const entries = filteredEntries();

  $('osint-count').textContent = `${entries.length} tool${entries.length !== 1 ? 's' : ''}`;

  if (entries.length === 0) {
    grid.innerHTML = `
      <li class="state-msg-wrapper">
        <div class="state-msg">No tools match the current filters.</div>
      </li>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const entry of entries) {
    const li = document.createElement('li');
    li.className = `osint-card ${cardImpClass(entry.importance)}`;
    li.addEventListener('click', () => openSubview(entry));

    /* Top row: name + importance badge */
    const top = document.createElement('div');
    top.className = 'osint-card-top';

    const nameEl = document.createElement('span');
    nameEl.className   = 'osint-tool-name';
    nameEl.textContent = entry.name;

    const impBadge = document.createElement('span');
    impBadge.className   = `osint-imp-badge ${impBadgeClass(entry.importance)}`;
    impBadge.textContent = IMPORTANCE_LABEL[entry.importance];

    top.appendChild(nameEl);
    top.appendChild(impBadge);

    if (entry.url) {
      const visitBtn = document.createElement('a');
      visitBtn.className = 'osint-card-visit-btn';
      visitBtn.href      = entry.url;
      visitBtn.target    = '_blank';
      visitBtn.rel       = 'noopener noreferrer';
      visitBtn.title     = 'Visit tool';
      visitBtn.textContent = '↗';
      visitBtn.addEventListener('click', e => e.stopPropagation());
      top.appendChild(visitBtn);
    }

    li.appendChild(top);

    /* Goal chips */
    const goalsEl = document.createElement('div');
    goalsEl.className = 'osint-goals';
    for (const goal of entry.goals) goalsEl.appendChild(makeGoalChip(goal.name));
    li.appendChild(goalsEl);

    /* Tag preview */
    if (entry.tags.length > 0) {
      const tagsEl = document.createElement('div');
      tagsEl.className = 'osint-tags';
      const preview = entry.tags.slice(0, TAG_PREVIEW_MAX);
      for (const tag of preview) tagsEl.appendChild(makeTagChip(tag));
      if (entry.tags.length > TAG_PREVIEW_MAX) {
        const more = document.createElement('span');
        more.className   = 'osint-tag osint-tag-more';
        more.textContent = `+${entry.tags.length - TAG_PREVIEW_MAX} more`;
        tagsEl.appendChild(more);
      }
      li.appendChild(tagsEl);
    }

    fragment.appendChild(li);
  }

  grid.innerHTML = '';
  grid.appendChild(fragment);
}

/* Subview */
function openSubview(entry) {
  const panel = $('osint-subview');

  /* Name + importance */
  $('osint-sv-name').textContent       = entry.name;
  $('osint-sv-imp').textContent        = IMPORTANCE_LABEL[entry.importance];
  $('osint-sv-imp').className          = `osint-imp-badge ${impBadgeClass(entry.importance)}`;

  /* Visit button */
  const visitBtn = $('osint-sv-visit');
  if (entry.url) {
    visitBtn.hidden = false;
    visitBtn.onclick = () => window.open(entry.url, '_blank', 'noopener,noreferrer');
  } else {
    visitBtn.hidden = true;
  }

  /* Goals */
  const goalsEl = $('osint-sv-goals');
  goalsEl.innerHTML = '';
  for (const goal of entry.goals) goalsEl.appendChild(makeGoalChip(goal.name));

  /* All tags */
  const tagsEl = $('osint-sv-tags');
  tagsEl.innerHTML = '';
  if (entry.tags.length > 0) {
    for (const tag of entry.tags) tagsEl.appendChild(makeTagChip(tag));
  } else {
    tagsEl.innerHTML = '<span class="osint-sv-empty">No specific applications listed.</span>';
  }

  /* Notes — one per goal that has a comment */
  const notesSection = $('osint-sv-comment-section');
  const notesContainer = $('osint-sv-comment');
  const goalsWithNotes = entry.goals.filter(g => g.comment);
  if (goalsWithNotes.length === 0) {
    notesSection.hidden = true;
  } else {
    notesContainer.innerHTML = '';
    notesSection.hidden = false;
    const multipleGoals = goalsWithNotes.length > 1;
    for (const goal of goalsWithNotes) {
      if (multipleGoals) {
        const heading = document.createElement('div');
        heading.className   = 'osint-sv-note-goal';
        heading.textContent = goal.name;
        notesContainer.appendChild(heading);
      }
      const text = document.createElement('p');
      text.className   = 'osint-sv-comment-text';
      text.textContent = goal.comment;
      notesContainer.appendChild(text);
    }
  }

  panel.hidden = false;
  document.body.classList.add('subview-open');
}

function closeSubview() {
  $('osint-subview').hidden = true;
  document.body.classList.remove('subview-open');
}

/* Dashboard navigation */
function initDashNav() {
  document.querySelectorAll('.dash-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.dash;
      document.querySelectorAll('.dash-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(target).classList.add('active');
    });
  });
}

/* Init */
function initOsint() {
  initDashNav();
  buildFilterUI();
  renderOsintGrid();

  $('osint-subview-close').addEventListener('click', closeSubview);
  $('osint-subview-backdrop').addEventListener('click', closeSubview);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('osint-subview').hidden) closeSubview();
  });
}
