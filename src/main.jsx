import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = '/api';
const routes = ['home', 'discover', 'matches', 'login', 'register', 'admin', 'profile'];
const currentRoute = () => {
  const route = window.location.pathname.replace('/', '') || 'discover';
  return routes.includes(route) ? route : 'discover';
};
function navigate(route) {
  window.history.pushState({}, '', `/${route}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function PasswordStrength({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];
  const score = checks.filter(Boolean).length;
  const label = !password ? '' : score <= 2 ? 'Weak' : score <= 4 ? 'Medium' : 'Strong';
  const suggestions = [
    !checks[0] && 'Use at least 8 characters',
    !checks[1] && 'Add a capital letter',
    !checks[2] && 'Add a lowercase letter',
    !checks[3] && 'Add a number',
    !checks[4] && 'Add a special symbol'
  ].filter(Boolean);
  return <div className="strength"><div className="strength-heading"><span>Password strength</span><strong className={label.toLowerCase()}>{label}</strong></div><div className="strength-bars">{[1,2,3,4,5].map((bar) => <i key={bar} className={score >= bar ? `filled level-${score}` : ''} />)}</div>{password && suggestions.length > 0 && <p>{suggestions.join(' · ')}</p>}</div>;
}

function AuthPage({ mode, onSuccess }) {
  const register = mode === 'register';
  const [form, setForm] = useState({ name:'', phone:'', password:'', age:'', city:'', bio:'', interests:'', photo:'', latitude:'', longitude:'' });
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  function choosePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose an image file');
    const reader = new FileReader();
    reader.onload = () => { setPreview(reader.result); update('photo', reader.result); };
    reader.readAsDataURL(file);
  }

  function useLocation() {
    if (!navigator.geolocation) return setError('GPS location is not supported by this browser');
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition((position) => {
      update('latitude', String(position.coords.latitude));
      update('longitude', String(position.coords.longitude));
      if (!form.city) update('city', `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
      setLocationLoading(false);
    }, () => {
      setError('Location access was denied. Enter a city manually.');
      setLocationLoading(false);
    }, { enableHighAccuracy:true, timeout:10000 });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = register ? { ...form, age:Number(form.age), interests:form.interests.split(',').map((item) => item.trim()).filter(Boolean) } : { phone:form.phone, password:form.password };
      const response = await fetch(register ? `${API}/auth/register` : `${API}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Authentication failed');
      localStorage.setItem('coy-user', JSON.stringify(result.user));
      if (result.token) localStorage.setItem('coy-admin-token', result.token);
      onSuccess(result.user);
      navigate(result.user.role === 'admin' ? 'admin' : 'discover');
    } catch (submitError) { setError(submitError.message); }
    finally { setLoading(false); }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit}>
    <button type="button" className="brand brand-button auth-brand" onClick={() => navigate(register ? 'login' : 'register')}><span className="brand-mark">k</span><span>kinly</span></button>
    <p className="eyebrow">{register ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</p><h1>{register ? 'Join Discover' : 'Log in'}</h1>
    {register && <>
      <label className="photo-upload">{preview ? <img src={preview} alt="Profile preview" /> : <span className="photo-placeholder">＋</span>}<div><strong>{preview ? 'Change photo' : 'Add profile photo'}</strong><small>Required · JPG or PNG</small></div><input type="file" accept="image/*" onChange={choosePhoto} /></label>
      <label>Full name<input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Your name" /></label>
      <div className="form-row"><label>Age<input required type="number" min="18" max="100" value={form.age} onChange={(event) => update('age', event.target.value)} placeholder="25" /></label><label>Location<div className="location-input"><input required value={form.city} onChange={(event) => update('city', event.target.value)} placeholder="City" /><button type="button" onClick={useLocation} disabled={locationLoading}>⌖</button></div></label></div>
      <label>Bio<input value={form.bio} onChange={(event) => update('bio', event.target.value)} placeholder="A short introduction" /></label>
      <label>Interests <small>Separate with commas</small><input value={form.interests} onChange={(event) => update('interests', event.target.value)} placeholder="Coffee, Travel, Music" /></label>
    </>}
    <label>Phone number<input required type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+91 98765 43210" /></label>
    <label>Password<input required type="password" value={form.password} onChange={(event) => update('password', event.target.value)} placeholder={register ? 'Create a strong password' : 'Enter password'} /></label>
    {register && <PasswordStrength password={form.password} />}
    {error && <div className="error">{error}</div>}
    <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait...' : register ? 'Create account' : 'Log in'}</button>
    <p className="auth-switch">{register ? 'Already have an account?' : 'New to Kinly?'} <button type="button" onClick={() => navigate(register ? 'login' : 'register')}>{register ? 'Log in' : 'Create account'}</button></p>
  </form></main>;
}

function fallbackPhoto(name, size=640) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=${size}&background=e56743&color=fff`;
}

