import React, { useState, useEffect } from 'react';
import { platform } from '../platform';

export default function PerformanceDiagnosticPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      const m = await platform.performance.getMetrics();
      setMetrics(m);
    } catch(e) {
      console.error(e);
    }
  };

  const handleClearCache = async () => {
    await platform.performance.clearCache();
    await loadMetrics();
    alert("Cache vidé et Garbage Collector appelé (si dispo).");
  };

  const handleBenchmark = async () => {
    setLoading(true);
    try {
      const res = await platform.performance.runBenchmark();
      setBenchmark(res);
    } catch(e) {
      alert("Erreur de benchmark : " + String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!metrics) return <div>Chargement des métriques...</div>;

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      <h1>Centre de Performances & Optimisation (Phase 15)</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        
        {/* Colonne 1 : RAM / CPU */}
        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '4px' }}>
          <h3>Mémoire & Système (Electron Main Process)</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><strong>RSS (Resident Set Size):</strong> {metrics.memory.rss} MB</li>
            <li><strong>Heap Total:</strong> {metrics.memory.heapTotal} MB</li>
            <li><strong>Heap Used:</strong> {metrics.memory.heapUsed} MB</li>
            <li><strong>Uptime:</strong> {Math.round(metrics.uptime)} secondes</li>
          </ul>
        </div>

        {/* Colonne 2 : Cache */}
        <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '4px' }}>
          <h3>Gestionnaire de Cache</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><strong>Taille du Cache:</strong> {metrics.cacheSize} objets</li>
          </ul>
          <button 
            onClick={handleClearCache}
            style={{ padding: '8px 16px', background: '#388e3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}
          >
            Purger le cache et forcer le GC
          </button>
        </div>
        
        {/* Colonne 3 : Benchmark */}
        <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '4px', gridColumn: 'span 2' }}>
          <h3>Tests de Performance & IPC</h3>
          <p>Mesure de la latence du canal IPC et de l'exécution d'un traitement asynchrone.</p>
          <button 
            onClick={handleBenchmark}
            disabled={loading}
            style={{ padding: '8px 16px', cursor: 'pointer', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px' }}
          >
            {loading ? "Test en cours..." : "Lancer le Benchmark"}
          </button>

          {benchmark && (
            <div style={{ marginTop: '15px', padding: '10px', background: '#fff', border: '1px solid #ffcc80', borderRadius: '4px' }}>
              <strong>Durée d'exécution (ms) :</strong> {benchmark.durationMs} ms<br/>
              <strong>Score de performance :</strong> {benchmark.score} pts
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
