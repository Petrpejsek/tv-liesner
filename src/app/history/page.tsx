'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface PipelineHistoryItem {
  id: string;
  title: string;
  status: 'running' | 'completed' | 'error';
  completedSteps: number;
  totalSteps: number;
  hasError: boolean;
  createdAt: string;
  updatedAt: string;
  completionPercentage: number;
}

export default function HistoryPage() {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<PipelineHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/pipelines');
      const data = await response.json();
      
      if (data.success) {
        setPipelines(data.pipelines);
      } else {
        setError(data.error || 'Nepodařilo se načíst historii');
      }
    } catch (err) {
      setError('Chyba při načítání historie');
      console.error('Error fetching pipelines:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePipeline = async (pipeline: PipelineHistoryItem) => {
    const confirmMessage = `Opravdu chcete smazat pipeline "${pipeline.title}"?`;
    
    if (!confirm(confirmMessage)) {
      return; // Uživatel zrušil
    }

    try {
      const response = await fetch(`/api/pipeline/${pipeline.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Pipeline "${pipeline.title}" byla úspěšně smazána`);
        fetchPipelines(); // Obnovíme seznam
      } else {
        alert(`❌ Smazání se nepodařilo: ${data.error}`);
      }
    } catch (err) {
      alert('❌ Chyba při mazání pipeline');
      console.error('Error deleting pipeline:', err);
    }
  };

  const getStatusColor = (status: string, hasError: boolean) => {
    if (hasError || status === 'error') return 'text-red-600 bg-red-100';
    if (status === 'completed') return 'text-green-600 bg-green-100';
    if (status === 'running') return 'text-blue-600 bg-blue-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status: string, hasError: boolean) => {
    if (hasError || status === 'error') return '❌';
    if (status === 'completed') return '✅';
    if (status === 'running') return '🔄';
    return '⏳';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Načítám historii pipeline...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">📋 Historie Pipeline</h1>
              <p className="text-blue-100">Přehled všech spuštěných AI Reels projektů</p>
            </div>
            <Link 
              href="/"
              className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
            >
              ← Zpět na hlavní stránku
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-6">
            <strong>Chyba:</strong> {error}
          </div>
        )}

        {pipelines.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Žádná historie</h2>
            <p className="text-gray-600 mb-6">Zatím jste nespustili žádnou pipeline.</p>
            <Link 
              href="/"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors inline-block"
            >
              Spustit první pipeline
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                Celkem {pipelines.length} pipeline{pipelines.length === 1 ? '' : 's'}
              </h2>
              <button
                onClick={fetchPipelines}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                🔄 Obnovit
              </button>
            </div>

            {/* Pipeline Cards */}
            {pipelines.map((pipeline) => (
              <div key={pipeline.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getStatusIcon(pipeline.status, pipeline.hasError)}</span>
                      <h3 className="text-lg font-semibold text-gray-800">{pipeline.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pipeline.status, pipeline.hasError)}`}>
                        {pipeline.hasError ? 'Error' : pipeline.status === 'completed' ? 'Dokončeno' : pipeline.status === 'running' ? 'Běží' : 'Čeká'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                      <span>📅 {formatDate(pipeline.createdAt)}</span>
                      <span>📊 {pipeline.completedSteps}/{pipeline.totalSteps} kroků</span>
                      <span>📈 {pipeline.completionPercentage}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div 
                        className={`h-2 rounded-full ${pipeline.hasError ? 'bg-red-400' : pipeline.status === 'completed' ? 'bg-green-400' : 'bg-blue-400'}`}
                        style={{ width: `${pipeline.completionPercentage}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex gap-3 ml-6">
                    <Link 
                      href={`/history/${pipeline.id}`}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      📋 Detail
                    </Link>
                    <button
                      onClick={() => handleDeletePipeline(pipeline)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                    >
                      🗑️ Smazat
                    </button>
                    {pipeline.hasError && (
                      <button className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-700 transition-colors">
                        🔄 Restart
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
} 