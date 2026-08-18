const STORAGE_KEY = "threeStyleCornerTrainer.v1";

const CATEGORY_PALETTE = ["#4f46e5", "#0f766e", "#b45309", "#be123c", "#7e22ce", "#0369a1", "#3f6212", "#9f1239"];
const DEFAULT_CATEGORY_COLOR = CATEGORY_PALETTE[0];

const CORNER_PIECES = [
  ["A", "E", "R"], // UBL / LUB / BUL
  ["B", "N", "Q"], // UBR / RUB / BUR
  ["C", "J", "M"], // UFR / FUR / RUF (buffer piece)
  ["D", "F", "I"], // UFL / LUF / FUL
  ["G", "L", "U"], // LDF / FDL / DFL
  ["H", "S", "X"], // LDB / BDL / DBL
  ["K", "P", "V"], // FDR / RDF / DFR
  ["O", "T", "W"], // RDB / BDR / DBR
];

const BUFFER_STICKERS = new Set(["C", "J", "M"]);
const TARGET_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWX".split("").filter(x => !BUFFER_STICKERS.has(x));

const pieceOf = {};
CORNER_PIECES.forEach((piece, idx) => piece.forEach(letter => pieceOf[letter] = idx));

function canonicalPair(a, b) {
  return [a, b].sort().join("");
}

function buildCaseIds() {
  const out = [];
  for (let i = 0; i < TARGET_LETTERS.length; i++) {
    for (let j = i + 1; j < TARGET_LETTERS.length; j++) {
      const a = TARGET_LETTERS[i];
      const b = TARGET_LETTERS[j];
      if (pieceOf[a] === pieceOf[b]) continue;
      out.push(canonicalPair(a, b));
    }
  }
  return out;
}

const ALL_CASE_IDS = buildCaseIds();

function defaultState() {
  const cases = {};
  ALL_CASE_IDS.forEach(id => {
    cases[id] = {
      categoryId: null,
      tagIds: [],
      notes: "",
      reviewCount: 0,
    };
  });

  return {
    version: 1,
    categories: [],
    tags: [],
    cases,
  };
}

function sanitizeState(raw) {
  const fresh = defaultState();
  if (!raw || typeof raw !== "object") return fresh;

  fresh.categories = Array.isArray(raw.categories)
    ? raw.categories
        .filter(x => x && typeof x.id === "string" && typeof x.name === "string")
        .map(x => ({
          id: x.id,
          name: x.name.slice(0, 40),
          color: isHexColor(x.color) ? x.color : DEFAULT_CATEGORY_COLOR,
          description: typeof x.description === "string" ? x.description.slice(0, 12000) : ""
        }))
    : [];

  fresh.tags = Array.isArray(raw.tags)
    ? raw.tags
        .filter(x => x && typeof x.id === "string" && typeof x.name === "string")
        .map(x => ({ id: x.id, name: x.name.slice(0, 40) }))
    : [];

  const validCategoryIds = new Set(fresh.categories.map(x => x.id));
  const validTagIds = new Set(fresh.tags.map(x => x.id));

  ALL_CASE_IDS.forEach(id => {
    const incoming = raw.cases?.[id];
    if (!incoming) return;
    fresh.cases[id] = {
      categoryId: validCategoryIds.has(incoming.categoryId) ? incoming.categoryId : null,
      tagIds: Array.isArray(incoming.tagIds)
        ? [...new Set(incoming.tagIds.filter(x => validTagIds.has(x)))]
        : [],
      notes: typeof incoming.notes === "string" ? incoming.notes.slice(0, 4000) : "",
      reviewCount: Number.isFinite(incoming.reviewCount)
        ? Math.max(0, Math.floor(incoming.reviewCount))
        : 0,
    };
  });

  return fresh;
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return sanitizeState(raw);
  } catch {
    return defaultState();
  }
}

let state = loadState();
let toastTimer = null;
let editingCategoryId = null;

