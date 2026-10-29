import { createContext, useContext, useEffect, useState } from 'react';
import { readState, mutate } from './services/database';
import { sessionUserId } from './services/auth';
const Context = createContext(null);
export function StudioProvider({ children }) {
  const [state, setState] = useState(null), [error, setError] = useState('');
  async function reload() { try { setState(await readState()); setError(''); } catch (e) { setError(e.message); } }
  useEffect(() => { let live = true; readState().then(s => { if (live) setState(s); }).catch(e => { if (live) setError(e.message); }); const refresh = () => reload(); window.addEventListener('focus', refresh); return () => { live = false; window.removeEventListener('focus', refresh); }; }, []);
  async function update(change, assets, deletes) { const result = await mutate(change, assets, deletes); setState(result.state); return result.value; }
  const user = state?.users.find(u => u.id === sessionUserId() && u.status === 'ACTIVE');
  if (error) return <div className="studio"><main><h1>Your studio couldn’t open</h1><p role="alert">{error}</p><button className="studio-button" onClick={reload}>Try again</button></main></div>;
  if (!state) return <div className="studio"><main role="status">Opening your local studio…</main></div>;
  return <Context.Provider value={{ state, user, update, reload }}>{children}</Context.Provider>;
}
// Context hook intentionally shares this small module with its provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useStudio() { return useContext(Context); }
