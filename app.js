/**
 * JATT - Just A Time Tracker
 *
 * Structure:
 *   Helpers    - shared utilities (DOM, dates, time parsing)
 *   Register   - entry form + week view
 *   Report     - overview with filters + CSV export
 *   Manage     - CRUD for members, customers, projects, phases
 *   App        - init, navigation, member select
 */

/* =============================================
   Helpers
   ============================================= */

const Helpers = (() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }

  function getWeekDates(offset = 0) {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) + (offset * 7);
    const monday = new Date(now.getFullYear(), now.getMonth(), diff);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  function formatDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function formatDateShort(d) {
    return d.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function formatWeekLabel(dates) {
    const from = dates[0].toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
    const to = dates[6].toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
    return `${from} - ${to}`;
  }

  function parseTime(str) {
    if (!str) return 0;
    str = str.trim().toLowerCase().replace(',', '.');

    const mMatch = str.match(/^(\d+)\s*m$/);
    if (mMatch) return parseInt(mMatch[1]);

    const colonMatch = str.match(/^(\d+):(\d{1,2})$/);
    if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);

    const uMatch = str.match(/^(\d+)\s*u\s*(\d{1,2})$/);
    if (uMatch) return parseInt(uMatch[1]) * 60 + parseInt(uMatch[2]);

    const uOnly = str.match(/^(\d+\.?\d*)\s*u$/);
    if (uOnly) return Math.round(parseFloat(uOnly[1]) * 60);

    const num = parseFloat(str);
    if (isNaN(num)) return 0;
    return Math.round(num * 60);
  }

  function formatHours(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h}u`;
    return `${h}u${String(m).padStart(2, '0')}`;
  }

  return { $, $$, toast, getWeekDates, formatDate, formatDateShort, formatWeekLabel, parseTime, formatHours };
})();


/* =============================================
   Register - entry form + week view
   ============================================= */

const Register = (() => {
  const { $, $$, toast, getWeekDates, formatDate, formatDateShort, formatWeekLabel, parseTime, formatHours } = Helpers;

  async function populateDropdowns(weekOffset) {
    const customers = await DataService.getCustomers();
    const phases = await DataService.getPhases();

    const custSel = $('#entryCustomer');
    custSel.innerHTML = '<option value="">Kies...</option>' +
      customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    if (phases.length > 0) {
      $('#phaseRow').style.display = '';
      $('#entryPhase').innerHTML = phases.map(p => `<option value="${p}">${p}</option>`).join('');
    } else {
      $('#phaseRow').style.display = 'none';
      $('#entryPhase').innerHTML = '';
    }

    highlightToday(weekOffset);

    const recent = DataService.getRecentProject();
    if (recent) {
      custSel.value = recent.customerId;
      await updateProjectDropdown();
      $('#entryProject').value = recent.projectId;
      $('#entryPhase').value = recent.phase;
    }
  }

  function highlightToday(weekOffset) {
    const dates = getWeekDates(weekOffset);
    const today = formatDate(new Date());
    const dayNames = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
    $$('.day-label').forEach((label, i) => {
      const isToday = formatDate(dates[i]) === today;
      label.classList.toggle('is-today', isToday);
      label.textContent = `${dayNames[i]} ${dates[i].getDate()}`;
    });
  }

  async function updateProjectDropdown() {
    const customerId = $('#entryCustomer').value;
    const projSel = $('#entryProject');
    if (!customerId) {
      projSel.innerHTML = '<option value="">Kies...</option>';
      return;
    }
    const projects = await DataService.getProjectsByCustomer(customerId);
    projSel.innerHTML = '<option value="">Kies...</option>' +
      projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  async function saveEntry(weekOffset, memberId) {
    const customerId = $('#entryCustomer').value;
    const projectId = $('#entryProject').value;
    const phase = $('#entryPhase').value || '';
    const note = $('#entryNote').value.trim();

    if (!customerId || !projectId) {
      toast('Kies klant en project');
      return;
    }

    const dates = getWeekDates(weekOffset);
    const dayInputs = $$('.day-input');
    let totalSaved = 0;

    for (let i = 0; i < dayInputs.length; i++) {
      const minutes = parseTime(dayInputs[i].value);
      if (!minutes || minutes <= 0) continue;

      await DataService.addEntry({
        memberId, customerId, projectId, phase,
        date: formatDate(dates[i]),
        minutes, note
      });
      totalSaved += minutes;
    }

    if (totalSaved === 0) {
      toast('Vul uren in bij minstens 1 dag');
      return;
    }

    DataService.setRecentProject({ customerId, projectId, phase });

    dayInputs.forEach(inp => inp.value = '');
    $('#entryNote').value = '';
    $('#noteField').classList.remove('visible');
    $('#noteToggle').textContent = '+ notitie';

    toast(`${formatHours(totalSaved)} opgeslagen`);
    renderWeek(weekOffset, memberId);
  }

  async function renderWeek(weekOffset, memberId) {
    const dates = getWeekDates(weekOffset);
    $('#weekLabel').textContent = formatWeekLabel(dates);

    const entries = await DataService.getEntries({
      memberId,
      dateFrom: formatDate(dates[0]),
      dateTo: formatDate(dates[6])
    });

    const projects = await DataService.getProjects();
    const customers = await DataService.getCustomers();

    const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);
    $('#weekTotal').innerHTML = `Totaal: <strong>${formatHours(totalMinutes)}</strong>`;

    const container = $('#weekEntries');
    const summaryContainer = $('#weekSummary');

    if (entries.length === 0) {
      summaryContainer.innerHTML = '';
      container.innerHTML = '<div class="empty-state">Geen registraties deze week</div>';
      return;
    }

    renderWeekSummary(summaryContainer, entries, projects, customers);
    renderWeekEntries(container, entries, projects, customers, dates, weekOffset, memberId);
  }

  function renderWeekSummary(container, entries, projects, customers) {
    const summaryMap = {};
    for (const e of entries) {
      const key = `${e.projectId}__${e.phase}`;
      if (!summaryMap[key]) summaryMap[key] = { projectId: e.projectId, customerId: e.customerId, phase: e.phase, minutes: 0 };
      summaryMap[key].minutes += e.minutes;
    }

    container.innerHTML = Object.values(summaryMap).map(s => {
      const proj = projects.find(p => p.id === s.projectId);
      const cust = customers.find(c => c.id === s.customerId);
      return `<div class="week-chip" data-customer="${s.customerId}" data-project="${s.projectId}" data-phase="${s.phase}">
        <div class="week-chip-project">${proj?.name || '?'}</div>
        <div class="week-chip-detail">${cust?.name || '?'}${s.phase ? ' / ' + s.phase : ''}</div>
        <div class="week-chip-hours">${formatHours(s.minutes)}</div>
      </div>`;
    }).join('');

    container.querySelectorAll('.week-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        $('#entryCustomer').value = chip.dataset.customer;
        await updateProjectDropdown();
        $('#entryProject').value = chip.dataset.project;
        $('#entryPhase').value = chip.dataset.phase;
        $$('.day-input').forEach(inp => inp.value = '');
        $('.quick-entry').scrollIntoView({ behavior: 'smooth', block: 'start' });
        $$('.week-chip').forEach(c => c.classList.remove('week-chip-active'));
        chip.classList.add('week-chip-active');
      });
    });
  }

  function renderWeekEntries(container, entries, projects, customers, dates, weekOffset, memberId) {
    const byDate = {};
    for (const d of dates) byDate[formatDate(d)] = [];
    for (const e of entries) {
      if (byDate[e.date]) byDate[e.date].push(e);
    }

    let html = '';
    for (const d of [...dates].reverse()) {
      const key = formatDate(d);
      const dayEntries = byDate[key];
      if (dayEntries.length === 0) continue;

      const dayTotal = dayEntries.reduce((s, e) => s + e.minutes, 0);
      html += `<div class="day-group">
        <div class="day-header">
          <span>${formatDateShort(d)}</span>
          <span class="day-header-hours">${formatHours(dayTotal)}</span>
        </div>`;

      const grouped = groupEntries(dayEntries);

      for (const e of grouped) {
        const proj = projects.find(p => p.id === e.projectId);
        const cust = customers.find(c => c.id === e.customerId);
        html += `<div class="entry-row" data-entry-ids="${e.ids.join(',')}" data-minutes="${e.minutes}">
          <div class="entry-project">
            <div class="entry-project-name">${proj?.name || '?'}</div>
            <div class="entry-project-detail">${cust?.name || '?'}${e.phase ? ' / ' + e.phase : ''}${e.note ? ' / ' + e.note : ''}</div>
          </div>
          <div class="entry-hours">${formatHours(e.minutes)}</div>
          <button class="entry-delete" data-ids="${e.ids.join(',')}" title="Verwijder">&times;</button>
        </div>`;
      }
      html += '</div>';
    }

    container.innerHTML = html;
    bindEntryActions(container, weekOffset, memberId);
  }

  function groupEntries(dayEntries) {
    const grouped = [];
    const groupMap = {};
    for (const e of dayEntries) {
      const key = `${e.projectId}__${e.phase}__${e.note || ''}`;
      if (groupMap[key]) {
        groupMap[key].minutes += e.minutes;
        groupMap[key].ids.push(e.id);
      } else {
        const g = { ...e, minutes: e.minutes, ids: [e.id] };
        groupMap[key] = g;
        grouped.push(g);
      }
    }
    return grouped;
  }

  function bindEntryActions(container, weekOffset, memberId) {
    container.querySelectorAll('.entry-delete').forEach(btn => {
      btn.addEventListener('click', async (evt) => {
        evt.stopPropagation();
        const ids = btn.dataset.ids.split(',');
        for (const id of ids) await DataService.removeEntry(id);
        renderWeek(weekOffset, memberId);
      });
    });

    container.querySelectorAll('.entry-row[data-entry-ids]').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', (evt) => {
        if (evt.target.closest('.entry-delete')) return;
        const hoursEl = row.querySelector('.entry-hours');
        if (hoursEl.querySelector('input')) return;

        const currentMinutes = row.dataset.minutes;
        const ids = row.dataset.entryIds.split(',');
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        const mins = parseInt(currentMinutes);
        const editH = Math.floor(mins / 60);
        const editM = mins % 60;
        input.value = editM === 0 ? `${editH}` : `${editH}:${String(editM).padStart(2, '0')}`;
        input.className = 'entry-hours-edit';
        hoursEl.textContent = '';
        hoursEl.appendChild(input);
        input.focus();
        input.select();

        const save = async () => {
          const newMinutes = parseTime(input.value);
          if (newMinutes && newMinutes > 0 && newMinutes !== parseInt(currentMinutes)) {
            const original = await DataService.getEntries({ memberId });
            const source = original.find(e => e.id === ids[0]);
            for (const id of ids) await DataService.removeEntry(id);
            await DataService.addEntry({
              memberId: source.memberId,
              customerId: source.customerId,
              projectId: source.projectId,
              phase: source.phase,
              date: source.date,
              minutes: newMinutes,
              note: source.note
            });
            renderWeek(weekOffset, memberId);
          } else {
            hoursEl.textContent = formatHours(parseInt(currentMinutes));
          }
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') input.blur();
          if (e.key === 'Escape') { hoursEl.textContent = formatHours(parseInt(currentMinutes)); }
        });
      });
    });
  }

  function bindEvents(getWeekOffset, getMemberId, onWeekChange) {
    $('#entryCustomer').addEventListener('change', updateProjectDropdown);

    $('#noteToggle').addEventListener('click', () => {
      $('#noteField').classList.toggle('visible');
      $('#noteToggle').textContent = $('#noteField').classList.contains('visible') ? '- notitie' : '+ notitie';
    });

    $('#btnSaveEntry').addEventListener('click', () => saveEntry(getWeekOffset(), getMemberId()));

    $('#weekPrev').addEventListener('click', () => {
      onWeekChange(-1);
      renderWeek(getWeekOffset(), getMemberId());
      highlightToday(getWeekOffset());
    });

    $('#weekNext').addEventListener('click', () => {
      onWeekChange(1);
      renderWeek(getWeekOffset(), getMemberId());
      highlightToday(getWeekOffset());
    });
  }

  return { populateDropdowns, renderWeek, highlightToday, bindEvents };
})();


/* =============================================
   Report - overview with filters + CSV export
   ============================================= */

const Report = (() => {
  const { $, formatDate, formatHours } = Helpers;

  async function render() {
    const customers = await DataService.getCustomers();
    const projects = await DataService.getProjects();
    const members = await DataService.getMembers();
    const phases = await DataService.getPhases();

    const prevCust = $('#reportCustomer').value;
    const prevProj = $('#reportProject').value;
    const prevMember = $('#reportMember').value;
    const prevPhase = $('#reportPhase').value;

    $('#reportCustomer').innerHTML = '<option value="">Alle</option>' +
      customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    $('#reportProject').innerHTML = '<option value="">Alle</option>' +
      projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    $('#reportMember').innerHTML = '<option value="">Iedereen</option>' +
      members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    $('#reportPhase').innerHTML = '<option value="">Alle</option>' +
      phases.map(p => `<option value="${p}">${p}</option>`).join('');

    $('#reportCustomer').value = prevCust;
    $('#reportProject').value = prevProj;
    $('#reportMember').value = prevMember;
    $('#reportPhase').value = prevPhase;

    if (!$('#reportFrom').value) {
      const now = new Date();
      $('#reportFrom').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      $('#reportTo').value = formatDate(now);
    }

    await update();
  }

  function getFilters() {
    return {
      dateFrom: $('#reportFrom').value || undefined,
      dateTo: $('#reportTo').value || undefined,
      customerId: $('#reportCustomer').value || undefined,
      projectId: $('#reportProject').value || undefined,
      memberId: $('#reportMember').value || undefined,
      phase: $('#reportPhase').value || undefined
    };
  }

  async function update() {
    const filters = getFilters();
    const allEntries = await DataService.getEntries(filters);
    const projects = await DataService.getProjects();
    const customers = await DataService.getCustomers();
    const members = await DataService.getMembers();

    const totalMinutes = allEntries.reduce((s, e) => s + e.minutes, 0);
    const container = $('#reportResults');

    let html = `
      <div class="report-card">
        <div class="report-total">${formatHours(totalMinutes)}</div>
        <div class="report-total-label">${allEntries.length} registraties</div>
      </div>`;

    // Group: customer > project > phase, but also store entry indices
    const byCustomer = {};
    for (let i = 0; i < allEntries.length; i++) {
      const e = allEntries[i];
      if (!byCustomer[e.customerId]) byCustomer[e.customerId] = {};
      if (!byCustomer[e.customerId][e.projectId]) byCustomer[e.customerId][e.projectId] = {};
      if (!byCustomer[e.customerId][e.projectId][e.phase || '']) byCustomer[e.customerId][e.projectId][e.phase || ''] = { minutes: 0, indices: [] };
      byCustomer[e.customerId][e.projectId][e.phase || ''].minutes += e.minutes;
      byCustomer[e.customerId][e.projectId][e.phase || ''].indices.push(i);
    }

    let drillId = 0;

    for (const [custId, projs] of Object.entries(byCustomer)) {
      const cust = customers.find(c => c.id === custId);
      const custIndices = [];
      for (const proj of Object.values(projs)) {
        for (const ph of Object.values(proj)) custIndices.push(...ph.indices);
      }
      const custTotal = custIndices.reduce((s, i) => s + allEntries[i].minutes, 0);

      html += `<div class="report-card">
        <div class="report-card-title report-drillable" data-drill="${drillId}">${cust?.name || '?'} <span style="float:right">${formatHours(custTotal)}</span></div>
        <div class="report-drill" id="drill-${drillId}" data-indices="${custIndices.join(',')}" style="display:none"></div>`;
      drillId++;

      for (const [projId, phases] of Object.entries(projs)) {
        const proj = projects.find(p => p.id === projId);
        const projIndices = [];
        for (const ph of Object.values(phases)) projIndices.push(...ph.indices);
        const projTotal = projIndices.reduce((s, i) => s + allEntries[i].minutes, 0);

        html += `<div class="report-row report-row-project report-drillable" data-drill="${drillId}">
          <span>${proj?.name || '?'}</span>
          <span class="report-row-hours">${formatHours(projTotal)}</span>
        </div>
        <div class="report-drill" id="drill-${drillId}" data-indices="${projIndices.join(',')}" style="display:none"></div>`;
        drillId++;

        for (const [phase, data] of Object.entries(phases)) {
          if (!phase) continue;
          html += `<div class="report-row report-row-phase report-drillable" data-drill="${drillId}">
            <span>${phase}</span>
            <span class="report-row-hours">${formatHours(data.minutes)}</span>
          </div>
          <div class="report-drill" id="drill-${drillId}" data-indices="${data.indices.join(',')}" style="display:none"></div>`;
          drillId++;
        }
      }
      html += '</div>';
    }

    if (allEntries.length === 0) {
      html += '<div class="empty-state">Geen registraties voor deze filters</div>';
    }

    container.innerHTML = html;

    // Bind drill-down clicks
    container.querySelectorAll('.report-drillable').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const drillEl = $(`#drill-${row.dataset.drill}`);
        if (drillEl.style.display !== 'none') {
          drillEl.style.display = 'none';
          drillEl.innerHTML = '';
          return;
        }

        // Close other open drills
        container.querySelectorAll('.report-drill').forEach(d => { d.style.display = 'none'; d.innerHTML = ''; });

        const indices = drillEl.dataset.indices.split(',').map(Number);
        const drillEntries = indices.map(i => allEntries[i]).sort((a, b) => b.date.localeCompare(a.date));

        drillEl.innerHTML = drillEntries.map(e => {
          const proj = projects.find(p => p.id === e.projectId);
          const member = members.find(m => m.id === e.memberId);
          return `<div class="report-drill-row">
            <span class="report-drill-date">${e.date.slice(5).replace('-', '/')}</span>
            <span class="report-drill-info">${member?.name || '?'} / ${proj?.name || '?'}${e.phase ? ' / ' + e.phase : ''}${e.note ? ' / ' + e.note : ''}</span>
            <span class="report-drill-hours">${formatHours(e.minutes)}</span>
          </div>`;
        }).join('');

        drillEl.style.display = 'block';
      });
    });
  }

  function bindEvents() {
    ['reportFrom', 'reportTo', 'reportCustomer', 'reportProject', 'reportMember', 'reportPhase'].forEach(id => {
      $(`#${id}`).addEventListener('change', update);
    });

    $('#btnExport').addEventListener('click', async () => {
      const csv = await DataService.exportCSV(getFilters());
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `tijdregistratie-${formatDate(new Date())}.csv`;
      a.click();
    });
  }

  return { render, bindEvents };
})();


