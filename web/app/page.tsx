'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Dashboard from '@/components/Dashboard';
import type { DashboardData } from '@/lib/types';

type Status = 'loading' | 'locked' | 'ready' | 'error';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  if (!response.ok) {
    const message = response.status === 401 && path === '/api/access' ? 'Clave incorrecta o vencida.' :
      response.status === 401 ? 'La sesión expiró. Ingresa la clave vigente.' :
      response.status === 403 ? 'Clave incorrecta o acceso denegado.' : 'No se pudo completar la solicitud. Intenta nuevamente.';
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export default function Home() {
  const [status, setStatus] = useState<Status>('loading');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [key, setKey] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await fetchJson<{ authenticated: boolean }>('/api/session');
        if (!active) return;
        if (!session.authenticated) { setStatus('locked'); return; }
        const data = await fetchJson<DashboardData>('/api/dashboard');
        if (active) { setDashboard(data); setStatus('ready'); }
      } catch (cause) {
        if (active) {
          const message = cause instanceof Error ? cause.message : 'No se pudo conectar con el servidor.';
          setError(message);
          setStatus(message.includes('sesión expiró') ? 'locked' : 'error');
        }
      }
    })();
    return () => { active = false; };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await fetchJson('/api/access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }),
      });
      setKey('');
      const data = await fetchJson<DashboardData>('/api/dashboard');
      setDashboard(data);
      setStatus('ready');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo conectar con el servidor.';
      setError(message);
      setStatus('locked');
    } finally { setPending(false); }
  }

  async function signOut() {
    setPending(true);
    setError('');
    try {
      await fetchJson('/api/logout', { method: 'POST' });
      setDashboard(null);
      setStatus('locked');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar la sesión.');
    } finally { setPending(false); }
  }

  function sessionExpired() {
    setDashboard(null);
    setStatus('locked');
    setError('La sesión expiró. Ingresa la clave vigente.');
  }

  if (status === 'ready' && dashboard) return <Dashboard data={dashboard} onLogout={signOut} onExpired={sessionExpired} pending={pending} error={error} />;
  return <main className="gate"><div className="gate-decor"><img src="/udd-logo.png" alt="Universidad del Desarrollo" width={640} height={160} className="gate-university" /><span className="gate-decor-caption">DATOS · CONTEXTO · DECISIONES</span></div><div className="gate-panel">
    <span className="eyebrow">LABORATORIO DE ANALÍTICA PREDICTIVA</span>
    <h1>Cardio<span>Insight</span><span className="brand-dot">.</span></h1>
    <p className="gate-lead">¿A quién derivar para evaluación? Compara escenarios hipotéticos de costos y detección con datos históricos, sin convertirlos en recomendaciones clínicas.</p>
    {status === 'loading' ? <p role="status">Verificando acceso…</p> : <>
      <div className="gate-divider" />
      <p className="gate-description">Acceso privado · Ingresa la clave vigente para explorar el panel de decisiones.</p>
      <form onSubmit={signIn} className="gate-form">
        <label htmlFor="access-key">Clave de acceso</label>
        <input id="access-key" type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} required disabled={pending} placeholder="Ingresa tu clave" />
        <button type="submit" disabled={pending || !key.trim()}>{pending ? 'Accediendo…' : 'Abrir panel'} <span aria-hidden="true">↗</span></button>
      </form>
      {error && <p role="alert" className="error-banner">{error} {status === 'error' && <button type="button" className="text-button" onClick={() => window.location.reload()}>Reintentar conexión</button>}</p>}
      <p className="privacy-note">Esta herramienta es educativa. No diagnostica, no indica tratamientos y no conserva los datos ingresados en el formulario.</p>
    </>}
  </div></main>;
}
