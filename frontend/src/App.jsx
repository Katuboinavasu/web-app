import React, { useEffect, useState } from 'react';
import { ArrowRight, Cloud, ShieldCheck, Users, LogOut, Pencil, Trash2, X, CheckCircle2, LockKeyhole } from 'lucide-react';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const blank = { name: '', email: '', phone: '', workStatus: 'Student', password: '' };
async function request(path, options = {}, token) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed. Please try again.');
  return data;
}

export default function App() {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState(blank);
  const [token, setToken] = useState(() => sessionStorage.getItem('mc_token') || '');
  const [account, setAccount] = useState(() => JSON.parse(sessionStorage.getItem('mc_user') || 'null'));
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  function setField(key, value) { setForm(old => ({ ...old, [key]: value })); }
  function logout() {
    sessionStorage.removeItem('mc_token'); sessionStorage.removeItem('mc_user');
    setToken(''); setAccount(null); setUsers([]); setEditing(null); setForm(blank); setMode('login');
    setNotice('You have been logged out.'); setError('');
  }
  async function loadUsers(activeToken = token) {
    const data = await request('/api/users', {}, activeToken);
    setUsers(data.users);
  }
  useEffect(() => {
    if (token) loadUsers().catch(e => { setError(e.message); if (e.message.toLowerCase().includes('log in')) logout(); });
  }, [token]);

  async function submitAuth(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'register' ? form : { email: form.email, password: form.password };
      const data = await request(path, { method: 'POST', body: JSON.stringify(payload) });
      sessionStorage.setItem('mc_token', data.token); sessionStorage.setItem('mc_user', JSON.stringify(data.user));
      setToken(data.token); setAccount(data.user); setNotice(mode === 'register' ? 'Registration successful. Welcome!' : 'Login successful. Welcome back!');
      setForm(blank);
    } catch (e) {
      setError(e.message);
      if (e.message.toLowerCase().includes('already exists')) setMode('login');
    } finally { setBusy(false); }
  }
  function startEdit(user) {
    setEditing(user.id);
    setEditForm({ name: user.name, email: user.email, phone: user.phone, workStatus: user.workStatus });
    setError(''); setNotice('');
  }
  async function saveEdit(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await request(`/api/users/${editing}`, { method: 'PUT', body: JSON.stringify(editForm) }, token);
      await loadUsers(); setEditing(null); setNotice('Your profile has been updated.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function deleteAccount(id) {
    if (!window.confirm('Delete your account permanently? This cannot be undone.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/api/users/${id}`, { method: 'DELETE' }, token);
      logout(); setNotice('Your account was deleted.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (!token) return (
    <main className="auth-shell">
      <section className="brand-panel">
        <div className="brand"><span className="brand-mark"><Cloud size={25}/></span><span>mind<span className="brand-accent">circuit</span></span></div>
        <div className="brand-copy">
          <span className="eyebrow">BUILD • AUTOMATE • SCALE</span>
          <h1>Your next chapter in<br/><em>cloud technology.</em></h1>
          <p>Connect with learners and professionals exploring DevOps, AWS, automation, and modern infrastructure.</p>
          <div className="feature"><span><ShieldCheck size={19}/></span><div><b>Secure accounts</b><small>Your password is securely hashed.</small></div></div>
          <div className="feature"><span><Users size={19}/></span><div><b>One learning community</b><small>See the community directory after signing in.</small></div></div>
        </div>
        <div className="brand-footer">MINDCIRCUIT COMMUNITY <span>© 2026</span></div>
      </section>
      <section className="form-panel">
        <div className="mobile-brand brand"><span className="brand-mark"><Cloud size={23}/></span><span>mind<span className="brand-accent">circuit</span></span></div>
        <div className="form-wrap">
          <div className="form-top"><span className="eyebrow">{mode === 'register' ? 'JOIN THE COMMUNITY' : 'WELCOME BACK'}</span><span className="secure"><LockKeyhole size={14}/> SECURE ACCESS</span></div>
          <h2>{mode === 'register' ? 'Create your account' : 'Sign in to MindCircuit'}</h2>
          <p className="muted">{mode === 'register' ? 'Start your cloud journey with us.' : 'Enter your details to continue to the community.'}</p>
          {error && <div className="alert error">{error}</div>}
          {notice && <div className="alert success">{notice}</div>}
          <form onSubmit={submitAuth} className="auth-form">
            {mode === 'register' && <>
              <label>Full name<input autoComplete="name" required minLength="2" maxLength="100" placeholder="e.g. Vasu Katuboina" value={form.name} onChange={e=>setField('name',e.target.value)}/></label>
            </>}
            <label>Email address<input type="email" autoComplete="email" required placeholder="you@example.com" value={form.email} onChange={e=>setField('email',e.target.value)}/></label>
            {mode === 'register' && <>
              <label>Phone number<input type="tel" autoComplete="tel" required minLength="7" maxLength="30" placeholder="+91 98765 43210" value={form.phone} onChange={e=>setField('phone',e.target.value)}/></label>
              <label>Current work status<select value={form.workStatus} onChange={e=>setField('workStatus',e.target.value)}><option>Student</option><option>Employee</option></select></label>
            </>}
            <label>Password<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength="8" maxLength="72" placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'} value={form.password} onChange={e=>setField('password',e.target.value)}/></label>
            {mode === 'register' && <p className="privacy-note">By registering, you understand that your name, email, phone, and work status will be visible to signed-in community members.</p>}
            <button className="primary-btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Login'} <ArrowRight size={17}/></button>
          </form>
          <div className="switch-mode">{mode === 'register' ? 'Already have an account?' : 'New to MindCircuit?'} <button onClick={()=>{setMode(mode==='register'?'login':'register');setError('');setNotice('');setForm(blank);}}>{mode === 'register' ? 'Login' : 'Register'}</button></div>
        </div>
        <p className="form-legal">A community for curious minds and cloud builders.</p>
      </section>
    </main>
  );

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Cloud size={23}/></span><span>mind<span className="brand-accent">circuit</span></span></div>
        <div className="top-actions"><span className="signed-in"><span className="online-dot"></span>{account?.email}</span><button className="logout-btn" onClick={logout}><LogOut size={16}/> Log out</button></div>
      </header>
      <section className="hero">
        <div className="hero-orb orb-one"></div><div className="hero-orb orb-two"></div>
        <div className="hero-content"><span className="eyebrow light">WELCOME TO THE COMMUNITY</span><h1>Welcome to MindCircuit<br/><em>DevOps &amp; AWS</em></h1><p>Learn together. Build boldly. Automate everything.</p><div className="hero-tag"><Cloud size={16}/> CLOUD • DEVOPS • COMMUNITY</div></div>
      </section>
      <section className="directory">
        <div className="section-heading"><div><span className="eyebrow">COMMUNITY DIRECTORY</span><h2>Registered members</h2><p className="muted">Meet the learners and professionals in our community.</p></div><div className="member-count"><Users size={18}/><b>{users.length}</b><span>members</span></div></div>
        {error && <div className="alert error">{error}</div>}{notice && <div className="alert success"><CheckCircle2 size={16}/>{notice}</div>}
        <div className="privacy-banner"><ShieldCheck size={17}/><span>Member details are visible to signed-in users. You can edit or delete only your own account.</span></div>
        <div className="table-card"><div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>EMAIL</th><th>PHONE</th><th>WORK STATUS</th><th>JOINED</th><th>ACTIONS</th></tr></thead><tbody>
          {users.map(user => <tr key={user.id}>
            {editing === user.id ? <td colSpan="6"><form className="edit-grid" onSubmit={saveEdit}>
              <input aria-label="Name" required value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/>
              <input aria-label="Email" type="email" required value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})}/>
              <input aria-label="Phone" required value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})}/>
              <select aria-label="Work status" value={editForm.workStatus} onChange={e=>setEditForm({...editForm,workStatus:e.target.value})}><option>Student</option><option>Employee</option></select>
              <div className="edit-actions"><button className="save-btn" disabled={busy}>Save</button><button type="button" className="cancel-btn" onClick={()=>setEditing(null)}><X size={15}/> Cancel</button></div>
            </form></td> : <>
              <td><div className="member-cell"><span className="avatar">{user.name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</span><span className="member-name">{user.name}{Number(user.id)===Number(account?.id) && <small>YOU</small>}</span></div></td>
              <td className="email-cell">{user.email}</td><td>{user.phone}</td><td><span className={`status-pill ${user.workStatus.toLowerCase()}`}>{user.workStatus}</span></td><td className="date-cell">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
              <td><div className="row-actions">{Number(user.id)===Number(account?.id) ? <><button className="icon-btn edit" title="Edit your profile" onClick={()=>startEdit(user)}><Pencil size={16}/></button><button className="icon-btn delete" title="Delete your account" onClick={()=>deleteAccount(user.id)}><Trash2 size={16}/></button></> : <span className="no-actions">—</span>}</div></td>
            </>}
          </tr>)}
          {!users.length && <tr><td colSpan="6" className="empty-state"><Users size={28}/><b>No members yet</b><span>Register to be the first member.</span></td></tr>}
        </tbody></table></div></div>
        <p className="directory-foot">Member directory · Passwords are never displayed · MindCircuit</p>
      </section>
      <footer className="dashboard-footer"><div className="brand"><span className="brand-mark"><Cloud size={20}/></span><span>mind<span className="brand-accent">circuit</span></span></div><span>Keep learning. Keep building.</span></footer>
    </main>
  );
}
