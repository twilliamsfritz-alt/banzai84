// ── Banzai — Executive Command Center ──────────────────────────────────
const S = {
  user: null, dash: null,
  convId: null, productId: null,
  quoteItems: [], install: null,
};

const $ = id => document.getElementById(id);
const fmt = (v, cur) => new Intl.NumberFormat(
  {USD:'en-US',ARS:'es-AR',BRL:'pt-BR',EUR:'de-DE',GBP:'en-GB'}[cur]||'en-US',
  {style:'currency',currency:cur||'USD',maximumFractionDigits:0}
).format(v||0);

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, type='ok') {
  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  el.textContent = msg;
  $('toast').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── API ────────────────────────────────────────────────────────────────────
async function api(path, opts={}) {
  const res = await fetch(path, {
    headers:{'Content-Type':'application/json',...(opts.headers||{})},
    credentials:'same-origin', ...opts,
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error||'Request failed');
  return data;
}

// ── Navigation ─────────────────────────────────────────────────────────────
function navTo(pageId) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const page = $(`page-${pageId}`);
  if (page) page.classList.add('active');
  const nav = document.querySelector(`[data-page="${pageId}"]`);
  if (nav) nav.classList.add('active');
  if (pageId==='agents') loadAgentEvents();
  if (pageId==='finance') loadFinanceReports();
  if (pageId==='pipeline') loadPipeline();
  if (pageId==='contacts') { loadContacts(); }
  if (pageId==='goals') loadGoals();
  if (pageId==='automations') loadAutomations();
  if (pageId==='advisor') {}
  if (pageId==='broadcast') loadBroadcastHistory();
  if (pageId==='deals') loadDeals();
  if (pageId==='invoices') loadInvoices();
  if (pageId==='settings') loadSettings();
}

// ── Auth ───────────────────────────────────────────────────────────────────
async function trySession() {
  try { const r=await api('/api/me'); S.user=r.user; await boot(); }
  catch { showLogin(); }
}

function showLogin() {
  $('login-view').classList.remove('hidden');
  $('dashboard-view').classList.add('hidden');
}

async function login() {
  $('login-error').textContent='';
  try {
    const r = await api('/api/login',{method:'POST',body:JSON.stringify({
      email:$('email').value.trim(), password:$('password').value
    })});
    S.user = r.user;
    await boot();
  } catch(e) { $('login-error').textContent = e.message; }
}

async function logout() {
  await api('/api/logout',{method:'POST'});
  S.user=null; S.dash=null;
  showLogin();
}

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
  $('login-view').classList.add('hidden');
  $('dashboard-view').classList.remove('hidden');
  const [dash,ver,intg] = await Promise.all([
    api('/api/dashboard'),
    api('/api/version'),
    api('/api/integrations/status'),
  ]);
  S.dash = dash.dashboard;
  S.user = dash.user;
  renderSidebar();
  renderKPIs();
  renderOverview();
  renderSales();
  renderFinance();
  renderTasks();
  renderPricing();
  renderKnowledge();
  renderSettings(intg, ver);
  navTo('overview');
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function renderSidebar() {
  const u = S.user, d = S.dash;
  $('ws-name-side').textContent = u.workspace_name;
  $('ws-region-side').textContent = `${u.currency} · ${u.language.toUpperCase()}`;
  $('user-av').textContent = u.name?.[0]?.toUpperCase()||'?';
  $('user-name-side').textContent = u.name;
  $('user-role-side').textContent = u.role;
  // badges
  const openDeals = (d.conversations||[]).length;
  $('badge-deals').textContent = openDeals;
}

// ── KPIs ───────────────────────────────────────────────────────────────────
function renderKPIs() {
  const k = S.dash.kpis, cur = S.user.currency;
  const cards = [
    {label:'Open conversations', val:k.open_chats, cls:'c-brand'},
    {label:'Hot leads', val:k.hot_leads, cls:'c-amber'},
    {label:'Pending income', val:k.pending_income, cls:'c-cyan'},
    {label:'Total income', val:fmt(k.income,cur), cls:'c-green'},
    {label:'Expenses', val:fmt(k.expenses,cur), cls:'c-red'},
    {label:'Net cash', val:fmt(k.net,cur), cls:k.net>=0?'c-green':'c-red'},
  ];
  $('kpi-row').innerHTML = cards.map(c=>`
    <div class="kpi-card ${c.cls}">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-val">${c.val}</div>
    </div>`).join('');
}

// ── Overview ───────────────────────────────────────────────────────────────
async function renderOverview() {
  const d = S.dash, cur = S.user.currency;
  $('overview-title').textContent = S.user.workspace_name;
  $('overview-sub').textContent = `${S.user.currency} · ${S.user.language.toUpperCase()} · Real-time command center`;

  // Recent ledger in invoice overview
  const ledger = (d.ledger||[]).slice(0,5);
  $('invoices-overview').innerHTML = ledger.length
    ? `<table class="data-table"><thead><tr><th>Concept</th><th>Type</th><th>Amount</th><th>State</th></tr></thead><tbody>${
        ledger.map(e=>`<tr><td>${e.concept}</td><td>${e.entry_type}</td><td>${fmt(e.amount,e.currency)}</td><td><span class="badge ${e.state==='Paid'?'green':e.state==='Pending'?'warn':'gray'}">${e.state}</span></td></tr>`).join('')
      }</tbody></table>`
    : '<div class="empty"><div class="empty-text">No ledger entries yet</div></div>';

  // Load agent events
  try {
    const ev = await api('/api/agents/events?limit=8');
    renderAgentEventsList(ev.events, 'agent-events-overview');
    const badge = ev.events.length>0 ? 'blue' : 'gray';
    $('agent-health-badge').className = `badge ${badge}`;
    $('agent-health-badge').textContent = `${ev.events.length} events`;
    $('badge-agents').textContent = ev.events.filter(e=>e.requires_human_review&&!e.reviewed_at).length||0;
  } catch {}

  // Open deals preview
  try {
    const dealsData = await api('/api/deals');
    const open = dealsData.deals.filter(d=>d.status==='offer_sent'||d.status==='negotiating');
    $('deals-pipeline-overview').innerHTML = open.length
      ? open.slice(0,5).map(d=>dealCardHtml(d,cur)).join('')
      : '<div class="empty"><div class="empty-icon">🤝</div><div class="empty-text">No open deals</div></div>';
    $('badge-deals').textContent = open.length||'';
  } catch {}

  // Quick audit
  $('audit-overview').innerHTML = `<div class="audit-section">
    <div class="audit-item"><span class="audit-ok">✓</span><span>Agent system operational</span></div>
    <div class="audit-item"><span class="audit-ok">✓</span><span>Ledger auto-reconciliation active</span></div>
    <div class="audit-item"><span class="${S.dash.kpis.net>=0?'audit-ok':'audit-warn'}">${S.dash.kpis.net>=0?'✓':'⚠'}</span><span>Net cash: ${fmt(S.dash.kpis.net,cur)}</span></div>
  </div>`;
}

// ── Agent events rendering ─────────────────────────────────────────────────
function agentColor(agent) {
  if (agent.includes('sales')) return 'sales';
  if (agent.includes('accounting')) return 'accounting';
  if (agent.includes('auditor')) return 'auditor';
  return 'ai';
}
function agentLabel(agent) {
  return ({sales_agent:'Sales',accounting_agent:'Accounting',auditor_agent:'Auditor',ai_engine:'AI',orchestrator:'Orchestrator'})[agent]||agent;
}
function renderAgentEventsList(events, containerId) {
  const el = $(containerId);
  if (!el) return;
  if (!events||!events.length) {
    el.innerHTML = '<div class="empty"><div class="empty-text">No events recorded yet. Send a message through the Agent pipeline to see activity here.</div></div>';
    return;
  }
  el.innerHTML = events.map(e=>`
    <div class="agent-event">
      <div class="ae-dot ${agentColor(e.agent)}"></div>
      <div class="ae-body">
        <div class="ae-agent" style="color:var(--${agentColor(e.agent)==='sales'?'accent':agentColor(e.agent)==='accounting'?'accent2':agentColor(e.agent)==='auditor'?'purple':'warn'})">${agentLabel(e.agent)}</div>
        <div class="ae-action">${e.action}${e.entity_type?' · '+e.entity_type+(e.entity_id?' #'+e.entity_id:''):''}</div>
        <div class="ae-detail">${e.output_summary||e.input_summary||''}</div>
        ${e.requires_human_review&&!e.reviewed_at?`<button class="ghost" style="font-size:10px;padding:3px 8px;margin-top:4px;" onclick="reviewEvent(${e.id})">Mark reviewed</button>`:''}
      </div>
      <div class="ae-time">${e.created_at?.substring(11,16)||''}</div>
    </div>`).join('');
}

async function loadAgentEvents() {
  try {
    const ev = await api('/api/agents/events?limit=50');
    renderAgentEventsList(ev.events, 'agent-event-log');
    $('event-count').textContent = `${ev.events.length} events`;
    // load tax profile and margins for settings panel
    const [tax, margins] = await Promise.all([api('/api/tax-profile'),api('/api/margins')]);
    const t = tax.tax_profile;
    $('tax-country').value = t.country_code||'';
    $('tax-rate').value = t.default_tax_pct||0;
    $('tax-authority').value = t.tax_authority||'';
    $('tax-company-id').value = t.tax_id||'';
    $('tax-prefix').value = t.invoice_prefix||'INV';
    if (margins.margins&&margins.margins[0]) {
      const m = margins.margins[0];
      $('margin-max-discount').value = (m.max_discount_pct*100).toFixed(0);
      $('margin-min-margin').value = (m.min_margin_pct*100).toFixed(0);
      $('margin-auto-approve').value = (m.auto_approve_below_pct*100).toFixed(0);
    }
  } catch(e) { console.warn(e); }
}

async function reviewEvent(id) {
  await api(`/api/agents/events/${id}/review`,{method:'POST'});
  toast('Event marked as reviewed');
  loadAgentEvents();
}

async function runAudit() {
  try {
    const r = await api('/api/agents/audit',{method:'POST'});
    const rep = r.report;
    const html = `
      <div class="audit-section">
        <h4>Overall health</h4>
        <div class="audit-item">
          <span class="${rep.health==='ok'?'audit-ok':'audit-warn'}">${rep.health==='ok'?'✓':'⚠'}</span>
          <span>${rep.health==='ok'?'All checks passed':'Issues detected — review below'}</span>
        </div>
      </div>
      <div class="audit-section">
        <h4>Orphan deals (closed without invoice)</h4>
        ${rep.orphan_deals.length===0
          ? '<div class="audit-item"><span class="audit-ok">✓</span><span>None found</span></div>'
          : rep.orphan_deals.map(d=>`<div class="audit-item"><span class="audit-err">✗</span><span>Deal #${d.id} — ${d.customer_name} — ${d.negotiated_total}</span></div>`).join('')}
      </div>
      <div class="audit-section">
        <h4>Unbilled commission</h4>
        ${rep.unbilled_commission.length===0
          ? '<div class="audit-item"><span class="audit-ok">✓</span><span>Nothing pending</span></div>'
          : rep.unbilled_commission.map(c=>`<div class="audit-item"><span class="audit-warn">⚠</span><span>${c.total_commission?.toFixed(4)} ${c.currency} pending billing</span></div>`).join('')}
      </div>
      <div class="audit-section">
        <h4>Suspicious invoices</h4>
        ${rep.suspicious_invoices.length===0
          ? '<div class="audit-item"><span class="audit-ok">✓</span><span>None found</span></div>'
          : rep.suspicious_invoices.map(i=>`<div class="audit-item"><span class="audit-warn">⚠</span><span>${i.invoice_number} — 0% tax in ${i.country_code}</span></div>`).join('')}
      </div>
      <div class="audit-section">
        <h4>Agent activity (24h)</h4>
        ${rep.agent_activity_24h.map(a=>`<div class="audit-item"><span class="audit-ok">●</span><span>${agentLabel(a.agent)} · ${a.action} · ${a.count}x · conf ${(a.avg_confidence*100).toFixed(0)}%</span></div>`).join('')||'<div class="audit-item"><span class="audit-ok">✓</span><span>No activity in last 24h</span></div>'}
      </div>`;
    if ($('audit-full-report')) $('audit-full-report').innerHTML = html;
    if ($('audit-overview')) $('audit-overview').innerHTML = `<div class="audit-item"><span class="${rep.health==='ok'?'audit-ok':'audit-warn'}">${rep.health==='ok'?'✓':'⚠'}</span><span>${rep.health==='ok'?'Audit passed — no issues found':'Issues detected. Go to Agent Center for details.'}</span></div>`;
    toast(`Audit complete — ${rep.health==='ok'?'all clear ✓':'issues found ⚠'}`, rep.health==='ok'?'ok':'err');
  } catch(e) { toast('Audit failed: '+e.message,'err'); }
}

// ── Deals ──────────────────────────────────────────────────────────────────
function dealCardHtml(d, cur) {
  const isOpen = d.status==='offer_sent'||d.status==='negotiating';
  const statusBadge = {
    negotiating:'<span class="badge blue">Negotiating</span>',
    offer_sent:'<span class="badge warn">Offer sent</span>',
    closed:'<span class="badge green">Closed</span>',
    rejected:'<span class="badge red">Rejected</span>',
    escalated:'<span class="badge purple">Escalated</span>',
  }[d.status]||'';
  return `<div class="deal-card ${isOpen?'active-deal':''}">
    <div class="deal-header">
      <div class="deal-customer">${d.customer_name}</div>
      ${statusBadge}
    </div>
    <div style="display:flex;align-items:baseline;gap:6px;">
      <div class="deal-total">${fmt(d.negotiated_total,d.currency||cur)}</div>
      ${d.discount_pct>0?`<div class="deal-discount">−${d.discount_pct.toFixed(1)}% off</div>`:''}
    </div>
    <div style="font-size:11px;color:var(--text2);margin-top:4px;">Original: ${fmt(d.original_total,d.currency||cur)} · Floor: ${fmt(d.margin_floor,d.currency||cur)}</div>
    ${isOpen?`<div class="deal-actions">
      <button class="success" onclick="acceptDeal(${d.id})">✓ Accept & invoice</button>
      <button class="danger-btn" onclick="rejectDeal(${d.id})">✗ Reject</button>
    </div>`:''}
  </div>`;
}

async function loadDeals() {
  try {
    const [dealsData, commData] = await Promise.all([api('/api/deals'), api('/api/commissions')]);
    const deals = dealsData.deals;
    const open = deals.filter(d=>d.status==='offer_sent'||d.status==='negotiating');
    const closed = deals.filter(d=>d.status==='closed');
    $('deals-open-badge').textContent = `${open.length} open`;
    $('deals-closed-badge').textContent = `${closed.length} closed`;
    $('deals-list').innerHTML = deals.length
      ? deals.map(d=>dealCardHtml(d,S.user.currency)).join('')
      : '<div class="empty"><div class="empty-icon">🤝</div><div class="empty-text">No deals yet. Send a message through the Agent pipeline.</div></div>';
    const summ = commData.summary;
    $('commission-summary').innerHTML = summ.length
      ? `<div style="margin-bottom:12px;">${summ.map(s=>`
          <div class="list-item">
            <div class="li-body"><div class="li-title">Commission earned</div><div class="li-sub">${s.currency}</div></div>
            <div class="li-right"><div class="li-val">${fmt(s.total_commission,s.currency)}</div><div class="li-meta">Unbilled: ${fmt(s.unbilled,s.currency)}</div></div>
          </div>
          <div class="list-item">
            <div class="li-body"><div class="li-title">Total gross revenue tracked</div></div>
            <div class="li-right"><div class="li-val">${fmt(s.total_gross,s.currency)}</div></div>
          </div>`).join('')}</div>
          <p style="font-size:11px;">Commission rate: 2% per closed deal (configurable). Value-based billing — you pay only when it generates revenue.</p>`
      : '<div class="empty"><div class="empty-text">No commissions yet</div></div>';
  } catch(e) { console.warn(e); }
}

async function acceptDeal(id) {
  try {
    const r = await api(`/api/deals/${id}/accept`,{method:'POST',body:JSON.stringify({})});
    toast(`Invoice ${r.invoice_number} issued instantly ✓`,'ok');
    loadDeals();
    renderOverview();
  } catch(e) { toast('Accept failed: '+e.message,'err'); }
}

async function rejectDeal(id) {
  await api(`/api/deals/${id}/reject`,{method:'POST',body:JSON.stringify({})});
  toast('Deal rejected','ok');
  loadDeals();
}

// ── Invoices ───────────────────────────────────────────────────────────────
async function loadInvoices() {
  try {
    const r = await api('/api/invoices');
    const invs = r.invoices;
    $('invoice-list').innerHTML = invs.length
      ? invs.map(i=>`
        <div class="invoice-row">
          <span style="font-weight:600;color:var(--brand)">${i.invoice_number}</span>
          <span>${i.customer_name}</span>
          <span>${fmt(i.total,i.currency)}</span>
          <span>${i.tax_pct>0?i.tax_pct+'%':'—'}</span>
          <span><span class="badge ${i.status==='issued'?'blue':i.status==='paid'?'green':'gray'}">${i.status}</span></span>
        </div>`).join('')
      : '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No invoices yet. Close a deal to issue the first one.</div></div>';
  } catch(e) { console.warn(e); }
}

// ── Sales ──────────────────────────────────────────────────────────────────
function renderSales() {
  const convs = S.dash.conversations||[];
  $('conv-list').innerHTML = convs.length
    ? convs.map(c=>`
      <div class="conv-item ${c.id===S.convId?'active':''}" onclick="selectConv(${c.id})">
        <div class="conv-name">${c.customer_name}</div>
        <div class="conv-preview">${(c.messages||[]).slice(-1)[0]?.text?.substring(0,50)||'No messages'}</div>
        <div class="conv-channel">${c.channel}</div>
      </div>`).join('')
    : '<div class="empty"><div class="empty-text">No conversations</div></div>';
  if (!S.convId && convs.length) selectConv(convs[0].id, false);
  // product picker for quotes
  const products = S.dash.products||[];
  $('product-picker').innerHTML = products.map(p=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface3);border-radius:var(--radius-sm);font-size:12px;">
      <span>${p.name}</span>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="color:var(--text2);">${fmt(p.price,S.user.currency)}</span>
        <button class="ghost" style="padding:3px 8px;font-size:11px;" onclick="addQuoteItem(${p.id},'${p.name}',${p.price})">+ Add</button>
      </div>
    </div>`).join('');
}

function selectConv(id, scroll=true) {
  S.convId = id;
  const conv = S.dash.conversations.find(c=>c.id===id);
  if (!conv) return;
  document.querySelectorAll('.conv-item').forEach(el=>{
    el.classList.toggle('active', parseInt(el.getAttribute('onclick').match(/\d+/)[0])===id);
  });
  $('chat-title').textContent = conv.customer_name;
  $('chat-channel').textContent = conv.channel;
  const msgs = conv.messages||[];
  $('chat-msgs').innerHTML = msgs.length
    ? msgs.map(m=>`
      <div class="bubble ${m.role}">
        <div class="bub-meta">${m.role==='assistant'?'Agent':'Customer'} · ${m.created_at?.substring(11,16)||''}</div>
        ${m.text}
      </div>`).join('')
    : '<div class="empty"><div class="empty-text">No messages yet</div></div>';
  if (scroll) $('chat-msgs').scrollTop = 9999;
}

async function suggestReply() {
  if (!S.convId) return;
  const conv = S.dash.conversations.find(c=>c.id===S.convId);
  if (!conv) return;
  const lastMsg = (conv.messages||[]).filter(m=>m.role==='customer').slice(-1)[0]?.text||'';
  if (!lastMsg) return toast('No customer message to reply to','err');
  try {
    const r = await api('/api/ai/reply',{method:'POST',body:JSON.stringify({text:lastMsg})});
    $('reply-box').value = r.reply;
  } catch(e) { toast('AI unavailable: '+e.message,'err'); }
}

async function sendReply() {
  const text = $('reply-box').value.trim();
  if (!text || !S.convId) return;
  await api('/api/messages/reply',{method:'POST',body:JSON.stringify({conversation_id:S.convId,text})});
  $('reply-box').value='';
  toast('Reply sent','ok');
  await boot();
  selectConv(S.convId);
}

async function sendAgentInbound() {
  const name = $('webchat-customer').value.trim()||'Lead';
  const text = $('webchat-message').value.trim();
  if (!text) return toast('Enter a message first','err');
  try {
    const r = await api('/api/agent/inbound',{method:'POST',body:JSON.stringify({customer_name:name,text})});
    const preview = $('agent-reply-preview');
    preview.style.display = 'block'; preview.classList.add('agent-reply-preview');
    preview.innerHTML = `<div style="margin-bottom:6px;font-size:10px;color:var(--brand);font-weight:700;text-transform:uppercase;">Agent: ${r.agent||'—'} · ${r.action||'—'}</div>${r.reply}`;
    $('webchat-message').value='';
    toast(`${r.agent==='sales_agent'?'Sales Agent negotiated':'Reply generated'} ✓`,'ok');
    await boot(); selectConv(r.conversation_id);
    loadDeals();
  } catch(e) { toast('Agent error: '+e.message,'err'); }
}

async function sendWebchat() {
  const name = $('webchat-customer').value.trim()||'Lead';
  const text = $('webchat-message').value.trim();
  if (!text) return toast('Enter a message','err');
  await api('/api/webchat/inbound',{method:'POST',body:JSON.stringify({customer_name:name,text})});
  $('webchat-message').value='';
  toast('Sent','ok');
  await boot();
}

// Quote
function addQuoteItem(id, name, price) {
  const existing = S.quoteItems.find(i=>i.id===id);
  if (existing) { existing.qty++; } else { S.quoteItems.push({id,name,price,qty:1,sku:name}); }
  renderQuoteItems();
}
function renderQuoteItems() {
  const cur = S.user.currency;
  $('quote-items').innerHTML = S.quoteItems.map(i=>`
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:5px 0;border-bottom:1px solid var(--border);">
      <span>${i.name} x${i.qty}</span>
      <span>${fmt(i.price*i.qty,cur)}</span>
    </div>`).join('');
  const total = S.quoteItems.reduce((s,i)=>s+i.price*i.qty,0);
  $('quote-total').textContent = fmt(total,cur);
}
async function createQuote() {
  if (!S.quoteItems.length) return toast('Add items first','err');
  const name = $('webchat-customer').value.trim()||'Client';
  await api('/api/quotes',{method:'POST',body:JSON.stringify({
    customer:name,
    items:S.quoteItems.map(i=>({sku:i.sku,name:i.name,unit_price:i.price,qty:i.qty}))
  })});
  S.quoteItems=[];
  renderQuoteItems();
  toast('Quote created + finance entry posted','ok');
  await boot();
}

// ── Finance & Reports ─────────────────────────────────────────────────────
let ledgerFilter = '';
let reportData = null;
let financeCharts = {};

async function loadFinanceReports() {
  try {
    const [repData, ledgerData] = await Promise.all([
      api('/api/reports/summary'),
      api('/api/reports/ledger-explained'),
    ]);
    reportData = repData;
    renderFinanceKPIs(repData);
    renderFinanceCharts(repData);
    renderLedgerExplained(ledgerData.entries);
    renderInventoryAlerts(repData.inventory);
  } catch(e) { console.warn('Finance load error:', e); }
}

function renderFinanceKPIs(r) {
  const cur = S.user.currency;
  const pl = r.pl || {};
  $('finance-kpis').innerHTML = [
    {label:'Ingresos totales',  val:fmt(pl.income||0,cur),   cls:'c-green'},
    {label:'Gastos totales',    val:fmt(pl.expenses||0,cur),  cls:'c-red'},
    {label:'Resultado neto',    val:fmt(pl.net||0,cur),       cls:pl.net>=0?'c-green':'c-red'},
    {label:'Margen neto',       val:(pl.margin_pct||0)+'%',   cls:'c-brand'},
    {label:'Impuestos emitidos',val:fmt(r.invoices?.total_tax_collected||0,cur), cls:'c-amber'},
  ].map(k=>`<div class="kpi-card ${k.cls}"><div class="kpi-label">${k.label}</div><div class="kpi-val">${k.val}</div></div>`).join('');
}

function renderFinanceCharts(r) {
  // Destroy existing charts
  Object.values(financeCharts).forEach(c=>{try{c.destroy();}catch(e){}});
  financeCharts = {};

  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const tc = dark?'#9AA3C2':'#6B7280';
  const gc = dark?'rgba(255,255,255,.05)':'rgba(0,0,0,.06)';
  const COLORS = ['#6366F1','#10B981','#F59E0B','#EF4444','#06B6D4','#8B5CF6','#EC4899','#F97316'];

  // 1. Monthly trend (bar chart)
  const monthly = r.monthly_trend || [];
  const monthCtx = document.getElementById('chart-monthly');
  if(monthCtx) {
    financeCharts.monthly = new Chart(monthCtx, {
      type:'bar',
      data:{
        labels: monthly.map(m=>m.month),
        datasets:[
          {label:'Ingresos', data:monthly.map(m=>m.income), backgroundColor:'rgba(16,185,129,.7)', borderRadius:4},
          {label:'Gastos',   data:monthly.map(m=>m.expenses), backgroundColor:'rgba(239,68,68,.6)', borderRadius:4},
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:tc,font:{size:11}}}},
        scales:{x:{ticks:{color:tc,font:{size:10}},grid:{color:gc},border:{display:false}},
                y:{ticks:{color:tc,font:{size:10},callback:v=>fmt(v,S.user.currency)},grid:{color:gc},border:{display:false}}}}
    });
  }

  // 2. Income by category (doughnut)
  const incCat = r.income_by_category || {};
  const incCtx = document.getElementById('chart-income-cat');
  if(incCtx && Object.keys(incCat).length) {
    financeCharts.incomeCat = new Chart(incCtx, {
      type:'doughnut',
      data:{labels:Object.keys(incCat), datasets:[{data:Object.values(incCat), backgroundColor:COLORS, borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
        plugins:{legend:{position:'right',labels:{color:tc,font:{size:10},boxWidth:10}},
          tooltip:{callbacks:{label:ctx=>` ${fmt(ctx.raw,S.user.currency)}`}}}}
    });
  }

  // 3. Expense by category (doughnut)
  const expCat = r.expense_by_category || {};
  const expCtx = document.getElementById('chart-expense-cat');
  if(expCtx && Object.keys(expCat).length) {
    financeCharts.expenseCat = new Chart(expCtx, {
      type:'doughnut',
      data:{labels:Object.keys(expCat), datasets:[{data:Object.values(expCat), backgroundColor:['#EF4444','#F59E0B','#F97316','#EC4899','#8B5CF6','#06B6D4'], borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'60%',
        plugins:{legend:{position:'right',labels:{color:tc,font:{size:10},boxWidth:10}},
          tooltip:{callbacks:{label:ctx=>` ${fmt(ctx.raw,S.user.currency)}`}}}}
    });
  }

  // 4. Deals funnel (horizontal bar)
  const funnel = r.deals?.funnel || {};
  const dealCtx = document.getElementById('chart-deals');
  if(dealCtx && Object.keys(funnel).length) {
    const STATUS_COLORS = {negotiating:'#6366F1',offer_sent:'#F59E0B',closed:'#10B981',rejected:'#EF4444',escalated:'#8B5CF6'};
    financeCharts.deals = new Chart(dealCtx, {
      type:'bar',
      data:{
        labels:Object.keys(funnel),
        datasets:[{label:'Deals',data:Object.values(funnel),
          backgroundColor:Object.keys(funnel).map(k=>STATUS_COLORS[k]||'#6B7280'), borderRadius:6}]
      },
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{ticks:{color:tc,font:{size:10}},grid:{color:gc},border:{display:false}},
                y:{ticks:{color:tc,font:{size:10}},grid:{display:false},border:{display:false}}}}
    });
  }

  // 5. Inventory top products (horizontal bar)
  const invItems = r.inventory_by_product || [];
  const invCtx = document.getElementById('chart-inventory');
  if(invCtx) {
    // Fetch top products for inventory chart
    api('/api/products').then(pr=>{
      const top = (pr.products||[]).sort((a,b)=>(b.cost*b.stock)-(a.cost*a.stock)).slice(0,8);
      if(top.length && invCtx) {
        financeCharts.inventory = new Chart(invCtx, {
          type:'bar',
          data:{labels:top.map(p=>p.name.substring(0,20)),
            datasets:[{label:'Valor en stock',data:top.map(p=>p.cost*p.stock),
              backgroundColor:'rgba(99,102,241,.7)',borderRadius:4}]},
          options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
            scales:{x:{ticks:{color:tc,font:{size:10},callback:v=>fmt(v,S.user.currency)},grid:{color:gc},border:{display:false}},
                    y:{ticks:{color:tc,font:{size:10}},grid:{display:false},border:{display:false}}}}
        });
      }
    }).catch(()=>{});
  }
}

