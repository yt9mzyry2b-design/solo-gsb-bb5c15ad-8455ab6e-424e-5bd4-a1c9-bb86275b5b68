'use strict';

// ---------- 页面状态 ----------
const state = {
  maxBasics: 12,
  basics: [], // string[]
  gates: [],  // [{name, type, refs}]
  top: '',
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const basicInput = $('basic-input');
const basicList = $('basic-list');
const basicsCount = $('basics-count');
const gateName = $('gate-name');
const gateType = $('gate-type');
const refsOptions = $('refs-options');
const gateList = $('gate-list');
const topSelect = $('top-select');
const resultCard = $('result-card');
const errorBox = $('error-box');
const resultBody = $('result-body');
const resultSummary = $('result-summary');
const resultRows = $('result-rows');

// ---------- 渲染 ----------
function allNames() {
  return [...state.basics, ...state.gates.map((g) => g.name)];
}

function renderBasics() {
  basicsCount.textContent = `（${state.basics.length}/${state.maxBasics}）`;
  basicList.innerHTML = '';
  state.basics.forEach((name, i) => {
    const li = document.createElement('li');
    li.className = 'tag';
    li.textContent = name;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-remove';
    btn.title = '删除';
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      state.basics.splice(i, 1);
      // 级联删除引用了该故障的门
      state.gates = state.gates.filter((g) => !g.refs.includes(name) && g.name !== name);
      if (state.top === name) state.top = '';
      renderAll();
    });
    li.appendChild(btn);
    basicList.appendChild(li);
  });
}

function renderRefsOptions() {
  refsOptions.innerHTML = '';
  const names = allNames();
  if (names.length === 0) {
    refsOptions.innerHTML = '<em>请先添加基础故障或门</em>';
    return;
  }
  names.forEach((name) => {
    const label = document.createElement('label');
    label.className = 'ref-option';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = name;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(name));
    refsOptions.appendChild(label);
  });
}

function renderGates() {
  gateList.innerHTML = '';
  state.gates.forEach((g, i) => {
    const li = document.createElement('li');
    li.className = 'gate-item';
    const badge = document.createElement('span');
    badge.className = `badge badge-${g.type.toLowerCase()}`;
    badge.textContent = g.type;
    const text = document.createElement('span');
    text.className = 'gate-text';
    text.textContent = `${g.name} = ${g.refs.join(` ${g.type} `)}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-remove';
    btn.title = '删除';
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      const removed = state.gates[i].name;
      state.gates.splice(i, 1);
      // 级联删除引用了该门的其他门
      state.gates = state.gates.filter((g) => !g.refs.includes(removed));
      if (state.top === removed) state.top = '';
      renderAll();
    });
    li.append(badge, text, btn);
    gateList.appendChild(li);
  });
}

function renderTopSelect() {
  const prev = state.top;
  topSelect.innerHTML = '<option value="">— 请选择顶层故障 —</option>';
  allNames().forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    topSelect.appendChild(opt);
  });
  topSelect.value = allNames().includes(prev) ? prev : '';
  state.top = topSelect.value;
}

function renderAll() {
  renderBasics();
  renderRefsOptions();
  renderGates();
  renderTopSelect();
}

// ---------- 事件 ----------
function showError(msg) {
  resultCard.hidden = false;
  errorBox.hidden = false;
  errorBox.textContent = `错误：${msg}`;
  resultBody.hidden = true;
}

function addBasic() {
  const name = basicInput.value.trim();
  if (!name) return showError('基础故障名称不能为空');
  if (state.basics.includes(name)) return showError(`基础故障「${name}」已存在`);
  if (allNames().includes(name)) return showError(`「${name}」已被用作门名称`);
  if (state.basics.length >= state.maxBasics) {
    return showError(`基础故障最多 ${state.maxBasics} 个`);
  }
  state.basics.push(name);
  basicInput.value = '';
  basicInput.focus();
  renderAll();
}

function addGate() {
  const name = gateName.value.trim();
  const type = gateType.value;
  const refs = [...refsOptions.querySelectorAll('input:checked')].map((c) => c.value);
  if (!name) return showError('门名称不能为空');
  if (allNames().includes(name)) return showError(`「${name}」已存在（故障或门重名）`);
  if (refs.length === 0) return showError(`门「${name}」至少需要引用一个基础故障或门`);
  state.gates.push({ name, type, refs });
  gateName.value = '';
  gateName.focus();
  renderAll();
}

async function runAnalyze() {
  state.top = topSelect.value;
  try {
    const resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basics: state.basics, gates: state.gates, top: state.top }),
    });
    const data = await resp.json();
    if (!data.ok) return showError(data.error || '分析失败');
    renderResult(data.combinations);
  } catch (e) {
    showError(`无法连接服务器：${e.message}`);
  }
}

function renderResult(combinations) {
  resultCard.hidden = false;
  errorBox.hidden = true;
  resultBody.hidden = false;
  resultSummary.textContent =
    `顶层故障「${state.top}」共有 ${combinations.length} 个最小基础故障组合` +
    '（按故障数与名称排序）：';
  resultRows.innerHTML = '';
  combinations.forEach((combo, i) => {
    const tr = document.createElement('tr');
    const tdNo = document.createElement('td');
    tdNo.textContent = i + 1;
    const tdSize = document.createElement('td');
    tdSize.textContent = `${combo.length} 个故障`;
    const tdMembers = document.createElement('td');
    combo.forEach((m) => {
      const tag = document.createElement('span');
      tag.className = 'tag tag-result';
      tag.textContent = m;
      tdMembers.appendChild(tag);
    });
    tr.append(tdNo, tdSize, tdMembers);
    resultRows.appendChild(tr);
  });
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function loadExample() {
  state.basics = ['轴承磨损', '润滑不足', '电机过热', '皮带断裂', '传感器失效', '冷却泵故障'];
  state.gates = [
    { name: '传动系统失效', type: 'OR', refs: ['轴承磨损', '皮带断裂'] },
    { name: '过热停机', type: 'AND', refs: ['电机过热', '冷却泵故障'] },
    { name: '润滑系统失效', type: 'AND', refs: ['润滑不足', '传感器失效'] },
    { name: '整机停机', type: 'OR', refs: ['传动系统失效', '过热停机', '润滑系统失效'] },
  ];
  state.top = '整机停机';
  renderAll();
  topSelect.value = state.top;
}

function resetAll() {
  state.basics = [];
  state.gates = [];
  state.top = '';
  resultCard.hidden = true;
  renderAll();
}

// ---------- 启动 ----------
$('add-basic').addEventListener('click', addBasic);
basicInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addBasic(); });
$('add-gate').addEventListener('click', addGate);
$('analyze-btn').addEventListener('click', runAnalyze);
$('example-btn').addEventListener('click', loadExample);
$('reset-btn').addEventListener('click', resetAll);
topSelect.addEventListener('change', () => { state.top = topSelect.value; });

fetch('/api/config')
  .then((r) => r.json())
  .then((cfg) => { state.maxBasics = cfg.maxBasics; renderAll(); })
  .catch(() => renderAll());
renderAll();
