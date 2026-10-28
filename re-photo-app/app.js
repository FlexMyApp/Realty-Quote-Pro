/* RE Photo Pro - Real Estate Photography Quote & Job Manager
   Vanilla JS PWA - All data in localStorage
   Updated with PropRaven lookup via Netlify Function
*/

const APP_VERSION = '1.1.0';
const STORAGE_KEY = 'rePhotoPro_data_v1';

// ===== Default Data =====
const DEFAULT_BUSINESS = {
  name: 'Your Photography Business',
  email: '',
  phone: '',
  website: '',
  address: '',
  taxRate: 0,
  taxLabel: 'Sales Tax',
  currency: 'USD',
  quotePrefix: 'Q',
  invoicePrefix: 'INV',
  nextQuoteNum: 1001,
  nextInvoiceNum: 1001,
  terms: 'Payment is due within 14 days of invoice date. Thank you for your business!',
  notesDefault: ''
};

const DEFAULT_SERVICES = [
  { id: 'interior', name: 'Interior Photography', defaultPrice: 150, unit: 'job' },
  { id: 'exterior', name: 'Exterior Photography', defaultPrice: 75, unit: 'job' },
  { id: 'drone', name: 'Drone / Aerial Photography', defaultPrice: 125, unit: 'job' },
  { id: 'virtual', name: 'Virtual Tour / 360°', defaultPrice: 200, unit: 'job' },
  { id: 'editing', name: 'Additional Editing / Retouching', defaultPrice: 50, unit: 'hour' },
  { id: 'rush', name: 'Rush Delivery', defaultPrice: 75, unit: 'job' },
  { id: 'return', name: 'Return Trip / Reshoot', defaultPrice: 100, unit: 'job' },
  { id: 'travel', name: 'Travel Fee', defaultPrice: 0, unit: 'job' }
];

const DEFAULT_PRICING = {
  basePackage: 175,
  sqftTiers: [
    { max: 1500, price: 175 },
    { max: 2500, price: 250 },
    { max: 3500, price: 325 },
    { max: 5000, price: 425 },
    { max: 99999, price: 550 }
  ],
  perBedroom: 0,
  perBathroom: 0,
  complexMultiplier: 1.15,
  largeLotSurcharge: 50,
  droneAdd: 125,
  virtualAdd: 200,
  rushAdd: 75,
  travelPerMile: 0.75,
  minTravelMiles: 20
};

const DEFAULT_PACKAGES = [
  {
    id: 'std',
    name: 'Standard Package',
    description: 'Interior + Exterior photos, basic editing',
    items: [
      { serviceId: 'interior', qty: 1, price: 150 },
      { serviceId: 'exterior', qty: 1, price: 75 }
    ]
  },
  {
    id: 'premium',
    name: 'Premium + Drone',
    description: 'Interior, Exterior, Drone, enhanced editing',
    items: [
      { serviceId: 'interior', qty: 1, price: 175 },
      { serviceId: 'exterior', qty: 1, price: 75 },
      { serviceId: 'drone', qty: 1, price: 125 }
    ]
  }
];

// ===== State =====
let state = {
  business: { ...DEFAULT_BUSINESS },
  services: [...DEFAULT_SERVICES],
  pricing: { ...DEFAULT_PRICING },
  packages: [...DEFAULT_PACKAGES],
  jobs: [],
  clients: [],
  currentView: 'dashboard',
  currentJobId: null,
  filterStatus: 'all',
  searchQuery: '',
  dateFilter: 'all'
};

// ===== Storage =====
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      state.business = { ...DEFAULT_BUSINESS, ...data.business };
      state.services = data.services || [...DEFAULT_SERVICES];
      state.pricing = { ...DEFAULT_PRICING, ...data.pricing };
      state.packages = data.packages || [...DEFAULT_PACKAGES];
      state.jobs = data.jobs || [];
      state.clients = data.clients || [];
    }
  } catch (e) {
    console.error('Load failed', e);
    showToast('Could not load saved data');
  }
}

function saveData() {
  try {
    const data = {
      business: state.business,
      services: state.services,
      pricing: state.pricing,
      packages: state.packages,
      jobs: state.jobs,
      clients: state.clients,
      version: APP_VERSION,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    updateStorageInfo();
  } catch (e) {
    console.error('Save failed', e);
    showToast('Save failed – storage may be full');
  }
}

function updateStorageInfo() {
  const el = document.getElementById('storageInfo');
  if (el) {
    const used = new Blob([localStorage.getItem(STORAGE_KEY) || '']).size;
    el.textContent = `Local storage · ${(used / 1024).toFixed(1)} KB · v${APP_VERSION}`;
  }
}

// ===== Helpers =====
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: state.business.currency || 'USD' }).format(n || 0);
}

function formatDate(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(msg, ms = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), ms);
}

function confirmAction(title, message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    modal.classList.remove('hidden');
    const ok = document.getElementById('confirmOk');
    const cancel = document.getElementById('confirmCancel');
    const cleanup = (val) => {
      modal.classList.add('hidden');
      ok.onclick = null;
      cancel.onclick = null;
      resolve(val);
    };
    ok.onclick = () => cleanup(true);
    cancel.onclick = () => cleanup(false);
  });
}

// ===== Pricing Engine =====
function recommendPrice(property, selectedServices = []) {
  const p = state.pricing;
  const sqft = Number(property.sqft) || 0;
  let base = p.basePackage;
  let explanation = [];

  for (const tier of p.sqftTiers) {
    if (sqft <= tier.max) {
      base = tier.price;
      explanation.push(`Base for ${sqft || '?'} sqft: ${formatMoney(tier.price)}`);
      break;
    }
  }

  const beds = Number(property.beds) || 0;
  const baths = Number(property.baths) || 0;
  if (p.perBedroom && beds) {
    const add = beds * p.perBedroom;
    base += add;
    explanation.push(`+ ${beds} bedrooms × ${formatMoney(p.perBedroom)}`);
  }
  if (p.perBathroom && baths) {
    const add = baths * p.perBathroom;
    base += add;
    explanation.push(`+ ${baths} baths × ${formatMoney(p.perBathroom)}`);
  }

  const stories = Number(property.stories) || 1;
  const hasPool = !!property.hasPool;
  if (stories > 1 || hasPool || (property.lotSize && Number(property.lotSize) > 0.5)) {
    const mult = p.complexMultiplier;
    base = Math.round(base * mult);
    explanation.push(`Complexity multiplier ×${mult}`);
  }

  let serviceAdds = 0;
  selectedServices.forEach(s => {
    if (s.id === 'drone' && s.qty > 0) { serviceAdds += p.droneAdd; explanation.push(`Drone add: ${formatMoney(p.droneAdd)}`); }
    if (s.id === 'virtual' && s.qty > 0) { serviceAdds += p.virtualAdd; explanation.push(`Virtual tour add: ${formatMoney(p.virtualAdd)}`); }
    if (s.id === 'rush' && s.qty > 0) { serviceAdds += p.rushAdd; explanation.push(`Rush: ${formatMoney(p.rushAdd)}`); }
  });

  const recommended = Math.round(base + serviceAdds);
  return { recommended, explanation, base };
}