/* =============================================
   Manage - CRUD for members, customers, projects, phases
   ============================================= */

const Manage = (() => {
  const { $ } = Helpers;

  async function render() {
    const members = await DataService.getMembers();
    const customers = await DataService.getCustomers();
    const projects = await DataService.getProjects();
    const phases = await DataService.getPhases();

    $('#manageMembers').innerHTML = members.map(m =>
      `<div class="manage-item">
        <span>${m.name}</span>
        <button class="btn btn-small btn-danger" data-remove-member="${m.id}">&times;</button>
      </div>`
    ).join('');

    $('#manageCustomers').innerHTML = customers.map(c =>
      `<div class="manage-item">
        <span>${c.name}</span>
        <button class="btn btn-small btn-danger" data-remove-customer="${c.id}">&times;</button>
      </div>`
    ).join('');

    $('#manageProjects').innerHTML = projects.map(p => {
      const cust = customers.find(c => c.id === p.customerId);
      return `<div class="manage-item">
        <div><span>${p.name}</span><div class="manage-item-sub">${cust?.name || '?'}</div></div>
        <button class="btn btn-small btn-danger" data-remove-project="${p.id}">&times;</button>
      </div>`;
    }).join('');

    $('#managePhases').innerHTML = phases.length === 0
      ? '<div class="empty-state" style="padding:8px 0">Geen fases ingesteld</div>'
      : phases.map(p =>
        `<div class="manage-item">
          <span>${p}</span>
          <button class="btn btn-small btn-danger" data-remove-phase="${p}">&times;</button>
        </div>`
      ).join('');

    $('#newProjectCustomer').innerHTML = '<option value="">Klant...</option>' +
      customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    bindRemoveActions();
  }

  function bindRemoveActions() {
    document.querySelectorAll('[data-remove-member]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await DataService.removeMember(btn.dataset.removeMember);
        render();
      });
    });

    document.querySelectorAll('[data-remove-customer]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await DataService.removeCustomer(btn.dataset.removeCustomer);
        render();
      });
    });

    document.querySelectorAll('[data-remove-project]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await DataService.removeProject(btn.dataset.removeProject);
        render();
      });
    });

    document.querySelectorAll('[data-remove-phase]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await DataService.removePhase(btn.dataset.removePhase);
        render();
        App.refreshDropdowns();
      });
    });
  }

  function bindEvents() {
    $('#btnAddMember').addEventListener('click', async () => {
      const name = $('#newMemberName').value.trim();
      if (!name) return;
      await DataService.addMember(name);
      $('#newMemberName').value = '';
      render();
    });

    $('#btnAddCustomer').addEventListener('click', async () => {
      const name = $('#newCustomerName').value.trim();
      if (!name) return;
      await DataService.addCustomer(name);
      $('#newCustomerName').value = '';
      render();
    });

    $('#btnAddProject').addEventListener('click', async () => {
      const customerId = $('#newProjectCustomer').value;
      const name = $('#newProjectName').value.trim();
      if (!customerId || !name) return;
      await DataService.addProject(customerId, name);
      $('#newProjectName').value = '';
      render();
    });

    $('#btnAddPhase').addEventListener('click', async () => {
      const name = $('#newPhaseName').value.trim();
      if (!name) return;
      await DataService.addPhase(name);
      $('#newPhaseName').value = '';
      render();
      App.refreshDropdowns();
    });
  }

  return { render, bindEvents };
})();


