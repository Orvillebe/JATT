/**
 * JATL Data Service - Supabase implementation with Auth
 *
 * Replace the two values below with your Supabase project details.
 * Find them at: Supabase Dashboard > Settings > API
 */

const SUPABASE_URL = 'https://pqbxqsunkbuvxlvvjbnp.supabase.co';       // e.g. https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_P_C445o2GHbvR1rYnJFPBQ_6DRvQBF8';       // e.g. eyJhbGciOi...

const DataService = (() => {
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // =====================
  // AUTH
  // =====================

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  function onAuthStateChange(callback) {
    supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  }

  // =====================
  // MEMBERS
  // =====================

  async function getMembers() {
    const { data, error } = await supabase.from('members').select('*').order('name');
    if (error) throw error;
    return data.map(r => ({ id: r.id, name: r.name, email: r.email }));
  }

  async function updateMemberName(name) {
    const session = await getSession();
    if (!session) throw new Error('Not authenticated');
    const { error } = await supabase.from('members')
      .update({ name })
      .eq('id', session.user.id);
    if (error) throw error;
  }

  // =====================
  // CUSTOMERS
  // =====================

  async function getCustomers() {
    const { data, error } = await supabase.from('customers').select('*').order('name');
    if (error) throw error;
    return data.map(r => ({ id: r.id, name: r.name }));
  }

  async function addCustomer(name) {
    const { data, error } = await supabase.from('customers').insert({ name }).select();
    if (error) throw error;
    return { id: data[0].id, name: data[0].name };
  }

  async function removeCustomer(id) {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
  }

  // =====================
  // PROJECTS
  // =====================

  async function getProjects() {
    const { data, error } = await supabase.from('projects').select('*').order('name');
    if (error) throw error;
    return data.map(r => ({ id: r.id, customerId: r.customer_id, name: r.name }));
  }

  async function getProjectsByCustomer(customerId) {
    const { data, error } = await supabase.from('projects')
      .select('*').eq('customer_id', customerId).order('name');
    if (error) throw error;
    return data.map(r => ({ id: r.id, customerId: r.customer_id, name: r.name }));
  }

  async function addProject(customerId, name) {
    const { data, error } = await supabase.from('projects')
      .insert({ customer_id: customerId, name }).select();
    if (error) throw error;
    return { id: data[0].id, customerId: data[0].customer_id, name: data[0].name };
  }

  async function removeProject(id) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  }

  // =====================
  // PHASES
  // =====================

  async function getPhases() {
    const { data, error } = await supabase.from('phases').select('name').order('name');
    if (error) throw error;
    return data.map(r => r.name);
  }

  async function addPhase(name) {
    const { error } = await supabase.from('phases').insert({ name });
    if (error) throw error;
  }

  async function removePhase(name) {
    const { error } = await supabase.from('phases').delete().eq('name', name);
    if (error) throw error;
  }

  // =====================
  // ENTRIES
  // =====================

  async function getEntries(filters = {}) {
    let q = supabase.from('entries').select('*');

    if (filters.memberId) q = q.eq('member_id', filters.memberId);
    if (filters.customerId) q = q.eq('customer_id', filters.customerId);
    if (filters.projectId) q = q.eq('project_id', filters.projectId);
    if (filters.phase) q = q.eq('phase', filters.phase);
    if (filters.dateFrom) q = q.gte('date', filters.dateFrom);
    if (filters.dateTo) q = q.lte('date', filters.dateTo);

    q = q.order('date', { ascending: false }).order('created_at', { ascending: false });

    const { data, error } = await q;
    if (error) throw error;

    return data.map(r => ({
      id: r.id,
      memberId: r.member_id,
      customerId: r.customer_id,
      projectId: r.project_id,
      phase: r.phase,
      date: r.date,
      minutes: r.minutes,
      note: r.note || '',
      createdAt: r.created_at
    }));
  }

  async function addEntry({ memberId, customerId, projectId, phase, date, minutes, note }) {
    const { data, error } = await supabase.from('entries').insert({
      member_id: memberId,
      customer_id: customerId,
      project_id: projectId,
      phase: phase || '',
      date, minutes,
      note: note || ''
    }).select();
    if (error) throw error;
    const r = data[0];
    return {
      id: r.id, memberId: r.member_id, customerId: r.customer_id,
      projectId: r.project_id, phase: r.phase, date: r.date,
      minutes: r.minutes, note: r.note, createdAt: r.created_at
    };
  }

  async function updateEntry(id, updates) {
    const dbUpdates = {};
    if (updates.minutes !== undefined) dbUpdates.minutes = updates.minutes;
    if (updates.note !== undefined) dbUpdates.note = updates.note;
    if (updates.phase !== undefined) dbUpdates.phase = updates.phase;

    const { data, error } = await supabase.from('entries')
      .update(dbUpdates).eq('id', id).select();
    if (error) throw error;
    const r = data[0];
    return {
      id: r.id, memberId: r.member_id, customerId: r.customer_id,
      projectId: r.project_id, phase: r.phase, date: r.date,
      minutes: r.minutes, note: r.note, createdAt: r.created_at
    };
  }

  async function removeEntry(id) {
    const { error } = await supabase.from('entries').delete().eq('id', id);
    if (error) throw error;
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
  // LOCAL PREFERENCES (always localStorage)
  // =====================

  function getRecentProject() {
    try {
      return JSON.parse(localStorage.getItem('jatl_recent_project')) || null;
    } catch { return null; }
  }

  function setRecentProject({ customerId, projectId, phase }) {
    localStorage.setItem('jatl_recent_project', JSON.stringify({ customerId, projectId, phase }));
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
    signIn, signOut, getSession, onAuthStateChange,
    getMembers, updateMemberName,
    getCustomers, addCustomer, removeCustomer,
    getProjects, getProjectsByCustomer, addProject, removeProject,
    getPhases, addPhase, removePhase,
    getEntries, addEntry, updateEntry, removeEntry,
    getReport,
    getRecentProject, setRecentProject,
    exportCSV
  };
})();
