'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CLAUSES, CATEGORIES, SECTIONS, CLAUSE_ORDER, BUILT_IN_PRESETS, type Clause } from '@/lib/clauses';
import { saveSession, loadSession, clearSession, loadTemplates, saveTemplate, deleteTemplate, type Template } from '@/lib/storage';
import { findConflicts } from '@/lib/conflicts';

type FieldValues = Record<number, string>;
type SelectedClause = { clause: Clause; fieldValues: FieldValues };
// Key: `${clauseId}::${blankIndex}` — marks fields that have been manually overridden
type Overrides = Set<string>;

const CAT_ACCENT: Record<string, string> = {
  'SUBJECTS/CONDITIONS':           '#111111',
  'TERMS':                         '#c8d400',
  'STRATA TERMS':                  '#4a90d9',
  'NEW CONSTRUCTION TERMS':        '#e8643c',
  'RURAL TERMS':                   '#4caf7a',
  'MANUFACTURED HOME PARK TERMS':  '#c47c3a',
  'INCLUSIONS':                    '#3aaf7c',
  'EXCLUSIONS':                    '#e84c4c',
  'DEPOSIT':                       '#8b5cf6',
};

const VARIANT_COLOR: Record<string, string> = {
  subject: '#1e3a5f', waiver: '#92400e', acknowledgment: '#5b21b6',
  term: '#065f46', inclusion: '#065f46', exclusion: '#7f1d1d', note: '#6b6b6b',
};

function formatDate(raw: string) {
  if (!raw) return '';
  return new Date(raw + 'T12:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatAmt(raw: string) {
  if (!raw) return '';
  const n = parseFloat(raw);
  return isNaN(n) ? raw : n.toLocaleString('en-CA');
}
function fillText(clause: Clause, fv: FieldValues, globalDate: string, dateOverrides: Overrides, globalAmount: string, amountOverrides: Overrides, agentName: string, brokerageName: string) {
  let i = 0;
  let result = clause.text.replace(/_{3,}/g, () => {
    const f = clause.fields[i];
    const key = `${clause.id}::${i}`;
    let v = fv[i] || '';
    i++;
    if (f?.type === 'date') {
      const effective = (dateOverrides.has(key) ? v : null) ?? (v || globalDate);
      return effective ? formatDate(effective) : '___________';
    }
    if (f?.type === 'amount') {
      const effective = (amountOverrides.has(key) ? v : null) ?? (v || globalAmount);
      return effective ? formatAmt(effective) : '___________';
    }
    if (f?.type === 'agent_name') {
      return v || agentName || '___________';
    }
    if (f?.type === 'brokerage') {
      return v || brokerageName || '___________';
    }
    return v || '___________';
  });
  return result;
}

function hour() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/* ── tiny inline SVG icons ─────────────────────────────────── */
const Icon = {
  home:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  file:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  list:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  copy:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  check:   <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  checkGr: <svg width="11" height="9" viewBox="0 0 12 10" fill="none"><path d="M1 5l4 4 6-8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  logout:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

/* ── Sidebar nav item ──────────────────────────────────────── */
function NavItem({ icon, label, active, onClick, count }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      width: '100%', padding: '8px 11px', borderRadius: '8px',
      background: active ? '#f0f0ee' : 'transparent',
      border: 'none', cursor: 'pointer',
      color: active ? '#111' : '#6b6b6b',
      fontSize: '13.5px', fontWeight: active ? 600 : 400,
      fontFamily: 'Outfit, sans-serif',
      textAlign: 'left',
      transition: 'all 0.15s',
    }}
    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = '#f8f8f6'; (e.currentTarget as HTMLElement).style.color = '#111'; } }}
    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b6b6b'; } }}
    >
      <span style={{ color: active ? '#3d3d3d' : '#a0a0a0', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: '11px', color: '#c8c8c8', fontWeight: 400 }}>{count}</span>}
    </button>
  );
}

