/**
 * Expense & Budget Visualizer
 * Vanilla JS · LocalStorage · Chart.js
 */

'use strict';

/* ── Constants ──────────────────────────────────────────────── */
const STORAGE_KEY = 'budgetVisualizer_transactions';

const CATEGORY_COLORS = {
  Food:      '#f97316',
  Transport: '#3b82f6',
  Fun:       '#a855f7',
};

const CATEGORY_LABELS = {
  Food:      '🍔 Food',
  Transport: '🚌 Transport',
  Fun:       '🎉 Fun',
};

/* ── State ──────────────────────────────────────────────────── */
let transactions = loadTransactions();
let chart        = null;

/* ── DOM references ─────────────────────────────────────────── */
const form          = document.getElementById('transactionForm');
const itemNameInput = document.getElementById('itemName');
const amountInput   = document.getElementById('amount');
const categoryInput = document.getElementById('category');

const nameError     = document.getElementById('nameError');
const amountError   = document.getElementById('amountError');
const categoryError = document.getElementById('categoryError');

const totalBalanceEl = document.getElementById('totalBalance');
const txListEl       = document.getElementById('txList');
const txCountEl      = document.getElementById('txCount');
const emptyStateEl   = document.getElementById('emptyState');
const chartEmptyEl   = document.getElementById('chartEmpty');
const chartCanvas    = document.getElementById('spendingChart');

/* ── LocalStorage helpers ───────────────────────────────────── */
function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/* ── Validation ─────────────────────────────────────────────── */
function clearErrors() {
  [itemNameInput, amountInput, categoryInput].forEach(el => el.classList.remove('invalid'));
  nameError.textContent     = '';
  amountError.textContent   = '';
  categoryError.textContent = '';
}

function validateForm() {
  clearErrors();
  let valid = true;

  const name     = itemNameInput.value.trim();
  const amount   = parseFloat(amountInput.value);
  const category = categoryInput.value;

  if (!name) {
    nameError.textContent = 'Item name is required.';
    itemNameInput.classList.add('invalid');
    valid = false;
  }

  if (!amountInput.value || isNaN(amount) || amount <= 0) {
    amountError.textContent = 'Enter a valid amount greater than 0.';
    amountInput.classList.add('invalid');
    valid = false;
  }

  if (!category) {
    categoryError.textContent = 'Please select a category.';
    categoryInput.classList.add('invalid');
    valid = false;
  }

  return valid;
}

/* ── Render ─────────────────────────────────────────────────── */

/** Render the full transaction list */
function renderList() {
  txListEl.innerHTML = '';

  if (transactions.length === 0) {
    emptyStateEl.style.display = 'block';
    txCountEl.textContent      = '0';
    return;
  }

  emptyStateEl.style.display = 'none';
  txCountEl.textContent      = transactions.length;

  // Show newest first
  [...transactions].reverse().forEach(tx => {
    const li = document.createElement('li');
    li.className   = 'tx-item';
    li.dataset.id  = tx.id;
    li.innerHTML   = `
      <span class="tx-dot ${tx.category}"></span>
      <div class="tx-info">
        <div class="tx-name" title="${escapeHtml(tx.name)}">${escapeHtml(tx.name)}</div>
        <div class="tx-meta">${CATEGORY_LABELS[tx.category]} · ${tx.date}</div>
      </div>
      <span class="tx-amount">-$${formatAmount(tx.amount)}</span>
      <button class="btn-delete" aria-label="Delete ${escapeHtml(tx.name)}">✕</button>
    `;

    // Delete handler
    li.querySelector('.btn-delete').addEventListener('click', () => deleteTransaction(tx.id));
    txListEl.appendChild(li);
  });
}

/** Update the balance display */
function renderBalance() {
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  totalBalanceEl.textContent = `-$${formatAmount(total)}`;

  // Green balance when no spending
  totalBalanceEl.style.color = total === 0 ? '#6ee7b7' : '#fff';
}

/** Build / update the pie chart */
function renderChart() {
  // Aggregate by category
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach(tx => { totals[tx.category] += tx.amount; });

  const categories = Object.keys(totals).filter(k => totals[k] > 0);
  const hasData    = categories.length > 0;

  chartEmptyEl.style.display    = hasData ? 'none'  : 'block';
  chartCanvas.style.display     = hasData ? 'block' : 'none';

  if (!hasData) {
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  const data   = categories.map(k => totals[k]);
  const colors = categories.map(k => CATEGORY_COLORS[k]);
  const labels = categories.map(k => `${CATEGORY_LABELS[k]}  $${formatAmount(totals[k])}`);

  if (chart) {
    // Update existing chart in-place (smooth transition)
    chart.data.labels          = labels;
    chart.data.datasets[0].data           = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update();
  } else {
    chart = new Chart(chartCanvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor:     '#ffffff',
          borderWidth:     3,
          hoverOffset:     8,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding:     16,
              font:        { size: 13 },
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` $${formatAmount(ctx.parsed)}`,
            },
          },
        },
      },
    });
  }
}

/** Re-render everything */
function renderAll() {
  renderBalance();
  renderList();
  renderChart();
}

/* ── CRUD ───────────────────────────────────────────────────── */

function addTransaction(name, amount, category) {
  const tx = {
    id:       crypto.randomUUID(),
    name:     name.trim(),
    amount:   parseFloat(amount),
    category,
    date:     new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }),
  };
  transactions.push(tx);
  saveTransactions();
  renderAll();
}

function deleteTransaction(id) {
  transactions = transactions.filter(tx => tx.id !== id);
  saveTransactions();
  renderAll();
}

/* ── Event listeners ────────────────────────────────────────── */

form.addEventListener('submit', e => {
  e.preventDefault();
  if (!validateForm()) return;

  addTransaction(itemNameInput.value, amountInput.value, categoryInput.value);

  // Reset form
  form.reset();
  clearErrors();
  itemNameInput.focus();
});

// Live-clear errors on input
itemNameInput.addEventListener('input',  () => { itemNameInput.classList.remove('invalid');  nameError.textContent     = ''; });
amountInput.addEventListener('input',    () => { amountInput.classList.remove('invalid');    amountError.textContent   = ''; });
categoryInput.addEventListener('change', () => { categoryInput.classList.remove('invalid'); categoryError.textContent = ''; });

/* ── Utilities ──────────────────────────────────────────────── */

function formatAmount(value) {
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

/* ── Boot ───────────────────────────────────────────────────── */
renderAll();
