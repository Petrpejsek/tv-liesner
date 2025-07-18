'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface PipelineStep {
  id: string;
  stepName: string;
  order: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  outputJson: any;
  assetUrls: string[] | null;
  errorLogs: string | null;
  createdAt: string;
  updatedAt: string;
  canRestart: boolean;
}

interface PipelineDetail {
  id: string;
  title: string;
  status: 'running' | 'completed' | 'error';
  completedSteps: number;
  totalSteps: number;
  completionPercentage: number;
  createdAt: string;
  updatedAt: string;
  steps: PipelineStep[];
}

interface PipelineVersion {
  id: string;
  versionName: string;
  description: string | null;
  pipelineTitle: string;
  totalSteps: number;
  completedSteps: number;
  createdAt: string;
}

export default function PipelineDetailPage() {
  const params = useParams();
  const pipelineId = params.id as string;
  
  const [pipeline, setPipeline] = useState<PipelineDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  
  // 📦 Verzování state
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [versionDescription, setVersionDescription] = useState('');

  // ✏️ JSON Editor state
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [editingStep, setEditingStep] = useState<{id: string, name: string, json: any} | null>(null);
  const [editedJson, setEditedJson] = useState('');

  useEffect(() => {
    if (pipelineId) {
      fetchPipelineDetail();
      fetchVersions();
    }
  }, [pipelineId]);

  const fetchPipelineDetail = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/pipeline/${pipelineId}`);
      const data = await response.json();
      
      if (data.success) {
        setPipeline(data.pipeline);
      } else {
        setError(data.error || 'Nepodařilo se načíst detail pipeline');
      }
    } catch (err) {
      setError('Chyba při načítání detailu pipeline');
      console.error('Error fetching pipeline detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 📦 Načtení verzí
  const fetchVersions = async () => {
    try {
      setVersionsLoading(true);
      const response = await fetch(`/api/pipeline/${pipelineId}/versions`);
      const data = await response.json();
      
      if (data.success) {
        setVersions(data.versions);
      } else {
        console.error('Chyba při načítání verzí:', data.error);
      }
    } catch (err) {
      console.error('Error fetching versions:', err);
    } finally {
      setVersionsLoading(false);
    }
  };

  // 📦 Vytvoření nové verze
  const createVersion = async () => {
    try {
      const response = await fetch(`/api/pipeline/${pipelineId}/create-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: versionDescription || null })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        fetchVersions(); // Refresh seznam verzí
        setShowCreateVersion(false);
        setVersionDescription('');
      } else {
        alert(`❌ Chyba při vytváření snapshotu: ${data.error}`);
      }
    } catch (err) {
      alert('❌ Chyba při vytváření snapshotu');
      console.error('Error creating version:', err);
    }
  };

  // 🔄 Obnovení verze
  const restoreVersion = async (versionId: string, versionName: string) => {
    if (!confirm(`Opravdu chcete obnovit pipeline na verzi "${versionName}"?\n\nTím se přepíší všechny současné kroky!`)) {
      return;
    }

    try {
      const response = await fetch(`/api/pipeline/${pipelineId}/restore-version/${versionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        fetchPipelineDetail(); // Refresh pipeline detail
      } else {
        alert(`❌ Chyba při obnovování verze: ${data.error}`);
      }
    } catch (err) {
      alert('❌ Chyba při obnovování verze');
      console.error('Error restoring version:', err);
    }
  };

  // 🔄 Spuštění zbývajících kroků
  const resumePipeline = async () => {
    if (!confirm('Spustit zbývající kroky pipeline?')) {
      return;
    }

    try {
      const response = await fetch(`/api/pipeline/${pipelineId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        fetchPipelineDetail(); // Refresh pipeline detail
      } else {
        alert(`❌ ${data.error || 'Nepodařilo se spustit zbývající kroky'}`);
      }
    } catch (err) {
      alert('❌ Chyba při spouštění zbývajících kroků');
      console.error('Error resuming pipeline:', err);
    }
  };

  // 🔄 Spuštění konkrétního kroku
  const runStep = async (stepId: string, stepName: string) => {
    if (!confirm(`Spustit krok "${stepName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/pipeline/${pipelineId}/step/${stepId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        fetchPipelineDetail(); // Refresh pipeline detail
      } else {
        alert(`❌ ${data.error || 'Nepodařilo se spustit krok'}`);
      }
    } catch (err) {
      alert('❌ Chyba při spouštění kroku');
      console.error('Error running step:', err);
    }
  };

  // ✏️ Otevření JSON editoru
  const openJsonEditor = (step: any) => {
    setEditingStep({
      id: step.id,
      name: step.stepName,
      json: step.outputJson
    });
    setEditedJson(JSON.stringify(step.outputJson, null, 2));
    setShowJsonEditor(true);
  };

  // ✏️ Uložení editovaného JSON
  const saveEditedJson = async () => {
    if (!editingStep) return;

    try {
      const parsedJson = JSON.parse(editedJson);
      
      const response = await fetch(`/api/pipeline/${pipelineId}/step/${editingStep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputJson: parsedJson })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        setShowJsonEditor(false);
        setEditingStep(null);
        setEditedJson('');
        fetchPipelineDetail(); // Refresh pipeline detail
      } else {
        alert(`❌ ${data.error || 'Nepodařilo se uložit JSON'}`);
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        alert('❌ Neplatný JSON formát');
        console.error('JSON parse error:', err);
      } else {
        alert('❌ Chyba při ukládání JSON');
        console.error('Error saving JSON:', err);
      }
    }
  };

  // ✏️ Zrušení editace JSON
  const cancelJsonEdit = () => {
    setShowJsonEditor(false);
    setEditingStep(null);
    setEditedJson('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'error': return '❌';
      case 'running': return '🔄';
      case 'pending': return '⏳';
      default: return '⏳';
    }
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

  const handleRestartFromStep = async (stepOrder: number) => {
    try {
      const response = await fetch('/api/pipeline/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId: pipelineId,
          fromOrder: stepOrder
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Pipeline restart spuštěna od kroku ${stepOrder}!\nNový pipeline ID: ${data.new_pipeline_id}`);
        // Redirect na nový pipeline detail
        window.location.href = `/history/${data.new_pipeline_id}`;
      } else {
        alert(`❌ Chyba při restartu: ${data.error}`);
      }
    } catch (err) {
      alert('❌ Chyba při restartu pipeline');
      console.error('Error restarting pipeline:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Načítám detail pipeline...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !pipeline) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">😞</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Chyba při načítání</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link 
              href="/history"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors inline-block"
            >
              ← Zpět na historii
            </Link>
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
              <h1 className="text-3xl font-bold mb-2">📋 Detail Pipeline</h1>
              <p className="text-blue-100">{pipeline.title}</p>
            </div>
            <Link 
              href="/history"
              className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
            >
              ← Zpět na historii
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6">
        {/* Pipeline Overview */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Přehled Pipeline</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pipeline.status)}`}>
              {pipeline.status === 'completed' ? 'Dokončeno' : pipeline.status === 'running' ? 'Běží' : pipeline.status === 'error' ? 'Chyba' : 'Čeká'}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{pipeline.completedSteps}</div>
              <div className="text-sm text-gray-600">Dokončených kroků</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">{pipeline.totalSteps}</div>
              <div className="text-sm text-gray-600">Celkem kroků</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{pipeline.completionPercentage}%</div>
              <div className="text-sm text-gray-600">Dokončeno</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-800 font-semibold">{formatDate(pipeline.createdAt)}</div>
              <div className="text-sm text-gray-600">Vytvořeno</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div 
              className={`h-3 rounded-full ${pipeline.status === 'error' ? 'bg-red-400' : pipeline.status === 'completed' ? 'bg-green-400' : 'bg-blue-400'}`}
              style={{ width: `${pipeline.completionPercentage}%` }}
            ></div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {pipeline.completionPercentage < 100 && (
              <button
                onClick={resumePipeline}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                ▶️ Spustit zbývající ({pipeline.totalSteps - pipeline.completedSteps} kroků)
              </button>
            )}
            
            {pipeline.completionPercentage === 100 && (
              <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-medium">
                🎉 Pipeline dokončena
              </div>
            )}
          </div>
        </div>

        {/* 📦 Pipeline Versions */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">📦 Historie verzí</h2>
            <button
              onClick={() => setShowCreateVersion(!showCreateVersion)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              📦 Vytvořit snapshot
            </button>
          </div>

          {/* Create Version Form */}
          {showCreateVersion && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2">Nový snapshot</h3>
              <input
                type="text"
                placeholder="Volitelný popis snapshotu (např. 'před úpravou timeline')"
                value={versionDescription}
                onChange={(e) => setVersionDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={createVersion}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  ✅ Vytvořit
                </button>
                <button
                  onClick={() => {
                    setShowCreateVersion(false);
                    setVersionDescription('');
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  ❌ Zrušit
                </button>
              </div>
            </div>
          )}

          {/* Versions List */}
          {versionsLoading ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-2">Načítám verze...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-gray-600">Zatím nejsou vytvořené žádné verze</p>
              <p className="text-sm text-gray-500 mt-1">Vytvořte první snapshot pomocí tlačítka výše</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div key={version.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold text-gray-800">{version.versionName}</h4>
                        <span className="text-sm text-gray-500">
                          {version.completedSteps}/{version.totalSteps} kroků ({Math.round((version.completedSteps / version.totalSteps) * 100)}%)
                        </span>
                      </div>
                      {version.description && (
                        <p className="text-sm text-gray-600 mb-1">💬 {version.description}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        📅 {formatDate(version.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => restoreVersion(version.id, version.versionName)}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors ml-4"
                    >
                      🔄 Obnovit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline Steps */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Kroky Pipeline</h2>
          
          {pipeline.steps.map((step) => (
            <div key={step.id} className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <span className="text-2xl">{getStatusIcon(step.status)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Krok {step.order}: {step.stepName}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(step.status)}`}>
                        {step.status === 'completed' ? 'Dokončeno' : step.status === 'error' ? 'Chyba' : step.status === 'running' ? 'Běží' : 'Čeká'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Aktualizováno: {formatDate(step.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {/* Detail tlačítko - vždy viditelné pokud má data */}
                  {(step.outputJson || step.assetUrls || step.errorLogs) && (
                    <button
                      onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                      className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      {expandedStep === step.id ? '🔼 Skrýt' : '🔽 Detail'}
                    </button>
                  )}

                  {/* Tlačítka podle stavu kroku */}
                  {step.status === 'completed' && (
                    <>
                      {/* Editovat JSON - jen pro dokončené kroky s výstupem */}
                      {step.outputJson && (
                        <button
                          onClick={() => openJsonEditor(step)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                          ✏️ Editovat JSON
                        </button>
                      )}
                      {/* Restart - pro dokončené kroky */}
                      <button
                        onClick={() => handleRestartFromStep(step.order)}
                        className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-700 transition-colors"
                      >
                        🔄 Restart
                      </button>
                    </>
                  )}

                  {step.status === 'pending' && (
                    <>
                      {/* Spustit - pro čekající kroky */}
                      <button
                        onClick={() => runStep(step.id, step.stepName)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                      >
                        ▶️ Spustit
                      </button>
                      {/* Restart - pro čekající kroky */}
                      <button
                        onClick={() => handleRestartFromStep(step.order)}
                        className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-700 transition-colors"
                      >
                        🔄 Restart
                      </button>
                    </>
                  )}

                  {step.status === 'error' && (
                    <>
                      {/* Zkusit znovu - pro chybné kroky */}
                      <button
                        onClick={() => runStep(step.id, step.stepName)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                      >
                        🔄 Zkusit znovu
                      </button>
                      {/* Restart - pro chybné kroky */}
                      <button
                        onClick={() => handleRestartFromStep(step.order)}
                        className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-700 transition-colors"
                      >
                        🔄 Restart
                      </button>
                    </>
                  )}

                  {step.status === 'running' && (
                    <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-medium">
                      ⏳ Probíhá...
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedStep === step.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {step.errorLogs && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-red-600 mb-2">❌ Error Log:</h4>
                      <pre className="bg-red-50 text-red-800 p-3 rounded-lg text-sm overflow-auto">
                        {step.errorLogs}
                      </pre>
                    </div>
                  )}

                  {step.assetUrls && step.assetUrls.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-blue-600 mb-2">📁 Asset URLs:</h4>
                      <div className="space-y-1">
                        {step.assetUrls.map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-blue-600 hover:text-blue-800 text-sm"
                          >
                            🔗 {url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {step.outputJson && (
                    <div>
                      <h4 className="font-semibold text-green-600 mb-2">📄 Output JSON:</h4>
                      <pre className="bg-gray-50 text-gray-800 p-3 rounded-lg text-sm overflow-auto max-h-64">
                        {JSON.stringify(step.outputJson, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* 📝 JSON Editor Modal */}
      {showJsonEditor && editingStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">
                ✏️ Editace JSON - {editingStep.name}
              </h2>
              <button
                onClick={cancelJsonEdit}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-hidden">
              <textarea
                value={editedJson}
                onChange={(e) => setEditedJson(e.target.value)}
                className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none"
                placeholder="Zadejte platný JSON..."
                spellCheck={false}
              />
              <p className="text-sm text-gray-600 mt-2">
                💡 Tip: Ujistěte se, že JSON je validní před uložením
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={saveEditedJson}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                💾 Uložit změny
              </button>
              <button
                onClick={cancelJsonEdit}
                className="bg-gray-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-600 transition-colors"
              >
                ❌ Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 