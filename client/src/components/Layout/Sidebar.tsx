import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, TableProperties, TrendingUp, LogOut, Palette, Check, Pencil, X, Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme, APP_THEMES } from '../../contexts/ThemeContext';

const NAV = [
  { section: 'Dashboard', items: [{ id: 'overview', label: 'Overview', icon: LayoutDashboard, to: '/' }] },
  { section: 'Investment', items: [{ id: 'tracker', label: 'My Tracker', icon: TableProperties, to: '/investment/tracker' }] },
  { section: 'Budget', items: [{ id: 'budget', label: 'Budget Planner', icon: Wallet, to: '/budget/planner' }] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { themeId, setThemeId, appTheme } = useAppTheme();
  const [showPicker, setShowPicker] = useState(false);

  const [trackerName, setTrackerName] = useState('My Tracker');
  const [renamingTracker, setRenamingTracker] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('pt_tracker_name');
    if (saved) setTrackerName(saved);
  }, []);

  const handleSaveRename = () => {
    if (renameValue.trim()) {
      setTrackerName(renameValue.trim());
      localStorage.setItem('pt_tracker_name', renameValue.trim());
    }
    setRenamingTracker(false);
  };

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100vh', width: 240,
      display: 'flex', flexDirection: 'column', padding: '24px 16px',
      background: 'var(--pt-sidebar)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(12px)',
      zIndex: 40,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', marginBottom: 32 }}>
        <TrendingUp size={22} color={appTheme.accent} />
        <span style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.3px' }}>Portfolio</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {NAV.map(group => (
          <div key={group.section}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 12px', marginBottom: 6 }}>
              {group.section}
            </p>
            <ul style={{ listStyle: 'none' }}>
              {group.items.map(item => {
                const isTracker = item.id === 'tracker';
                const labelText = isTracker ? trackerName : item.label;

                if (isTracker && renamingTracker) {
                  return (
                    <li key={item.to} style={{ padding: '8px 12px', display:'flex', alignItems:'center', gap:4 }}>
                      <input 
                        autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key==='Enter') handleSaveRename(); if (e.key==='Escape') setRenamingTracker(false); }}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#F1F5F9', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: 110, outline: 'none' }}
                      />
                      <button onClick={handleSaveRename} style={{ padding: 4, background: 'rgba(min(var(--pt-accent-rgb)),0.2)', color: 'var(--pt-accent-light)', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex' }}><Check size={14}/></button>
                      <button onClick={() => setRenamingTracker(false)} style={{ padding: 4, background: 'transparent', color: '#CBD5E1', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex' }}><X size={14}/></button>
                    </li>
                  );
                }

                return (
                  <li key={item.to} style={{ position: 'relative' }} onMouseEnter={(e) => {
                    const btn = e.currentTarget.querySelector('.rename-btn') as HTMLElement;
                    if (btn && isTracker) btn.style.opacity = '1';
                  }} onMouseLeave={(e) => {
                    const btn = e.currentTarget.querySelector('.rename-btn') as HTMLElement;
                    if (btn && isTracker) btn.style.opacity = '0';
                  }}>
                    <NavLink to={item.to} style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 12, fontSize: 14,
                      textDecoration: 'none', transition: 'all 0.15s',
                      color: isActive ? 'var(--pt-accent-light)' : '#E2E8F0',
                      background: isActive ? 'rgba(var(--pt-accent-rgb),0.12)' : 'transparent',
                      fontWeight: isActive ? 600 : 400,
                    })}>
                      <item.icon size={18} />
                      <span style={{ flex: 1 }}>{labelText}</span>
                    </NavLink>
                    {isTracker && (
                      <button 
                        className="rename-btn"
                        onClick={(e) => { e.preventDefault(); setRenameValue(trackerName); setRenamingTracker(true); }}
                        style={{
                          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                          background: 'transparent', border: 'none', color: '#E2E8F0', cursor: 'pointer',
                          opacity: 0, transition: 'opacity 0.2s', padding: 4, borderRadius: 6,
                          display: 'flex', alignItems: 'center'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--pt-accent-light)')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#E2E8F0')}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Theme Picker */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginBottom: 0, position: 'relative' }}>
        <button
          onClick={() => setShowPicker(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '8px 12px', borderRadius: 10,
            fontSize: 13, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)',
            background: showPicker ? 'rgba(255,255,255,0.06)' : 'transparent',
            color: '#E2E8F0', transition: 'all 0.15s', marginBottom: 2,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
            (e.currentTarget as HTMLElement).style.color = '#CBD5E1';
          }}
          onMouseLeave={e => {
            if (!showPicker) {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#E2E8F0';
            }
          }}
        >
          <Palette size={14} />
          <span style={{ flex: 1, textAlign: 'left' }}>Theme</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: appTheme.accent, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#CBD5E1', fontWeight: 600 }}>{appTheme.label}</span>
          </span>
        </button>

        {showPicker && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0,
            background: 'rgba(8,12,24,0.98)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, padding: '6px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 -12px 40px rgba(0,0,0,0.6)',
            marginBottom: 8, zIndex: 999,
          }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px 6px' }}>
              Choose Theme
            </p>
            {Object.values(APP_THEMES).map(t => {
              const isActive = themeId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setThemeId(t.id); setShowPicker(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: 'none', cursor: 'pointer', fontSize: 13,
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: isActive ? '#F1F5F9' : '#E2E8F0',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                    (e.currentTarget as HTMLElement).style.color = '#CBD5E1';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = isActive ? 'rgba(255,255,255,0.08)' : 'transparent';
                    (e.currentTarget as HTMLElement).style.color = isActive ? '#F1F5F9' : '#E2E8F0';
                  }}
                >
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    background: t.accent,
                    boxShadow: isActive ? `0 0 8px ${t.accent}` : 'none',
                  }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{t.label}</span>
                  {isActive && <Check size={12} color={t.accentLight} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* User + logout */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '0 4px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'var(--pt-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'var(--pt-accent-text)', flexShrink: 0,
          }}>
            {(user?.name ?? user?.email ?? 'U')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name ?? 'User'}
            </p>
            <p style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '8px 12px', borderRadius: 10,
            fontSize: 13, color: '#CBD5E1', cursor: 'pointer',
            background: 'transparent', border: 'none', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.08)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CBD5E1'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  );
}