// ===== Job Helpers =====
function createEmptyJob() {
  return {
    id: uid(),
    quoteNumber: state.business.quotePrefix + state.business.nextQuoteNum,
    invoiceNumber: '',
    status: 'quoted',
    createdAt: new Date().toISOString(),
    quoteDate: todayISO(),
    serviceDate: '',
    expireDate: '',
    clientId: null,
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientCompany: '',
    property: {
      address: '',
      city: '',
      state: '',
      zip: '',
      sqft: '',
      beds: '',
      baths: '',
      stories: '',
      yearBuilt: '',
      propertyType: '',
      lotSize: '',
      hasGarage: false,
      hasPool: false,
      notes: '',
      source: 'Manual entry',
      retrievedAt: null
    },
    lineItems: [],
    discount: 0,
    discountType: 'amount',
    taxRate: state.business.taxRate,
    deposit: 0,
    amountPaid: 0,
    notes: state.business.notesDefault || '',
    terms: state.business.terms || '',
    timeEntries: [],
    expenses: [],
    estimatedHours: 0,
    estimatedPrice: 0
  };
}

function calcJobTotals(job) {
  const subtotal = (job.lineItems || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  let discount = Number(job.discount) || 0;
  if (job.discountType === 'percent') discount = subtotal * (discount / 100);
  const afterDiscount = Math.max(0, subtotal - discount);
  const tax = afterDiscount * ((Number(job.taxRate) || 0) / 100);
  const total = afterDiscount + tax;
  const paid = Number(job.amountPaid) || 0;
  const balance = Math.max(0, total - paid);
  return { subtotal, discount, tax, total, paid, balance };
}

function calcJobProfit(job) {
  const { total } = calcJobTotals(job);
  const expenses = (job.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const hours = (job.timeEntries || []).reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const profit = total - expenses;
  const revPerHour = hours > 0 ? total / hours : 0;
  const profitPerHour = hours > 0 ? profit / hours : 0;
  return { total, expenses, hours, profit, revPerHour, profitPerHour };
}

function getOrCreateClient(job) {
  if (!job.clientName && !job.clientEmail) return null;
  let client = state.clients.find(c =>
    (job.clientEmail && c.email === job.clientEmail) ||
    (job.clientName && c.name === job.clientName)
  );
  if (!client) {
    client = {
      id: uid(),
      name: job.clientName || '',
      email: job.clientEmail || '',
      phone: job.clientPhone || '',
      company: job.clientCompany || '',
      createdAt: new Date().toISOString()
    };
    state.clients.push(client);
  } else {
    client.name = job.clientName || client.name;
    client.email = job.clientEmail || client.email;
    client.phone = job.clientPhone || client.phone;
    client.company = job.clientCompany || client.company;
  }
  return client.id;
}

// ===== Navigation =====
function navigate(view, jobId = null) {
  state.currentView = view;
  state.currentJobId = jobId;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view || (view === 'job-detail' && el.dataset.view === 'jobs'));
  });
  const titles = {
    dashboard: 'Dashboard',
    jobs: 'Jobs',
    'new-job': 'New Quote / Job',
    'job-detail': 'Job Details',
    clients: 'Clients',
    pricing: 'Pricing Rules',
    settings: 'Settings & Backup'
  };
  document.getElementById('pageTitle').textContent = titles[view] || 'RE Photo Pro';
  closeSidebar();
  render();
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ===== Render =====
function render() {
  const main = document.getElementById('mainContent');
  switch (state.currentView) {
    case 'dashboard': main.innerHTML = renderDashboard(); break;
    case 'jobs': main.innerHTML = renderJobsList(); break;
    case 'new-job': main.innerHTML = renderJobForm(createEmptyJob(), true); break;
    case 'job-detail': {
      const job = state.jobs.find(j => j.id === state.currentJobId);
      if (!job) { navigate('jobs'); return; }
      main.innerHTML = renderJobForm(job, false);
      break;
    }
    case 'clients': main.innerHTML = renderClients(); break;
    case 'pricing': main.innerHTML = renderPricing(); break;
    case 'settings': main.innerHTML = renderSettings(); break;
    default: main.innerHTML = renderDashboard();
  }
  bindViewEvents();
}