function AdminPage({ user, onLogout }) {
  const token = localStorage.getItem('coy-admin-token');
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Admin request failed');
    return result;
  }

  async function load() {
    try {
      const [summary, accountList, profileList] = await Promise.all([
        request('/admin/overview'), request('/admin/users'), request('/admin/profiles')
      ]);
      setOverview(summary); setUsers(accountList); setProfiles(profileList); setError('');
    } catch (loadError) { setError(loadError.message); }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab === 'overview') return;
    const timer = window.setTimeout(async () => {
      const controller = new AbortController();
      setSearchLoading(true);
      try {
        const encodedQuery = encodeURIComponent(search.trim());
        const suffix = encodedQuery ? `?q=${encodedQuery}` : '';
        if (tab === 'users') {
          const result = await request(`/admin/users${suffix}`, { signal: controller.signal });
          setUsers(result);
        } else if (tab === 'profiles') {
          const result = await request(`/admin/profiles${suffix}`, { signal: controller.signal });
          setProfiles(result);
        }
        setError('');
      } catch (searchError) {
        if (searchError.name !== 'AbortError') setError(searchError.message);
      } finally {
        setSearchLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search, tab]);

  async function deleteUser(account) {
    if (!window.confirm(`Delete ${account.name}?`)) return;
    try { await request(`/admin/users/${encodeURIComponent(account.id)}`, { method:'DELETE' }); await load(); }
    catch (actionError) { setError(actionError.message); }
  }

  async function editUser(account) {
    try {
      const details = await request(`/admin/users/${encodeURIComponent(account.id)}/details`);
      setEditingUser({
        ...details.user,
        interests: (details.user.interests || []).join(', ')
      });
      setUserDetails(details);
    } catch (actionError) { setError(actionError.message); }
  }

  function chooseUserPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditingUser((current) => ({ ...current, photo: reader.result }));
    reader.readAsDataURL(file);
  }

  async function saveUser(event) {
    event.preventDefault();
    try {
      await request(`/admin/users/${encodeURIComponent(editingUser.id)}`, {
        method:'PUT',
        body:JSON.stringify({
          ...editingUser,
          age:Number(editingUser.age),
          interests:typeof editingUser.interests === 'string'
            ? editingUser.interests.split(',').map((item) => item.trim()).filter(Boolean)
            : editingUser.interests
        })
      });
      setEditingUser(null);
      setUserDetails(null);
      await load();
    } catch (saveError) { setError(saveError.message); }
  }

  async function resetUserSwipes() {
    if (!window.confirm(`Reset all swipes and matches for ${editingUser.name}?`)) return;
    try {
      await request(`/admin/users/${encodeURIComponent(editingUser.id)}/reset-swipes`, { method:'POST' });
      setUserDetails((current) => current ? { ...current, swipes:[], matches:[] } : current);
      await load();
    } catch (actionError) { setError(actionError.message); }
  }

  async function unmarkProfile(profileId) {
    try {
      await request(`/admin/users/${encodeURIComponent(editingUser.id)}/swipes/${encodeURIComponent(profileId)}`, { method:'DELETE' });
      setUserDetails((current) => current ? {
        ...current,
        swipes:current.swipes.filter((item) => item.profile_id !== profileId),
        matches:current.matches.filter((item) => item.profile_id !== profileId)
      } : current);
      await load();
    } catch (actionError) { setError(actionError.message); }
  }

  async function saveProfile(event) {
    event.preventEvent?.();
    event.preventDefault();
    const data = {
      name:event.target.name.value,
      age:Number(event.target.age.value),
      photo:event.target.photo.value,
      bio:event.target.bio.value,
      city:event.target.city.value,
      interests:event.target.interests.value.split(',').map((item)=>item.trim()).filter(Boolean),
      liked_by_demo:event.target.liked.checked
    };
    try {
      if (editingProfile) await request(`/admin/profiles/${encodeURIComponent(editingProfile.id)}`, { method:'PUT', body:JSON.stringify(data) });
      else await request('/admin/profiles', { method:'POST', body:JSON.stringify(data) });
      setEditingProfile(null); await load();
    } catch (saveError) { setError(saveError.message); }
  }

  async function deleteProfile(profile) {
    if (!window.confirm(`Delete ${profile.name}?`)) return;
    try { await request(`/admin/profiles/${encodeURIComponent(profile.id)}`, { method:'DELETE' }); await load(); }
    catch (actionError) { setError(actionError.message); }
  }

  return <div className="admin-shell"><aside className="admin-sidebar"><button className="brand brand-button" onClick={()=>navigate('discover')}><span className="brand-mark">k</span><span>kinly</span></button><div className="admin-links"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>▦ Overview</button><button className={tab==='users'?'active':''} onClick={()=>setTab('users')}>♙ Users</button><button className={tab==='profiles'?'active':''} onClick={()=>setTab('profiles')}>◆ Profiles</button></div><button className="admin-logout" onClick={onLogout}>Log out</button></aside>
    <main className="admin-main"><header className="admin-header"><div><p className="eyebrow">ADMIN CONSOLE</p><h1>{tab==='overview'?'Database overview':tab==='users'?'User accounts':'Discovery profiles'}</h1></div><div className="admin-header-actions">{tab!=='overview'&&<div className="admin-search-wrap"><input className="admin-search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder={`Search ${tab}...`}/>{searchLoading&&<span className="search-spinner" aria-label="Searching">⋯</span>}</div>}<div className="profile-menu"><button className="avatar-button" onClick={()=>setAdminMenuOpen((open)=>!open)} aria-expanded={adminMenuOpen}>{user.photo?<img src={user.photo} alt={user.name} onError={(event)=>{event.currentTarget.onerror=null;event.currentTarget.src=fallbackPhoto(user.name,80);}}/>:<span>{user.name?.[0]}</span>}</button>{adminMenuOpen&&<div className="profile-dropdown"><div className="profile-dropdown-user"><strong>{user.name}</strong><span>{user.phone}</span></div><button onClick={()=>{setAdminMenuOpen(false);navigate('profile');}}>♙ <span>Profile</span></button><button onClick={()=>{setAdminMenuOpen(false);navigate('discover');}}>✦ <span>Discover</span></button><button className="logout-menu-item" onClick={onLogout}>↪ <span>Log out</span></button></div>}</div></div></header>
      {error&&<div className="error">{error}</div>}
      {tab==='overview'&&overview&&<section className="stat-grid"><article><span>Users</span><strong>{overview.users}</strong></article><article><span>Profiles</span><strong>{overview.profiles}</strong></article><article><span>Swipes</span><strong>{overview.swipes}</strong></article><article><span>Matches</span><strong>{overview.matches}</strong></article></section>}
      {tab==='users'&&<section className="admin-table-wrap"><table><thead><tr><th>User</th><th>Phone</th><th>Age</th><th>Location</th><th>Role</th><th>Actions</th></tr></thead><tbody>{users.map((account)=><tr key={account.id}><td><div className="admin-user"><img src={account.photo||fallbackPhoto(account.name,80)} alt="" onError={(event)=>{event.currentTarget.src=fallbackPhoto(account.name,80);}}/><strong>{account.name}</strong></div></td><td>{account.phone}</td><td>{account.age}</td><td>{account.city}</td><td><span className={`role ${account.role}`}>{account.role}</span></td><td><button className="table-action" onClick={()=>editUser(account)}>Edit</button>{account.role!=='admin'&&<button className="table-action danger" onClick={()=>deleteUser(account)}>Delete</button>}</td></tr>)}</tbody></table>{!searchLoading&&users.length===0&&<div className="admin-no-results">No users found</div>}</section>}
      {tab==='profiles'&&<section><div className="profile-admin-grid">{profiles.map((profile)=><article className="profile-admin-card" key={profile.id}><img src={profile.photo||fallbackPhoto(profile.name)} alt={profile.name} onError={(event)=>{event.currentTarget.src=fallbackPhoto(profile.name);}}/><div><strong>{profile.name}, {profile.age}</strong><p>{profile.city}</p><div className="admin-card-actions"><button onClick={()=>setEditingProfile(profile)}>Edit</button><button className="danger" onClick={()=>deleteProfile(profile)}>Delete</button></div></div></article>)}</div>{!searchLoading&&profiles.length===0&&<div className="admin-no-results">No profiles found</div>}<button className="admin-add" onClick={()=>setEditingProfile({id:'',name:'',age:25,photo:'',bio:'',city:'',interests:[],liked_by_demo:false})}>＋ Add profile</button></section>}
      {editingProfile&&<div className="modal-backdrop"><form className="profile-editor" onSubmit={saveProfile}><button type="button" className="close" onClick={()=>setEditingProfile(null)}>×</button><p className="eyebrow">{editingProfile.id?'EDIT PROFILE':'NEW PROFILE'}</p><h2>Profile details</h2><label>Name<input name="name" required defaultValue={editingProfile.name}/></label><div className="form-row"><label>Age<input name="age" type="number" required min="18" defaultValue={editingProfile.age}/></label><label>City<input name="city" required defaultValue={editingProfile.city}/></label></div><label>Photo URL<input name="photo" required defaultValue={editingProfile.photo}/></label><label>Bio<input name="bio" defaultValue={editingProfile.bio}/></label><label>Interests<input name="interests" defaultValue={(editingProfile.interests||[]).join(', ')}/></label><label className="check-label"><input name="liked" type="checkbox" defaultChecked={Boolean(editingProfile.liked_by_demo)} /> Already likes the demo user</label><button className="auth-submit" type="submit">Save profile</button></form></div>}
      {editingUser&&<div className="modal-backdrop"><form className="profile-editor user-edit-modal" onSubmit={saveUser}><button type="button" className="close" onClick={()=>{setEditingUser(null);setUserDetails(null);}}>×</button><p className="eyebrow">USER MANAGEMENT</p><h2>{editingUser.name}</h2><label className="admin-edit-photo">{editingUser.photo?<img src={editingUser.photo} alt={editingUser.name}/>:<span>＋</span>}<div><strong>Change photo</strong><small>Upload image or keep current photo</small></div><input type="file" accept="image/*" onChange={chooseUserPhoto}/></label><label>Name<input required value={editingUser.name} onChange={(event)=>setEditingUser({...editingUser,name:event.target.value})}/></label><div className="form-row"><label>Age<input required type="number" min="18" max="100" value={editingUser.age} onChange={(event)=>setEditingUser({...editingUser,age:event.target.value})}/></label><label>City<input required value={editingUser.city} onChange={(event)=>setEditingUser({...editingUser,city:event.target.value})}/></label></div><label>Phone<input required type="tel" value={editingUser.phone} onChange={(event)=>setEditingUser({...editingUser,phone:event.target.value})}/></label><label>Photo URL<input value={editingUser.photo} onChange={(event)=>setEditingUser({...editingUser,photo:event.target.value})}/></label><label>Bio<input value={editingUser.bio||''} onChange={(event)=>setEditingUser({...editingUser,bio:event.target.value})}/></label><label>Interests<input value={editingUser.interests||''} onChange={(event)=>setEditingUser({...editingUser,interests:event.target.value})}/></label><div className="swipe-summary"><div><strong>{userDetails?.swipes?.length || 0}</strong><span>Swipes</span></div><div><strong>{userDetails?.matches?.length || 0}</strong><span>Matches</span></div></div>{userDetails?.matches?.length>0&&<div className="match-reset-list"><p>Mutual matches</p>{userDetails.matches.map((item)=><div className="match-reset-row" key={item.profile_id}><span>{item.name || item.profile_id}</span><button type="button" onClick={()=>unmarkProfile(item.profile_id)}>Unmark match</button></div>)}</div>}<button type="button" className="reset-swipes-button" onClick={resetUserSwipes}>Reset all swipes and matches</button><button className="auth-submit" type="submit">Save user</button></form></div>}
    </main>
  </div>;
}

