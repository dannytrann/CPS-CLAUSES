'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) { router.push('/dashboard'); router.refresh(); }
      else setError('Invalid username or password.');
    } catch { setError('Connection error. Please try again.'); }
    finally { setLoading(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1px solid #e8e8e6', background: '#fff', color: '#111',
    fontFamily: 'Outfit, sans-serif', fontSize: '14px', outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f0ee', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="fade-up" style={{ width: '100%', maxWidth: '360px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
          <div style={{ width: '28px', height: '28px', background: '#111', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.1em', color: '#111', textTransform: 'uppercase' }}>
            CPS Clauses
          </span>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', border: '1px solid #e8e8e6', borderRadius: '12px', padding: '28px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111', marginBottom: '4px' }}>Sign in</h2>
          <p style={{ fontSize: '13px', color: '#a0a0a0', marginBottom: '22px' }}>Royal LePage Advance Realty</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#3d3d3d', marginBottom: '5px', letterSpacing: '0.04em' }}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" required placeholder="Enter username"
                className="finput"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#3d3d3d', marginBottom: '5px', letterSpacing: '0.04em' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" required placeholder="Enter password"
                  className="finput" style={{ paddingRight: '38px' }}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a0a0a0', display: 'flex', alignItems: 'center' }}>
                  {showPass
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', color: '#b91c1c' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-dark"
              style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '14px', marginTop: '4px' }}>
              {loading
                ? <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-18 0" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/></svg>Signing in…</>
                : 'Sign In'
              }
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#c8c8c8' }}>
          Judit Hernadi PREC* · 972 Shoppers Row, Campbell River
        </p>
      </div>
    </div>
  );
}