/* =============================================
   App - init, navigation, member select
   ============================================= */

const App = (() => {
  const { $, $$ } = Helpers;

  let currentMemberId = null;
  let weekOffset = 0;

  async function renderMemberSelect() {
    const members = await DataService.getMembers();
    const saved = DataService.getCurrentMember();

    if (saved && members.find(m => m.id === saved)) {
      selectMember(saved);
      return;
    }

    const list = $('#memberList');
    list.innerHTML = members.map(m =>
      `<button data-id="${m.id}">${m.name}</button>`
    ).join('');

    list.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => selectMember(btn.dataset.id));
    });

    $('#addMemberFromSelect').style.display = members.length === 0 ? '' : 'none';
  }

  async function selectMember(id) {
    currentMemberId = id;
    DataService.setCurrentMember(id);

    const members = await DataService.getMembers();
    const member = members.find(m => m.id === id);

    $('#memberSelect').style.display = 'none';
    $('#mainApp').style.display = 'block';
    $('#tabBar').style.display = 'flex';
    $('#headerMember').textContent = member?.name || '';

    await Register.populateDropdowns(weekOffset);
    Register.renderWeek(weekOffset, currentMemberId);
  }

  function refreshDropdowns() {
    Register.populateDropdowns(weekOffset);
  }

  function init() {
    // Tab navigation
    $$('.tab-bar button').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.tab-bar button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.view').forEach(v => v.classList.remove('active'));
        $(`#${btn.dataset.tab}`).classList.add('active');

        if (btn.dataset.tab === 'viewReport') Report.render();
        if (btn.dataset.tab === 'viewManage') Manage.render();
      });
    });

    // Member switch
    $('#headerMember').addEventListener('click', () => {
      DataService.setCurrentMember(null);
      currentMemberId = null;
      $('#memberSelect').style.display = '';
      $('#mainApp').style.display = 'none';
      $('#tabBar').style.display = 'none';
      renderMemberSelect();
    });

    // Bind module events
    Register.bindEvents(
      () => weekOffset,
      () => currentMemberId,
      (delta) => { weekOffset += delta; }
    );
    Report.bindEvents();
    Manage.bindEvents();

    // Add member from select screen
    $('#btnAddMemberFromSelect').addEventListener('click', async () => {
      const name = $('#newMemberFromSelect').value.trim();
      if (!name) return;
      await DataService.addMember(name);
      $('#newMemberFromSelect').value = '';
      renderMemberSelect();
    });

    // Start
    renderMemberSelect();
  }

  return { init, refreshDropdowns };
})();


/* ---- Bootstrap ---- */
App.init();