function renderLedgerExplained(entries) {
  const cur = S.user.currency;
  const filtered = ledgerFilter ? entries.filter(e=>e.entry_type===ledgerFilter) : entries;
  $('ledger-explained-body').innerHTML = filtered.length
    ? filtered.map(e=>{
        const isIncome = e.entry_type === 'Income';
        const isPaid = e.state === 'Paid';
        const color = isIncome ? 'var(--green)' : 'var(--red)';
        const sign = isIncome ? '+' : '-';
        const icon = isIncome ? '↑' : '↓';
        return `<div style="padding:12px 0;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:flex-start;">
          <div style="width:28px;height:28px;border-radius:8px;background:${isIncome?'var(--green-dim)':'var(--red-dim)'};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">${icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:var(--text);">${e.concept}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">${e.explanation}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:3px;">${e.category||''} · ${(e.created_at||'').substring(0,10)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:14px;font-weight:700;color:${color};">${sign}${fmt(e.amount,e.currency||cur)}</div>
            <div style="font-size:10px;margin-top:2px;"><span class="badge ${isPaid?'green':'amber'}">${isPaid?'Pagado':'Pendiente'}</span></div>
            <div style="font-size:10px;color:var(--text3);margin-top:3px;">Saldo: ${fmt(e.running_balance||0,cur)}</div>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">Sin movimientos registrados todavía</div></div>';
}

function filterLedger(type) {
  ledgerFilter = type;
  api('/api/reports/ledger-explained').then(r=>renderLedgerExplained(r.entries)).catch(()=>{});
}

function renderInventoryAlerts(inv) {
  if(!inv) return;
  const low = inv.low_stock_items || [];
  $('inventory-alerts').innerHTML = low.length
    ? low.map(p=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
        <span style="color:${p.stock===0?'var(--red)':'var(--amber)'};">${p.stock===0?'⚠ Sin stock':'⚠ Stock bajo'}</span>
        <span style="flex:1;">${p.name}</span>
        <strong>${p.stock} uds</strong>
      </div>`).join('')
    : '<div style="font-size:12px;color:var(--green);">✓ Todo el inventario con stock normal</div>';
}

async function exportExcel() {
  try {
    toast('Generando Excel…','ok');
    window.open('/api/export/excel','_blank');
  } catch(e){ toast('Error: '+e.message,'err'); }
}

async function exportCSV() {
  window.open('/api/export/ledger-csv','_blank');
}

function renderFinance() {
  loadFinanceReports();
  // Set today as default due date
  const today = new Date().toISOString().slice(0,10);
  if($('ledger-due')) $('ledger-due').value = today;
}

async function saveLedger() {
  const concept = $('ledger-concept').value.trim();
  if(!concept){ toast('Escribí un concepto','err'); return; }
  await api('/api/ledger',{method:'POST',body:JSON.stringify({
    entry_type:$('ledger-type').value,
    concept,
    category:$('ledger-category').value,
    amount:parseFloat($('ledger-amount').value||0),
    state:$('ledger-state').value,
    currency:S.user.currency,
    due_date:$('ledger-due')?$('ledger-due').value:new Date().toISOString().slice(0,10),
  })});
  $('ledger-concept').value='';
  $('ledger-amount').value='0';
  toast('Movimiento registrado ✓','ok');
  await boot();
  loadFinanceReports();
}

// ── Tasks ──────────────────────────────────────────────────────────────────
function renderTasks() {
  const tasks = S.dash.tasks||[];
  $('task-list').innerHTML = tasks.length
    ? tasks.map(t=>`
      <div class="list-item">
        <div class="li-body">
          <div class="li-title">${t.title}</div>
          <div class="li-sub">${t.area} · ${t.owner} · ${t.priority}</div>
        </div>
        <div class="li-right">
          <span class="badge ${t.priority==='High'?'red':t.priority==='Medium'?'warn':'gray'}">${t.status}</span>
          <div class="li-meta">Impact ${t.impact}/10</div>
        </div>
      </div>`).join('')
    : '<div class="empty"><div class="empty-text">No tasks yet</div></div>';
}
async function saveTask() {
  await api('/api/tasks',{method:'POST',body:JSON.stringify({
    title:$('task-title').value, area:$('task-area').value, owner:$('task-owner').value,
    priority:$('task-priority').value, impact:parseInt($('task-impact').value)||5, status:'Today', due_label:'Today'
  })});
  $('task-title').value='';
  toast('Task created','ok');
  await boot();
}

// ── Inventory ─────────────────────────────────────────────────────────────
let allProducts = [];
let editingId = null;
let adjProductId = null;

async function loadInventory() {
  const r = await api('/api/products');
  allProducts = r.products || [];
  renderInventoryStats();
  renderInventoryTable();
  renderCategoryFilter();
}

function renderInventoryStats() {
  const cur = S.user.currency;
  const low = allProducts.filter(p=>p.stock<=(p.stock_min||0)&&p.stock>0).length;
  const zero = allProducts.filter(p=>p.stock===0).length;
  const totalValue = allProducts.reduce((s,p)=>s+p.cost*p.stock,0);
  $('inv-stats').innerHTML = [
    {label:'Total productos', val:allProducts.length, cls:'c-brand'},
    {label:'Stock bajo',      val:low,                cls:'c-amber'},
    {label:'Sin stock',       val:zero,               cls:'c-red'},
    {label:'Valor inventario',val:fmt(totalValue,cur),cls:'c-green'},
  ].map(k=>`<div class="kpi-card ${k.cls}"><div class="kpi-label">${k.label}</div><div class="kpi-val">${k.val}</div></div>`).join('');
}

function renderCategoryFilter() {
  const cats = [...new Set(allProducts.map(p=>p.category).filter(Boolean))].sort();
  const sel = $('inv-filter-cat');
  const current = sel ? sel.value : '';
  if(sel) sel.innerHTML = '<option value="">Todas las categorías</option>' +
    cats.map(c=>`<option value="${c}" ${c===current?'selected':''}>${c}</option>`).join('');
}

function getFilteredProducts() {
  const search = ($('inv-search')?$('inv-search').value||'':'').toLowerCase();
  const cat = $('inv-filter-cat')?$('inv-filter-cat').value:'';
  const stockF = $('inv-filter-stock')?$('inv-filter-stock').value:'';
  return allProducts.filter(p=>{
    if(search && !p.name.toLowerCase().includes(search) && !p.sku.toLowerCase().includes(search) && !(p.category||'').toLowerCase().includes(search)) return false;
    if(cat && p.category!==cat) return false;
    const min = p.stock_min||0;
    if(stockF==='low' && !(p.stock<=min&&p.stock>0)) return false;
    if(stockF==='ok' && !(p.stock>min)) return false;
    if(stockF==='zero' && p.stock!==0) return false;
    return true;
  });
}

function renderInventoryTable() {
  const cur = S.user.currency;
  const filtered = getFilteredProducts();
  const countEl = $('inv-count');
  const badgeEl = $('inv-total-badge');
  if(countEl) countEl.textContent = `${filtered.length} producto${filtered.length!==1?'s':''}`;
  if(badgeEl) badgeEl.textContent = `${allProducts.length} total`;
  const tbody = $('inv-body');
  const emptyEl = $('inv-empty');
  const tableEl = $('inv-table');
  if(!tbody) return;
  if(!filtered.length){
    tbody.innerHTML='';
    if(emptyEl) emptyEl.style.display='flex';
    if(tableEl) tableEl.style.display='none';
    return;
  }
  if(emptyEl) emptyEl.style.display='none';
  if(tableEl) tableEl.style.display='table';
  tbody.innerHTML = filtered.map(p=>{
    const margin = p.cost>0?((p.price-p.cost)/p.price*100).toFixed(0):'—';
    const mColor = p.cost>0?(parseFloat(margin)>=30?'var(--green)':parseFloat(margin)>=15?'var(--amber)':'var(--red)'):'var(--text3)';
    const min = p.stock_min||0;
    const sColor = p.stock===0?'var(--red)':p.stock<=min?'var(--amber)':'var(--green)';
    const sLabel = p.stock===0?'Sin stock':p.stock<=min?`⚠ ${p.stock}`:p.stock;
    const name = (p.name||'').replace(/'/g,"\'");
    return `<tr id="inv-row-${p.id}">
      <td style="padding-left:18px;">
        <div style="font-weight:600;font-size:13px;">${p.name}</div>
        ${p.notes?`<div style="font-size:10px;color:var(--text3);">${p.notes.substring(0,40)}</div>`:''}
      </td>
      <td><span style="font-family:monospace;font-size:11px;color:var(--text3);">${p.sku}</span></td>
      <td><span class="badge gray">${p.category||'—'}</span></td>
      <td style="font-size:12px;">${fmt(p.cost,cur)}</td>
      <td style="font-size:13px;font-weight:600;">${fmt(p.price,cur)}</td>
      <td style="font-weight:700;color:${mColor}">${margin}%</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-weight:700;color:${sColor};font-size:13px;">${sLabel}</span>
          <button onclick="openStockAdj(${p.id},'${name}',${p.stock})" style="padding:2px 7px;font-size:10px;background:var(--surface3);border:1px solid var(--border2);border-radius:4px;color:var(--text2);cursor:pointer;">±</button>
        </div>
      </td>
      <td>
        <div style="display:flex;gap:5px;">
          <button onclick="editProduct(${p.id})" style="padding:3px 8px;font-size:11px;background:var(--brand-dim);border:1px solid rgba(99,102,241,.2);border-radius:4px;color:var(--brand);cursor:pointer;">Editar</button>
          <button onclick="deleteProduct(${p.id},'${name}')" style="padding:3px 8px;font-size:11px;background:var(--red-dim);border:1px solid rgba(239,68,68,.2);border-radius:4px;color:var(--red);cursor:pointer;">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openNewProduct() {
  editingId=null; $('editing-product-id').value='';
  $('form-panel-title').textContent='Nuevo producto';
  $('btn-cancel-form').style.display='none';
  ['p-name','p-sku','p-category','p-cost','p-price','p-stock','p-stock-min','p-competitor','p-barcode','p-notes'].forEach(id=>{const el=$(id);if(el)el.value='';});
  $('p-unit').value='unidad';
  $('p-margin-preview').style.display='none';
  $('product-form-panel').scrollIntoView({behavior:'smooth'});
  $('p-name').focus();
}

function editProduct(id) {
  const p=allProducts.find(x=>x.id===id); if(!p) return;
  editingId=id; $('editing-product-id').value=id;
  $('form-panel-title').textContent='Editar producto';
  $('btn-cancel-form').style.display='block';
  $('p-name').value=p.name||''; $('p-sku').value=p.sku||'';
  $('p-category').value=p.category||''; $('p-unit').value=p.unit||'unidad';
  $('p-cost').value=p.cost||''; $('p-price').value=p.price||'';
  $('p-stock').value=p.stock||''; $('p-stock-min').value=p.stock_min||'';
  $('p-competitor').value=p.competitor_price||''; $('p-barcode').value=p.barcode||'';
  $('p-notes').value=p.notes||'';
  updateMarginPreview();
  $('product-form-panel').scrollIntoView({behavior:'smooth'});
}

function cancelForm() {
  editingId=null; $('editing-product-id').value='';
  $('form-panel-title').textContent='Nuevo producto';
  $('btn-cancel-form').style.display='none';
  $('p-margin-preview').style.display='none';
}

function updateMarginPreview() {
  const cost=parseFloat($('p-cost').value||0), price=parseFloat($('p-price').value||0);
  const preview=$('p-margin-preview');
  if(!preview) return;
  if(cost>0&&price>0){
    const m=((price-cost)/price*100);
    const c=m>=30?'var(--green)':m>=15?'var(--amber)':'var(--red)';
    preview.style.display='block';
    preview.innerHTML=`Margen: <strong style="color:${c}">${m.toFixed(1)}%</strong> · Ganancia: <strong>${fmt(price-cost,S.user.currency)}</strong> por unidad`;
  } else { preview.style.display='none'; }
}

async function saveProduct() {
  const id=$('editing-product-id').value;
  const payload={name:$('p-name').value.trim(),sku:$('p-sku').value.trim(),
    category:$('p-category').value.trim()||'General',unit:$('p-unit').value.trim()||'unidad',
    cost:parseFloat($('p-cost').value||0),price:parseFloat($('p-price').value||0),
    stock:parseInt($('p-stock').value||0),stock_min:parseInt($('p-stock-min').value||0),
    competitor_price:parseFloat($('p-competitor').value||0),
    barcode:$('p-barcode').value.trim(),notes:$('p-notes').value.trim()};
  if(!payload.name||!payload.sku){toast('Nombre y SKU son obligatorios','err');return;}
  try {
    if(id){await api(`/api/products/${id}`,{method:'PUT',body:JSON.stringify(payload)});toast('Producto actualizado ✓','ok');}
    else {await api('/api/products',{method:'POST',body:JSON.stringify(payload)});toast('Producto creado ✓','ok');}
    cancelForm(); await loadInventory(); await boot();
  } catch(e){toast(e.message,'err');}
}

async function deleteProduct(id,name) {
  if(!confirm(`¿Eliminar "${name}"? No se puede deshacer.`)) return;
  try{await api(`/api/products/${id}`,{method:'DELETE'});toast('Eliminado','ok');await loadInventory();await boot();}
  catch(e){toast(e.message,'err');}
}

function openStockAdj(id,name,current) {
  adjProductId=id;
  $('stock-adj-title').textContent=`Stock: ${name} (actual: ${current})`;
  $('stock-delta').value='0'; $('stock-note').value='';
  $('stock-adj-panel').style.display='block';
  $('stock-history-panel').style.display='block';
  loadStockHistory(id);
  $('stock-adj-panel').scrollIntoView({behavior:'smooth'});
}
function closeStockAdj(){adjProductId=null;$('stock-adj-panel').style.display='none';$('stock-history-panel').style.display='none';}
function setDelta(v){$('stock-delta').value=v;}

async function applyStockAdj() {
  if(!adjProductId){toast('Seleccioná un producto','err');return;}
  const delta=parseInt($('stock-delta').value||0), note=$('stock-note').value.trim();
  if(delta===0){toast('El delta no puede ser cero','err');return;}
  try{
    const r=await api(`/api/products/${adjProductId}/stock`,{method:'POST',body:JSON.stringify({delta,note})});
    toast(`Stock → ${r.new_stock} unidades ✓`,'ok');
    $('stock-delta').value='0'; $('stock-note').value='';
    await loadInventory(); await loadStockHistory(adjProductId);
  } catch(e){toast(e.message,'err');}
}

async function loadStockHistory(id) {
  try{
    const r=await api(`/api/products/${id}/movements`);
    const el=$('stock-history-body');
    if(!el) return;
    const mvs=r.movements||[];
    el.innerHTML=mvs.length?mvs.map(m=>`
      <div class="agent-event">
        <div class="ae-dot" style="background:${m.delta>0?'var(--green)':'var(--red)'}"></div>
        <div class="ae-body">
          <div class="ae-action">${m.delta>0?'+':''}${m.delta} uds → stock: ${m.stock_after}</div>
          <div class="ae-detail">${m.note||m.movement_type} · ${(m.created_at||'').substring(0,16)}</div>
        </div>
      </div>`).join('')
      :'<div class="empty"><div class="empty-text">Sin movimientos</div></div>';
  } catch(e){}
}

function runPricing() {
  const pid=editingId||S.productId||(allProducts[0]&&allProducts[0].id);
  if(!pid){toast('Seleccioná un producto primero','err');return;}
  const margin=parseFloat($('target-margin').value||42)/100;
  api(`/api/pricing/${pid}?target_margin=${margin}`).then(r=>{
    const rec=r.recommendation, cur=S.user.currency;
    $('pricing-result').innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:var(--surface2);border-radius:var(--r-sm);padding:12px;">
          <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">Precio recomendado</div>
          <div style="font-size:22px;font-weight:700;color:var(--brand)">${fmt(rec.recommended_price,cur)}</div>
          <div style="font-size:11px;color:var(--green);margin-top:3px;">${rec.delta>=0?'+':''}${fmt(rec.delta,cur)} vs actual</div>
        </div>
        <div style="background:var(--surface2);border-radius:var(--r-sm);padding:12px;">
          <div style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">Margen proyectado</div>
          <div style="font-size:22px;font-weight:700;color:var(--green)">${rec.projected_margin_pct.toFixed(1)}%</div>
          <div style="font-size:11px;color:var(--text2);margin-top:3px;">Actual: ${rec.current_margin_pct.toFixed(1)}%</div>
        </div>
      </div>`;
  }).catch(e=>toast(e.message,'err'));
}

function openBulkModal(){$('bulk-modal').style.display='flex';$('bulk-result').textContent='';}
function closeBulkModal(){$('bulk-modal').style.display='none';}

async function processBulkCSV() {
  const csv=$('bulk-csv').value.trim();
  if(!csv){toast('Pegá el CSV','err');return;}
  const lines=csv.split('\n').map(l=>l.trim()).filter(Boolean);
  const headers=lines[0].split(',').map(h=>h.trim().toLowerCase());
  const products=[];
  for(let i=1;i<lines.length;i++){
    const cols=lines[i].split(',').map(c=>c.trim());
    const obj={}; headers.forEach((h,idx)=>{obj[h]=cols[idx]||'';});
    if(obj.sku&&obj.name) products.push({sku:obj.sku,name:obj.name,category:obj.category||'General',
      cost:parseFloat(obj.cost||0),price:parseFloat(obj.price||0),stock:parseInt(obj.stock||0),
      stock_min:parseInt(obj.stock_min||0),competitor_price:parseFloat(obj.competitor_price||0),unit:obj.unit||'unidad'});
  }
  if(!products.length){$('bulk-result').textContent='No se encontraron productos válidos.';return;}
  try{
    const r=await api('/api/products/bulk',{method:'POST',body:JSON.stringify({products})});
    $('bulk-result').innerHTML=`<span style="color:var(--green)">✓ Creados: ${r.created} · Actualizados: ${r.updated} · Errores: ${r.errors}</span>`;
    await loadInventory(); await boot();
    setTimeout(closeBulkModal,1500);
  } catch(e){$('bulk-result').textContent=e.message;}
}

function renderPricing(){loadInventory();}
function selectProduct(id){S.productId=id;editingId=id;}

// ── Knowledge ──────────────────────────────────────────────────────────────
function renderKnowledge() {
  const arts = S.dash.knowledge||[];
  $('knowledge-list').innerHTML = arts.length
    ? arts.map(a=>`<div class="list-item"><div class="li-body"><div class="li-title">${a.title}</div><div class="li-sub">${a.content?.substring(0,80)}…</div></div></div>`).join('')
    : '<div class="empty"><div class="empty-text">No articles yet</div></div>';
  const srcs = S.dash.sources||[];
  $('source-list').innerHTML = srcs.length
    ? srcs.map(s=>`<div class="list-item"><div class="li-body"><div class="li-title">${s.title}</div><div class="li-sub">${s.domain} · ${s.source_type}</div></div></div>`).join('')
    : '<div class="empty"><div class="empty-text">No sources yet</div></div>';
  const tmps = S.dash.templates||[];
  $('template-list').innerHTML = tmps.length
    ? tmps.map(t=>`<div class="list-item"><div class="li-body"><div class="li-title">${t.name}</div><div class="li-sub">${t.category}</div></div></div>`).join('')
    : '<div class="empty"><div class="empty-text">No templates yet</div></div>';
}
async function saveKnowledge() {
  await api('/api/knowledge',{method:'POST',body:JSON.stringify({title:$('knowledge-title').value,content:$('knowledge-content').value})});
  $('knowledge-title').value=''; $('knowledge-content').value='';
  toast('Article saved','ok'); await boot();
}
async function saveSource() {
  await api('/api/sources',{method:'POST',body:JSON.stringify({title:$('source-title').value,domain:$('source-domain').value,source_type:$('source-type').value,content:$('source-content').value})});
  $('source-title').value=''; $('source-content').value='';
  toast('Source saved','ok'); await boot();
}
async function uploadSourceFile() {
  const file = $('source-file').files[0];
  if (!file) return toast('Select a file first','err');
  const form = new FormData();
  form.append('file',file);
  form.append('domain',$('upload-domain').value||'general');
  const res = await fetch('/api/sources/upload',{method:'POST',body:form,credentials:'same-origin'});
  if (!res.ok) { const d=await res.json(); throw new Error(d.error||'Upload failed'); }
  $('source-file').value='';
  toast('File uploaded to library','ok'); await boot();
}
async function saveTemplate() {
  await api('/api/templates',{method:'POST',body:JSON.stringify({name:$('template-name')?$('template-name').value:'',category:'General',body:''})});
  toast('Template saved','ok'); await boot();
}

// ── Settings ───────────────────────────────────────────────────────────────
function renderSettings(intg, ver) {
  const i = intg.integrations||{};
  $('integrations-list').innerHTML = [
    {name:'OpenAI', on:i.openai?.configured, detail:i.openai?.model||'Not configured'},
    {name:'WhatsApp Business', on:i.whatsapp?.configured, detail:i.whatsapp?.configured?'Webhook active':'Credentials needed'},
    {name:'Stripe', on:i.stripe?.configured, detail:i.stripe?.configured?'Payments active':'Credentials needed'},
  ].map(it=>`<div class="intg-chip">
    <div class="ic-dot ${it.on?'on':'off'}"></div>
    <div class="ic-name">${it.name}</div>
    <div class="ic-status">${it.detail}</div>
  </div>`).join('');
  const prof = S.dash.profile||{};
  $('profile-style').value = prof.response_style||'';
  $('profile-notes').value = prof.personality_notes||'';
  $('profile-forbidden').value = prof.forbidden_tone||'';
  $('system-status').innerHTML = `
    <div class="list-item"><div class="li-body"><div class="li-title">App</div></div><div class="li-right"><div class="li-val">${ver.app}</div></div></div>
    <div class="list-item"><div class="li-body"><div class="li-title">Version</div></div><div class="li-right"><div class="li-val">${ver.version}</div></div></div>
    <div class="list-item"><div class="li-body"><div class="li-title">Edition</div></div><div class="li-right"><div class="li-val" style="font-size:11px;">${ver.edition}</div></div></div>
    <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;">
      <button class="secondary" id="btn-sims-settings">▶ Run simulations</button>
      <div id="sim-results"></div>
    </div>`;
  document.getElementById('btn-sims-settings')?.addEventListener('click', runSimulations);
}
async function loadSettings() {
  try {
    const [intg,ver] = await Promise.all([api('/api/integrations/status'),api('/api/version')]);
    renderSettings(intg,ver);
  } catch {}
}
async function saveProfile() {
  await api('/api/profile',{method:'POST',body:JSON.stringify({response_style:$('profile-style').value,personality_notes:$('profile-notes').value,forbidden_tone:$('profile-forbidden').value})});
  toast('Profile saved','ok'); await boot();
}
async function saveTaxProfile() {
  await api('/api/tax-profile',{method:'POST',body:JSON.stringify({
    country_code:$('tax-country').value, default_tax_pct:parseFloat($('tax-rate').value||0),
    tax_authority:$('tax-authority').value, tax_id:$('tax-company-id').value,
    invoice_prefix:$('tax-prefix').value,
  })});
  toast('Fiscal config saved','ok');
}
async function saveMargins() {
  await api('/api/margins',{method:'POST',body:JSON.stringify({
    min_margin_pct:parseFloat($('margin-min-margin').value||25)/100,
    max_discount_pct:parseFloat($('margin-max-discount').value||15)/100,
    auto_approve_below_pct:parseFloat($('margin-auto-approve').value||5)/100,
  })});
  toast('Margin rules saved','ok');
}
async function runSimulations() {
  const r = await api('/api/simulations/run',{method:'POST'});
  const el = document.getElementById('sim-results');
  if (el) el.innerHTML = r.results.map(x=>`
    <div style="padding:8px;background:var(--surface2);border-radius:var(--radius-sm);margin-top:6px;font-size:11px;">
      <strong>${x.workspace}</strong> · ${x.ok?'✓':'✗'}<br>
      <span style="color:var(--text2);">${x.reply||x.error||''}</span>
    </div>`).join('');
  toast('Simulations complete','ok');
}

// ── Wire UI ────────────────────────────────────────────────────────────────
function wire() {
  // nav
  document.querySelectorAll('.nav-item[data-page]').forEach(b=>{
    b.addEventListener('click',()=>navTo(b.dataset.page));
  });
  // login
  $('login-btn').addEventListener('click', login);
  $('password').addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });

  // top actions
  $('logout-btn').addEventListener('click', logout);
  $('btn-run-audit').addEventListener('click', runAudit);
  $('btn-audit-run').addEventListener('click', runAudit);
  $('btn-backup').addEventListener('click',()=>window.open('/api/backup','_blank'));
  $('btn-run-sims').addEventListener('click', runSimulations);
  $('btn-go-live')?.addEventListener('click',()=>window.open('/api/go-live-pack','_blank'));
  $('btn-audit-detail')?.addEventListener('click',()=>navTo('agents'));
  // sales
  $('suggest-reply').addEventListener('click', suggestReply);
  $('send-reply').addEventListener('click', sendReply);
  $('send-agent').addEventListener('click', sendAgentInbound);
  $('send-webchat').addEventListener('click', sendWebchat);
  $('create-quote').addEventListener('click', createQuote);
  // finance
  $('save-ledger').addEventListener('click', saveLedger);
  $('btn-export-excel')?.addEventListener('click', exportExcel);
  $('btn-export-csv')?.addEventListener('click', exportCSV);
  // tasks
  $('save-task').addEventListener('click', saveTask);
  // pricing
  $('run-pricing').addEventListener('click', runPricing);
  $('btn-new-product')?.addEventListener('click', openNewProduct);
  $('btn-bulk-import')?.addEventListener('click', openBulkModal);
  $('btn-save-product')?.addEventListener('click', saveProduct);
  $('inv-search')?.addEventListener('input', renderInventoryTable);
  $('inv-filter-cat')?.addEventListener('change', renderInventoryTable);
  $('inv-filter-stock')?.addEventListener('change', renderInventoryTable);
  $('p-cost')?.addEventListener('input', updateMarginPreview);
  $('p-price')?.addEventListener('input', updateMarginPreview);
  // knowledge
  $('save-knowledge').addEventListener('click', saveKnowledge);
  $('save-source').addEventListener('click', saveSource);
  $('upload-source').addEventListener('click',()=>uploadSourceFile().catch(e=>toast(e.message,'err')));
  // agents
  $('btn-save-tax').addEventListener('click', saveTaxProfile);
  $('btn-save-margins').addEventListener('click', saveMargins);
  // settings
  $('save-profile').addEventListener('click', saveProfile);
  // PWA
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); S.install=e; });
}

