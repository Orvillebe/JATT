/**
 * JATL Data Service - Abstraction layer for the timetracker.
 * 
 * This file defines the interface AND provides a localStorage implementation.
 * To switch to Supabase (or anything else), replace this file with one that
 * implements the same functions. The UI doesn't care where data lives.
 * 
 * All functions are async so the interface stays compatible with remote backends.
 */

const DataService = (() => {
  const STORAGE_KEYS = {
    members: 'jatl_members',
    customers: 'jatl_customers',
    projects: 'jatl_projects',
    entries: 'jatl_entries',
    phases: 'jatl_phases',
    currentMember: 'jatl_current_member',
    recentProject: 'jatl_recent_project'
  };

  function _get(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch { return []; }
  }

  function _set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // =====================
  // MEMBERS
  // =====================
  async function getMembers() {
    return _get(STORAGE_KEYS.members);
  }

  async function addMember(name) {
    const members = _get(STORAGE_KEYS.members);
    const member = { id: _uid(), name };
    members.push(member);
    _set(STORAGE_KEYS.members, members);
    return member;
  }

  async function removeMember(id) {
    const members = _get(STORAGE_KEYS.members).filter(m => m.id !== id);
    _set(STORAGE_KEYS.members, members);
    const entries = _get(STORAGE_KEYS.entries).filter(e => e.memberId !== id);
    _set(STORAGE_KEYS.entries, entries);
  }

  // =====================
  // CUSTOMERS
  // =====================
  async function getCustomers() {
    return _get(STORAGE_KEYS.customers);
  }

  async function addCustomer(name) {
    const customers = _get(STORAGE_KEYS.customers);
    const customer = { id: _uid(), name };
    customers.push(customer);
    _set(STORAGE_KEYS.customers, customers);
    return customer;
  }

  async function removeCustomer(id) {
    const customers = _get(STORAGE_KEYS.customers).filter(c => c.id !== id);
    _set(STORAGE_KEYS.customers, customers);
    const projects = _get(STORAGE_KEYS.projects).filter(p => p.customerId !== id);
    _set(STORAGE_KEYS.projects, projects);
    const entries = _get(STORAGE_KEYS.entries).filter(e => e.customerId !== id);
    _set(STORAGE_KEYS.entries, entries);
  }

  // =====================
  // PROJECTS
  // =====================
  async function getProjects() {
    return _get(STORAGE_KEYS.projects);
  }

  async function getProjectsByCustomer(customerId) {
    return _get(STORAGE_KEYS.projects).filter(p => p.customerId === customerId);
  }

  async function addProject(customerId, name) {
    const projects = _get(STORAGE_KEYS.projects);
    const project = { id: _uid(), customerId, name };
    projects.push(project);
    _set(STORAGE_KEYS.projects, projects);
    return project;
  }

  async function removeProject(id) {
    const projects = _get(STORAGE_KEYS.projects).filter(p => p.id !== id);
    _set(STORAGE_KEYS.projects, projects);
    const entries = _get(STORAGE_KEYS.entries).filter(e => e.projectId !== id);
    _set(STORAGE_KEYS.entries, entries);
  }

  // =====================
  // PHASES (stored, global for all projects)
  // =====================
  async function getPhases() {
    const phases = _get(STORAGE_KEYS.phases);
    return phases;
  }

  async function addPhase(name) {
    const phases = _get(STORAGE_KEYS.phases);
    if (phases.includes(name)) return;
    phases.push(name);
    _set(STORAGE_KEYS.phases, phases);
  }

  async function removePhase(name) {
    const phases = _get(STORAGE_KEYS.phases).filter(p => p !== name);
    _set(STORAGE_KEYS.phases, phases);
  }

  // =====================
  // TIME ENTRIES
  // =====================
  async function getEntries(filters = {}) {
    let entries = _get(STORAGE_KEYS.entries);

    if (filters.memberId) entries = entries.filter(e => e.memberId === filters.memberId);
    if (filters.customerId) entries = entries.filter(e => e.customerId === filters.customerId);
    if (filters.projectId) entries = entries.filter(e => e.projectId === filters.projectId);
    if (filters.phase) entries = entries.filter(e => e.phase === filters.phase);
    if (filters.dateFrom) entries = entries.filter(e => e.date >= filters.dateFrom);
    if (filters.dateTo) entries = entries.filter(e => e.date <= filters.dateTo);

    return entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  async function addEntry({ memberId, customerId, projectId, phase, date, minutes, note }) {
    const entries = _get(STORAGE_KEYS.entries);
    const entry = {
      id: _uid(),
      memberId,
      customerId,
      projectId,
      phase,
      date,         // 'YYYY-MM-DD'
      minutes,      // integer (no floating point errors)
      note: note || '',
      createdAt: Date.now()
    };
    entries.push(entry);
    _set(STORAGE_KEYS.entries, entries);
    return entry;
  }

  async function updateEntry(id, updates) {
    const entries = _get(STORAGE_KEYS.entries);
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Entry not found');
    entries[idx] = { ...entries[idx], ...updates };
    _set(STORAGE_KEYS.entries, entries);
    return entries[idx];
  }

  async function removeEntry(id) {
    const entries = _get(STORAGE_KEYS.entries).filter(e => e.id !== id);
    _set(STORAGE_KEYS.entries, entries);
  }

  // =====================
  // REPORTING
  // =====================
  async function getReport(filters = {}) {
    const entries = await getEntries(filters);
    const members = await getMembers();
    const customers = await getCustomers();
    const projects = await getProjects();

    const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);

    const byMember = {};
    const byProject = {};
    const byPhase = {};
    const byCustomer = {};

    for (const e of entries) {
      byMember[e.memberId] = (byMember[e.memberId] || 0) + e.minutes;
      byProject[e.projectId] = (byProject[e.projectId] || 0) + e.minutes;
      byPhase[e.phase] = (byPhase[e.phase] || 0) + e.minutes;
      byCustomer[e.customerId] = (byCustomer[e.customerId] || 0) + e.minutes;
    }

    const resolve = (map, list) =>
      Object.entries(map).map(([id, minutes]) => ({
        id,
        name: (list.find(x => x.id === id) || {}).name || 'Onbekend',
        minutes
      })).sort((a, b) => b.minutes - a.minutes);

    return {
      totalMinutes,
      entries: entries.length,
      byMember: resolve(byMember, members),
      byProject: resolve(byProject, projects),
      byPhase: Object.entries(byPhase).map(([phase, minutes]) => ({ phase, minutes })),
      byCustomer: resolve(byCustomer, customers)
    };
  }

  // =====================
  // LOCAL PREFERENCES (always localStorage, even with remote backend)
  // =====================
  function getCurrentMember() {
    return localStorage.getItem(STORAGE_KEYS.currentMember) || null;
  }

  function setCurrentMember(memberId) {
    localStorage.setItem(STORAGE_KEYS.currentMember, memberId);
  }

  function getRecentProject() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.recentProject)) || null;
    } catch { return null; }
  }

  function setRecentProject({ customerId, projectId, phase }) {
    localStorage.setItem(STORAGE_KEYS.recentProject, JSON.stringify({ customerId, projectId, phase }));
  }

  // =====================
  // EXPORT
  // =====================
  async function exportCSV(filters = {}) {
    const entries = await getEntries(filters);
    const members = await getMembers();
    const customers = await getCustomers();
    const projects = await getProjects();

    const header = 'Datum,Persoon,Klant,Project,Fase,Uren,Minuten,Notitie';
    const rows = entries.map(e => {
      const member = members.find(m => m.id === e.memberId)?.name || '';
      const customer = customers.find(c => c.id === e.customerId)?.name || '';
      const project = projects.find(p => p.id === e.projectId)?.name || '';
      const note = `"${(e.note || '').replace(/"/g, '""')}"`;
      const h = Math.floor(e.minutes / 60);
      const m = e.minutes % 60;
      return `${e.date},${member},${customer},${project},${e.phase},${h}:${String(m).padStart(2,'0')},${e.minutes},${note}`;
    });

    return [header, ...rows].join('\n');
  }

  // =====================
  // PUBLIC API
  // =====================
  return {
    getMembers, addMember, removeMember,
    getCustomers, addCustomer, removeCustomer,
    getProjects, getProjectsByCustomer, addProject, removeProject,
    getPhases, addPhase, removePhase,
    getEntries, addEntry, updateEntry, removeEntry,
    getReport,
    getCurrentMember, setCurrentMember,
    getRecentProject, setRecentProject,
    exportCSV
  };
})();