function App() {
  const [route, setRoute] = useState(currentRoute);
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('coy-user')); } catch { return null; } });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [feed, setFeed] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [match, setMatch] = useState(null);
  const [swiping, setSwiping] = useState(false);
  const [drag, setDrag] = useState({x:0,y:0});
  const dragStart = useRef(null);

  useEffect(() => { const update=()=>setRoute(currentRoute()); window.addEventListener('popstate',update); return ()=>window.removeEventListener('popstate',update); }, []);
  useEffect(() => {
    function closeMenu(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) setProfileMenuOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  useEffect(() => { if (!user && !['login','register'].includes(route)) navigate('login'); }, [user,route]);
  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('coy-admin-token') || '';
      const headers = token ? { Authorization:`Bearer ${token}` } : {};
      const [a,b] = await Promise.all([
        fetch(`${API}/feed`, { headers }),
        fetch(`${API}/matches`, { headers })
      ]);
      if (!a.ok || !b.ok) throw new Error('Unable to load discovery data');
      setFeed(await a.json()); setMatches(await b.json()); setError('');
    } catch (requestError) { setError(requestError.message); } finally { setLoading(false); }
  }
  useEffect(() => { if (user && !['login','register'].includes(route)) loadData(); }, [user,route]);

  async function swipe(direction) {
    const profile = feed[0];
    if (!profile || swiping) return;
    setSwiping(true);
    try {
      const token = localStorage.getItem('coy-admin-token') || '';
      const response=await fetch(`${API}/swipe`,{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({profileId:profile.id,direction})
      });
      if (!response.ok) throw new Error('Swipe could not be saved');
      const result=await response.json();
      setDrag({x:direction==='like'?700:-700,y:0});
      window.setTimeout(()=>{setFeed((items)=>items.slice(1));setDrag({x:0,y:0});setSwiping(false);},280);
      if (result.matched) { setMatch(result.profile); setMatches((items)=>[...items,result.profile]); }
    } catch (swipeError) { setError(swipeError.message); setSwiping(false); }
  }
  function pointerDown(event){dragStart.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);}
  function pointerMove(event){if(dragStart.current)setDrag({x:event.clientX-dragStart.current.x,y:(event.clientY-dragStart.current.y)*.35});}
  function pointerUp(){if(!dragStart.current)return;const direction=drag.x>110?'like':drag.x<-110?'pass':null;dragStart.current=null;if(direction)swipe(direction);else setDrag({x:0,y:0});}
  function logout(){localStorage.removeItem('coy-user');localStorage.removeItem('coy-admin-token');setUser(null);navigate('login');}
  function startProfileEdit() {
    setProfileForm({
      id:user.id,
      name:user.name || '',
      phone:user.phone || '',
      age:user.age || '',
      photo:user.photo || '',
      city:user.city || '',
      latitude:user.latitude || '',
      longitude:user.longitude || '',
      bio:user.bio || '',
      interests:(user.interests || []).join(', ')
    });
    setProfilePhotoPreview(user.photo || '');
    setProfileStatus('');
    setEditingProfile(true);
  }
  function updateProfileForm(field, value) {
    setProfileForm((current) => ({ ...current, [field]: value }));
  }
  function chooseProfilePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileStatus('Please choose an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfilePhotoPreview(reader.result);
      updateProfileForm('photo', reader.result);
    };
    reader.readAsDataURL(file);
  }
  function useProfileLocation() {
    if (!navigator.geolocation) {
      setProfileStatus('GPS location is not supported by this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      updateProfileForm('latitude', String(position.coords.latitude));
      updateProfileForm('longitude', String(position.coords.longitude));
      updateProfileForm('city', `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
    }, () => setProfileStatus('Location access was denied'), { enableHighAccuracy:true, timeout:10000 });
  }
  async function saveProfile(event) {
    event.preventDefault();
    setProfileStatus('');
    try {
      const body = {
        ...profileForm,
        age:Number(profileForm.age),
        interests:profileForm.interests.split(',').map((item) => item.trim()).filter(Boolean)
      };
      const response = await fetch(`${API}/profile`, {
        method:'PUT',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('coy-admin-token') || ''}`},
        body:JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update profile');
      localStorage.setItem('coy-user', JSON.stringify(result.user));
      setUser(result.user);
      setEditingProfile(false);
      setProfileStatus('Profile updated successfully');
    } catch (saveError) {
      setProfileStatus(saveError.message);
    }
  }

  if (!user && route==='login') return <AuthPage mode="login" onSuccess={setUser}/>;
  if (!user && route==='register') return <AuthPage mode="register" onSuccess={setUser}/>;
  if (route==='admin') {
    if (user.role !== 'admin') return <main className="auth-page"><div className="auth-card"><p className="eyebrow">ACCESS DENIED</p><h1>Admin only</h1><p>This page is reserved for the Kinly administrator.</p><button className="auth-submit" onClick={()=>navigate('discover')}>Back to Discover</button></div></main>;
    return <AdminPage user={user} onLogout={logout}/>;
  }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand brand-button" onClick={()=>navigate('discover')}><span className="brand-mark">k</span><span>kinly</span></button>
      <div className="header-actions">
        <div className="privacy-pill"><span className="lock">●</span> private by default</div>
        {user&&<div className="profile-menu" ref={profileMenuRef}>
          <button className="avatar-button" onClick={()=>setProfileMenuOpen((open)=>!open)} aria-expanded={profileMenuOpen} aria-haspopup="menu" title="Open profile menu">
            {user.photo?<img src={user.photo} alt={user.name} onError={(event)=>{event.currentTarget.onerror=null;event.currentTarget.src=fallbackPhoto(user.name,80);}}/>:<span>{user.name?.[0] || '?'}</span>}
          </button>
          {profileMenuOpen&&<div className="profile-dropdown" role="menu">
            <div className="profile-dropdown-user"><strong>{user.name}</strong><span>{user.phone}</span></div>
            {user.role==='admin'&&<button role="menuitem" onClick={()=>{setProfileMenuOpen(false);navigate('admin');}}>▦ <span>Admin dashboard</span></button>}
            <button role="menuitem" onClick={()=>{setProfileMenuOpen(false);navigate('profile');}}>♙ <span>Profile</span></button>
            <button role="menuitem" className="logout-menu-item" onClick={logout}>↪ <span>Log out</span></button>
          </div>}
        </div>}
      </div>
    </header>
    <main>
      {route==='home'&&<section className="blank-home"><p className="eyebrow">YOUR SPACE</p><h1>Welcome, {user?.name}</h1></section>}
      {route==='profile'&&<section className="profile-page"><p className="eyebrow">MY ACCOUNT</p><div className="profile-heading"><h1>Profile</h1><button className="profile-edit-button" onClick={startProfileEdit}>Edit profile</button></div>{profileStatus&&!editingProfile&&<div className={profileStatus.includes('successfully')?'profile-success':'error'}>{profileStatus}</div>}<div className="profile-detail-card">{user.photo?<img src={user.photo} alt={user.name} onError={(event)=>{event.currentTarget.onerror=null;event.currentTarget.src=fallbackPhoto(user.name);}}/>:<img src={fallbackPhoto(user.name)} alt={user.name}/>}<div><h2>{user.name}{user.age?`, ${user.age}`:''}</h2><p>⌖ {user.city || 'Location not set'}</p><p>{user.bio || 'No bio added yet.'}</p><div className="chips profile-detail-chips">{(user.interests||[]).map((interest)=><span key={interest}>{interest}</span>)}</div><p className="profile-phone">{user.phone}</p>{user.role==='admin'&&<button className="auth-submit" onClick={()=>navigate('admin')}>Open admin dashboard</button>}</div></div>
        {editingProfile&&<div className="modal-backdrop"><form className="profile-edit-modal" onSubmit={saveProfile}><button type="button" className="close" onClick={()=>setEditingProfile(false)}>×</button><p className="eyebrow">MY ACCOUNT</p><h2>Edit profile</h2><label className="edit-photo-upload">{profilePhotoPreview?<img src={profilePhotoPreview} alt="Profile preview"/>:<span>＋</span>}<div><strong>{profilePhotoPreview?'Change photo':'Add photo'}</strong><small>JPG or PNG</small></div><input type="file" accept="image/*" onChange={chooseProfilePhoto}/></label><label>Name<input required value={profileForm.name} onChange={(event)=>updateProfileForm('name',event.target.value)}/></label><div className="form-row"><label>Age<input required type="number" min="18" max="100" value={profileForm.age} onChange={(event)=>updateProfileForm('age',event.target.value)}/></label><label>Location<div className="location-input"><input required value={profileForm.city} onChange={(event)=>updateProfileForm('city',event.target.value)}/><button type="button" onClick={useProfileLocation}>⌖</button></div></label></div><label>Phone number<input required type="tel" value={profileForm.phone} onChange={(event)=>updateProfileForm('phone',event.target.value)}/></label><label>Bio<input value={profileForm.bio} onChange={(event)=>updateProfileForm('bio',event.target.value)}/></label><label>Interests <small>Separate with commas</small><input value={profileForm.interests} onChange={(event)=>updateProfileForm('interests',event.target.value)}/></label>{profileStatus&&<div className={profileStatus.includes('successfully')?'profile-success':'error'}>{profileStatus}</div>}<button className="auth-submit" type="submit">Save changes</button></form></div>}
      </section>}
      {route==='discover'&&<section className="discover"><div className="heading-row"><div><p className="eyebrow">FIND YOUR PEOPLE</p><h1>Discover</h1></div><button className="match-count" onClick={()=>navigate('matches')}>♡ <span>{matches.length}</span></button></div>
        {error&&<div className="error">{error}</div>}
        {loading?<div className="state">Loading your picks...</div>:feed.length?<div className="deck"><div className="next-card"/><article className="profile-card" style={{transform:`translate(${drag.x}px,${drag.y}px) rotate(${drag.x*.06}deg)`}} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
          <img src={feed[0].photo} alt={feed[0].name} draggable="false" onError={(event)=>{event.currentTarget.onerror=null;event.currentTarget.src=fallbackPhoto(feed[0].name);}}/><div className="photo-shade"/><div className={`swipe-label like-label ${drag.x>35?'visible':''}`}>LIKE</div><div className={`swipe-label pass-label ${drag.x<-35?'visible':''}`}>PASS</div>
          <div className="profile-info"><h2>{feed[0].name}, <span>{feed[0].age}</span></h2><p className="location">⌖ {feed[0].city}</p><p>{feed[0].bio}</p><div className="chips">{feed[0].interests.map((interest)=><span key={interest}>{interest}</span>)}</div></div>
        </article></div>:<div className="empty-state"><div className="empty-icon">✦</div><h2>You’re all caught up</h2><p>There are no new profiles right now.</p></div>}
        {feed.length>0&&<div className="actions"><button className="action-button pass" disabled={swiping} onClick={()=>swipe('pass')}>×</button><button className="action-button like" disabled={swiping} onClick={()=>swipe('like')}>♡</button></div>}<p className="hint">Drag right to like · drag left to pass</p>
      </section>}
      {route==='matches'&&<section className="matches-page"><div className="heading-row"><div><p className="eyebrow">YOUR CONNECTIONS</p><h1>Matches</h1></div></div>{matches.length?<div className="match-grid">{matches.map((item)=><article className="match-card" key={item.id}><img src={item.photo} alt={item.name} onError={(event)=>{event.currentTarget.onerror=null;event.currentTarget.src=fallbackPhoto(item.name,160);}}/><div><h3>{item.name}, {item.age}</h3><p>{item.city}</p></div></article>)}</div>:<div className="empty-state"><div className="empty-icon">♡</div><h2>No matches yet</h2><p>Mutual matches will appear here.</p></div>}</section>}
    </main>
    {match&&<div className="modal-backdrop"><div className="match-modal"><button className="close" onClick={()=>setMatch(null)}>×</button><div className="sparkle">✦</div><p className="eyebrow">YOU BOTH SAID YES</p><h2>It’s a match!</h2><img src={match.photo} alt={match.name}/><p>You and <strong>{match.name}</strong> liked each other.</p><button className="primary" onClick={()=>setMatch(null)}>Keep discovering</button></div></div>}
    <nav className="tabbar"><button className={route==='home'?'active':''} onClick={()=>navigate('home')}><span>⌂</span>Home</button><button className={route==='discover'?'active':''} onClick={()=>navigate('discover')}><span>✦</span>Discover</button><button className={route==='matches'?'active':''} onClick={()=>navigate('matches')}><span>♡</span>Matches{matches.length>0&&<b>{matches.length}</b>}</button></nav>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