// ===== Dashboard =====
function renderDashboard() {
  const now = new Date();
  let jobs = state.jobs;
  if (state.dateFilter === 'week') {
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    jobs = jobs.filter(j => new Date(j.createdAt) >= weekAgo);
  } else if (state.dateFilter === 'month') {
    const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
    jobs = jobs.filter(j => new Date(j.createdAt) >= monthAgo);
  } else if (state.dateFilter === 'year') {
    const yearAgo = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    jobs = jobs.filter(j => new Date(j.createdAt) >= yearAgo);
  }

  const completed = jobs.filter(j => ['completed', 'invoiced', 'paid'].includes(j.status));
  const quoted = jobs.filter(j => j.status === 'quoted');
  let revenue = 0, outstanding = 0, totalHours = 0, totalProfit = 0;
  completed.forEach(j => {
    const p = calcJobProfit(j);
    revenue += p.total;
    totalHours += p.hours;
    totalProfit += p.profit;
  });
  jobs.forEach(j => {
    const t = calcJobTotals(j);
    if (['quoted', 'scheduled', 'completed', 'invoiced'].includes(j.status)) outstanding += t.balance;
  });
  const avgPrice = completed.length ? revenue / completed.length : 0;
  const avgHours = completed.length ? totalHours / completed.length : 0;
  const avgRevHr = totalHours > 0 ? revenue / totalHours : 0;

  const svcCount = {};
  jobs.forEach(j => (j.lineItems || []).forEach(li => {
    if (li.qty > 0) svcCount[li.name] = (svcCount[li.name] || 0) + 1;
  }));
  const topServices = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Period</span>
        <div class="filter-chips">
          <button class="chip ${state.dateFilter === 'all' ? 'active' : ''}" data-period="all">All</button>
          <button class="chip ${state.dateFilter === 'week' ? 'active' : ''}" data-period="week">Week</button>
          <button class="chip ${state.dateFilter === 'month' ? 'active' : ''}" data-period="month">Month</button>
          <button class="chip ${state.dateFilter === 'year' ? 'active' : ''}" data-period="year">Year</button>
        </div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${quoted.length}</div><div class="stat-label">Quotes</div></div>
      <div class="stat-card"><div class="stat-value">${completed.length}</div><div class="stat-label">Completed</div></div>
      <div class="stat-card"><div class="stat-value">${formatMoney(revenue)}</div><div class="stat-label">Revenue</div></div>
      <div class="stat-card"><div class="stat-value">${formatMoney(outstanding)}</div><div class="stat-label">Outstanding</div></div>
      <div class="stat-card"><div class="stat-value">${formatMoney(avgPrice)}</div><div class="stat-label">Avg Job Price</div></div>
      <div class="stat-card"><div class="stat-value">${avgHours.toFixed(1)}h</div><div class="stat-label">Avg Hours/Job</div></div>
      <div class="stat-card"><div class="stat-value">${formatMoney(avgRevHr)}</div><div class="stat-label">Avg Rev/Hour</div></div>
      <div class="stat-card"><div class="stat-value">${formatMoney(totalProfit)}</div><div class="stat-label">Est. Profit</div></div>
    </div>
    ${topServices.length ? `
    <div class="card">
      <div class="card-title">Most Requested Services</div>
      <ul style="margin-top:10px;padding-left:18px;">
        ${topServices.map(([n, c]) => `<li>${n} <span style="color:var(--text-muted)">(${c})</span></li>`).join('')}
      </ul>
    </div>` : ''}
    <div class="card">
      <div class="card-header">
        <span class="card-title">Recent Jobs</span>
        <button class="btn btn-sm btn-outline" data-nav="jobs">View All</button>
      </div>
      <div class="job-list">
        ${state.jobs.slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map(j => jobListItem(j)).join('') || '<div class="empty-state">No jobs yet. Create your first quote!</div>'}
      </div>
    </div>
  `;
}

function jobListItem(j) {
  const t = calcJobTotals(j);
  const addr = j.property.address || 'No address';
  return `
    <div class="job-item status-${j.status}" data-job-id="${j.id}">
      <div class="job-address">${addr}${j.property.city ? ', ' + j.property.city : ''}</div>
      <div class="job-meta">
        <span class="badge badge-${j.status}">${j.status}</span>
        <span>${j.clientName || 'No client'}</span>
        <span>${formatDate(j.quoteDate)}</span>
        <span>${formatMoney(t.total)}</span>
        ${t.balance > 0 ? `<span style="color:var(--warning)">Bal ${formatMoney(t.balance)}</span>` : ''}
      </div>
    </div>
  `;
}

// ===== Jobs List =====
function renderJobsList() {
  let jobs = state.jobs.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (state.filterStatus !== 'all') jobs = jobs.filter(j => j.status === state.filterStatus);
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    jobs = jobs.filter(j =>
      (j.property.address || '').toLowerCase().includes(q) ||
      (j.clientName || '').toLowerCase().includes(q) ||
      (j.quoteNumber || '').toLowerCase().includes(q) ||
      (j.invoiceNumber || '').toLowerCase().includes(q)
    );
  }
  return `
    <div class="search-bar">
      <input type="search" id="jobSearch" placeholder="Search address, client, quote #..." value="${state.searchQuery}">
    </div>
    <div class="filter-chips">
      ${['all','quoted','scheduled','completed','invoiced','paid','cancelled'].map(s =>
        `<button class="chip ${state.filterStatus === s ? 'active' : ''}" data-status="${s}">${s}</button>`
      ).join('')}
    </div>
    <div class="job-list">
      ${jobs.map(j => jobListItem(j)).join('') || '<div class="empty-state"><div class="icon">📋</div>No jobs match your filters</div>'}
    </div>
  `;
}

// ===== Job Form =====
function renderJobForm(job, isNew) {
  const totals = calcJobTotals(job);
  const profit = calcJobProfit(job);

  return `
    <form id="jobForm">
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>Status</label>
            <select name="status">
              ${['quoted','scheduled','completed','invoiced','paid','cancelled'].map(s =>
                `<option value="${s}" ${job.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Quote #</label>
            <input name="quoteNumber" value="${job.quoteNumber || ''}" ${isNew ? '' : 'readonly'}>
          </div>
          <div class="form-group">
            <label>Invoice #</label>
            <input name="invoiceNumber" value="${job.invoiceNumber || ''}" placeholder="Auto on invoice">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Quote Date</label>
            <input type="date" name="quoteDate" value="${job.quoteDate || ''}">
          </div>
          <div class="form-group">
            <label>Service Date</label>
            <input type="date" name="serviceDate" value="${job.serviceDate || ''}">
          </div>
          <div class="form-group">
            <label>Expires</label>
            <input type="date" name="expireDate" value="${job.expireDate || ''}">
          </div>
        </div>
      </div>

      <div class="section-title">Client</div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>Name / Agent</label>
            <input name="clientName" value="${job.clientName || ''}" placeholder="Client or agent name" list="clientList">
            <datalist id="clientList">${state.clients.map(c => `<option value="${c.name}">`).join('')}</datalist>
          </div>
          <div class="form-group">
            <label>Company</label>
            <input name="clientCompany" value="${job.clientCompany || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="clientEmail" value="${job.clientEmail || ''}">
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" name="clientPhone" value="${job.clientPhone || ''}">
          </div>
        </div>
      </div>

      <div class="section-title">Property</div>
      <div class="card">
        <div class="form-group">
          <label>Street Address</label>
          <input name="address" value="${job.property.address || ''}" placeholder="123 Main St" id="propAddress">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>City</label>
            <input name="city" value="${job.property.city || ''}" id="propCity">
          </div>
          <div class="form-group">
            <label>State</label>
            <input name="state" value="${job.property.state || ''}" maxlength="2" id="propState">
          </div>
          <div class="form-group">
            <label>ZIP</label>
            <input name="zip" value="${job.property.zip || ''}" id="propZip">
          </div>
        </div>
        <div class="btn-group">
          <button type="button" class="btn btn-outline btn-sm" id="lookupBtn">🔍 Lookup Property Info</button>
        </div>
        <div class="source-note" id="lookupNote">
          Property details are entered manually by default. Lookup uses PropRaven via Netlify Function when configured.
        </div>
        <div class="prop-grid" style="margin-top:12px;">
          <div class="form-group">
            <label>Sq Ft</label>
            <input type="number" name="sqft" value="${job.property.sqft || ''}" min="0" id="propSqft">
          </div>
          <div class="form-group">
            <label>Beds</label>
            <input type="number" name="beds" value="${job.property.beds || ''}" min="0" step="0.5" id="propBeds">
          </div>
          <div class="form-group">
            <label>Baths</label>
            <input type="number" name="baths" value="${job.property.baths || ''}" min="0" step="0.5" id="propBaths">
          </div>
          <div class="form-group">
            <label>Stories</label>
            <input type="number" name="stories" value="${job.property.stories || ''}" min="0" step="0.5" id="propStories">
          </div>
          <div class="form-group">
            <label>Year Built</label>
            <input type="number" name="yearBuilt" value="${job.property.yearBuilt || ''}" min="1800" max="2030" id="propYear">
          </div>
          <div class="form-group">
            <label>Type</label>
            <select name="propertyType" id="propType">
              <option value="">—</option>
              ${['Single Family','Condo','Townhouse','Multi-Family','Commercial','Land','Other'].map(t =>
                `<option value="${t}" ${job.property.propertyType === t ? 'selected' : ''}>${t}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Lot Size (acres)</label>
            <input type="number" name="lotSize" value="${job.property.lotSize || ''}" min="0" step="0.01" id="propLot">
          </div>
          <div class="form-group">
            <label>Garage</label>
            <select name="hasGarage" id="propGarage">
              <option value="false" ${!job.property.hasGarage ? 'selected' : ''}>No</option>
              <option value="true" ${job.property.hasGarage ? 'selected' : ''}>Yes</option>
            </select>
          </div>
          <div class="form-group">
            <label>Pool</label>
            <select name="hasPool" id="propPool">
              <option value="false" ${!job.property.hasPool ? 'selected' : ''}>No</option>
              <option value="true" ${job.property.hasPool ? 'selected' : ''}>Yes</option>
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-top:10px;">
          <label>Property Notes</label>
          <textarea name="propNotes" rows="2">${job.property.notes || ''}</textarea>
        </div>
        ${job.property.source ? `<div class="source-note">Source: ${job.property.source}${job.property.retrievedAt ? ' · ' + formatDate(job.property.retrievedAt) : ''}</div>` : ''}
      </div>

      <div class="section-title">Services & Pricing</div>
      <div class="card">
        <div class="btn-group" style="margin-bottom:12px;">
          <button type="button" class="btn btn-sm btn-outline" id="applyPackageBtn">Apply Package</button>
          <button type="button" class="btn btn-sm btn-outline" id="addLineBtn">+ Add Line</button>
          <button type="button" class="btn btn-sm btn-secondary" id="recommendBtn">💡 Recommend Price</button>
        </div>
        <div id="recommendBox" class="source-note" style="display:none;margin-bottom:12px;"></div>
        <div class="line-items" id="lineItems">
          ${(job.lineItems || []).map((li, idx) => lineItemHTML(li, idx)).join('') || '<p style="color:var(--text-muted);font-size:.9rem;">No services yet. Add a package or line item.</p>'}
        </div>
        <div class="totals-box">
          <div class="total-row"><span>Subtotal</span><span id="dispSubtotal">${formatMoney(totals.subtotal)}</span></div>
          <div class="total-row">
            <span>
              Discount
              <select name="discountType" style="width:auto;display:inline;padding:2px 6px;font-size:.8rem;">
                <option value="amount" ${job.discountType === 'amount' ? 'selected' : ''}>$</option>
                <option value="percent" ${job.discountType === 'percent' ? 'selected' : ''}>%</option>
              </select>
            </span>
            <span><input type="number" name="discount" value="${job.discount || 0}" min="0" step="0.01" style="width:90px;text-align:right;"></span>
          </div>
          <div class="total-row"><span>Tax (${job.taxRate || 0}%)</span><span id="dispTax">${formatMoney(totals.tax)}</span></div>
          <div class="total-row grand"><span>Total</span><span id="dispTotal">${formatMoney(totals.total)}</span></div>
          <div class="total-row">
            <span>Amount Paid</span>
            <span><input type="number" name="amountPaid" value="${job.amountPaid || 0}" min="0" step="0.01" style="width:90px;text-align:right;"></span>
          </div>
          <div class="total-row"><span>Balance</span><span id="dispBalance">${formatMoney(totals.balance)}</span></div>
          <div class="total-row">
            <span>Deposit (optional)</span>
            <span><input type="number" name="deposit" value="${job.deposit || 0}" min="0" step="0.01" style="width:90px;text-align:right;"></span>
          </div>
        </div>
      </div>

      <div class="section-title">Time Tracking</div>
      <div class="card">
        <div id="timeEntries">
          ${(job.timeEntries || []).map((t, i) => timeEntryHTML(t, i)).join('')}
        </div>
        <button type="button" class="btn btn-sm btn-outline" id="addTimeBtn">+ Add Time</button>
        <div class="profit-summary">
          <div class="profit-box">
            <div class="value">${profit.hours.toFixed(1)}h</div>
            <div class="label">Total Hours</div>
          </div>
          <div class="profit-box">
            <div class="value">${formatMoney(profit.revPerHour)}</div>
            <div class="label">Revenue / Hour</div>
          </div>
        </div>
      </div>

      <div class="section-title">Expenses</div>
      <div class="card">
        <div id="expenseEntries">
          ${(job.expenses || []).map((e, i) => expenseHTML(e, i)).join('')}
        </div>
        <button type="button" class="btn btn-sm btn-outline" id="addExpenseBtn">+ Add Expense</button>
        <div class="profit-summary">
          <div class="profit-box ${profit.profit >= 0 ? 'positive' : 'negative'}">
            <div class="value">${formatMoney(profit.profit)}</div>
            <div class="label">Est. Profit</div>
          </div>
          <div class="profit-box ${profit.profitPerHour >= 0 ? 'positive' : 'negative'}">
            <div class="value">${formatMoney(profit.profitPerHour)}</div>
            <div class="label">Profit / Hour</div>
          </div>
        </div>
      </div>

      <div class="section-title">Notes & Terms</div>
      <div class="card">
        <div class="form-group">
          <label>Job Notes</label>
          <textarea name="notes" rows="3">${job.notes || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Terms</label>
          <textarea name="terms" rows="2">${job.terms || ''}</textarea>
        </div>
      </div>

      <div class="btn-group" style="margin-top:20px;margin-bottom:40px;">
        <button type="submit" class="btn btn-primary btn-block">${isNew ? 'Save Quote' : 'Update Job'}</button>
        ${!isNew ? `
          <button type="button" class="btn btn-success" id="genQuotePdf">📄 Quote PDF</button>
          <button type="button" class="btn btn-success" id="genInvoicePdf">📄 Invoice PDF</button>
          <button type="button" class="btn btn-secondary" id="genReceiptPdf">🧾 Receipt PDF</button>
          <button type="button" class="btn btn-outline" id="duplicateJob">Duplicate</button>
          <button type="button" class="btn btn-danger" id="deleteJob">Delete</button>
        ` : ''}
      </div>
    </form>
  `;
}

function lineItemHTML(li, idx) {
  const total = (Number(li.qty) || 0) * (Number(li.price) || 0);
  return `
    <div class="line-item" data-idx="${idx}">
      <div class="desc form-group" style="margin:0;">
        <label>Description</label>
        <input name="li_name_${idx}" value="${li.name || ''}" placeholder="Service">
      </div>
      <div class="qty form-group" style="margin:0;">
        <label>Qty</label>
        <input type="number" name="li_qty_${idx}" value="${li.qty ?? 1}" min="0" step="0.5">
      </div>
      <div class="price form-group" style="margin:0;">
        <label>Price</label>
        <input type="number" name="li_price_${idx}" value="${li.price ?? 0}" min="0" step="0.01">
      </div>
      <div class="total form-group" style="margin:0;">
        <label>Total</label>
        <input type="text" value="${formatMoney(total)}" readonly tabindex="-1">
      </div>
      <div class="rm">
        <button type="button" class="icon-btn remove-line" data-idx="${idx}" style="color:var(--danger);font-size:1.2rem;" title="Remove">×</button>
      </div>
    </div>
  `;
}

function timeEntryHTML(t, i) {
  return `
    <div class="time-grid" data-idx="${i}">
      <div class="form-group" style="margin:0;">
        <label>Category</label>
        <select name="time_cat_${i}">
          ${['Photography','Drone','Editing','Driving','Upload/Delivery','Admin/Communication','Reshoot','Other'].map(c =>
            `<option value="${c}" ${t.category === c ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group" style="margin:0;">
        <label>Hours</label>
        <input type="number" name="time_hours_${i}" value="${t.hours || 0}" min="0" step="0.25">
      </div>
      <button type="button" class="icon-btn remove-time" data-idx="${i}" style="color:var(--danger);">×</button>
    </div>
  `;
}

function expenseHTML(e, i) {
  return `
    <div class="expense-grid" data-idx="${i}">
      <div class="form-group" style="margin:0;">
        <label>Description</label>
        <input name="exp_desc_${i}" value="${e.description || ''}" placeholder="Mileage, parking, supplies...">
      </div>
      <div class="form-group" style="margin:0;">
        <label>Amount</label>
        <input type="number" name="exp_amt_${i}" value="${e.amount || 0}" min="0" step="0.01">
      </div>
      <button type="button" class="icon-btn remove-exp" data-idx="${i}" style="color:var(--danger);">×</button>
    </div>
  `;
}

// ===== Clients =====
function renderClients() {
  const clients = state.clients.slice().sort((a, b) => a.name.localeCompare(b.name));
  return `
    <div class="card">
      <p class="card-subtitle">Clients are created automatically when you save jobs. ${clients.length} total.</p>
    </div>
    <div class="job-list">
      ${clients.map(c => {
        const jobCount = state.jobs.filter(j => j.clientId === c.id || j.clientName === c.name).length;
        return `
          <div class="job-item" style="cursor:default;">
            <div class="job-address">${c.name || 'Unnamed'}</div>
            <div class="job-meta">
              ${c.company ? `<span>${c.company}</span>` : ''}
              ${c.email ? `<span>${c.email}</span>` : ''}
              ${c.phone ? `<span>${c.phone}</span>` : ''}
              <span>${jobCount} job${jobCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        `;
      }).join('') || '<div class="empty-state">No clients yet</div>'}
    </div>
  `;
}

// ===== Pricing Rules =====
function renderPricing() {
  const p = state.pricing;
  return `
    <div class="card">
      <p class="card-subtitle">These rules power the “Recommend Price” button. All values are editable.</p>
    </div>
    <div class="card">
      <div class="card-title">Base & Square Footage Tiers</div>
      <div class="form-group" style="margin-top:12px;">
        <label>Default Base Package ($)</label>
        <input type="number" id="basePackage" value="${p.basePackage}" min="0" step="1">
      </div>
      <div id="sqftTiers">
        ${p.sqftTiers.map((t, i) => `
          <div class="form-row" style="margin-bottom:8px;">
            <div class="form-group"><label>Up to sqft</label><input type="number" class="tier-max" data-i="${i}" value="${t.max}"></div>
            <div class="form-group"><label>Price ($)</label><input type="number" class="tier-price" data-i="${i}" value="${t.price}"></div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Add-ons & Multipliers</div>
      <div class="form-row">
        <div class="form-group"><label>$ per Bedroom</label><input type="number" id="perBedroom" value="${p.perBedroom}" min="0"></div>
        <div class="form-group"><label>$ per Bathroom</label><input type="number" id="perBathroom" value="${p.perBathroom}" min="0"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Complexity Multiplier</label><input type="number" id="complexMult" value="${p.complexMultiplier}" min="1" step="0.05"></div>
        <div class="form-group"><label>Drone Add ($)</label><input type="number" id="droneAdd" value="${p.droneAdd}" min="0"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Virtual Tour Add ($)</label><input type="number" id="virtualAdd" value="${p.virtualAdd}" min="0"></div>
        <div class="form-group"><label>Rush Add ($)</label><input type="number" id="rushAdd" value="${p.rushAdd}" min="0"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Service Catalog (defaults)</div>
      <div class="package-list" id="serviceList">
        ${state.services.map((s, i) => `
          <div class="package-item">
            <span>${s.name}</span>
            <input type="number" class="svc-price" data-i="${i}" value="${s.defaultPrice}" style="width:90px;" min="0" step="1">
          </div>
        `).join('')}
      </div>
    </div>
    <button class="btn btn-primary btn-block" id="savePricingBtn" style="margin-top:12px;">Save Pricing Rules</button>
  `;
}

// ===== Settings =====
function renderSettings() {
  const b = state.business;
  return `
    <div class="settings-section">
      <div class="card">
        <div class="card-title">Business Information</div>
        <div class="form-group" style="margin-top:12px;">
          <label>Business Name</label>
          <input id="bizName" value="${b.name || ''}">
        </div>
        <div class="form-row">
          <div class="form-group"><label>Email</label><input id="bizEmail" type="email" value="${b.email || ''}"></div>
          <div class="form-group"><label>Phone</label><input id="bizPhone" value="${b.phone || ''}"></div>
        </div>
        <div class="form-group"><label>Website</label><input id="bizWebsite" value="${b.website || ''}"></div>
        <div class="form-group"><label>Address</label><input id="bizAddress" value="${b.address || ''}"></div>
        <div class="form-row">
          <div class="form-group"><label>Tax Rate (%)</label><input id="bizTax" type="number" value="${b.taxRate || 0}" min="0" step="0.01"></div>
          <div class="form-group"><label>Tax Label</label><input id="bizTaxLabel" value="${b.taxLabel || 'Sales Tax'}"></div>
        </div>
        <div class="form-group"><label>Default Terms</label><textarea id="bizTerms" rows="2">${b.terms || ''}</textarea></div>
        <button class="btn btn-primary" id="saveBizBtn" style="margin-top:10px;">Save Business Info</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="card">
        <div class="card-title">Property Lookup</div>
        <p class="card-subtitle" style="margin:10px 0;">
          Lookup now uses a Netlify Function + PropRaven. Make sure you have set the <code>PROPRAVEN_API_KEY</code> environment variable in Netlify.
        </p>
      </div>
    </div>

    <div class="settings-section">
      <div class="card">
        <div class="card-title">Data Backup & Restore</div>
        <p class="card-subtitle" style="margin:10px 0;">
          All data is stored in this browser’s localStorage.
        </p>
        <div class="btn-group">
          <button class="btn btn-primary" id="exportBackupBtn">⬇️ Download Backup (JSON)</button>
          <button class="btn btn-secondary" id="exportCsvBtn">⬇️ Export Jobs CSV</button>
        </div>
        <div class="form-group" style="margin-top:16px;">
          <label>Restore from Backup</label>
          <input type="file" id="restoreFile" accept=".json,application/json">
        </div>
        <button class="btn btn-danger btn-sm" id="clearDataBtn" style="margin-top:8px;">Clear All Data</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="card">
        <div class="card-title">About</div>
        <p class="card-subtitle">RE Photo Pro v${APP_VERSION}<br>
        Runs in your browser. PDF generation uses jsPDF.</p>
      </div>
    </div>
  `;
}

// ===== Collect Form Data =====
function collectJobFromForm() {
  const form = document.getElementById('jobForm');
  if (!form) return null;
  const fd = new FormData(form);
  const get = (n) => fd.get(n) || '';

  const job = state.currentJobId
    ? { ...state.jobs.find(j => j.id === state.currentJobId) }
    : createEmptyJob();

  job.status = get('status');
  job.quoteNumber = get('quoteNumber');
  job.invoiceNumber = get('invoiceNumber');
  job.quoteDate = get('quoteDate');
  job.serviceDate = get('serviceDate');
  job.expireDate = get('expireDate');
  job.clientName = get('clientName');
  job.clientCompany = get('clientCompany');
  job.clientEmail = get('clientEmail');
  job.clientPhone = get('clientPhone');
  job.notes = get('notes');
  job.terms = get('terms');
  job.discount = Number(get('discount')) || 0;
  job.discountType = get('discountType') || 'amount';
  job.amountPaid = Number(get('amountPaid')) || 0;
  job.deposit = Number(get('deposit')) || 0;
  job.taxRate = state.business.taxRate;

  job.property = {
    ...job.property,
    address: get('address'),
    city: get('city'),
    state: get('state'),
    zip: get('zip'),
    sqft: get('sqft'),
    beds: get('beds'),
    baths: get('baths'),
    stories: get('stories'),
    yearBuilt: get('yearBuilt'),
    propertyType: get('propertyType'),
    lotSize: get('lotSize'),
    hasGarage: get('hasGarage') === 'true',
    hasPool: get('hasPool') === 'true',
    notes: get('propNotes')
  };

  const lineItems = [];
  form.querySelectorAll('.line-item').forEach((el, idx) => {
    const name = form.querySelector(`[name="li_name_${idx}"]`)?.value;
    if (name) {
      lineItems.push({
        name,
        qty: Number(form.querySelector(`[name="li_qty_${idx}"]`)?.value) || 0,
        price: Number(form.querySelector(`[name="li_price_${idx}"]`)?.value) || 0
      });
    }
  });
  job.lineItems = lineItems;

  const timeEntries = [];
  form.querySelectorAll('.time-grid').forEach((el, idx) => {
    const cat = form.querySelector(`[name="time_cat_${idx}"]`)?.value;
    const hours = Number(form.querySelector(`[name="time_hours_${idx}"]`)?.value) || 0;
    if (cat && hours > 0) timeEntries.push({ category: cat, hours });
  });
  job.timeEntries = timeEntries;

  const expenses = [];
  form.querySelectorAll('.expense-grid').forEach((el, idx) => {
    const desc = form.querySelector(`[name="exp_desc_${idx}"]`)?.value;
    const amount = Number(form.querySelector(`[name="exp_amt_${idx}"]`)?.value) || 0;
    if (desc || amount) expenses.push({ description: desc, amount });
  });
  job.expenses = expenses;

  return job;
}

// ===== PDF Generation =====
function generatePDF(job, type = 'quote') {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;
  const b = state.business;
  const totals = calcJobTotals(job);
  const isQuote = type === 'quote';
  const isInvoice = type === 'invoice';
  const isReceipt = type === 'receipt';

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(26, 54, 93);
  doc.text(b.name || 'Photography Business', margin, y);
  y += 18;
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(80);
  const bizLines = [b.address, [b.phone, b.email].filter(Boolean).join(' · '), b.website].filter(Boolean);
  bizLines.forEach(l => { doc.text(l, margin, y); y += 12; });

  y = margin;
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(26, 54, 93);
  const title = isQuote ? 'QUOTE' : isInvoice ? 'INVOICE' : 'PAYMENT RECEIPT';
  doc.text(title, pageW - margin, y, { align: 'right' });
  y += 16;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(60);
  const num = isQuote ? job.quoteNumber : (job.invoiceNumber || job.quoteNumber);
  doc.text(`# ${num}`, pageW - margin, y, { align: 'right' });
  y += 12;
  doc.text(`Date: ${formatDate(job.quoteDate || job.createdAt)}`, pageW - margin, y, { align: 'right' });
  if (job.serviceDate) { y += 12; doc.text(`Service: ${formatDate(job.serviceDate)}`, pageW - margin, y, { align: 'right' }); }
  if (isQuote && job.expireDate) { y += 12; doc.text(`Valid until: ${formatDate(job.expireDate)}`, pageW - margin, y, { align: 'right' }); }

  y = Math.max(y, margin + 70) + 10;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(26, 54, 93);
  doc.text('BILL TO', margin, y);
  doc.text('PROPERTY', pageW / 2, y);
  y += 14;
  doc.setFont(undefined, 'normal');
  doc.setTextColor(40);
  const clientLines = [job.clientName, job.clientCompany, job.clientEmail, job.clientPhone].filter(Boolean);
  const propLines = [
    job.property.address,
    [job.property.city, job.property.state, job.property.zip].filter(Boolean).join(', '),
    job.property.sqft ? `${job.property.sqft} sqft` : '',
    [job.property.beds ? `${job.property.beds} bd` : '', job.property.baths ? `${job.property.baths} ba` : ''].filter(Boolean).join(' / '),
    job.property.propertyType
  ].filter(Boolean);
  const maxLines = Math.max(clientLines.length, propLines.length, 1);
  for (let i = 0; i < maxLines; i++) {
    if (clientLines[i]) doc.text(clientLines[i], margin, y);
    if (propLines[i]) doc.text(propLines[i], pageW / 2, y);
    y += 13;
  }
  y += 12;

  const tableBody = (job.lineItems || []).map(li => [
    li.name,
    String(li.qty),
    formatMoney(li.price),
    formatMoney((li.qty || 0) * (li.price || 0))
  ]);
  doc.autoTable({
    startY: y,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [26, 54, 93], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 50, halign: 'center' },
      2: { cellWidth: 80, halign: 'right' },
      3: { cellWidth: 80, halign: 'right' }
    }
  });
  y = doc.lastAutoTable.finalY + 16;

  const rightX = pageW - margin;
  const labelX = rightX - 140;
  const rows = [
    ['Subtotal', formatMoney(totals.subtotal)],
    ['Discount', formatMoney(totals.discount)],
    [`${b.taxLabel || 'Tax'} (${job.taxRate || 0}%)`, formatMoney(totals.tax)],
    ['TOTAL', formatMoney(totals.total)]
  ];
  if (isInvoice || isReceipt) {
    rows.push(['Amount Paid', formatMoney(totals.paid)]);
    rows.push(['Balance Due', formatMoney(totals.balance)]);
  }
  if (job.deposit && isQuote) rows.push(['Suggested Deposit', formatMoney(job.deposit)]);

  rows.forEach(([label, val], i) => {
    const isLast = i === rows.length - 1 || label === 'TOTAL';
    doc.setFont(undefined, isLast ? 'bold' : 'normal');
    doc.setFontSize(isLast ? 11 : 9);
    doc.text(label, labelX, y);
    doc.text(val, rightX, y, { align: 'right' });
    y += isLast ? 16 : 13;
  });

  if (job.notes || job.terms) {
    y += 10;
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
    y += 16;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(60);
    if (job.notes) {
      doc.setFont(undefined, 'bold');
      doc.text('Notes', margin, y);
      y += 12;
      doc.setFont(undefined, 'normal');
      const noteLines = doc.splitTextToSize(job.notes, pageW - margin * 2);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 12 + 8;
    }
    if (job.terms) {
      doc.setFont(undefined, 'bold');
      doc.text('Terms', margin, y);
      y += 12;
      doc.setFont(undefined, 'normal');
      const termLines = doc.splitTextToSize(job.terms, pageW - margin * 2);
      doc.text(termLines, margin, y);
    }
  }

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text('Generated by RE Photo Pro', pageW / 2, pageH - 24, { align: 'center' });

  const filename = `${type}_${num || job.id}.pdf`;
  doc.save(filename);
  showToast(`${title} downloaded`);
}

// ===== Event Binding =====
function bindViewEvents() {
  document.querySelectorAll('[data-period]').forEach(el => {
    el.onclick = () => { state.dateFilter = el.dataset.period; render(); };
  });
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.onclick = () => navigate(el.dataset.nav);
  });

  document.querySelectorAll('.job-item[data-job-id]').forEach(el => {
    el.onclick = () => navigate('job-detail', el.dataset.jobId);
  });
  document.querySelectorAll('[data-status]').forEach(el => {
    el.onclick = () => { state.filterStatus = el.dataset.status; render(); };
  });
  const search = document.getElementById('jobSearch');
  if (search) {
    search.oninput = () => {
      state.searchQuery = search.value;
      clearTimeout(search._t);
      search._t = setTimeout(render, 200);
    };
  }

  const form = document.getElementById('jobForm');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const job = collectJobFromForm();
      if (!job) return;
      job.clientId = getOrCreateClient(job);
      if (state.currentJobId) {
        const idx = state.jobs.findIndex(j => j.id === state.currentJobId);
        if (idx >= 0) state.jobs[idx] = job;
      } else {
        state.business.nextQuoteNum = (state.business.nextQuoteNum || 1001) + 1;
        job.quoteNumber = state.business.quotePrefix + (state.business.nextQuoteNum - 1);
        state.jobs.push(job);
      }
      saveData();
      showToast('Job saved');
      navigate('job-detail', job.id);
    };

    form.addEventListener('input', () => {
      const job = collectJobFromForm();
      if (!job) return;
      const t = calcJobTotals(job);
      const el = (id) => document.getElementById(id);
      if (el('dispSubtotal')) el('dispSubtotal').textContent = formatMoney(t.subtotal);
      if (el('dispTax')) el('dispTax').textContent = formatMoney(t.tax);
      if (el('dispTotal')) el('dispTotal').textContent = formatMoney(t.total);
      if (el('dispBalance')) el('dispBalance').textContent = formatMoney(t.balance);
    });

    document.getElementById('addLineBtn')?.addEventListener('click', () => {
      const job = collectJobFromForm();
      job.lineItems.push({ name: '', qty: 1, price: 0 });
      const isNew = !state.currentJobId;
      if (state.currentJobId) {
        const idx = state.jobs.findIndex(j => j.id === state.currentJobId);
        if (idx >= 0) state.jobs[idx] = job;
      }
      document.getElementById('mainContent').innerHTML = renderJobForm(job, isNew);
      bindViewEvents();
    });

    document.querySelectorAll('.remove-line').forEach(btn => {
      btn.onclick = () => {
        const job = collectJobFromForm();
        job.lineItems.splice(Number(btn.dataset.idx), 1);
        const isNew = !state.currentJobId;
        if (state.currentJobId) {
          const idx = state.jobs.findIndex(j => j.id === state.currentJobId);
          if (idx >= 0) state.jobs[idx] = job;
        }
        document.getElementById('mainContent').innerHTML = renderJobForm(job, isNew);
        bindViewEvents();
      };
    });

    document.getElementById('applyPackageBtn')?.addEventListener('click', () => {
      if (!state.packages.length) { showToast('No packages defined'); return; }
      const names = state.packages.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
      const choice = prompt(`Choose package number:\n${names}`);
      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || !state.packages[idx]) return;
      const pkg = state.packages[idx];
      const job = collectJobFromForm();
      job.lineItems = pkg.items.map(it => {
        const svc = state.services.find(s => s.id === it.serviceId);
        return { name: svc ? svc.name : it.serviceId, qty: it.qty, price: it.price };
      });
      const isNew = !state.currentJobId;
      if (state.currentJobId) {
        const i = state.jobs.findIndex(j => j.id === state.currentJobId);
        if (i >= 0) state.jobs[i] = job;
      }
      document.getElementById('mainContent').innerHTML = renderJobForm(job, isNew);
      bindViewEvents();
      showToast(`Applied: ${pkg.name}`);
    });

    document.getElementById('recommendBtn')?.addEventListener('click', () => {
      const job = collectJobFromForm();
      const rec = recommendPrice(job.property, job.lineItems);
      const box = document.getElementById('recommendBox');
      box.style.display = 'block';
      box.innerHTML = `<strong>Recommended: ${formatMoney(rec.recommended)}</strong><br>${rec.explanation.join('<br>')}<br><em>You can override any line price.</em>`;
    });

    // ===== LOOKUP BUTTON - NOW CALLS NETLIFY FUNCTION =====
    document.getElementById('lookupBtn')?.addEventListener('click', async () => {
      const address = document.getElementById('propAddress')?.value?.trim();
      const city = document.getElementById('propCity')?.value?.trim();
      const stateVal = document.getElementById('propState')?.value?.trim();
      const zip = document.getElementById('propZip')?.value?.trim();

      if (!address) {
        showToast('Enter a street address first');
        return;
      }

      const btn = document.getElementById('lookupBtn');
      const note = document.getElementById('lookupNote');
      btn.disabled = true;
      btn.textContent = 'Looking up...';
      note.textContent = 'Searching PropRaven...';

      try {
        const response = await fetch('/.netlify/functions/property-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, city, state: stateVal, zip })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Error ${response.status}`);
        }

        // Try to find the best matching parcel
        let parcel = null;
        if (Array.isArray(data.results) && data.results.length > 0) {
          parcel = data.results[0];
        } else if (Array.isArray(data.data) && data.data.length > 0) {
          parcel = data.data[0];
        } else if (data.parcel) {
          parcel = data.parcel;
        } else if (data) {
          parcel = data;
        }

        if (!parcel) {
          note.textContent = 'No property found. Please enter details manually.';
          showToast('No matching property found');
          return;
        }

        // Fill the form fields with whatever we got
        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el && val != null && val !== '') el.value = val;
        };

        // Common field mappings (PropRaven field names can vary)
        setVal('propSqft', parcel.living_area || parcel.sqft || parcel.building_sqft || parcel.finished_sqft);
        setVal('propBeds', parcel.bedrooms || parcel.beds);
        setVal('propBaths', parcel.bathrooms || parcel.baths || parcel.full_baths);
        setVal('propStories', parcel.stories || parcel.floors);
        setVal('propYear', parcel.year_built || parcel.yearBuilt);
        setVal('propLot', parcel.lot_size_acres || parcel.lot_acres || parcel.lot_size);
        
        if (parcel.property_type || parcel.land_use) {
          const typeEl = document.getElementById('propType');
          if (typeEl) typeEl.value = parcel.property_type || parcel.land_use || '';
        }

        note.innerHTML = `Source: PropRaven · Retrieved ${new Date().toLocaleString()}<br>Review the numbers — you can still edit them.`;
        showToast('Property info loaded – please review');

      } catch (err) {
        console.error(err);
        note.textContent = 'Lookup failed. You can still enter details manually.';
        showToast('Lookup failed: ' + (err.message || 'Unknown error'));
      } finally {
        btn.disabled = false;
        btn.textContent = '🔍 Lookup Property Info';
      }
    });

    // Time / Expense handlers
    document.getElementById('addTimeBtn')?.addEventListener('click', () => {
      const job = collectJobFromForm();
      job.timeEntries.push({ category: 'Photography', hours: 1 });
      const isNew = !state.currentJobId;
      if (state.currentJobId) {
        const i = state.jobs.findIndex(j => j.id === state.currentJobId);
        if (i >= 0) state.jobs[i] = job;
      }
      document.getElementById('mainContent').innerHTML = renderJobForm(job, isNew);
      bindViewEvents();
    });
    document.querySelectorAll('.remove-time').forEach(btn => {
      btn.onclick = () => {
        const job = collectJobFromForm();
        job.timeEntries.splice(Number(btn.dataset.idx), 1);
        const isNew = !state.currentJobId;
        if (state.currentJobId) {
          const i = state.jobs.findIndex(j => j.id === state.currentJobId);
          if (i >= 0) state.jobs[i] = job;
        }
        document.getElementById('mainContent').innerHTML = renderJobForm(job, isNew);
        bindViewEvents();
      };
    });
    document.getElementById('addExpenseBtn')?.addEventListener('click', () => {
      const job = collectJobFromForm();
      job.expenses.push({ description: '', amount: 0 });
      const isNew = !state.currentJobId;
      if (state.currentJobId) {
        const i = state.jobs.findIndex(j => j.id === state.currentJobId);
        if (i >= 0) state.jobs[i] = job;
      }
      document.getElementById('mainContent').innerHTML = renderJobForm(job, isNew);
      bindViewEvents();
    });
    document.querySelectorAll('.remove-exp').forEach(btn => {
      btn.onclick = () => {
        const job = collectJobFromForm();
        job.expenses.splice(Number(btn.dataset.idx), 1);
        const isNew = !state.currentJobId;
        if (state.currentJobId) {
          const i = state.jobs.findIndex(j => j.id === state.currentJobId);
          if (i >= 0) state.jobs[i] = job;
        }
        document.getElementById('mainContent').innerHTML = renderJobForm(job, isNew);
        bindViewEvents();
      };
    });

    // PDFs
    document.getElementById('genQuotePdf')?.addEventListener('click', () => {
      const job = collectJobFromForm();
      generatePDF(job, 'quote');
    });
    document.getElementById('genInvoicePdf')?.addEventListener('click', () => {
      const job = collectJobFromForm();
      if (!job.invoiceNumber) {
        job.invoiceNumber = state.business.invoicePrefix + state.business.nextInvoiceNum;
        state.business.nextInvoiceNum++;
        job.status = job.status === 'quoted' || job.status === 'completed' ? 'invoiced' : job.status;
      }
      const idx = state.jobs.findIndex(j => j.id === job.id);
      if (idx >= 0) state.jobs[idx] = job;
      saveData();
      generatePDF(job, 'invoice');
      render();
    });
    document.getElementById('genReceiptPdf')?.addEventListener('click', () => {
      const job = collectJobFromForm();
      generatePDF(job, 'receipt');
    });

    document.getElementById('duplicateJob')?.addEventListener('click', () => {
      const orig = collectJobFromForm();
      const copy = JSON.parse(JSON.stringify(orig));
      copy.id = uid();
      copy.quoteNumber = state.business.quotePrefix + state.business.nextQuoteNum;
      state.business.nextQuoteNum++;
      copy.invoiceNumber = '';
      copy.status = 'quoted';
      copy.createdAt = new Date().toISOString();
      copy.quoteDate = todayISO();
      copy.amountPaid = 0;
      copy.timeEntries = [];
      copy.expenses = [];
      state.jobs.push(copy);
      saveData();
      showToast('Job duplicated');
      navigate('job-detail', copy.id);
    });
    document.getElementById('deleteJob')?.addEventListener('click', async () => {
      const ok = await confirmAction('Delete Job', 'This cannot be undone. Delete this job permanently?');
      if (!ok) return;
      state.jobs = state.jobs.filter(j => j.id !== state.currentJobId);
      saveData();
      showToast('Job deleted');
      navigate('jobs');
    });
  }

  // Pricing save
  document.getElementById('savePricingBtn')?.addEventListener('click', () => {
    state.pricing.basePackage = Number(document.getElementById('basePackage').value) || 0;
    state.pricing.perBedroom = Number(document.getElementById('perBedroom').value) || 0;
    state.pricing.perBathroom = Number(document.getElementById('perBathroom').value) || 0;
    state.pricing.complexMultiplier = Number(document.getElementById('complexMult').value) || 1;
    state.pricing.droneAdd = Number(document.getElementById('droneAdd').value) || 0;
    state.pricing.virtualAdd = Number(document.getElementById('virtualAdd').value) || 0;
    state.pricing.rushAdd = Number(document.getElementById('rushAdd').value) || 0;
    document.querySelectorAll('.tier-max').forEach(el => {
      const i = Number(el.dataset.i);
      state.pricing.sqftTiers[i].max = Number(el.value) || 0;
    });
    document.querySelectorAll('.tier-price').forEach(el => {
      const i = Number(el.dataset.i);
      state.pricing.sqftTiers[i].price = Number(el.value) || 0;
    });
    document.querySelectorAll('.svc-price').forEach(el => {
      const i = Number(el.dataset.i);
      state.services[i].defaultPrice = Number(el.value) || 0;
    });
    saveData();
    showToast('Pricing rules saved');
  });

  // Settings
  document.getElementById('saveBizBtn')?.addEventListener('click', () => {
    state.business.name = document.getElementById('bizName').value;
    state.business.email = document.getElementById('bizEmail').value;
    state.business.phone = document.getElementById('bizPhone').value;
    state.business.website = document.getElementById('bizWebsite').value;
    state.business.address = document.getElementById('bizAddress').value;
    state.business.taxRate = Number(document.getElementById('bizTax').value) || 0;
    state.business.taxLabel = document.getElementById('bizTaxLabel').value;
    state.business.terms = document.getElementById('bizTerms').value;
    saveData();
    showToast('Business info saved');
  });
  document.getElementById('exportBackupBtn')?.addEventListener('click', () => {
    const data = localStorage.getItem(STORAGE_KEY);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `re-photo-pro-backup-${todayISO()}.json`;
    a.click();
    showToast('Backup downloaded');
  });
  document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
    const rows = [['Quote#', 'Status', 'Client', 'Address', 'City', 'QuoteDate', 'ServiceDate', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance', 'Hours', 'Expenses', 'Profit']];
    state.jobs.forEach(j => {
      const t = calcJobTotals(j);
      const p = calcJobProfit(j);
      rows.push([
        j.quoteNumber, j.status, j.clientName, j.property.address, j.property.city,
        j.quoteDate, j.serviceDate, t.subtotal, t.tax, t.total, t.paid, t.balance,
        p.hours, p.expenses, p.profit
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `re-photo-jobs-${todayISO()}.csv`;
    a.click();
    showToast('CSV exported');
  });
  document.getElementById('restoreFile')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.jobs && !data.business) throw new Error('Invalid backup');
      const ok = await confirmAction('Restore Backup', 'This will replace all current data with the backup. Continue?');
      if (!ok) return;
      localStorage.setItem(STORAGE_KEY, text);
      loadData();
      showToast('Backup restored');
      navigate('dashboard');
    } catch (err) {
      showToast('Invalid backup file');
    }
  });
  document.getElementById('clearDataBtn')?.addEventListener('click', async () => {
    const ok = await confirmAction('Clear All Data', 'This permanently deletes every job, client, and setting on this device. Are you sure?');
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    state = {
      business: { ...DEFAULT_BUSINESS },
      services: [...DEFAULT_SERVICES],
      pricing: { ...DEFAULT_PRICING },
      packages: [...DEFAULT_PACKAGES],
      jobs: [],
      clients: [],
      currentView: 'dashboard',
      currentJobId: null,
      filterStatus: 'all',
      searchQuery: '',
      dateFilter: 'all'
    };
    saveData();
    showToast('All data cleared');
    navigate('dashboard');
  });
}

// ===== Init =====
function init() {
  loadData();
  document.getElementById('menuBtn').onclick = openSidebar;
  document.getElementById('closeSidebar').onclick = closeSidebar;
  document.getElementById('sidebarOverlay').onclick = closeSidebar;
  document.getElementById('newJobBtn').onclick = () => navigate('new-job');
  document.querySelectorAll('.nav-item').forEach(el => {
    el.onclick = () => navigate(el.dataset.view);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  navigate('dashboard');
  updateStorageInfo();
}

document.addEventListener('DOMContentLoaded', init);