const training = {
  active: false,
  queue: [],
  totalUnique: 0,
  goodCount: 0,
  currentId: null,
  directionIndex: 0,
  initialDirection: 0,
  retries: 0,
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  if (crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function getCategoryColor(id) {
  return state.categories.find(x => x.id === id)?.color || null;
}

function contrastTextColor(hex) {
  if (!isHexColor(hex)) return "#111827";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminance > 160 ? "#111827" : "#ffffff";
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function getCategoryName(id) {
  return state.categories.find(x => x.id === id)?.name || "Uncategorized";
}

function getTagName(id) {
  return state.tags.find(x => x.id === id)?.name || "";
}

function reversePair(id) {
  return id[1] + id[0];
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAll() {
  renderManagers();
  renderFilters();
  renderCases();
  renderTrainingChoices();
  updateTrainingSelectionCount();
  renderCategoryMatrix();
  renderStats();
}

function renderManagers() {
  const catList = document.getElementById("categoryManagerList");
  const tagList = document.getElementById("tagManagerList");

  document.getElementById("categoryCount").textContent = `${state.categories.length} total`;
  document.getElementById("tagCount").textContent = `${state.tags.length} total`;

  catList.innerHTML = state.categories.length
    ? state.categories.map(c => {
        const editing = editingCategoryId === c.id;
        return editing ? `
          <div class="manager-chip category-manager-chip editing-category">
            <div class="category-edit-topline">
              <input class="manager-name-input" type="text" maxlength="40" value="${escapeHtml(c.name)}" data-edit-category-name="${c.id}" aria-label="Rename ${escapeHtml(c.name)}">
              <input class="manager-color-input" type="color" value="${c.color}" data-edit-category-color="${c.id}" aria-label="Color for ${escapeHtml(c.name)}">
            </div>
            <div class="category-edit-actions">
              <button class="category-action save" data-save-category="${c.id}">Save</button>
              <button class="category-action" data-cancel-category="${c.id}">Cancel</button>
            </div>
          </div>` : `
          <div class="manager-chip category-manager-chip" data-category-chip="${c.id}">
            <div class="category-summary-row">
              <button
                class="category-drag-handle"
                type="button"
                data-drag-category="${c.id}"
                aria-label="Drag to reorder ${escapeHtml(c.name)}"
                title="Drag to reorder"
              >⋮⋮</button>
              <span class="category-swatch" style="background:${c.color}"></span>
              <span class="category-name">${escapeHtml(c.name)}</span>
              <span class="category-spacer"></span>
              <button class="category-action" data-edit-category="${c.id}">Edit</button>
              <button class="chip-delete" data-delete-category="${c.id}" aria-label="Delete ${escapeHtml(c.name)}">×</button>
            </div>
          </div>`;
      }).join("")
    : `<span class="muted">No categories yet.</span>`;

  tagList.innerHTML = state.tags.length
    ? state.tags.map(t => `
      <span class="manager-chip">
        ${escapeHtml(t.name)}
        <button class="chip-delete" data-delete-tag="${t.id}" aria-label="Delete ${escapeHtml(t.name)}">×</button>
      </span>`).join("")
    : `<span class="muted">No tags yet.</span>`;
}

function renderFilters() {
  const categoryFilter = document.getElementById("categoryFilter");
  const tagFilter = document.getElementById("tagFilter");
  const prevCat = categoryFilter.value;
  const prevTag = tagFilter.value;

  categoryFilter.innerHTML = `
    <option value="all">All</option>
    <option value="uncategorized">Uncategorized</option>
    ${state.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
  `;
  tagFilter.innerHTML = `
    <option value="all">All</option>
    <option value="untagged">Untagged</option>
    ${state.tags.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("")}
  `;

  if ([...categoryFilter.options].some(o => o.value === prevCat)) categoryFilter.value = prevCat;
  if ([...tagFilter.options].some(o => o.value === prevTag)) tagFilter.value = prevTag;
  renderSelectedCategoryDescription();
}

function renderSelectedCategoryDescription() {
  const filter = document.getElementById("categoryFilter");
  const panel = document.getElementById("selectedCategoryDescriptionPanel");
  const nameEl = document.getElementById("selectedCategoryDescriptionName");
  const swatchEl = document.getElementById("selectedCategoryDescriptionSwatch");
  const input = document.getElementById("selectedCategoryDescriptionInput");

  if (!filter || !panel || !nameEl || !swatchEl || !input) return;

  const categoryId = filter.value;
  const category = state.categories.find(c => c.id === categoryId);

  if (!category) {
    panel.classList.add("hidden");
    input.value = "";
    input.dataset.categoryId = "";
    return;
  }

  panel.classList.remove("hidden");
  nameEl.textContent = category.name;
  swatchEl.style.background = category.color;
  input.value = category.description || "";
  input.dataset.categoryId = category.id;
}

function getFilteredCaseIds() {
  const q = document.getElementById("caseSearch").value.trim().toUpperCase();
  const cat = document.getElementById("categoryFilter").value;
  const tag = document.getElementById("tagFilter").value;
  const sort = document.getElementById("sortCases").value;

  let ids = ALL_CASE_IDS.filter(id => {
    const item = state.cases[id];
    const pairText = `${id} ${reversePair(id)}`;
    const matchesSearch = !q || pairText.includes(q);

    let matchesCat = true;
    if (cat === "uncategorized") matchesCat = !item.categoryId;
    else if (cat !== "all") matchesCat = item.categoryId === cat;

    let matchesTag = true;
    if (tag === "untagged") matchesTag = item.tagIds.length === 0;
    else if (tag !== "all") matchesTag = item.tagIds.includes(tag);

    return matchesSearch && matchesCat && matchesTag;
  });

  ids.sort((a, b) => {
    const A = state.cases[a], B = state.cases[b];
    if (sort === "reviews-asc") return A.reviewCount - B.reviewCount || a.localeCompare(b);
    if (sort === "reviews-desc") return B.reviewCount - A.reviewCount || a.localeCompare(b);
    if (sort === "category") {
      return getCategoryName(A.categoryId).localeCompare(getCategoryName(B.categoryId)) || a.localeCompare(b);
    }
    return a.localeCompare(b);
  });

  return ids;
}

function renderCases() {
  const ids = getFilteredCaseIds();
  document.getElementById("visibleCaseCount").textContent = `${ids.length} of ${ALL_CASE_IDS.length} cases`;

  const list = document.getElementById("caseList");
  if (!ids.length) {
    list.innerHTML = `<div class="panel"><span class="muted">No cases match these filters.</span></div>`;
    return;
  }

  list.innerHTML = ids.map(id => {
    const item = state.cases[id];
    const tagHtml = state.tags.length
      ? state.tags.map(tag => `
        <label class="tag-toggle">
          <input type="checkbox" data-case-tag="${id}" value="${tag.id}" ${item.tagIds.includes(tag.id) ? "checked" : ""}>
          <span>${escapeHtml(tag.name)}</span>
        </label>`).join("")
      : `<span class="muted">Create tags above to assign them here.</span>`;

    return `
      <article class="case-card" data-case-id="${id}" ${item.categoryId ? `style="border-left:5px solid ${getCategoryColor(item.categoryId)}"` : ""}>
        <div class="case-card-header">
          <div class="case-pair">${id} / ${reversePair(id)}</div>
          <div class="case-reviews">${item.reviewCount} good review${item.reviewCount === 1 ? "" : "s"}</div>
        </div>

        <div class="case-fields">
          <label>
            <span>Category</span>
            <select data-case-category="${id}">
              <option value="">Uncategorized</option>
              ${state.categories.map(c => `<option value="${c.id}" ${item.categoryId === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
            </select>
          </label>

          <div>
            <span class="muted" style="display:block;font-size:.8rem;font-weight:700;margin-bottom:5px;">Tags</span>
            <div class="tag-checkboxes">${tagHtml}</div>
          </div>

          <label>
            <span>Notes</span>
            <textarea data-case-notes="${id}" placeholder="Setup idea, recognition cue, execution note...">${escapeHtml(item.notes)}</textarea>
          </label>
        </div>

        <div class="case-card-footer">
          <span class="muted">Manual review adjustment</span>
          <div class="review-adjust">
            <button data-review-minus="${id}" aria-label="Decrease review count">−</button>
            <strong>${item.reviewCount}</strong>
            <button data-review-plus="${id}" aria-label="Increase review count">+</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderTrainingChoices() {
  const container = document.getElementById("trainingCategoryChoices");
  const letterContainer = document.getElementById("trainingLetterChoices");

  const previous = new Set(
    [...container.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value)
  );
  const previousLetters = new Set(
    [...letterContainer.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value)
  );

  letterContainer.innerHTML = TARGET_LETTERS.map(letter => `
    <label class="letter-choice">
      <input type="checkbox" value="${letter}" ${previousLetters.has(letter) ? "checked" : ""}>
      <span>${letter}</span>
    </label>
  `).join("");

  if (!state.categories.length) {
    container.innerHTML = `<span class="muted">No categories yet. You can still train uncategorized cases.</span>`;
    return;
  }

  container.innerHTML = state.categories.map(c => `
    <label class="training-choice" style="border-color:${c.color}">
      <input type="checkbox" value="${c.id}" ${previous.has(c.id) ? "checked" : ""}>
      <span class="category-swatch" style="background:${c.color}"></span>
      <span>${escapeHtml(c.name)}</span>
    </label>
  `).join("");
}

function selectedTrainingCaseIds() {
  const selectedCats = new Set(
    [...document.querySelectorAll('#trainingCategoryChoices input[type="checkbox"]:checked')].map(x => x.value)
  );
  const includeUncategorized = document.getElementById("includeUncategorized").checked;
  const selectedLetters = new Set(
    [...document.querySelectorAll('#trainingLetterChoices input[type="checkbox"]:checked')].map(x => x.value)
  );

  return ALL_CASE_IDS.filter(id => {
    const cat = state.cases[id].categoryId;
    const matchesCategory = (cat && selectedCats.has(cat)) || (!cat && includeUncategorized);
    const matchesLetter =
      selectedLetters.size === 0 ||
      [...selectedLetters].some(letter => id.includes(letter));
    return matchesCategory && matchesLetter;
  });
}

function updateTrainingSelectionCount() {
  const count = selectedTrainingCaseIds().length;
  document.getElementById("trainingCaseCount").textContent = `${count} case${count === 1 ? "" : "s"} selected`;
  document.getElementById("startTrainingBtn").disabled = count === 0;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startSession() {
  const selected = selectedTrainingCaseIds();
  if (!selected.length) return;

  training.active = true;
  training.queue = shuffle(selected);
  training.totalUnique = selected.length;
  training.goodCount = 0;
  training.currentId = null;
  training.retries = 0;

  document.getElementById("trainSetup").classList.add("hidden");
  document.getElementById("sessionComplete").classList.add("hidden");
  document.getElementById("activeTraining").classList.remove("hidden");

  loadNextTrainingCard();
}

function loadNextTrainingCard() {
  if (!training.queue.length) {
    finishSession();
    return;
  }

  training.currentId = training.queue.shift();
  training.initialDirection = Math.random() < 0.5 ? 0 : 1;
  training.directionIndex = 0;

  document.getElementById("trainingNotesBox").classList.add("hidden");
  document.getElementById("toggleNotesBtn").textContent = "Show notes";
  document.getElementById("directionActions").classList.remove("hidden");
  document.getElementById("gradeActions").classList.add("hidden");
  document.getElementById("trainingNoteEditor").classList.add("hidden");

  renderTrainingCard();
}

function currentDirectionPair() {
  const id = training.currentId;
  const order = training.initialDirection === 0 ? [id, reversePair(id)] : [reversePair(id), id];
  return order[training.directionIndex];
}

function renderTrainingCard() {
  const id = training.currentId;
  if (!id) return;
  const item = state.cases[id];

  const categoryBadge = document.getElementById("trainingCategoryBadge");
  const categoryColor = getCategoryColor(item.categoryId);
  categoryBadge.textContent = getCategoryName(item.categoryId);
  categoryBadge.style.backgroundColor = categoryColor || "var(--soft)";
  categoryBadge.style.color = categoryColor ? contrastTextColor(categoryColor) : "var(--text)";
  document.getElementById("trainingCard").style.borderTop = categoryColor ? `6px solid ${categoryColor}` : "1px solid var(--line)";
  document.getElementById("trainingReviewCount").textContent =
    `${item.reviewCount} previous good review${item.reviewCount === 1 ? "" : "s"}`;
  document.getElementById("directionLabel").textContent = `Direction ${training.directionIndex + 1} of 2`;
  document.getElementById("trainingPair").textContent = currentDirectionPair();
  document.getElementById("trainingNotesText").textContent = item.notes || "No notes for this case.";
  const trainingNoteInput = document.getElementById("trainingNoteInput");
  trainingNoteInput.value = item.notes || "";
  trainingNoteInput.dataset.caseId = id;

  document.getElementById("sessionProgress").textContent =
    `${training.goodCount} / ${training.totalUnique} good`;
  document.getElementById("sessionQueueText").textContent =
    `${training.queue.length + 1} card${training.queue.length === 0 ? "" : "s"} currently in queue`;
}

function advanceDirection() {
  if (training.directionIndex === 0) {
    training.directionIndex = 1;
    document.getElementById("directionLabel").textContent = "Direction 2 of 2";
    document.getElementById("trainingPair").textContent = currentDirectionPair();
    document.getElementById("nextDirectionBtn").textContent = "I did this direction →";
    return;
  }

  document.getElementById("directionActions").classList.add("hidden");
  document.getElementById("trainingNoteEditor").classList.remove("hidden");
  document.getElementById("gradeActions").classList.remove("hidden");
  document.getElementById("directionLabel").textContent = "Grade both directions";
  document.getElementById("trainingPair").textContent = `${training.currentId} / ${reversePair(training.currentId)}`;
}

function gradeGood() {
  const id = training.currentId;
  state.cases[id].reviewCount += 1;
  training.goodCount += 1;
  saveState();
  renderStats();
  loadNextTrainingCard();
}

function gradeTryAgain() {
  const id = training.currentId;
  training.retries += 1;

  // Put the failed card back 2–4 cards from now, or at the end if the queue is shorter.
  const offset = 2 + Math.floor(Math.random() * 3);
  const insertAt = Math.min(offset, training.queue.length);
  training.queue.splice(insertAt, 0, id);

  loadNextTrainingCard();
}

function finishSession() {
  training.active = false;
  training.currentId = null;
  document.getElementById("activeTraining").classList.add("hidden");
  document.getElementById("sessionComplete").classList.remove("hidden");
  document.getElementById("completeSummary").textContent =
    `${training.totalUnique} cases completed with ${training.retries} ${training.retries === 1 ? "retry" : "retries"}.`;
  renderCases();
  renderStats();
}

function endSession() {
  training.active = false;
  training.queue = [];
  training.currentId = null;
  document.getElementById("activeTraining").classList.add("hidden");
  document.getElementById("sessionComplete").classList.add("hidden");
  document.getElementById("trainSetup").classList.remove("hidden");
}


function renderCategoryMatrix() {
  const container = document.getElementById("categoryMatrix");
  if (!container) return;

  let html = `<div class="matrix-label corner"></div>`;

  for (const letter of TARGET_LETTERS) {
    html += `<div class="matrix-label top">${letter}</div>`;
  }

  for (let row = 0; row < TARGET_LETTERS.length; row++) {
    const a = TARGET_LETTERS[row];
    html += `<div class="matrix-label side">${a}</div>`;

    for (let col = 0; col < TARGET_LETTERS.length; col++) {
      const b = TARGET_LETTERS[col];

      if (col <= row || pieceOf[a] === pieceOf[b]) {
        html += `<div class="matrix-cell blocked" aria-hidden="true"></div>`;
        continue;
      }

      const id = canonicalPair(a, b);
      const item = state.cases[id];
      const color = getCategoryColor(item.categoryId);
      const title = `${id} / ${reversePair(id)} — ${getCategoryName(item.categoryId)}`;
      const cls = color ? "categorized" : "uncategorized";
      const style = color ? ` style="background:${color};"` : "";

      html += `<div class="matrix-cell ${cls}" title="${escapeHtml(title)}"${style}></div>`;
    }
  }

  container.innerHTML = html;
}

function renderStats() {
  const counts = ALL_CASE_IDS.map(id => state.cases[id].reviewCount);
  const total = counts.reduce((a, b) => a + b, 0);
  const reviewed = counts.filter(x => x > 0).length;
  const never = counts.length - reviewed;

  document.getElementById("totalReviewsStat").textContent = total;
  document.getElementById("reviewedCasesStat").textContent = `${reviewed} / ${ALL_CASE_IDS.length}`;
  document.getElementById("neverReviewedStat").textContent = never;
  document.getElementById("averageReviewsStat").textContent = (total / ALL_CASE_IDS.length).toFixed(1);

  const categoryRows = [
    { id: null, name: "Uncategorized", color: null },
    ...state.categories.map(c => ({ id: c.id, name: c.name, color: c.color }))
  ].map(cat => {
    const ids = ALL_CASE_IDS.filter(id => state.cases[id].categoryId === cat.id);
    const reviews = ids.reduce((sum, id) => sum + state.cases[id].reviewCount, 0);
    return { ...cat, cases: ids.length, reviews };
  }).filter(x => x.cases > 0);

  document.getElementById("categoryStats").innerHTML = categoryRows.length
    ? categoryRows.map(row => `
      <div class="stats-row">
        <div style="display:flex;align-items:center;gap:9px;">
          ${row.color ? `<span class="category-swatch" style="background:${row.color}"></span>` : ""}
          <div>
            <strong>${escapeHtml(row.name)}</strong>
            <div class="muted">${row.cases} case${row.cases === 1 ? "" : "s"}</div>
          </div>
        </div>
        <strong>${row.reviews} reviews</strong>
      </div>
    `).join("")
    : `<span class="muted">No cases to summarize.</span>`;

  const sort = document.getElementById("statsSort")?.value || "asc";
  const ids = [...ALL_CASE_IDS].sort((a, b) => {
    const A = state.cases[a].reviewCount, B = state.cases[b].reviewCount;
    if (sort === "desc") return B - A || a.localeCompare(b);
    if (sort === "pair") return a.localeCompare(b);
    return A - B || a.localeCompare(b);
  });

  document.getElementById("caseStatsList").innerHTML = ids.map(id => {
    const item = state.cases[id];
    return `
      <div class="case-stat-row">
        <div class="case-stat-left">
          <span class="case-stat-pair">${id} / ${reversePair(id)}</span>
          <span class="muted">${escapeHtml(getCategoryName(item.categoryId))}</span>
        </div>
        <div class="case-stat-actions">
          <strong>${item.reviewCount}</strong>
          <button class="button ghost compact-reset" data-reset-review="${id}" ${item.reviewCount === 0 ? "disabled" : ""}>Reset</button>
        </div>
      </div>
    `;
  }).join("");
}

function resetCaseReviewCount(id) {
  if (!state.cases[id] || state.cases[id].reviewCount === 0) return;
  const current = state.cases[id].reviewCount;
  if (!confirm(`Reset ${id} / ${reversePair(id)} from ${current} good review${current === 1 ? "" : "s"} to 0?`)) return;

  state.cases[id].reviewCount = 0;
  saveState();
  renderCases();
  renderStats();
  showToast(`${id} / ${reversePair(id)} reset`);
}

function resetAllReviewCounts() {
  const total = ALL_CASE_IDS.reduce((sum, id) => sum + state.cases[id].reviewCount, 0);
  if (total === 0) {
    showToast("All review counts are already 0");
    return;
  }

  if (!confirm(`Reset all ${total} recorded good reviews to 0? Categories, tags, colors, and notes will be kept.`)) return;

  ALL_CASE_IDS.forEach(id => { state.cases[id].reviewCount = 0; });
  saveState();
  renderCases();
  renderStats();
  showToast("All review counts reset");
}

function exportJson() {
  const payload = {
    ...state,
    exportedAt: new Date().toISOString(),
    app: "3-Style Corner Trainer"
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `3style-corner-trainer-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Backup exported");
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = sanitizeState(parsed);
      saveState();
      endSession();
      renderAll();
      showToast("Backup imported");
    } catch (err) {
      alert("That file could not be imported. Please choose a valid trainer JSON backup.");
    }
    document.getElementById("importInput").value = "";
  };
  reader.readAsText(file);
}

function addCategory(name, color) {
  const clean = name.trim();
  if (!clean) return;
  if (state.categories.some(c => c.name.toLowerCase() === clean.toLowerCase())) {
    showToast("That category already exists");
    return;
  }
  state.categories.push({
    id: uid("cat"),
    name: clean,
    color: isHexColor(color) ? color : DEFAULT_CATEGORY_COLOR,
    description: ""
  });
  saveState();
  renderAll();
}

function renameCategory(id, newName) {
  const category = state.categories.find(c => c.id === id);
  if (!category) return;

  const clean = newName.trim();
  if (!clean) {
    showToast("Category name cannot be empty");
    renderManagers();
    return;
  }

  const duplicate = state.categories.some(
    c => c.id !== id && c.name.toLowerCase() === clean.toLowerCase()
  );
  if (duplicate) {
    showToast("That category name already exists");
    renderManagers();
    return;
  }

  if (category.name === clean) return;
  category.name = clean;
  saveState();
  renderAll();
  showToast("Category renamed");
}

function addTag(name) {
  const clean = name.trim();
  if (!clean) return;
  if (state.tags.some(t => t.name.toLowerCase() === clean.toLowerCase())) {
    showToast("That tag already exists");
    return;
  }
  state.tags.push({ id: uid("tag"), name: clean });
  saveState();
  renderAll();
}

function deleteCategory(id) {
  const cat = state.categories.find(c => c.id === id);
  if (!cat) return;
  if (!confirm(`Delete category "${cat.name}"? Cases in it will become uncategorized.`)) return;

  state.categories = state.categories.filter(c => c.id !== id);
  if (editingCategoryId === id) editingCategoryId = null;
  ALL_CASE_IDS.forEach(caseId => {
    if (state.cases[caseId].categoryId === id) state.cases[caseId].categoryId = null;
  });
  saveState();
  renderAll();
}

function deleteTag(id) {
  const tag = state.tags.find(t => t.id === id);
  if (!tag) return;
  if (!confirm(`Delete tag "${tag.name}"? It will be removed from all cases.`)) return;

  state.tags = state.tags.filter(t => t.id !== id);
  ALL_CASE_IDS.forEach(caseId => {
    state.cases[caseId].tagIds = state.cases[caseId].tagIds.filter(x => x !== id);
  });
  saveState();
  renderAll();
}

function clearVisibleAssignments() {
  const ids = getFilteredCaseIds();
  if (!ids.length) return;
  if (!confirm(`Clear category, tags, and notes for the ${ids.length} currently visible cases? Review counts will be kept.`)) return;

  ids.forEach(id => {
    state.cases[id].categoryId = null;
    state.cases[id].tagIds = [];
    state.cases[id].notes = "";
  });
  saveState();
  renderAll();
  showToast("Visible assignments cleared");
}


let categoryDrag = null;

function beginCategoryDrag(event) {
  const handle = event.target.closest("[data-drag-category]");
  if (!handle) return;

  const chip = handle.closest("[data-category-chip]");
  if (!chip) return;

  event.preventDefault();
  categoryDrag = { pointerId: event.pointerId, chip, handle, moved: false };
  chip.classList.add("dragging-category");
  document.body.classList.add("category-drag-active");

  try { handle.setPointerCapture(event.pointerId); } catch {}
}

function moveCategoryDrag(event) {
  if (!categoryDrag || event.pointerId !== categoryDrag.pointerId) return;
  event.preventDefault();

  const { chip } = categoryDrag;
  chip.style.pointerEvents = "none";
  const underneath = document.elementFromPoint(event.clientX, event.clientY);
  chip.style.pointerEvents = "";

  const target = underneath?.closest?.("[data-category-chip]");
  if (!target || target === chip || !target.parentElement) return;

  const rect = target.getBoundingClientRect();
  const before = event.clientY < rect.top + rect.height / 2;
  const parent = target.parentElement;

  if (before) parent.insertBefore(chip, target);
  else parent.insertBefore(chip, target.nextSibling);

  categoryDrag.moved = true;
}

function finishCategoryDrag(event) {
  if (!categoryDrag || event.pointerId !== categoryDrag.pointerId) return;

  const { chip, handle, moved } = categoryDrag;
  try { handle.releasePointerCapture(event.pointerId); } catch {}

  chip.classList.remove("dragging-category");
  document.body.classList.remove("category-drag-active");

  if (moved) {
    const orderedIds = [...document.querySelectorAll("#categoryManagerList [data-category-chip]")]
      .map(el => el.dataset.categoryChip);
    const byId = new Map(state.categories.map(category => [category.id, category]));
    const reordered = orderedIds.map(id => byId.get(id)).filter(Boolean);
    const seen = new Set(reordered.map(category => category.id));
    for (const category of state.categories) {
      if (!seen.has(category.id)) reordered.push(category);
    }
    state.categories = reordered;
    saveState();
    renderAll();
    showToast("Category order saved");
  }

  categoryDrag = null;
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`${tab.dataset.view}View`).classList.add("active");
      if (tab.dataset.view === "stats") renderStats();
    });
  });

  document.getElementById("categoryForm").addEventListener("submit", e => {
    e.preventDefault();
    const input = document.getElementById("categoryNameInput");
    const colorInput = document.getElementById("categoryColorInput");
    addCategory(input.value, colorInput.value);
    input.value = "";
    const nextColor = CATEGORY_PALETTE[state.categories.length % CATEGORY_PALETTE.length];
    colorInput.value = nextColor;
  });

  document.getElementById("tagForm").addEventListener("submit", e => {
    e.preventDefault();
    const input = document.getElementById("tagNameInput");
    addTag(input.value);
    input.value = "";
  });

  const categoryManagerList = document.getElementById("categoryManagerList");
  categoryManagerList.addEventListener("pointerdown", beginCategoryDrag);
  categoryManagerList.addEventListener("pointermove", moveCategoryDrag);
  categoryManagerList.addEventListener("pointerup", finishCategoryDrag);
  categoryManagerList.addEventListener("pointercancel", finishCategoryDrag);

  document.getElementById("categoryManagerList").addEventListener("click", e => {
    const deleteId = e.target.dataset.deleteCategory;
    if (deleteId) {
      deleteCategory(deleteId);
      return;
    }

    const editId = e.target.dataset.editCategory;
    if (editId) {
      editingCategoryId = editId;
      renderManagers();
      const input = document.querySelector(`[data-edit-category-name="${editId}"]`);
      if (input) {
        input.focus();
        input.select();
      }
      return;
    }

    const cancelId = e.target.dataset.cancelCategory;
    if (cancelId) {
      editingCategoryId = null;
      renderManagers();
      return;
    }

    const saveId = e.target.dataset.saveCategory;
    if (saveId) {
      const category = state.categories.find(c => c.id === saveId);
      const nameInput = document.querySelector(`[data-edit-category-name="${saveId}"]`);
      const colorInput = document.querySelector(`[data-edit-category-color="${saveId}"]`);
      if (!category || !nameInput || !colorInput) return;

      const clean = nameInput.value.trim();
      if (!clean) {
        showToast("Category name cannot be empty");
        nameInput.focus();
        return;
      }
      const duplicate = state.categories.some(
        c => c.id !== saveId && c.name.toLowerCase() === clean.toLowerCase()
      );
      if (duplicate) {
        showToast("That category name already exists");
        nameInput.focus();
        return;
      }

      category.name = clean;
      if (isHexColor(colorInput.value)) category.color = colorInput.value;
      editingCategoryId = null;
      saveState();
      renderAll();
      showToast("Category updated");
    }
  });

  document.getElementById("categoryManagerList").addEventListener("keydown", e => {
    const editId = e.target.dataset.editCategoryName;
    if (!editId) return;
    if (e.key === "Enter") {
      e.preventDefault();
      document.querySelector(`[data-save-category="${editId}"]`)?.click();
    } else if (e.key === "Escape") {
      e.preventDefault();
      editingCategoryId = null;
      renderManagers();
    }
  });

  document.getElementById("tagManagerList").addEventListener("click", e => {
    const id = e.target.dataset.deleteTag;
    if (id) deleteTag(id);
  });

  ["caseSearch", "tagFilter", "sortCases"].forEach(id => {
    document.getElementById(id).addEventListener(id === "caseSearch" ? "input" : "change", renderCases);
  });

  document.getElementById("categoryFilter").addEventListener("change", () => {
    renderSelectedCategoryDescription();
    renderCases();
  });

  document.getElementById("selectedCategoryDescriptionInput").addEventListener("input", e => {
    const categoryId = e.target.dataset.categoryId;
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return;
    category.description = e.target.value.slice(0, 12000);
    saveState();
  });

  document.getElementById("caseList").addEventListener("change", e => {
    const categoryId = e.target.dataset.caseCategory;
    const tagCaseId = e.target.dataset.caseTag;

    if (categoryId) {
      const newCategoryId = e.target.value || null;
      state.cases[categoryId].categoryId = newCategoryId;
      saveState();

      // Update this card's category color immediately instead of waiting for
      // the organizer list to be rendered again.
      const card = e.target.closest(".case-card");
      if (card) {
        if (newCategoryId) {
          card.style.borderLeft = `5px solid ${getCategoryColor(newCategoryId)}`;
        } else {
          card.style.borderLeft = "";
        }
      }

      renderTrainingChoices();
      updateTrainingSelectionCount();
      renderStats();
      return;
    }

    if (tagCaseId) {
      const tagId = e.target.value;
      const tags = new Set(state.cases[tagCaseId].tagIds);
      if (e.target.checked) tags.add(tagId);
      else tags.delete(tagId);
      state.cases[tagCaseId].tagIds = [...tags];
      saveState();
    }
  });

  document.getElementById("caseList").addEventListener("input", e => {
    const notesCaseId = e.target.dataset.caseNotes;
    if (!notesCaseId) return;
    state.cases[notesCaseId].notes = e.target.value;
    saveState();
  });

  document.getElementById("caseList").addEventListener("click", e => {
    const plus = e.target.dataset.reviewPlus;
    const minus = e.target.dataset.reviewMinus;
    if (plus) {
      state.cases[plus].reviewCount += 1;
      saveState();
      renderCases();
      renderStats();
    }
    if (minus) {
      state.cases[minus].reviewCount = Math.max(0, state.cases[minus].reviewCount - 1);
      saveState();
      renderCases();
      renderStats();
    }
  });

  document.getElementById("clearAssignmentsBtn").addEventListener("click", clearVisibleAssignments);

  document.getElementById("trainingCategoryChoices").addEventListener("change", updateTrainingSelectionCount);
  document.getElementById("includeUncategorized").addEventListener("change", updateTrainingSelectionCount);
  document.getElementById("trainingLetterChoices").addEventListener("change", updateTrainingSelectionCount);

  document.getElementById("selectAllLettersBtn").addEventListener("click", () => {
    document.querySelectorAll('#trainingLetterChoices input[type="checkbox"]').forEach(x => x.checked = true);
    updateTrainingSelectionCount();
  });

  document.getElementById("clearLetterSelectionBtn").addEventListener("click", () => {
    document.querySelectorAll('#trainingLetterChoices input[type="checkbox"]').forEach(x => x.checked = false);
    updateTrainingSelectionCount();
  });

  document.getElementById("selectAllCategoriesBtn").addEventListener("click", () => {
    document.querySelectorAll('#trainingCategoryChoices input[type="checkbox"]').forEach(x => x.checked = true);
    document.getElementById("includeUncategorized").checked = true;
    updateTrainingSelectionCount();
  });

  document.getElementById("clearCategorySelectionBtn").addEventListener("click", () => {
    document.querySelectorAll('#trainingCategoryChoices input[type="checkbox"]').forEach(x => x.checked = false);
    document.getElementById("includeUncategorized").checked = false;
    updateTrainingSelectionCount();
  });

  document.getElementById("startTrainingBtn").addEventListener("click", startSession);
  document.getElementById("nextDirectionBtn").addEventListener("click", advanceDirection);

  document.addEventListener("keydown", e => {
    if (e.code !== "Space") return;
    if (!training.active) return;

    const directionActions = document.getElementById("directionActions");
    if (!directionActions || directionActions.classList.contains("hidden")) return;

    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (["input", "textarea", "select"].includes(activeTag)) return;

    e.preventDefault();
    advanceDirection();
  });

  document.getElementById("goodBtn").addEventListener("click", gradeGood);
  document.getElementById("tryAgainBtn").addEventListener("click", gradeTryAgain);
  document.getElementById("endSessionBtn").addEventListener("click", endSession);
  document.getElementById("newSessionBtn").addEventListener("click", () => {
    document.getElementById("sessionComplete").classList.add("hidden");
    document.getElementById("trainSetup").classList.remove("hidden");
    updateTrainingSelectionCount();
  });

  document.getElementById("toggleNotesBtn").addEventListener("click", () => {
    const box = document.getElementById("trainingNotesBox");
    box.classList.toggle("hidden");
    document.getElementById("toggleNotesBtn").textContent =
      box.classList.contains("hidden") ? "Show notes" : "Hide notes";
  });

  document.getElementById("trainingNoteInput").addEventListener("input", e => {
    const caseId = e.target.dataset.caseId;
    if (!caseId || !state.cases[caseId]) return;

    state.cases[caseId].notes = e.target.value.slice(0, 4000);
    document.getElementById("trainingNotesText").textContent =
      state.cases[caseId].notes || "No notes for this case.";
    saveState();
  });

  document.getElementById("statsSort").addEventListener("change", renderStats);

  document.getElementById("caseStatsList").addEventListener("click", e => {
    const id = e.target.dataset.resetReview;
    if (id) resetCaseReviewCount(id);
  });

  document.getElementById("resetAllReviewsBtn").addEventListener("click", resetAllReviewCounts);

  document.getElementById("exportBtn").addEventListener("click", exportJson);
  document.getElementById("importInput").addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (file) importJson(file);
  });

  window.addEventListener("beforeunload", saveState);
}

function init() {
  if (ALL_CASE_IDS.length !== 189) {
    console.warn(`Expected 189 valid unordered cases, found ${ALL_CASE_IDS.length}.`);
  }
  bindEvents();
  renderAll();
}

init();