async function loadVersionBadge() {
  try {
    const v = await api('/api/version');
    $('version-badge').textContent = `${v.app} ${v.version}`;
  } catch { $('version-badge').textContent='Banzai'; }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));
}

wire();
loadVersionBadge();
trySession();

// ── Pipeline Kanban ────────────────────────────────────────────────────────
let pipelineData = null;
let editingCardId = null;

async function loadPipeline() {
  const r = await api('/api/pipeline');
  pipelineData = r;
  const cur = S.user.currency;
  const stats = r.stats || {};
  $('pipeline-stats').innerHTML = [
    {l:'Total oportunidades', v:stats.total_cards||0, c:'c-brand'},
    {l:'Pipeline value', v:fmt(stats.total_value||0,cur), c:'c-green'},
    {l:'Revenue cerrado', v:fmt(stats.closed_value||0,cur), c:'c-green'},
    {l:'Win rate', v:(stats.win_rate||0)+'%', c:stats.win_rate>=50?'c-green':'c-amber'},
  ].map(k=>`<div class="kpi-card ${k.c}"><div class="kpi-label">${k.l}</div><div class="kpi-val">${k.v}</div></div>`).join('');
  const board = r.board || {};
  const stages = r.stages || [];
  $('pipeline-board').innerHTML = stages.map(stage => {
    const cards = board[stage] || [];
    const stageValue = cards.reduce((s,c)=>s+c.deal_value,0);
    const STAGE_COLORS = {
      'Nuevo':'var(--text3)', 'Contactado':'var(--brand)', 'Demo':'var(--cyan)',
      'Propuesta':'var(--amber)', 'Negociación':'#F97316', 'Cerrado':'var(--green)', 'Perdido':'var(--red)'
    };
    return `<div style="min-width:220px;flex-shrink:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding:0 2px;">
        <div style="font-size:12px;font-weight:600;color:${STAGE_COLORS[stage]||'var(--text2)'};">${stage}</div>
        <div style="font-size:10px;color:var(--text3);">${cards.length} · ${fmt(stageValue,cur)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;" id="stage-${stage.replace(/\s/g,'-')}">
        ${cards.map(card=>`
          <div onclick="editCard(${card.id})" style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-lg);padding:12px;cursor:pointer;transition:border-color .12s;" onmouseover="this.style.borderColor='var(--brand)'" onmouseout="this.style.borderColor='var(--border2)'">
            <div style="font-size:13px;font-weight:600;margin-bottom:4px;">${card.customer_name}</div>
            <div style="font-size:14px;font-weight:700;color:var(--brand);">${fmt(card.deal_value,card.currency||cur)}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <div style="flex:1;height:4px;background:var(--surface3);border-radius:2px;overflow:hidden;">
                <div style="width:${card.probability}%;height:100%;background:${card.probability>=70?'var(--green)':card.probability>=40?'var(--amber)':'var(--red)'}"></div>
              </div>
              <span style="font-size:10px;color:var(--text3);">${card.probability}%</span>
            </div>
            ${card.expected_close?`<div style="font-size:10px;color:var(--text3);margin-top:4px;">📅 ${card.expected_close}</div>`:''}
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
  // Update badge
  const openCards = Object.entries(board).filter(([s])=>!['Cerrado','Perdido'].includes(s)).reduce((n,[,c])=>n+c.length,0);
  if($('badge-pipeline')) $('badge-pipeline').textContent = openCards || '';
}

function openNewCard() {
  editingCardId = null; $('card-id').value='';
  $('card-modal-title').textContent='Nueva oportunidad';
  $('btn-delete-card').style.display='none';
  ['card-customer','card-notes'].forEach(id=>$(id).value='');
  $('card-value').value='0'; $('card-prob').value='50';
  if(pipelineData) {
    $('card-stage').innerHTML = (pipelineData.stages||[]).map(s=>`<option>${s}</option>`).join('');
  }
  $('card-close').value = new Date().toISOString().slice(0,10);
  $('card-modal').style.display='flex';
}

function editCard(id) {
  editingCardId = id;
  const allCards = Object.values(pipelineData?.board||{}).flat();
  const card = allCards.find(c=>c.id===id); if(!card) return;
  $('card-id').value=id; $('card-modal-title').textContent='Editar oportunidad';
  $('btn-delete-card').style.display='block';
  $('card-customer').value=card.customer_name||'';
  $('card-value').value=card.deal_value||0;
  $('card-prob').value=card.probability||50;
  $('card-notes').value=card.notes||'';
  $('card-close').value=card.expected_close||'';
  if(pipelineData) {
    $('card-stage').innerHTML=(pipelineData.stages||[]).map(s=>`<option ${s===card.stage?'selected':''}>${s}</option>`).join('');
  }
  $('card-modal').style.display='flex';
}

function closePipelineModal() { $('card-modal').style.display='none'; }

async function saveCard() {
  const payload = { customer_name:$('card-customer').value.trim(), deal_value:parseFloat($('card-value').value||0),
    probability:parseInt($('card-prob').value||50), stage:$('card-stage').value,
    notes:$('card-notes').value.trim(), expected_close:$('card-close').value, currency:S.user.currency };
  if(!payload.customer_name){toast('Nombre del cliente obligatorio','err');return;}
  try {
    const id = $('card-id').value;
    if(id){await api(`/api/pipeline/cards/${id}`,{method:'PUT',body:JSON.stringify(payload)});}
    else {await api('/api/pipeline/cards',{method:'POST',body:JSON.stringify(payload)});}
    toast('Guardado ✓','ok'); closePipelineModal(); await loadPipeline();
  } catch(e){toast(e.message,'err');}
}

async function deleteCardModal() {
  const id=$('card-id').value; if(!id||!confirm('¿Eliminar esta oportunidad?')) return;
  await api(`/api/pipeline/cards/${id}`,{method:'DELETE'});
  toast('Eliminada','ok'); closePipelineModal(); await loadPipeline();
}

// ── Contacts ───────────────────────────────────────────────────────────────
async function loadContacts() {
  const r = await api('/api/contacts');
  const contacts = r.contacts||[];
  const cur = S.user.currency;
  $('contacts-count').textContent=`${contacts.length} contactos`;
  $('contacts-list').innerHTML = contacts.length
    ? contacts.map(c=>`
      <div onclick="viewContact(${c.id})" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <div style="width:34px;height:34px;border-radius:10px;background:var(--brand-dim);border:1px solid rgba(99,102,241,.2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--brand);flex-shrink:0;">${(c.name||'?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">${c.name}</div>
          <div style="font-size:11px;color:var(--text3);">${c.company||''} ${c.email||''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:13px;font-weight:600;color:var(--green);">${fmt(c.total_revenue||0,cur)}</div>
          <div style="font-size:10px;color:var(--text3);">${c.nps_score!==null?'NPS '+c.nps_score:''}</div>
        </div>
      </div>`).join('')
    : '<div class="empty"><div class="empty-icon">◎</div><div class="empty-text">Sin contactos. Sincronizá desde las conversaciones activas.</div></div>';
}

async function viewContact(id) {
  const r = await api(`/api/contacts/${id}`);
  const c = r.contact; const cur = S.user.currency;
  const summary = r.summary||{};
  $('contact-detail-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <div style="width:48px;height:48px;border-radius:14px;background:var(--brand-dim);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:var(--brand);">${(c.name||'?')[0].toUpperCase()}</div>
      <div><div style="font-size:16px;font-weight:700;">${c.name}</div><div style="font-size:12px;color:var(--text3);">${c.company||''} · ${c.role||''}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
      <div class="kpi-card c-green" style="padding:10px 12px;"><div class="kpi-label">Revenue total</div><div class="kpi-val" style="font-size:18px;">${fmt(summary.total_revenue||0,cur)}</div></div>
      <div class="kpi-card c-brand" style="padding:10px 12px;"><div class="kpi-label">NPS promedio</div><div class="kpi-val" style="font-size:18px;">${summary.avg_nps||'—'}</div></div>
    </div>
    ${c.email?`<div style="font-size:12px;color:var(--text2);margin-bottom:4px;">📧 ${c.email}</div>`:''}
    ${c.phone?`<div style="font-size:12px;color:var(--text2);margin-bottom:4px;">📱 ${c.phone}</div>`:''}
    ${c.notes?`<div style="font-size:12px;color:var(--text2);margin-top:8px;padding:10px;background:var(--surface3);border-radius:8px;">${c.notes}</div>`:''}
    <div style="margin-top:14px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-bottom:8px;">Deals (${r.deals?.length||0})</div>
      ${(r.deals||[]).slice(0,3).map(d=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;"><span>${d.status}</span><span style="font-weight:600;">${fmt(d.negotiated_total,d.currency||cur)}</span></div>`).join('')||'<span style="font-size:12px;color:var(--text3);">Sin deals</span>'}
    </div>`;
}

async function syncContacts() {
  const r = await api('/api/contacts/sync',{method:'POST',body:JSON.stringify({})});
  toast(`Sincronizado: ${r.created} nuevos, ${r.updated} actualizados`,'ok');
  await loadContacts();
}

function openNewContact() { $('new-contact-modal').style.display='flex'; }
function closeContactModal() { $('new-contact-modal').style.display='none'; }
async function saveNewContact() {
  const payload={name:$('c-name').value.trim(),email:$('c-email').value.trim(),phone:$('c-phone').value.trim(),company:$('c-company').value.trim(),role:$('c-role').value.trim(),notes:$('c-notes').value.trim()};
  if(!payload.name){toast('Nombre obligatorio','err');return;}
  await api('/api/contacts',{method:'POST',body:JSON.stringify(payload)});
  toast('Contacto creado ✓','ok'); closeContactModal(); await loadContacts();
}

// ── Goals ──────────────────────────────────────────────────────────────────
async function loadGoals() {
  const r = await api('/api/goals');
  const goals = r.goals||[];
  const cur = S.user.currency;
  $('goals-list').innerHTML = goals.length
    ? goals.map(g=>{
        const pct=g.progress_pct||0;
        const color=pct>=80?'var(--green)':pct>=50?'var(--amber)':'var(--red)';
        const metricLabel={'revenue':'Ingresos','deals_closed':'Deals cerrados','deals_value':'Valor deals','nps':'NPS','surveys':'Encuestas'}[g.metric]||g.metric;
        return `<div class="kpi-card" style="padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div><div style="font-size:13px;font-weight:600;">${g.name}</div><div style="font-size:11px;color:var(--text3);">${metricLabel} · ${g.period}</div></div>
            <button onclick="deleteGoal(${g.id})" style="padding:2px 7px;font-size:10px;background:var(--red-dim);border:1px solid rgba(239,68,68,.2);border-radius:4px;color:var(--red);cursor:pointer;">✕</button>
          </div>
          <div style="font-size:24px;font-weight:700;color:${color};margin-bottom:4px;">${pct.toFixed(0)}%</div>
          <div style="height:6px;background:var(--surface3);border-radius:3px;overflow:hidden;margin-bottom:8px;">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width .4s;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);">
            <span>${typeof g.current_value==='number'?g.current_value.toLocaleString():g.current_value}</span>
            <span>Meta: ${typeof g.target_value==='number'?g.target_value.toLocaleString():g.target_value}</span>
          </div>
        </div>`;
      }).join('')
    : '<div style="grid-column:1/-1;" class="empty"><div class="empty-icon">◉</div><div class="empty-text">No hay objetivos todavía. Creá uno para trackear tu progreso.</div></div>';
}

function openNewGoal(){
  const today=new Date().toISOString().slice(0,10);
  $('g-start').value=today;
  $('g-end').value=new Date(new Date().setMonth(new Date().getMonth()+1)).toISOString().slice(0,10);
  $('goal-modal').style.display='flex';
}
function closeGoalModal(){ $('goal-modal').style.display='none'; }
async function saveGoal(){
  const payload={name:$('g-name').value.trim(),metric:$('g-metric').value,target_value:parseFloat($('g-target').value||0),start_date:$('g-start').value,end_date:$('g-end').value};
  if(!payload.name||!payload.target_value){toast('Completá todos los campos','err');return;}
  await api('/api/goals',{method:'POST',body:JSON.stringify(payload)});
  toast('Objetivo creado ✓','ok'); closeGoalModal(); await loadGoals();
}
async function deleteGoal(id){
  if(!confirm('¿Eliminar este objetivo?')) return;
  await api(`/api/goals/${id}`,{method:'DELETE'});
  await loadGoals();
}

// ── Automations ────────────────────────────────────────────────────────────
async function loadAutomations() {
  const r = await api('/api/automations');
  const autos = r.automations||[];
  // Fill selects
  if($('auto-trigger')) $('auto-trigger').innerHTML=Object.entries(r.available_triggers||{}).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
  if($('auto-action')) $('auto-action').innerHTML=Object.entries(r.available_actions||{}).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
  $('automations-list').innerHTML = autos.length
    ? autos.map(a=>`
      <div class="panel" style="margin-bottom:10px;">
        <div class="panel-body" style="display:flex;align-items:center;gap:10px;">
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;">${a.name}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">${a.trigger_type} → ${a.action_type} · Corrió ${a.run_count}x</div>
          </div>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;text-transform:none;letter-spacing:0;color:var(--text2);margin:0;cursor:pointer;">
            <input type="checkbox" ${a.active?'checked':''} onchange="toggleAuto(${a.id},this.checked)" style="width:auto;">
            Activo
          </label>
          <button onclick="deleteAuto(${a.id})" class="danger-btn" style="padding:4px 8px;font-size:11px;">✕</button>
        </div>
      </div>`).join('')
    : '<div class="empty"><div class="empty-icon">⚡</div><div class="empty-text">Sin automatizaciones. Creá una para que el sistema trabaje solo.</div></div>';
}

function openNewAutomation(){ $('auto-form-panel').scrollIntoView({behavior:'smooth'}); }
async function saveAutomation(){
  let cfg={};
  try{ cfg=JSON.parse($('auto-config').value||'{}'); } catch(e){ toast('JSON inválido en configuración','err'); return; }
  const payload={name:$('auto-name').value.trim(),trigger_type:$('auto-trigger').value,action_type:$('auto-action').value,action_config:cfg};
  if(!payload.name){toast('Nombre obligatorio','err');return;}
  await api('/api/automations',{method:'POST',body:JSON.stringify(payload)});
  toast('Automatización creada ✓','ok'); await loadAutomations();
}
async function toggleAuto(id,active){ await api(`/api/automations/${id}`,{method:'PUT',body:JSON.stringify({active:active?1:0})}); }
async function deleteAuto(id){ if(!confirm('¿Eliminar?'))return; await api(`/api/automations/${id}`,{method:'DELETE'}); await loadAutomations(); }

// ── AI Advisor ─────────────────────────────────────────────────────────────
async function loadAdvisorInsights(){
  $('advisor-loading').style.display='block';
  $('advisor-content').innerHTML='';
  const btn=$('btn-get-insights');
  if(btn){btn.disabled=true; btn.textContent='Analizando…';}
  try{
    const r=await api('/api/advisor/insights');
    $('advisor-loading').style.display='none';
    const insights=r.rule_insights||[];
    const cur=S.user.currency; const ctx=r.context||{};
    $('advisor-content').innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        <div class="kpi-card c-green"><div class="kpi-label">Ingresos</div><div class="kpi-val" style="font-size:20px;">${fmt(ctx.income||0,cur)}</div></div>
        <div class="kpi-card c-brand"><div class="kpi-label">Deals abiertos</div><div class="kpi-val" style="font-size:20px;">${ctx.deals_open||0}</div></div>
        <div class="kpi-card c-amber"><div class="kpi-label">NPS promedio</div><div class="kpi-val" style="font-size:20px;">${ctx.avg_nps||'—'}</div></div>
      </div>
      ${r.insights_text?`<div style="background:var(--brand-dim);border:1px solid rgba(99,102,241,.2);border-radius:var(--r-lg);padding:18px;margin-bottom:16px;font-size:13px;line-height:1.8;white-space:pre-wrap;color:var(--text);">${r.insights_text}</div>`:''}
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${insights.map(ins=>`
          <div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-lg);padding:16px;display:flex;gap:12px;align-items:flex-start;">
            <div style="font-size:22px;flex-shrink:0;">${ins.emoji}</div>
            <div><div style="font-size:14px;font-weight:600;margin-bottom:4px;">${ins.title}</div>
              <div style="font-size:13px;color:var(--text2);margin-bottom:6px;">${ins.body}</div>
              <div style="font-size:12px;color:var(--brand);font-weight:500;">→ ${ins.action}</div>
            </div>
          </div>`).join('')}
      </div>
      <div style="margin-top:12px;font-size:11px;color:var(--text3);">Generado: ${(r.generated_at||'').substring(0,16)} · Fuente: ${r.source}</div>`;
    if(btn){btn.disabled=false; btn.textContent='↺ Actualizar insights';}
  }catch(e){
    $('advisor-loading').style.display='none';
    $('advisor-content').innerHTML=`<div class="empty"><div class="empty-text">Error: ${e.message}</div></div>`;
    if(btn){btn.disabled=false; btn.textContent='✦ Generar insights';}
  }
}

// ── Broadcast ──────────────────────────────────────────────────────────────
async function loadBroadcastHistory(){
  const r=await api('/api/broadcast/history');
  const h=r.history||[];
  $('broadcast-history').innerHTML=h.length
    ?h.map(t=>`<div style="padding:9px 0;border-bottom:1px solid var(--border);font-size:12px;"><div style="font-weight:500;">${t.customer||'—'}</div><div style="color:var(--text3);font-size:11px;">${t.detail?.substring(0,60)||''}</div><div style="color:var(--text3);font-size:10px;">${(t.created_at||'').substring(0,16)}</div></div>`).join('')
    :'<div class="empty"><div class="empty-text">Sin broadcasts enviados</div></div>';
}

async function sendBroadcast(){
  const message=$('bc-message').value.trim();
  const channel=$('bc-channel').value;
  const lines=$('bc-recipients').value.trim().split('\n').filter(Boolean);
  if(!message){toast('Escribí el mensaje','err');return;}
  if(!lines.length){toast('Agregá destinatarios','err');return;}
  const recipients=lines.map(l=>{const[name,phone]=(l+'|').split('|');return{name:name.trim(),phone:phone?.trim()||''};});
  $('bc-result').style.display='none';
  try{
    const r=await api('/api/broadcast',{method:'POST',body:JSON.stringify({message,channel,recipients})});
    $('bc-result').style.display='block';
    $('bc-result').style.background='var(--green-dim)';
    $('bc-result').style.border='1px solid rgba(16,185,129,.2)';
    $('bc-result').textContent=`✓ Enviado a ${r.sent} de ${r.total}${r.failed?` (${r.failed} fallidos)`:''}`;
    toast(`Broadcast enviado: ${r.sent} mensajes ✓`,'ok');
    await loadBroadcastHistory();
  }catch(e){toast(e.message,'err');}
}

$('bc-message')?.addEventListener('input',()=>{
  const n=$('bc-message')?.value?.length||0;
  const el=$('bc-char-count');
  if(el) el.textContent=`${n} caracteres${n>1000?' ⚠ Muy largo para WhatsApp':''}`;
});

