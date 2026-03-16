'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CLAUSES, CATEGORIES, SECTIONS, type Clause } from '@/lib/clauses';

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
function fillText(clause: Clause, fv: FieldValues, globalDate: string, dateOverrides: Overrides, globalAmount: string, amountOverrides: Overrides) {
  let i = 0;
  return clause.text.replace(/_{3,}/g, () => {
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
    return v || '___________';
  });
}

function hour() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/* ── tiny inline SVG icons ─────────────────────────────────── */
const Icon = {
  home:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  file:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  tag:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  list:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  copy:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  check:   <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  checkGr: <svg width="11" height="9" viewBox="0 0 12 10" fill="none"><path d="M1 5l4 4 6-8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x:       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  search:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  bell:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  help:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  logout:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

/* ── Sidebar nav item ──────────────────────────────────────── */
function NavItem({ icon, label, active, onClick, count }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '9px',
      width: '100%', padding: '7px 10px', borderRadius: '7px',
      background: active ? '#f0f0ee' : 'transparent',
      border: 'none', cursor: 'pointer',
      color: active ? '#111' : '#6b6b6b',
      fontSize: '13.5px', fontWeight: active ? 500 : 400,
      fontFamily: 'Outfit, sans-serif',
      textAlign: 'left',
      transition: 'background 0.1s, color 0.1s',
    }}
    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = '#f8f8f6'; (e.currentTarget as HTMLElement).style.color = '#111'; } }}
    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b6b6b'; } }}
    >
      <span style={{ color: active ? '#3d3d3d' : '#a0a0a0', display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: '11px', color: '#a0a0a0' }}>{count}</span>}
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
  const previewRef = useRef<HTMLDivElement>(null);

  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

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
      return !e.fieldValues[f.blankIndex];
    })
  ).length;

  const toggle = useCallback((c: Clause) => {
    setSelected(prev => { const n = new Map(prev); n.has(c.id) ? n.delete(c.id) : n.set(c.id, { clause: c, fieldValues: {} }); return n; });
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
    subj.forEach((e, i) => {
      lines.push(`${i+1}. ${e.clause.title.replace(/\s*\(.*?\)\s*/g,'').trim()}: ${fillText(e.clause, e.fieldValues, globalDate, dateOverrides, globalAmount, amountOverrides)}`);
      lines.push('');
    });
    if (terms.length) {
      lines.push('TERMS AND CONDITIONS:', '');
      terms.forEach(e => { lines.push(`${e.clause.title.replace(/\s*\(.*?\)\s*/g,'').trim()}: ${fillText(e.clause, e.fieldValues, globalDate, dateOverrides, globalAmount, amountOverrides)}`); lines.push(''); });
    }
    return lines.join('\n').trim();
  }, [selected, cnt, globalDate, dateOverrides, globalAmount, amountOverrides]);

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
        } else {
          if (!val) missing.push({ clauseTitle: title, fieldLabel: f.label, fieldType: f.type });
        }
      }
    }
    return missing;
  }, [selected, globalDate, dateOverrides, globalAmount, amountOverrides]);

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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f0f0ee' }}>

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside style={{
        width: '200px', flexShrink: 0,
        background: '#fff', borderRight: '1px solid #e8e8e6',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #e8e8e6', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '24px', height: '24px', background: '#111', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', color: '#111', textTransform: 'uppercase' }}>CPS Clauses</span>
        </div>

        {/* Nav */}
        <nav style={{ padding: '10px 8px', flex: 1 }}>
          <NavItem icon={Icon.home} label="All Clauses" active={activeSection === 'ALL' && activeCategory === 'ALL'}
            onClick={() => { setActiveSection('ALL'); setActiveCategory('ALL'); }} />

          {/* Templates */}
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a0a0a0', padding: '16px 10px 4px', display: 'block' }}>Templates</p>
          {SECTIONS.map(s => (
            <NavItem key={s} icon={Icon.file} label={sectionShort(s)}
              active={activeSection === s && activeCategory === 'ALL'}
              onClick={() => { setActiveSection(s); setActiveCategory('ALL'); }}
              count={CLAUSES.filter(c => c.section === s).length}
            />
          ))}

          {/* Categories */}
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a0a0a0', padding: '16px 10px 4px', display: 'block' }}>Categories</p>
          {CATEGORIES.map(cat => (
            <NavItem key={cat} icon={<span style={{ width: '8px', height: '8px', borderRadius: '2px', background: CAT_ACCENT[cat] || '#888', display: 'inline-block', flexShrink: 0 }} />}
              label={catShort(cat)}
              active={activeCategory === cat}
              onClick={() => { setActiveCategory(cat); setActiveSection('ALL'); }}
              count={CLAUSES.filter(c => c.category === cat).length}
            />
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '10px 10px', borderTop: '1px solid #e8e8e6', display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>{username[0]}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#111', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
            <p style={{ fontSize: '11px', color: '#a0a0a0' }}>Royal LePage</p>
          </div>
          <button onClick={logout} title="Sign out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8c8c8', display: 'flex', padding: '3px' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#111'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#c8c8c8'}>
            {Icon.logout}
          </button>
        </div>
      </aside>

      {/* ══════════════════ CENTRE ══════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{ height: '48px', background: '#fff', borderBottom: '1px solid #e8e8e6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#a0a0a0' }}>
            <span>Home</span>
            {(activeSection !== 'ALL' || activeCategory !== 'ALL') && (
              <><span>›</span><span style={{ color: '#3d3d3d' }}>{activeCategory !== 'ALL' ? catShort(activeCategory) : sectionShort(activeSection)}</span></>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {[Icon.bell, Icon.help].map((ic, i) => (
              <button key={i} style={{ width: '32px', height: '32px', border: '1px solid #e8e8e6', borderRadius: '7px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0a0a0' }}>
                {ic}
              </button>
            ))}
            {cnt > 0 && missingFields.length > 0 && (
              <span style={{ fontSize: '12px', color: '#d97706', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                {missingFields.length} empty
              </span>
            )}
            <button onClick={copy} disabled={cnt === 0} className={`btn-dark ${copyOk ? 'copied' : ''}`}>
              {copyOk ? <>{Icon.checkGr} Copied!</> : <>{Icon.copy} {cnt > 0 ? `Copy (${cnt})` : 'Copy'}</>}
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '26px 24px 40px' }}>

          {/* Greeting */}
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: '#111', marginBottom: '20px', lineHeight: 1.25 }}>
            {hour()},{' '}
            <span className="serif-italic" style={{ fontSize: '30px', fontWeight: 400 }}>{displayName}</span>
          </h1>

          {/* Stat cards — 4 across, identical to reference */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Selected',  value: cnt,        accent: '#111111' },
              { label: 'Subjects',  value: subjectCnt, accent: '#c8d400' },
              { label: 'Terms',     value: termCnt,    accent: '#4a90d9' },
              { label: 'To Fill',   value: toFillCnt,  accent: '#e8643c' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="stat-card">
                <p style={{ fontSize: '12px', color: '#a0a0a0', fontWeight: 500, marginBottom: '10px' }}>{label}</p>
                <p style={{ fontSize: '34px', fontWeight: 600, color: '#111', lineHeight: 1, marginBottom: '16px' }}>{value}</p>
                <div style={{ height: '3px', background: accent, margin: '0 -18px' }} />
              </div>
            ))}
          </div>

          {/* ── Global banners row ── */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>

            {/* Global Subject Date */}
            <div style={{
              flex: '1 1 280px', minWidth: '260px',
              background: globalDate ? '#fff' : '#fffbeb',
              border: `1px solid ${globalDate ? '#e8e8e6' : '#fde68a'}`,
              borderRadius: '10px', padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
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
            <div style={{
              flex: '1 1 260px', minWidth: '240px',
              background: globalAmount ? '#fff' : '#f0fdf4',
              border: `1px solid ${globalAmount ? '#e8e8e6' : '#bbf7d0'}`,
              borderRadius: '10px', padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
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

          </div>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: '480px', marginBottom: '20px' }}>
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
              <button onClick={() => setSelected(new Map())}
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
                                      <span className="tag" style={{ color: VARIANT_COLOR[clause.variant], borderColor: VARIANT_COLOR[clause.variant] + '30', background: VARIANT_COLOR[clause.variant] + '0e' }}>
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
                                      const overrideKey = `${clause.id}::${field.blankIndex}`;
                                      const isDateOverridden = dateOverrides.has(overrideKey);
                                      const isAmtOverridden  = amountOverrides.has(overrideKey);
                                      const effectiveDate = isDate ? (isDateOverridden ? val : (val || globalDate)) : '';
                                      const usingGlobalDate = isDate && !isDateOverridden && !val && !!globalDate;
                                      const usingGlobalAmt  = isAmt  && !isAmtOverridden  && !val && !!globalAmount;

                                      return (
                                        <div key={field.blankIndex}
                                          style={{ flex: isDate ? '1 1 200px' : isAmt ? '1 1 148px' : '1 1 155px', minWidth: isDate ? '190px' : '138px', maxWidth: '300px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: '#6b6b6b', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                                              <span style={{ fontSize: '12px' }}>{isDate ? '📅' : isAmt ? '💲' : '✏️'}</span>
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
                                                  placeholder="0" className="finput"
                                                  style={{ paddingLeft: '22px', borderColor: val ? '#111' : '#e8e8e6', background: val ? '#fff' : '#fafafa' }}
                                                />
                                              </div>
                                            )
                                          ) : (
                                            <input type="text" value={val}
                                              onChange={e => setField(clause.id, field.blankIndex, e.target.value)}
                                              placeholder="Enter value…" className="finput"
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
      <aside style={{ width: '300px', flexShrink: 0, background: '#fff', borderLeft: '1px solid #e8e8e6', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e8e8e6' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#a0a0a0', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>To-Do</p>

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
                    <span style={{ fontSize: '11px' }}>{m.fieldType === 'date' ? '📅' : m.fieldType === 'amount' ? '💲' : '✏️'}</span>
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
              {Array.from(selected.values()).map(entry => {
                const allFilled = entry.clause.fields.length === 0 || entry.clause.fields.every(f => {
                  const key = `${entry.clause.id}::${f.blankIndex}`;
                  if (f.type === 'date') return !!(entry.fieldValues[f.blankIndex] || globalDate);
                  if (f.type === 'amount') return !!(entry.fieldValues[f.blankIndex] || globalAmount);
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
              <button onClick={() => setSelected(new Map())}
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
    </div>
  );
}