export default function DashboardClient({ username }: { username: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Map<string, SelectedClause>>(new Map());
  const [activeSection, setActiveSection] = useState('ALL');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [copyOk, setCopyOk] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [globalDate, setGlobalDate] = useState('');
  const [dateOverrides, setDateOverrides] = useState<Overrides>(new Set());
  const [globalAmount, setGlobalAmount] = useState('');
  const [amountOverrides, setAmountOverrides] = useState<Overrides>(new Set());
  const [globalAgentName, setGlobalAgentName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('agentName') || '';
    return '';
  });
  const [globalBrokerage, setGlobalBrokerage] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('brokerageName') || '';
    return '';
  });
  const [confirmRemove, setConfirmRemove] = useState<Clause | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [userTemplates, setUserTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [confirmLoadPreset, setConfirmLoadPreset] = useState<{ name: string; clauseIds: string[] } | null>(null);
  const [conflictPrompt, setConflictPrompt] = useState<{ incoming: Clause; existingId: string } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clauseMap = useMemo(() => Object.fromEntries(CLAUSES.map(c => [c.id, c])), []);
  const titleMap = useMemo(() => Object.fromEntries(CLAUSES.map(c => [c.id, c.title])), []);

  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

  // ── Hydrate from localStorage on mount ──
  useEffect(() => {
    const session = loadSession();
    if (session) {
      const map = new Map<string, SelectedClause>();
      for (const [id, data] of Object.entries(session.selected)) {
        const clause = clauseMap[data.clauseId];
        if (clause) map.set(id, { clause, fieldValues: data.fieldValues });
      }
      setSelected(map);
      if (session.globalDate) setGlobalDate(session.globalDate);
      if (session.globalAmount) setGlobalAmount(session.globalAmount);
      setDateOverrides(new Set(session.dateOverrides));
      setAmountOverrides(new Set(session.amountOverrides));
    }
    setUserTemplates(loadTemplates());
    setHydrated(true);
  }, [clauseMap]);

  // ── Debounced save to localStorage ──
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const serialized: Record<string, { clauseId: string; fieldValues: Record<number, string> }> = {};
      for (const [id, entry] of selected.entries()) {
        serialized[id] = { clauseId: entry.clause.id, fieldValues: entry.fieldValues };
      }
      saveSession({
        selected: serialized,
        globalDate,
        globalAmount,
        dateOverrides: Array.from(dateOverrides),
        amountOverrides: Array.from(amountOverrides),
      });
    }, 300);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [selected, globalDate, globalAmount, dateOverrides, amountOverrides, hydrated]);

  const filtered = useMemo(() => {
    let list = CLAUSES;
    if (activeSection !== 'ALL') list = list.filter(c => c.section === activeSection);
    if (activeCategory !== 'ALL') list = list.filter(c => c.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(q) || c.text.toLowerCase().includes(q));
    }
    return list;
  }, [activeSection, activeCategory, search]);

  const grouped = useMemo(() => {
    const g: Record<string, Clause[]> = {};
    for (const c of filtered) { if (!g[c.category]) g[c.category] = []; g[c.category].push(c); }
    return g;
  }, [filtered]);

  const cnt = selected.size;
  const subjectCnt = Array.from(selected.values()).filter(e => e.clause.variant === 'subject' || e.clause.category === 'SUBJECTS/CONDITIONS').length;
  const termCnt = cnt - subjectCnt;
  // "To Fill" = clauses that have unfilled non-date fields OR date fields with no global date and no override
  const toFillCnt = Array.from(selected.values()).filter(e =>
    e.clause.fields.some(f => {
      const key = `${e.clause.id}::${f.blankIndex}`;
      if (f.type === 'date') return !(globalDate || (dateOverrides.has(key) && e.fieldValues[f.blankIndex]));
      if (f.type === 'amount') return !(globalAmount || (amountOverrides.has(key) && e.fieldValues[f.blankIndex]));
      if (f.type === 'agent_name') return !(globalAgentName || e.fieldValues[f.blankIndex]);
      if (f.type === 'brokerage') return !(globalBrokerage || e.fieldValues[f.blankIndex]);
      return !e.fieldValues[f.blankIndex];
    })
  ).length;

  // ── Conflict detection ──
  const conflicts = useMemo(() => {
    const ids = Array.from(selected.keys());
    return findConflicts(ids, titleMap);
  }, [selected, titleMap]);

  const toggle = useCallback((c: Clause) => {
    if (selected.has(c.id)) {
      setConfirmRemove(c);
    } else {
      // Check for subject/waiver conflict before adding
      const conflictId = c.id.endsWith('W') ? c.id.slice(0, -1) : c.id + 'W';
      if (selected.has(conflictId)) {
        setConflictPrompt({ incoming: c, existingId: conflictId });
      } else {
        setSelected(prev => { const n = new Map(prev); n.set(c.id, { clause: c, fieldValues: {} }); return n; });
      }
    }
  }, [selected]);

  const doRemove = useCallback(() => {
    if (!confirmRemove) return;
    setSelected(prev => { const n = new Map(prev); n.delete(confirmRemove.id); return n; });
    setConfirmRemove(null);
  }, [confirmRemove]);

  const doClearAll = useCallback(() => {
    setSelected(new Map());
    setConfirmClearAll(false);
    clearSession();
  }, []);

  const loadPreset = useCallback((clauseIds: string[]) => {
    const map = new Map<string, SelectedClause>();
    for (const id of clauseIds) {
      const clause = clauseMap[id];
      if (clause) map.set(id, { clause, fieldValues: {} });
    }
    setSelected(map);
    setConfirmLoadPreset(null);
  }, [clauseMap]);

  const handleLoadPreset = useCallback((name: string, clauseIds: string[]) => {
    if (selected.size > 0) {
      setConfirmLoadPreset({ name, clauseIds });
    } else {
      loadPreset(clauseIds);
    }
  }, [selected.size, loadPreset]);

  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim() || selected.size === 0) return;
    const t: Template = {
      id: Date.now().toString(),
      name: templateName.trim(),
      clauseIds: Array.from(selected.keys()),
    };
    saveTemplate(t);
    setUserTemplates(loadTemplates());
    setTemplateName('');
    setShowSaveTemplate(false);
  }, [templateName, selected]);

  const handleDeleteTemplate = useCallback((id: string) => {
    deleteTemplate(id);
    setUserTemplates(loadTemplates());
  }, []);

  const setField = useCallback((id: string, idx: number, val: string) => {
    setSelected(prev => {
      const n = new Map(prev); const e = n.get(id);
      if (e) n.set(id, { ...e, fieldValues: { ...e.fieldValues, [idx]: val } });
      return n;
    });
  }, []);

  const preview = useMemo(() => {
    if (!cnt) return '';
    const lines = ['THE FOLLOWING CONDITIONS ARE FOR THE SOLE BENEFIT OF THE BUYER:', ''];
    const subj: SelectedClause[] = [], terms: SelectedClause[] = [];
    for (const e of selected.values()) {
      (e.clause.variant === 'subject' || e.clause.category === 'SUBJECTS/CONDITIONS' ? subj : terms).push(e);
    }
    // Sort both arrays by canonical document order
    const byOrder = (a: SelectedClause, b: SelectedClause) => (CLAUSE_ORDER[a.clause.id] ?? 999) - (CLAUSE_ORDER[b.clause.id] ?? 999);
    subj.sort(byOrder);
    terms.sort(byOrder);
    subj.forEach((e, i) => {
      lines.push(`${i+1}. ${e.clause.title.replace(/\s*\(.*?\)\s*/g,'').trim()}: ${fillText(e.clause, e.fieldValues, globalDate, dateOverrides, globalAmount, amountOverrides, globalAgentName, globalBrokerage)}`);
      lines.push('');
    });
    if (terms.length) {
      lines.push('TERMS AND CONDITIONS:', '');
      terms.forEach((e, i) => { lines.push(`${i+1}. ${e.clause.title.replace(/\s*\(.*?\)\s*/g,'').trim()}: ${fillText(e.clause, e.fieldValues, globalDate, dateOverrides, globalAmount, amountOverrides, globalAgentName, globalBrokerage)}`); lines.push(''); });
    }
    return lines.join('\n').trim();
  }, [selected, cnt, globalDate, dateOverrides, globalAmount, amountOverrides, globalAgentName, globalBrokerage]);

  const setOverride = useCallback((clauseId: string, blankIndex: number, enable: boolean) => {
    setDateOverrides(prev => {
      const next = new Set(prev);
      const key = `${clauseId}::${blankIndex}`;
      enable ? next.add(key) : next.delete(key);
      return next;
    });
    if (!enable) {
      setSelected(prev => {
        const next = new Map(prev); const e = next.get(clauseId);
        if (e) { const fv = { ...e.fieldValues }; delete fv[blankIndex]; next.set(clauseId, { ...e, fieldValues: fv }); }
        return next;
      });
    }
  }, []);

  const setAmountOverride = useCallback((clauseId: string, blankIndex: number, enable: boolean) => {
    setAmountOverrides(prev => {
      const next = new Set(prev);
      const key = `${clauseId}::${blankIndex}`;
      enable ? next.add(key) : next.delete(key);
      return next;
    });
    if (!enable) {
      setSelected(prev => {
        const next = new Map(prev); const e = next.get(clauseId);
        if (e) { const fv = { ...e.fieldValues }; delete fv[blankIndex]; next.set(clauseId, { ...e, fieldValues: fv }); }
        return next;
      });
    }
  }, []);

  // Compute every unfilled field across all selected clauses
  const missingFields = useMemo(() => {
    const missing: { clauseTitle: string; fieldLabel: string; fieldType: string }[] = [];
    for (const entry of selected.values()) {
      for (const f of entry.clause.fields) {
        const key = `${entry.clause.id}::${f.blankIndex}`;
        const val = entry.fieldValues[f.blankIndex] || '';
        const title = entry.clause.title.replace(/\s*\(.*?\)\s*/g, '').trim();
        if (f.type === 'date') {
          const effective = dateOverrides.has(key) ? val : (val || globalDate);
          if (!effective) missing.push({ clauseTitle: title, fieldLabel: f.label, fieldType: 'date' });
        } else if (f.type === 'amount') {
          const effective = amountOverrides.has(key) ? val : (val || globalAmount);
          if (!effective) missing.push({ clauseTitle: title, fieldLabel: f.label, fieldType: 'amount' });
        } else if (f.type === 'agent_name') {
          if (!val && !globalAgentName) missing.push({ clauseTitle: title, fieldLabel: f.label, fieldType: 'agent_name' });
        } else if (f.type === 'brokerage') {
          if (!val && !globalBrokerage) missing.push({ clauseTitle: title, fieldLabel: f.label, fieldType: 'brokerage' });
        } else {
          if (!val) missing.push({ clauseTitle: title, fieldLabel: f.label, fieldType: f.type });
        }
      }
    }
    return missing;
  }, [selected, globalDate, dateOverrides, globalAmount, amountOverrides, globalAgentName, globalBrokerage]);

  async function copy() {
    // Clipboard write with reliable fallback
    const text = preview;
    let ok = false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); ok = true; } catch { /* fall through */ }
    }
    if (!ok) {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(el);
      el.focus();
      el.select();
      try { ok = document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(el);
    }
    if (ok) { setCopyOk(true); setTimeout(() => setCopyOk(false), 2500); }
  }

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); router.refresh(); }

  const sectionShort = (s: string) => s.replace('SINGLE FAMILY ', '').replace(/ 202\d$/, '');
  const catShort = (c: string) => c.replace(' TERMS', '').replace('SUBJECTS/CONDITIONS', 'Subjects').replace('MANUFACTURED HOME PARK', 'MHP').replace('NEW CONSTRUCTION', 'New Const.').replace('INCLUSIONS','Inclusions').replace('EXCLUSIONS','Exclusions').replace('DEPOSIT','Deposit');

  return (
    <div className="dash-layout">

      {/* Mobile overlay */}
      <div className={`mobile-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside className={`dash-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #e8e8e6', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', background: '#111', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span style={{ fontSize: '13.5px', fontWeight: 700, letterSpacing: '0.1em', color: '#111', textTransform: 'uppercase' }}>CPS Clauses</span>
          {/* Mobile close button */}
          <button onClick={() => setSidebarOpen(false)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#a0a0a0', display: 'none', padding: '4px' }}
            className="mobile-sidebar-close">
            {Icon.x}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ padding: '10px 10px', flex: 1 }}>
          <NavItem icon={Icon.home} label="All Clauses" active={activeSection === 'ALL' && activeCategory === 'ALL'}
            onClick={() => { setActiveSection('ALL'); setActiveCategory('ALL'); setSidebarOpen(false); }} />

          {/* Templates */}
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a0a0a0', padding: '18px 10px 6px', display: 'block' }}>Templates</p>
          {SECTIONS.map(s => (
            <NavItem key={s} icon={Icon.file} label={sectionShort(s)}
              active={activeSection === s && activeCategory === 'ALL'}
              onClick={() => { setActiveSection(s); setActiveCategory('ALL'); setSidebarOpen(false); }}
              count={CLAUSES.filter(c => c.section === s).length}
            />
          ))}

          {/* Categories */}
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a0a0a0', padding: '18px 10px 6px', display: 'block' }}>Categories</p>
          {CATEGORIES.map(cat => (
            <NavItem key={cat} icon={<span style={{ width: '8px', height: '8px', borderRadius: '3px', background: CAT_ACCENT[cat] || '#888', display: 'inline-block', flexShrink: 0 }} />}
              label={catShort(cat)}
              active={activeCategory === cat}
              onClick={() => { setActiveCategory(cat); setActiveSection('ALL'); setSidebarOpen(false); }}
              count={CLAUSES.filter(c => c.category === cat).length}
            />
          ))}

          {/* My Presets */}
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a0a0a0', padding: '18px 10px 6px', display: 'block' }}>Presets</p>
          {BUILT_IN_PRESETS.map(p => (
            <button key={p.id} onClick={() => handleLoadPreset(p.name, [...p.clauseIds])}
              style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                width: '100%', padding: '7px 10px', borderRadius: '7px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#6b6b6b', fontSize: '13.5px', fontWeight: 400,
                fontFamily: 'Outfit, sans-serif', textAlign: 'left',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8f8f6'; (e.currentTarget as HTMLElement).style.color = '#111'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b6b6b'; }}>
              <span style={{ color: '#a0a0a0', display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
              </span>
              <span style={{ flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: '11px', color: '#a0a0a0' }}>{p.clauseIds.length}</span>
            </button>
          ))}
          {userTemplates.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0', width: '100%' }}>
              <button onClick={() => handleLoadPreset(t.name, t.clauseIds)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '9px',
                  flex: 1, padding: '7px 4px 7px 10px', borderRadius: '7px 0 0 7px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#6b6b6b', fontSize: '13.5px', fontWeight: 400,
                  fontFamily: 'Outfit, sans-serif', textAlign: 'left',
                  transition: 'background 0.1s, color 0.1s', minWidth: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8f8f6'; (e.currentTarget as HTMLElement).style.color = '#111'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b6b6b'; }}>
                <span style={{ color: '#a0a0a0', display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                <span style={{ fontSize: '11px', color: '#a0a0a0', flexShrink: 0 }}>{t.clauseIds.length}</span>
              </button>
              <button onClick={() => handleDeleteTemplate(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d4d4d2', display: 'flex', padding: '4px 8px 4px 4px', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#d4d4d2'}
                title="Delete preset">
                {Icon.x}
              </button>
            </div>
          ))}
          {selected.size > 0 && (
            showSaveTemplate ? (
              <div style={{ padding: '6px 10px', display: 'flex', gap: '6px' }}>
                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                  placeholder="Preset name…" className="finput"
                  style={{ flex: 1, fontSize: '12px', padding: '5px 8px' }}
                  autoFocus />
                <button onClick={handleSaveTemplate} className="btn-dark"
                  style={{ padding: '5px 10px', fontSize: '11px' }}
                  disabled={!templateName.trim()}>
                  Save
                </button>
                <button onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0a0a0', display: 'flex', padding: '2px' }}>
                  {Icon.x}
                </button>
              </div>
            ) : (
              <button onClick={() => setShowSaveTemplate(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  width: '100%', padding: '7px 10px', borderRadius: '7px',
                  background: 'transparent', border: '1px dashed #d4d4d2', cursor: 'pointer',
                  color: '#a0a0a0', fontSize: '12px', fontWeight: 500,
                  fontFamily: 'Outfit, sans-serif', textAlign: 'left',
                  transition: 'border-color 0.1s, color 0.1s', marginTop: '4px',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#111'; (e.currentTarget as HTMLElement).style.color = '#111'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d4d4d2'; (e.currentTarget as HTMLElement).style.color = '#a0a0a0'; }}>
                + Save current as preset
              </button>
            )
          )}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 12px', borderTop: '1px solid #e8e8e6', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #111 0%, #333 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>{username[0]}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#111', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
            <p style={{ fontSize: '11px', color: '#a0a0a0' }}>{globalBrokerage || 'Set brokerage'}</p>
          </div>
          <button onClick={logout} title="Sign out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8c8c8', display: 'flex', padding: '4px', borderRadius: '6px', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#dc2626'; (e.currentTarget as HTMLElement).style.background = '#fef2f2'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#c8c8c8'; (e.currentTarget as HTMLElement).style.background = 'none'; }}>
            {Icon.logout}
          </button>
        </div>
      </aside>

      {/* ══════════════════ CENTRE ══════════════════ */}
      <div className="dash-centre">

        {/* Mobile top bar */}
        <div className="mobile-topbar">
          <button onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111', display: 'flex', padding: '4px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '22px', height: '22px', background: '#111', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: '#111', textTransform: 'uppercase' }}>CPS</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {cnt > 0 && (
              <button onClick={() => setPanelOpen(true)} className="mobile-panel-toggle"
                style={{ background: '#111', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, fontFamily: 'Outfit,sans-serif', alignItems: 'center', gap: '4px' }}>
                {Icon.copy} {cnt}
              </button>
            )}
            <button onClick={copy} disabled={cnt === 0} className={`btn-dark ${copyOk ? 'copied' : ''}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}>
              {copyOk ? <>{Icon.checkGr} Copied!</> : <>{Icon.copy} Copy</>}
            </button>
          </div>
        </div>

        {/* Desktop Top bar */}
        <div style={{ height: '50px', background: '#fff', borderBottom: '1px solid #e8e8e6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}
          className="desktop-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#a0a0a0' }}>
            <span>Home</span>
            {(activeSection !== 'ALL' || activeCategory !== 'ALL') && (
              <><span style={{ color: '#d4d4d2' }}>/</span><span style={{ color: '#3d3d3d', fontWeight: 500 }}>{activeCategory !== 'ALL' ? catShort(activeCategory) : sectionShort(activeSection)}</span></>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {cnt > 0 && missingFields.length > 0 && (
              <span style={{ fontSize: '12px', color: '#d97706', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                {missingFields.length} empty
              </span>
            )}
            <button onClick={() => setPanelOpen(p => !p)} className="mobile-panel-toggle"
              style={{ background: 'none', border: '1px solid #e8e8e6', cursor: 'pointer', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 500, fontFamily: 'Outfit,sans-serif', color: '#6b6b6b', alignItems: 'center', gap: '5px', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#111'; (e.currentTarget as HTMLElement).style.color = '#111'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e8e8e6'; (e.currentTarget as HTMLElement).style.color = '#6b6b6b'; }}>
              {Icon.list} Selected {cnt > 0 && `(${cnt})`}
            </button>
            <button onClick={copy} disabled={cnt === 0} className={`btn-dark ${copyOk ? 'copied' : ''}`}>
              {copyOk ? <>{Icon.checkGr} Copied!</> : <>{Icon.copy} {cnt > 0 ? `Copy (${cnt})` : 'Copy'}</>}
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 48px' }}>

          {/* Greeting */}
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#111', marginBottom: '24px', lineHeight: 1.25 }}>
            {hour()},{' '}
            <span className="serif-italic" style={{ fontSize: '30px', fontWeight: 400 }}>{displayName}</span>
          </h1>

          {/* Stat cards */}
          <div className="stat-grid">
            {[
              { label: 'Selected',  value: cnt,        accent: '#111111' },
              { label: 'Subjects',  value: subjectCnt, accent: '#c8d400' },
              { label: 'Terms',     value: termCnt,    accent: '#4a90d9' },
              { label: 'To Fill',   value: toFillCnt,  accent: '#e8643c' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="stat-card">
                <p style={{ fontSize: '11.5px', color: '#a0a0a0', fontWeight: 500, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                <p style={{ fontSize: '36px', fontWeight: 600, color: '#111', lineHeight: 1, marginBottom: '18px' }}>{value}</p>
                <div style={{ height: '4px', background: accent, margin: '0 -20px', borderRadius: '2px 2px 0 0' }} />
              </div>
            ))}
          </div>

          {/* ── Global banners row ── */}
          <div className="globals-row">

            {/* Global Subject Date */}
            <div className="global-field" style={{
              background: globalDate ? '#fff' : '#fffbeb',
              border: `1px solid ${globalDate ? '#e8e8e6' : '#fde68a'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '17px', lineHeight: 1 }}>📅</span>
                <div>
                  <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#111', lineHeight: 1.2 }}>Subject Removal Date</p>
                  <p style={{ fontSize: '11px', color: '#a0a0a0', lineHeight: 1.3 }}>Default for all date fields</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 180px', minWidth: '160px' }}>
                <input type="date" value={globalDate} onChange={e => setGlobalDate(e.target.value)}
                  className="finput"
                  style={{ flex: 1, fontWeight: globalDate ? 600 : 400, borderColor: globalDate ? '#111' : '#fcd34d', fontSize: '13.5px', background: globalDate ? '#fff' : '#fffbeb' }}
                />
                {globalDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    <span style={{ fontSize: '12.5px', color: '#16a34a', fontWeight: 500 }}>✓ {formatDate(globalDate)}</span>
                    <button onClick={() => { setGlobalDate(''); setDateOverrides(new Set()); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0a0a0', display: 'flex', padding: '2px', fontSize: '11px', fontFamily: 'Outfit,sans-serif' }}
                      title="Clear global date"
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#a0a0a0'}>✕ clear</button>
                  </div>
                )}
                {!globalDate && <span style={{ fontSize: '11.5px', color: '#d97706', fontWeight: 500, flexShrink: 0 }}>Set this first!</span>}
              </div>
            </div>

            {/* Global Default Amount */}
            <div className="global-field" style={{
              background: globalAmount ? '#fff' : '#f0fdf4',
              border: `1px solid ${globalAmount ? '#e8e8e6' : '#bbf7d0'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '17px', lineHeight: 1 }}>💰</span>
                <div>
                  <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#111', lineHeight: 1.2 }}>Default Amount</p>
                  <p style={{ fontSize: '11px', color: '#a0a0a0', lineHeight: 1.3 }}>Default for all $ fields</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 160px', minWidth: '140px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: globalAmount ? '#111' : '#a0a0a0', pointerEvents: 'none', fontSize: '14px' }}>$</span>
                  <input type="number" min="0" step="1000" value={globalAmount}
                    onChange={e => setGlobalAmount(e.target.value)}
                    onWheel={e => (e.target as HTMLElement).blur()}
                    placeholder="0" className="finput"
                    style={{ paddingLeft: '22px', fontWeight: globalAmount ? 600 : 400, borderColor: globalAmount ? '#111' : '#86efac', fontSize: '13.5px', background: globalAmount ? '#fff' : '#f0fdf4' }}
                  />
                </div>
                {globalAmount && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    <span style={{ fontSize: '12.5px', color: '#16a34a', fontWeight: 500 }}>✓ $ {formatAmt(globalAmount)}</span>
                    <button onClick={() => { setGlobalAmount(''); setAmountOverrides(new Set()); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0a0a0', display: 'flex', padding: '2px', fontSize: '11px', fontFamily: 'Outfit,sans-serif' }}
                      title="Clear global amount"
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#a0a0a0'}>✕ clear</button>
                  </div>
                )}
                {!globalAmount && <span style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 500, flexShrink: 0 }}>Optional default</span>}
              </div>
            </div>

            {/* Global Agent Name */}
            <div className="global-field" style={{
              background: globalAgentName ? '#fff' : '#f5f3ff',
              border: `1px solid ${globalAgentName ? '#e8e8e6' : '#ddd6fe'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '17px', lineHeight: 1 }}>👤</span>
                <div>
                  <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#111', lineHeight: 1.2 }}>Agent Name</p>
                  <p style={{ fontSize: '11px', color: '#a0a0a0', lineHeight: 1.3 }}>Replaces agent name in clauses</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 180px', minWidth: '160px' }}>
                <input type="text" value={globalAgentName}
                  onChange={e => { setGlobalAgentName(e.target.value); localStorage.setItem('agentName', e.target.value); }}
                  placeholder="Enter agent name…" className="finput"
                  style={{ flex: 1, fontWeight: globalAgentName ? 600 : 400, borderColor: globalAgentName ? '#111' : '#c4b5fd', fontSize: '13.5px', background: globalAgentName ? '#fff' : '#f5f3ff' }}
                />
                {!globalAgentName && (
                  <button onClick={() => { setGlobalAgentName(displayName); localStorage.setItem('agentName', displayName); }}
                    style={{ background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'Outfit,sans-serif' }}>
                    Use my name
                  </button>
                )}
                {globalAgentName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    <span style={{ fontSize: '12.5px', color: '#16a34a', fontWeight: 500 }}>✓ {globalAgentName}</span>
                    <button onClick={() => { setGlobalAgentName(''); localStorage.removeItem('agentName'); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0a0a0', display: 'flex', padding: '2px', fontSize: '11px', fontFamily: 'Outfit,sans-serif' }}
                      title="Clear agent name"
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#a0a0a0'}>✕ clear</button>
                  </div>
                )}
              </div>
            </div>

            {/* Global Brokerage Name */}
            <div className="global-field" style={{
              background: globalBrokerage ? '#fff' : '#f0f9ff',
              border: `1px solid ${globalBrokerage ? '#e8e8e6' : '#bae6fd'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontSize: '17px', lineHeight: 1 }}>🏢</span>
                <div>
                  <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#111', lineHeight: 1.2 }}>Brokerage</p>
                  <p style={{ fontSize: '11px', color: '#a0a0a0', lineHeight: 1.3 }}>Replaces brokerage in clauses</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 180px', minWidth: '160px' }}>
                <input type="text" value={globalBrokerage}
                  onChange={e => { setGlobalBrokerage(e.target.value); localStorage.setItem('brokerageName', e.target.value); }}
                  placeholder="Enter brokerage name…" className="finput"
                  style={{ flex: 1, fontWeight: globalBrokerage ? 600 : 400, borderColor: globalBrokerage ? '#111' : '#7dd3fc', fontSize: '13.5px', background: globalBrokerage ? '#fff' : '#f0f9ff' }}
                />
                {globalBrokerage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    <span style={{ fontSize: '12.5px', color: '#16a34a', fontWeight: 500 }}>✓ {globalBrokerage}</span>
                    <button onClick={() => { setGlobalBrokerage(''); localStorage.removeItem('brokerageName'); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0a0a0', display: 'flex', padding: '2px', fontSize: '11px', fontFamily: 'Outfit,sans-serif' }}
                      title="Clear brokerage name"
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#a0a0a0'}>✕ clear</button>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: '520px', marginBottom: '22px' }}>
            <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#a0a0a0', display: 'flex' }}>{Icon.search}</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search clauses…"
              className="finput"
              style={{ paddingLeft: '34px', paddingRight: search ? '34px' : '12px' }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a0a0a0', display: 'flex' }}>
                {Icon.x}
              </button>
            )}
          </div>

          {/* Sub-header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p style={{ fontSize: '13px', color: '#6b6b6b' }}>
              <span style={{ fontWeight: 500, color: '#111' }}>{filtered.length}</span> clauses
              {cnt > 0 && <> · <span style={{ fontWeight: 500, color: '#111' }}>{cnt} selected</span></>}
            </p>
            {cnt > 0 && (
              <button onClick={() => setConfirmClearAll(true)}
                style={{ fontSize: '12.5px', color: '#a0a0a0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#a0a0a0'}>
                Clear all
              </button>
            )}
          </div>

          {/* Clause groups */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
            {Object.entries(grouped).map(([cat, clauses]) => {
              const accent = CAT_ACCENT[cat] || '#888';
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: accent, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#a0a0a0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{cat}</span>
                    <div style={{ flex: 1, height: '1px', background: '#e8e8e6' }} />
                    <span style={{ fontSize: '11px', color: '#c8c8c8' }}>{clauses.length}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {clauses.map(clause => {
                      const isSel = selected.has(clause.id);
                      const entry = selected.get(clause.id);
                      const isExp = expanded === clause.id;
                      const dateFields = clause.fields.filter(f => f.type === 'date');
                      const amtFields  = clause.fields.filter(f => f.type === 'amount');
                      const txtFields  = clause.fields.filter(f => f.type === 'text');

                      return (
                        <div key={clause.id} className={`clause-card ${isSel ? 'is-selected' : ''}`}>
                          {/* Left accent + content */}
                          <div style={{ display: 'flex' }}>
                            <div style={{ width: '3px', background: isSel ? accent : 'transparent', flexShrink: 0, borderRadius: '9px 0 0 9px', transition: 'background 0.12s' }} />
                            <div style={{ flex: 1 }}>
                              {/* Click row */}
                              <div onClick={() => toggle(clause)}
                                style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', padding: '12px 14px 12px 12px' }}>
                                <div className={`cbox ${isSel ? 'on' : ''}`} style={{ marginTop: '2px' }}>
                                  {isSel && Icon.check}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {/* Title + badges */}
                                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px', marginBottom: '5px' }}>
                                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: isSel ? '#111' : '#3d3d3d', lineHeight: 1.25 }}>
                                      {clause.title}
                                    </span>
                                    {clause.variant && VARIANT_COLOR[clause.variant] && (
                                      <span className="tag" style={{
                                        color: VARIANT_COLOR[clause.variant],
                                        borderColor: VARIANT_COLOR[clause.variant] + '40',
                                        background: VARIANT_COLOR[clause.variant] + '12',
                                        fontSize: '12px', fontWeight: 600, padding: '2px 10px',
                                      }}>
                                        <span style={{
                                          width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                                          background: clause.variant === 'subject' ? VARIANT_COLOR[clause.variant] : 'transparent',
                                          border: `2px solid ${VARIANT_COLOR[clause.variant]}`,
                                        }} />
                                        {clause.variant.charAt(0).toUpperCase() + clause.variant.slice(1)}
                                      </span>
                                    )}
                                    {dateFields.length > 0 && <span className="tag">📅 {dateFields.length > 1 ? `${dateFields.length} dates` : 'date'}</span>}
                                    {amtFields.length > 0  && <span className="tag">$ amount</span>}
                                    {txtFields.length > 0  && <span className="tag">✏ fill-in</span>}
                                    {clause.section !== 'SINGLE FAMILY NON-STRATA' && (
                                      <span className="tag" style={{ fontSize: '9.5px' }}>{sectionShort(clause.section)}</span>
                                    )}
                                  </div>
                                  {/* Text */}
                                  <p style={{
                                    fontSize: '13px', color: '#6b6b6b', lineHeight: '1.55',
                                    display: isExp ? 'block' : '-webkit-box',
                                    WebkitLineClamp: isExp ? undefined : 2,
                                    WebkitBoxOrient: 'vertical' as const,
                                    overflow: isExp ? 'visible' : 'hidden',
                                  }}>
                                    {clause.text}
                                  </p>
                                  {clause.text.length > 150 && (
                                    <button onClick={e => { e.stopPropagation(); setExpanded(isExp ? null : clause.id); }}
                                      style={{ fontSize: '12px', color: '#a0a0a0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit,sans-serif', padding: '3px 0 0' }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#111'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#a0a0a0'}>
                                      {isExp ? 'Show less ↑' : 'Read more ↓'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Fill-in fields */}
                              {isSel && clause.fields.length > 0 && (
                                <div onClick={e => e.stopPropagation()}
                                  style={{ borderTop: '1px solid #e8e8e6', background: '#f8f8f6', padding: '11px 14px 13px 12px' }}>
                                  <p style={{ fontSize: '10.5px', fontWeight: 600, color: '#a0a0a0', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '9px' }}>
                                    Fill in placeholders
                                  </p>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {clause.fields.map(field => {
                                      const val = entry?.fieldValues[field.blankIndex] || '';
                                      const isDate = field.type === 'date';
                                      const isAmt  = field.type === 'amount';
                                      const isAgentName = field.type === 'agent_name';
                                      const isBrokerage = field.type === 'brokerage';
                                      const overrideKey = `${clause.id}::${field.blankIndex}`;
                                      const isDateOverridden = dateOverrides.has(overrideKey);
                                      const isAmtOverridden  = amountOverrides.has(overrideKey);
                                      const effectiveDate = isDate ? (isDateOverridden ? val : (val || globalDate)) : '';
                                      const usingGlobalDate = isDate && !isDateOverridden && !val && !!globalDate;
                                      const usingGlobalAmt  = isAmt  && !isAmtOverridden  && !val && !!globalAmount;
                                      const usingGlobalAgent = isAgentName && !val && !!globalAgentName;
                                      const usingGlobalBrokerage = isBrokerage && !val && !!globalBrokerage;

                                      return (
                                        <div key={field.blankIndex}
                                          style={{ flex: isDate ? '1 1 200px' : isAmt ? '1 1 148px' : '1 1 155px', minWidth: isDate ? '190px' : '138px', maxWidth: '300px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: '#6b6b6b', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                                              <span style={{ fontSize: '12px' }}>{isDate ? '📅' : isAmt ? '💲' : isAgentName ? '👤' : isBrokerage ? '🏢' : '✏️'}</span>
                                              {field.label}
                                            </label>
                                            {/* Override toggle for date fields */}
                                            {isDate && globalDate && (
                                              <button
                                                onClick={() => setOverride(clause.id, field.blankIndex, !isDateOverridden)}
                                                style={{ fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit,sans-serif', padding: '0', color: isDateOverridden ? '#dc2626' : '#6b6b6b', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                                                {isDateOverridden ? '↩ use global' : 'override'}
                                              </button>
                                            )}
                                            {/* Override toggle for amount fields */}
                                            {isAmt && globalAmount && (
                                              <button
                                                onClick={() => setAmountOverride(clause.id, field.blankIndex, !isAmtOverridden)}
                                                style={{ fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit,sans-serif', padding: '0', color: isAmtOverridden ? '#dc2626' : '#6b6b6b', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
                                                {isAmtOverridden ? '↩ use global' : 'override'}
                                              </button>
                                            )}
                                          </div>

                                          {isDate ? (
                                            usingGlobalDate ? (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 11px', borderRadius: '7px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                                <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 500, flex: 1 }}>{formatDate(globalDate)}</span>
                                                <span style={{ fontSize: '10px', color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>global</span>
                                              </div>
                                            ) : (
                                              <input type="date"
                                                value={isDateOverridden ? val : effectiveDate}
                                                onChange={e => {
                                                  if (!isDateOverridden) setOverride(clause.id, field.blankIndex, true);
                                                  setField(clause.id, field.blankIndex, e.target.value);
                                                }}
                                                className="finput"
                                                style={{ borderColor: (val || effectiveDate) ? '#111' : '#e8e8e6', background: (val || effectiveDate) ? '#fff' : '#fafafa' }}
                                              />
                                            )
                                          ) : isAmt ? (
                                            usingGlobalAmt ? (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 11px', borderRadius: '7px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                                <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 500, flex: 1 }}>$ {formatAmt(globalAmount)}</span>
                                                <span style={{ fontSize: '10px', color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>global</span>
                                              </div>
                                            ) : (
                                              <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: val ? '#111' : '#c8c8c8', pointerEvents: 'none', fontSize: '14px' }}>$</span>
                                                <input type="number" min="0" step="1000" value={val}
                                                  onChange={e => {
                                                    if (!isAmtOverridden && globalAmount) setAmountOverride(clause.id, field.blankIndex, true);
                                                    setField(clause.id, field.blankIndex, e.target.value);
                                                  }}
                                                  onWheel={e => (e.target as HTMLElement).blur()}
                                                  placeholder="0" className="finput"
                                                  style={{ paddingLeft: '22px', borderColor: val ? '#111' : '#e8e8e6', background: val ? '#fff' : '#fafafa' }}
                                                />
                                              </div>
                                            )
                                          ) : (usingGlobalAgent || usingGlobalBrokerage) ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 11px', borderRadius: '7px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                              <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 500, flex: 1 }}>{isAgentName ? globalAgentName : globalBrokerage}</span>
                                              <span style={{ fontSize: '10px', color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>global</span>
                                            </div>
                                          ) : (
                                            <input type="text" value={val}
                                              onChange={e => setField(clause.id, field.blankIndex, e.target.value)}
                                              placeholder={isAgentName ? 'Agent name…' : isBrokerage ? 'Brokerage name…' : 'Enter value…'} className="finput"
                                              style={{ borderColor: val ? '#111' : '#e8e8e6', background: val ? '#fff' : '#fafafa' }}
                                            />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p style={{ color: '#a0a0a0', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>No clauses match your search.</p>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════ RIGHT PANEL ══════════════════ */}
      {panelOpen && <div className="mobile-overlay show" onClick={() => setPanelOpen(false)} style={{ zIndex: 25 }} />}
      <aside className={`dash-panel ${panelOpen ? 'panel-open' : ''}`}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e8e8e6' }}>
          {/* Mobile close for panel */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#a0a0a0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Selected Clauses</p>
            <button onClick={() => setPanelOpen(false)} className="mobile-panel-toggle"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0a0a0', padding: '2px', alignItems: 'center' }}>
              {Icon.x}
            </button>
          </div>
          {/* To-Do items */}

          {/* Conflict warning */}
          {conflicts.length > 0 && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#9a3412', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Subject/Waiver conflict{conflicts.length > 1 ? 's' : ''}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {conflicts.map((c, i) => (
                  <p key={i} style={{ fontSize: '11.5px', color: '#7c2d12', lineHeight: 1.35 }}>
                    Both <strong>{c.subjectTitle.replace(/\s*\(.*?\)\s*/g, '').trim()}</strong> (Subject) and its Waiver are selected
                  </p>
                ))}
              </div>
              <p style={{ fontSize: '11px', color: '#c2410c', marginTop: '7px', fontStyle: 'italic' }}>
                Having both a subject and its waiver is contradictory. Consider removing one.
              </p>
            </div>
          )}

          {/* Missing fields warning */}
          {cnt > 0 && missingFields.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                {missingFields.length} field{missingFields.length !== 1 ? 's' : ''} still empty
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {missingFields.slice(0, 5).map((m, i) => (
                  <p key={i} style={{ fontSize: '11.5px', color: '#78350f', lineHeight: 1.35 }}>
                    <span style={{ fontSize: '11px' }}>{m.fieldType === 'date' ? '📅' : m.fieldType === 'amount' ? '💲' : m.fieldType === 'agent_name' ? '👤' : m.fieldType === 'brokerage' ? '🏢' : '✏️'}</span>
                    {' '}<strong>{m.clauseTitle}</strong> — {m.fieldLabel}
                  </p>
                ))}
                {missingFields.length > 5 && (
                  <p style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>…and {missingFields.length - 5} more</p>
                )}
              </div>
              <p style={{ fontSize: '11px', color: '#a16207', marginTop: '7px', fontStyle: 'italic' }}>
                Blanks will copy as ___________ if you continue.
              </p>
            </div>
          )}

          {/* All clear */}
          {cnt > 0 && missingFields.length === 0 && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <p style={{ fontSize: '12px', fontWeight: 500, color: '#15803d' }}>All fields filled — ready to copy!</p>
            </div>
          )}

          <button onClick={copy} disabled={cnt === 0} className={`btn-dark ${copyOk ? 'copied' : ''}`}
            style={{ width: '100%', justifyContent: 'center', padding: '9px', fontSize: '13.5px', opacity: cnt === 0 ? 0.35 : 1 }}>
            {copyOk
              ? <>{Icon.checkGr} Copied to clipboard!</>
              : <>{Icon.copy} {cnt === 0 ? 'Select clauses to copy' : `Copy ${cnt} clause${cnt !== 1 ? 's' : ''}`}</>
            }
          </button>
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cnt === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', padding: '20px', textAlign: 'center' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #e8e8e6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                {React.cloneElement(Icon.list, { width: 16, height: 16 } as React.SVGProps<SVGSVGElement>)}
              </div>
              <p style={{ fontSize: '13px', color: '#a0a0a0', lineHeight: 1.5 }}>Select clauses to build your document</p>
            </div>
          ) : (
            <div style={{ padding: '4px 18px 8px' }}>
              {Array.from(selected.values()).sort((a, b) => (CLAUSE_ORDER[a.clause.id] ?? 999) - (CLAUSE_ORDER[b.clause.id] ?? 999)).map(entry => {
                const allFilled = entry.clause.fields.length === 0 || entry.clause.fields.every(f => {
                  if (f.type === 'date') return !!(entry.fieldValues[f.blankIndex] || globalDate);
                  if (f.type === 'amount') return !!(entry.fieldValues[f.blankIndex] || globalAmount);
                  if (f.type === 'agent_name') return !!(entry.fieldValues[f.blankIndex] || globalAgentName);
                  if (f.type === 'brokerage') return !!(entry.fieldValues[f.blankIndex] || globalBrokerage);
                  return !!entry.fieldValues[f.blankIndex];
                });
                const filledDates = entry.clause.fields.filter(f => {
                  const key = `${entry.clause.id}::${f.blankIndex}`;
                  const effective = dateOverrides.has(key) ? entry.fieldValues[f.blankIndex] : (entry.fieldValues[f.blankIndex] || globalDate);
                  return f.type === 'date' && effective;
                });
                const filledAmts = entry.clause.fields.filter(f => {
                  const key = `${entry.clause.id}::${f.blankIndex}`;
                  const effective = amountOverrides.has(key) ? entry.fieldValues[f.blankIndex] : (entry.fieldValues[f.blankIndex] || globalAmount);
                  return f.type === 'amount' && effective;
                });
                return (
                  <div key={entry.clause.id} className="todo-item">
                    {/* Circle check — filled when done */}
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                      background: allFilled ? '#111' : '#fff',
                      border: `1.5px solid ${allFilled ? '#111' : '#d4d4d2'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {allFilled && Icon.check}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '13px', fontWeight: 500, color: allFilled ? '#a0a0a0' : '#111',
                        textDecoration: allFilled ? 'line-through' : 'none',
                        textDecorationColor: '#c8c8c8', lineHeight: 1.3, marginBottom: '2px',
                      }}>
                        {entry.clause.title.replace(/\s*\(.*?\)\s*/g, '')}
                      </p>
                      {filledDates.map(f => {
                        const key = `${entry.clause.id}::${f.blankIndex}`;
                        const effective = dateOverrides.has(key) ? entry.fieldValues[f.blankIndex] : (entry.fieldValues[f.blankIndex] || globalDate);
                        return <p key={f.blankIndex} style={{ fontSize: '11px', color: '#a0a0a0' }}>📅 {formatDate(effective)}{!dateOverrides.has(key) && globalDate && !entry.fieldValues[f.blankIndex] ? ' (global)' : ''}</p>;
                      })}
                      {filledAmts.map(f => {
                        const key = `${entry.clause.id}::${f.blankIndex}`;
                        const effectiveAmt = amountOverrides.has(key) ? entry.fieldValues[f.blankIndex] : (entry.fieldValues[f.blankIndex] || globalAmount);
                        return <p key={f.blankIndex} style={{ fontSize: '11px', color: '#a0a0a0' }}>$ {formatAmt(effectiveAmt)}{!amountOverrides.has(key) && globalAmount && !entry.fieldValues[f.blankIndex] ? ' (global)' : ''}</p>;
                      })}
                    </div>
                    <button onClick={() => toggle(entry.clause)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d4d4d2', display: 'flex', padding: '2px', flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#d4d4d2'}>
                      {Icon.x}
                    </button>
                  </div>
                );
              })}
              <button onClick={() => setConfirmClearAll(true)}
                style={{ fontSize: '12px', color: '#c8c8c8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit,sans-serif', padding: '8px 0', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#dc2626'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#c8c8c8'}>
                Clear all
              </button>
            </div>
          )}

          {/* Full text preview */}
          {cnt > 0 && (
            <div style={{ margin: '4px 18px 20px' }}>
              <div style={{ border: '1px solid #e8e8e6', borderRadius: '9px', overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: '#f8f8f6', borderBottom: '1px solid #e8e8e6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {Icon.file}
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#a0a0a0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Full Text</span>
                </div>
                <div ref={previewRef} style={{ padding: '12px', background: '#fff' }}>
                  <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10.5px', lineHeight: '1.85', color: '#6b6b6b', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {preview}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ══════════════════ REMOVE CONFIRMATION MODAL ══════════════════ */}
      {confirmRemove && (
        <div
          onClick={() => setConfirmRemove(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.12s ease',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '14px', padding: '28px 30px 24px',
              width: '100%', maxWidth: '380px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
              animation: 'modalUp 0.15s ease',
            }}>
            {/* Warning icon */}
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: '#fef2f2', border: '1px solid #fecaca',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111', marginBottom: '6px', lineHeight: 1.3 }}>
              Remove clause?
            </h3>
            <p style={{ fontSize: '13.5px', color: '#6b6b6b', lineHeight: 1.5, marginBottom: '22px' }}>
              <strong style={{ color: '#3d3d3d' }}>{confirmRemove.title.replace(/\s*\(.*?\)\s*/g, '').trim()}</strong> will be removed from your selection. Any filled-in values will be lost.
            </p>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmRemove(null)}
                className="btn-ghost"
                style={{ padding: '8px 18px', fontSize: '13px' }}>
                Cancel
              </button>
              <button
                onClick={doRemove}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', borderRadius: '8px', border: 'none',
                  background: '#dc2626', color: '#fff',
                  fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#b91c1c'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#dc2626'}>
                {Icon.x} Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ CLEAR ALL CONFIRMATION MODAL ══════════════════ */}
      {confirmClearAll && (
        <div
          onClick={() => setConfirmClearAll(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.12s ease',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '14px', padding: '28px 30px 24px',
              width: '100%', maxWidth: '380px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
              animation: 'modalUp 0.15s ease',
            }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: '#fef2f2', border: '1px solid #fecaca',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111', marginBottom: '6px', lineHeight: 1.3 }}>
              Remove all clauses?
            </h3>
            <p style={{ fontSize: '13.5px', color: '#6b6b6b', lineHeight: 1.5, marginBottom: '22px' }}>
              All <strong style={{ color: '#3d3d3d' }}>{cnt} selected clause{cnt !== 1 ? 's' : ''}</strong> and their filled-in values will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmClearAll(false)} className="btn-ghost"
                style={{ padding: '8px 18px', fontSize: '13px' }}>
                Cancel
              </button>
              <button onClick={doClearAll}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 18px', borderRadius: '8px', border: 'none',
                  background: '#dc2626', color: '#fff',
                  fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#b91c1c'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#dc2626'}>
                {Icon.x} Remove All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ LOAD PRESET CONFIRMATION MODAL ══════════════════ */}
      {confirmLoadPreset && (
        <div
          onClick={() => setConfirmLoadPreset(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.12s ease',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '14px', padding: '28px 30px 24px',
              width: '100%', maxWidth: '380px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
              animation: 'modalUp 0.15s ease',
            }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111', marginBottom: '6px', lineHeight: 1.3 }}>
              Load preset?
            </h3>
            <p style={{ fontSize: '13.5px', color: '#6b6b6b', lineHeight: 1.5, marginBottom: '22px' }}>
              Loading <strong style={{ color: '#3d3d3d' }}>{confirmLoadPreset.name}</strong> will replace your current {cnt} selected clause{cnt !== 1 ? 's' : ''}. Any filled-in values will be lost.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmLoadPreset(null)} className="btn-ghost"
                style={{ padding: '8px 18px', fontSize: '13px' }}>
                Cancel
              </button>
              <button onClick={() => loadPreset(confirmLoadPreset.clauseIds)}
                className="btn-dark" style={{ padding: '8px 18px', fontSize: '13px' }}>
                Load Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ CONFLICT PROMPT MODAL ══════════════════ */}
      {conflictPrompt && (
        <div
          onClick={() => setConflictPrompt(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.12s ease',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '14px', padding: '28px 30px 24px',
              width: '100%', maxWidth: '420px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
              animation: 'modalUp 0.15s ease',
            }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: '#fff7ed', border: '1px solid #fed7aa',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111', marginBottom: '6px', lineHeight: 1.3 }}>
              Subject/Waiver conflict
            </h3>
            <p style={{ fontSize: '13.5px', color: '#6b6b6b', lineHeight: 1.5, marginBottom: '22px' }}>
              You already have <strong style={{ color: '#3d3d3d' }}>{titleMap[conflictPrompt.existingId]?.replace(/\s*\(.*?\)\s*/g, '').trim()}</strong> ({clauseMap[conflictPrompt.existingId]?.variant}). Adding <strong style={{ color: '#3d3d3d' }}>{conflictPrompt.incoming.title.replace(/\s*\(.*?\)\s*/g, '').trim()}</strong> ({conflictPrompt.incoming.variant}) creates a legal contradiction.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => setConflictPrompt(null)} className="btn-ghost"
                style={{ padding: '8px 14px', fontSize: '13px' }}>
                Cancel
              </button>
              <button onClick={() => {
                // Keep both
                setSelected(prev => { const n = new Map(prev); n.set(conflictPrompt.incoming.id, { clause: conflictPrompt.incoming, fieldValues: {} }); return n; });
                setConflictPrompt(null);
              }} className="btn-ghost"
                style={{ padding: '8px 14px', fontSize: '13px' }}>
                Keep Both
              </button>
              <button onClick={() => {
                // Swap: remove existing, add incoming
                setSelected(prev => {
                  const n = new Map(prev);
                  n.delete(conflictPrompt.existingId);
                  n.set(conflictPrompt.incoming.id, { clause: conflictPrompt.incoming, fieldValues: {} });
                  return n;
                });
                setConflictPrompt(null);
              }}
                className="btn-dark" style={{ padding: '8px 14px', fontSize: '13px' }}>
                Swap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
