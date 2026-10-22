'use client';

import { useEffect, useState } from 'react';
import Dashboard from '@/components/Dashboard';
import type { DashboardData } from '@/lib/types';

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/dashboard', { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('No se pudo cargar el tablero. Intenta nuevamente.');
        return response.json() as Promise<DashboardData>;
      })
      .then(data => { if (active) setDashboard(data); })
      .catch(() => { if (active) setError('No se pudo cargar el tablero. Intenta nuevamente.'); });
    return () => { active = false; };
  }, []);

  if (dashboard) return <Dashboard data={dashboard} />;
  return <main className="loading-panel" role="status">
    <img src="/udd-logo.png" alt="Universidad del Desarrollo" width={640} height={160} />
    <h1>CardioInsight</h1>
    {error ? <><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Reintentar</button></> : <p>Cargando tablero de decisiones…</p>}
  </main>;
}
