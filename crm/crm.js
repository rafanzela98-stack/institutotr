'use strict';
/* CRM interno – Instituto T&R. Dados em localStorage (somente neste navegador). */
const KEY = 'crm-instituto-tr-v1';
const ETAPAS = ['Novo contato', 'Visita agendada', 'Em avaliação', 'Proposta', 'Matriculado', 'Perdido'];
const TIPOS_CONTATO = ['Aluno', 'Responsável', 'Lead', 'Profissional', 'Parceiro'];
const TIPOS_EVENTO = ['Atendimento', 'Tarefa', 'Follow-up', 'Reunião'];

const db = (() => {
  try { return Object.assign({ contacts: [], leads: [], events: [], payments: [] }, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { return { contacts: [], leads: [], events: [], payments: [] }; }
})();
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = d => d ? d.split('-').reverse().join('/') : '';
const contactName = id => (db.contacts.find(c => c.id === id) || {}).nome || '—';
const contactOpts = () => [['', '— nenhum —'], ...db.contacts.map(c => [c.id, c.nome])];
const opts = a => a.map(x => [x, x]);

/* ---------- Modal de formulário genérico ---------- */
function openForm(title, fields, values, onSave, extra) {
  const form = $('#form');
  form.innerHTML = `<h2>${esc(title)}</h2>` + fields.map(f => {
    const v = values[f.k] ?? f.def ?? '';
    let input;
    if (f.type === 'select') input = `<select name="${f.k}">${f.opts.map(([val, lab]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') input = `<textarea name="${f.k}">${esc(v)}</textarea>`;
    else input = `<input name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" ${f.step ? `step="${f.step}"` : ''} ${f.req ? 'required' : ''}>`;
    return `<div class="f"><label>${esc(f.label)}</label>${input}</div>`;
  }).join('') + (extra || '') + `<div class="actions"><button type="button" class="btn ghost" id="cancel">Cancelar</button><button class="btn">Salvar</button></div>`;
  const m = $('#modal');
  $('#cancel').onclick = () => m.close();
  form.onsubmit = e => {
    e.preventDefault();
    const out = {};
    fields.forEach(f => { out[f.k] = f.type === 'number' ? Number(form.elements[f.k].value) || 0 : form.elements[f.k].value.trim(); });
    onSave(out); save(); m.close(); render();
  };
  m.showModal();
}
const confirmDel = (msg, fn) => { if (confirm(msg)) { fn(); save(); render(); } };
const empty = t => `<p class="empty">${t}</p>`;

/* ---------- Painel ---------- */
function viewDashboard() {
  const t = today(), mes = t.slice(0, 7);
  const abertas = db.events.filter(e => !e.feito);
  const atrasadas = abertas.filter(e => e.data < t);
  const hoje = abertas.filter(e => e.data === t);
  const pend = db.payments.filter(p => p.status !== 'Pago');
  const venc = pend.filter(p => p.vencimento < t);
  const recMes = db.payments.filter(p => p.status === 'Pago' && (p.pagoEm || '').startsWith(mes)).reduce((s, p) => s + p.valor, 0);
  const ativos = db.leads.filter(l => !['Matriculado', 'Perdido'].includes(l.etapa)).length;
  const porEtapa = ETAPAS.map(e => `<tr><td>${e}</td><td>${db.leads.filter(l => l.etapa === e).length}</td></tr>`).join('');
  return `<div class="head"><h1>Painel</h1></div>
  <div class="cards">
    <div class="card"><b>${db.contacts.length}</b><span>Contatos</span></div>
    <div class="card"><b>${ativos}</b><span>Leads em andamento</span></div>
    <div class="card ${atrasadas.length ? 'warn' : ''}"><b>${atrasadas.length}</b><span>Tarefas atrasadas</span></div>
    <div class="card ${venc.length ? 'warn' : ''}"><b>${brl(venc.reduce((s, p) => s + p.valor, 0))}</b><span>Em atraso (${venc.length})</span></div>
    <div class="card"><b>${brl(pend.reduce((s, p) => s + p.valor, 0))}</b><span>A receber</span></div>
    <div class="card"><b>${brl(recMes)}</b><span>Recebido no mês</span></div>
  </div>
  <div class="grid2">
    <div class="panel"><h2>Agenda de hoje</h2>${hoje.length ? hoje.map(e => `<p>${esc(e.hora || '')} <b>${esc(e.titulo)}</b> <span class="muted">${esc(contactName(e.contatoId))}</span></p>`).join('') : empty('Nada para hoje.')}</div>
    <div class="panel"><h2>Funil</h2><table><tbody>${porEtapa}</tbody></table></div>
    <div class="panel"><h2>Atrasadas</h2>${atrasadas.length ? atrasadas.slice(0, 8).map(e => `<p><span class="tag bad">${dt(e.data)}</span> ${esc(e.titulo)}</p>`).join('') : empty('Tudo em dia 🎉')}</div>
  </div>`;
}

/* ---------- Contatos ---------- */
const contactFields = () => [
  { k: 'nome', label: 'Nome', req: 1 }, { k: 'tipo', label: 'Tipo', type: 'select', opts: opts(TIPOS_CONTATO) },
  { k: 'telefone', label: 'Telefone / WhatsApp', type: 'tel' }, { k: 'email', label: 'E-mail', type: 'email' },
  { k: 'serie', label: 'Série / turma (se aluno)' }, { k: 'responsavel', label: 'Responsável' },
  { k: 'status', label: 'Status', type: 'select', opts: opts(['Ativo', 'Inativo']) }, { k: 'obs', label: 'Observações', type: 'textarea' }];
let q = '', fTipo = '';
function viewContatos() {
  const list = db.contacts.filter(c => (!fTipo || c.tipo === fTipo) && (c.nome + c.telefone + c.email).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  return `<div class="head"><h1>Contatos</h1><div class="tools">
    <input id="q" placeholder="Buscar…" value="${esc(q)}">
    <select id="ft"><option value="">Todos</option>${TIPOS_CONTATO.map(t => `<option ${t === fTipo ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <button class="btn" data-a="new">+ Novo contato</button></div></div>
  <div class="wrap">${list.length ? `<table><tr><th>Nome</th><th>Tipo</th><th>Contato</th><th>Série</th><th>Status</th><th></th></tr>${list.map(c => `
    <tr><td><b>${esc(c.nome)}</b></td><td>${esc(c.tipo)}</td><td>${esc(c.telefone)}<br><span class="muted">${esc(c.email)}</span></td><td>${esc(c.serie)}</td>
    <td><span class="tag ${c.status === 'Ativo' ? 'ok' : ''}">${esc(c.status)}</span></td>
    <td><button class="btn sm ghost" data-a="hist" data-id="${c.id}">Histórico</button> <button class="btn sm ghost" data-a="edit" data-id="${c.id}">Editar</button> <button class="btn sm danger" data-a="del" data-id="${c.id}">×</button></td></tr>`).join('')}</table>` : empty('Nenhum contato.')}</div>`;
}
function histModal(id) {
  const c = db.contacts.find(x => x.id === id); c.hist = c.hist || [];
  const form = $('#form');
  form.innerHTML = `<h2>Histórico – ${esc(c.nome)}</h2>
    <ul class="hist">${c.hist.length ? c.hist.slice().reverse().map(h => `<li><b>${dt(h.data)}</b> · ${esc(h.texto)}</li>`).join('') : '<li class="muted">Sem interações.</li>'}</ul>
    <div class="f"><label>Nova interação</label><textarea name="t"></textarea></div>
    <div class="actions"><button type="button" class="btn ghost" id="cancel">Fechar</button><button class="btn">Registrar</button></div>`;
  $('#cancel').onclick = () => $('#modal').close();
  form.onsubmit = e => { e.preventDefault(); const t = form.elements.t.value.trim(); if (t) { c.hist.push({ data: today(), texto: t }); save(); } $('#modal').close(); render(); };
  $('#modal').showModal();
}

/* ---------- Funil ---------- */
const leadFields = () => [
  { k: 'nome', label: 'Nome do lead / família', req: 1 }, { k: 'contato', label: 'Telefone / e-mail' },
  { k: 'interesse', label: 'Interesse (série, serviço)' }, { k: 'origem', label: 'Origem', type: 'select', opts: opts(['Indicação', 'Instagram', 'Google', 'Site', 'Evento', 'Outro']) },
  { k: 'etapa', label: 'Etapa', type: 'select', opts: opts(ETAPAS) }, { k: 'obs', label: 'Observações', type: 'textarea' }];
function viewFunil() {
  return `<div class="head"><h1>Funil de leads</h1><button class="btn" data-a="new">+ Novo lead</button></div>
  <p class="muted">Arraste os cartões entre as etapas.</p>
  <div class="kanban">${ETAPAS.map(e => {
    const ls = db.leads.filter(l => l.etapa === e);
    return `<div class="col" data-etapa="${e}"><h3>${e}<span>${ls.length}</span></h3>${ls.map(l => `
      <div class="lead" draggable="true" data-id="${l.id}"><b>${esc(l.nome)}</b><span class="muted">${esc(l.interesse)}</span><br><span class="muted">${esc(l.contato)}</span>
      <div class="row"><button class="btn sm ghost" data-a="edit" data-id="${l.id}">Editar</button>${e === 'Matriculado' && !l.contatoId ? `<button class="btn sm" data-a="tocontact" data-id="${l.id}">→ Contato</button>` : ''}<button class="btn sm danger" data-a="del" data-id="${l.id}">×</button></div></div>`).join('')}</div>`;
  }).join('')}</div>`;
}
function bindKanban() {
  document.querySelectorAll('.lead').forEach(el => el.ondragstart = e => e.dataTransfer.setData('text/plain', el.dataset.id));
  document.querySelectorAll('.col').forEach(col => {
    col.ondragover = e => { e.preventDefault(); col.classList.add('over'); };
    col.ondragleave = () => col.classList.remove('over');
    col.ondrop = e => {
      e.preventDefault();
      const l = db.leads.find(x => x.id === e.dataTransfer.getData('text/plain'));
      if (l) { l.etapa = col.dataset.etapa; save(); render(); }
    };
  });
}

/* ---------- Agenda ---------- */
const eventFields = () => [
  { k: 'titulo', label: 'Título', req: 1 }, { k: 'tipo', label: 'Tipo', type: 'select', opts: opts(TIPOS_EVENTO) },
  { k: 'data', label: 'Data', type: 'date', req: 1, def: today() }, { k: 'hora', label: 'Hora', type: 'time' },
  { k: 'contatoId', label: 'Contato', type: 'select', opts: contactOpts() }, { k: 'obs', label: 'Observações', type: 'textarea' }];
let showDone = false;
function viewAgenda() {
  const t = today();
  const list = db.events.filter(e => showDone || !e.feito).sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));
  return `<div class="head"><h1>Agenda</h1><div class="tools"><label class="muted"><input type="checkbox" id="sd" style="width:auto" ${showDone ? 'checked' : ''}> mostrar concluídos</label><button class="btn" data-a="new">+ Novo compromisso</button></div></div>
  <div class="wrap">${list.length ? `<table><tr><th></th><th>Quando</th><th>O quê</th><th>Contato</th><th></th></tr>${list.map(e => `
    <tr><td><input type="checkbox" style="width:auto" data-a="toggle" data-id="${e.id}" ${e.feito ? 'checked' : ''}></td>
    <td><span class="tag ${!e.feito && e.data < t ? 'bad' : e.data === t ? 'mid' : ''}">${dt(e.data)}</span> ${esc(e.hora)}</td>
    <td class="${e.feito ? 'done' : ''}"><b>${esc(e.titulo)}</b> <span class="muted">${esc(e.tipo)}</span></td><td>${esc(contactName(e.contatoId))}</td>
    <td><button class="btn sm ghost" data-a="edit" data-id="${e.id}">Editar</button> <button class="btn sm danger" data-a="del" data-id="${e.id}">×</button></td></tr>`).join('')}</table>` : empty('Nenhum compromisso.')}</div>`;
}

/* ---------- Financeiro ---------- */
const payFields = () => [
  { k: 'contatoId', label: 'Contato', type: 'select', opts: contactOpts() }, { k: 'descricao', label: 'Descrição', req: 1, def: 'Mensalidade' },
  { k: 'valor', label: 'Valor (R$)', type: 'number', step: '0.01', req: 1 }, { k: 'vencimento', label: 'Vencimento', type: 'date', req: 1, def: today() },
  { k: 'status', label: 'Status', type: 'select', opts: opts(['Pendente', 'Pago']) }, { k: 'pagoEm', label: 'Pago em', type: 'date' }];
let fPay = '';
function viewFinanceiro() {
  const t = today();
  const eff = p => p.status === 'Pago' ? 'Pago' : p.vencimento < t ? 'Atrasado' : 'Pendente';
  const list = db.payments.filter(p => !fPay || eff(p) === fPay).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const cls = { Pago: 'ok', Atrasado: 'bad', Pendente: 'mid' };
  return `<div class="head"><h1>Financeiro</h1><div class="tools">
    <select id="fp"><option value="">Todos</option>${['Pendente', 'Atrasado', 'Pago'].map(s => `<option ${s === fPay ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <button class="btn" data-a="new">+ Nova cobrança</button></div></div>
  <div class="wrap">${list.length ? `<table><tr><th>Vencimento</th><th>Contato</th><th>Descrição</th><th>Valor</th><th>Status</th><th></th></tr>${list.map(p => `
    <tr><td>${dt(p.vencimento)}</td><td>${esc(contactName(p.contatoId))}</td><td>${esc(p.descricao)}</td><td>${brl(p.valor)}</td><td><span class="tag ${cls[eff(p)]}">${eff(p)}</span></td>
    <td>${p.status !== 'Pago' ? `<button class="btn sm" data-a="pay" data-id="${p.id}">Dar baixa</button> ` : ''}<button class="btn sm ghost" data-a="edit" data-id="${p.id}">Editar</button> <button class="btn sm danger" data-a="del" data-id="${p.id}">×</button></td></tr>`).join('')}</table>
    <p class="muted">Total listado: <b>${brl(list.reduce((s, p) => s + p.valor, 0))}</b></p>` : empty('Nenhuma cobrança.')}</div>`;
}

/* ---------- Backup ---------- */
function viewDados() {
  return `<div class="head"><h1>Backup e dados</h1></div>
  <div class="grid2"><div class="panel"><h2>Exportar</h2><p class="muted">Guarde uma cópia em local seguro. Os dados contêm informações pessoais (LGPD).</p>
    <button class="btn" data-a="export">Baixar backup (.json)</button> <button class="btn ghost" data-a="csv">Contatos (.csv)</button></div>
  <div class="panel"><h2>Importar</h2><p class="muted">Substitui todos os dados atuais pelos do arquivo.</p><input type="file" id="imp" accept=".json"></div></div>`;
}
const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };

/* ---------- Roteamento e ações ---------- */
const COLL = { contatos: ['contacts', contactFields, 'Contato'], funil: ['leads', leadFields, 'Lead'], agenda: ['events', eventFields, 'Compromisso'], financeiro: ['payments', payFields, 'Cobrança'] };
const VIEWS = { dashboard: viewDashboard, contatos: viewContatos, funil: viewFunil, agenda: viewAgenda, financeiro: viewFinanceiro, dados: viewDados };
const route = () => (location.hash.replace('#/', '') || 'dashboard').split('?')[0];

function render() {
  const r = VIEWS[route()] ? route() : 'dashboard';
  $('#view').innerHTML = VIEWS[r]();
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + r));
  if (r === 'funil') bindKanban();
  const on = (id, ev, fn) => { const el = $(id); if (el) el[ev] = fn; };
  on('#q', 'oninput', e => { q = e.target.value; render(); const i = $('#q'); i.focus(); i.setSelectionRange(q.length, q.length); });
  on('#ft', 'onchange', e => { fTipo = e.target.value; render(); });
  on('#fp', 'onchange', e => { fPay = e.target.value; render(); });
  on('#sd', 'onchange', e => { showDone = e.target.checked; render(); });
  on('#imp', 'onchange', async e => {
    try {
      const d = JSON.parse(await e.target.files[0].text());
      if (!confirm('Substituir TODOS os dados atuais?')) return;
      ['contacts', 'leads', 'events', 'payments'].forEach(k => db[k] = Array.isArray(d[k]) ? d[k] : []);
      save(); alert('Importado.'); render();
    } catch { alert('Arquivo inválido.'); }
  });
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.type === 'checkbox') return;
  const r = route(), a = b.dataset.a, id = b.dataset.id, c = COLL[r];
  if (a === 'new' && c) openForm('Novo – ' + c[2], c[1](), {}, v => db[c[0]].push({ id: uid(), ...v }));
  else if (a === 'edit' && c) { const it = db[c[0]].find(x => x.id === id); openForm('Editar – ' + c[2], c[1](), it, v => Object.assign(it, v)); }
  else if (a === 'del' && c) confirmDel('Excluir este registro?', () => db[c[0]] = db[c[0]].filter(x => x.id !== id));
  else if (a === 'hist') histModal(id);
  else if (a === 'pay') { const p = db.payments.find(x => x.id === id); p.status = 'Pago'; p.pagoEm = today(); save(); render(); }
  else if (a === 'tocontact') {
    const l = db.leads.find(x => x.id === id), n = { id: uid(), nome: l.nome, tipo: 'Aluno', telefone: l.contato, status: 'Ativo', obs: l.obs || '', hist: [{ data: today(), texto: 'Matriculado via funil de leads.' }] };
    db.contacts.push(n); l.contatoId = n.id; save(); alert('Contato criado.'); render();
  }
  else if (a === 'export') download(`crm-instituto-tr-${today()}.json`, JSON.stringify(db, null, 2), 'application/json');
  else if (a === 'csv') download(`contatos-${today()}.csv`, ['Nome,Tipo,Telefone,Email,Serie,Responsavel,Status', ...db.contacts.map(c => [c.nome, c.tipo, c.telefone, c.email, c.serie, c.responsavel, c.status].map(csvCell).join(','))].join('\n'), 'text/csv');
});
document.addEventListener('change', e => {
  const b = e.target; if (b.dataset && b.dataset.a === 'toggle') { db.events.find(x => x.id === b.dataset.id).feito = b.checked; save(); render(); }
});
addEventListener('hashchange', render);
render();
