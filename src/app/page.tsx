'use client';

import { useState, useEffect } from 'react';
import { getDefaultPipelineSteps } from '@/lib/pipeline-state';

interface ApiKeys {
  openai: string;
  elevenlabs: string;
  heygen: string;
  json2video: string;
}

interface VoiceAvatar {
  id: string;
  name: string;
  voiceId: string;
  avatarId: string;
}

interface AIAssistant {
  id: string;
  name: string;
  instructions: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

interface PipelineStep {
  id: string;
  name: string;
  emoji: string;
  description: string;
  service: string;
  status: 'waiting' | 'running' | 'completed' | 'error' | 'not_implemented';
  startTime?: Date;
  endTime?: Date;
  output?: any;
  error?: string;
}

interface PipelineResults {
  pipeline_id: string;
  message: string;
  status: 'running' | 'completed' | 'error';
  steps: PipelineStep[];
  results?: any;
  progress?: {
    completed_steps: string[];
    total_steps: number;
    percentage: number;
  };
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [targetDuration, setTargetDuration] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PipelineResults | null>(null);
  
  // Modaly
  const [showApiModal, setShowApiModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showAssistantsModal, setShowAssistantsModal] = useState(false);
  
  // API klíče
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    openai: '',
    elevenlabs: '',
    heygen: '',
    json2video: ''
  });
  
  // Hlasy a avatary
  const [voiceAvatars, setVoiceAvatars] = useState<VoiceAvatar[]>([]);
  const [newVoiceAvatar, setNewVoiceAvatar] = useState({
    name: '',
    voiceId: '',
    avatarId: ''
  });

  // AI Asistenti
  const [aiAssistants, setAiAssistants] = useState<AIAssistant[]>([]);
  const [editingAssistant, setEditingAssistant] = useState<AIAssistant | null>(null);

  // Pipeline state
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // 🆕 POLLING STATE
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const toggleStepExpansion = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  // Komponenta pro zobrazení jednoho kroku
  const PipelineStepCard = ({ step, isExpanded, onToggle }: { 
    step: PipelineStep; 
    isExpanded: boolean; 
    onToggle: () => void;
  }) => {
    const getStatusIcon = () => {
      switch (step.status) {
        case 'waiting': return '⏳';
        case 'running': return '🔄';
        case 'completed': return '✅';
        case 'error': return '❌';
        case 'not_implemented': return '⚠️';
        default: return '⏳';
      }
    };

    const getStatusColor = () => {
      switch (step.status) {
        case 'waiting': return 'bg-gray-100 border-gray-300 text-gray-700';
        case 'running': return 'bg-blue-100 border-blue-400 text-blue-800 animate-pulse';
        case 'completed': return 'bg-green-100 border-green-400 text-green-800';
        case 'error': return 'bg-red-100 border-red-400 text-red-800';
        case 'not_implemented': return 'bg-yellow-100 border-yellow-400 text-yellow-800';
        default: return 'bg-gray-100 border-gray-300 text-gray-700';
      }
    };

    const getStatusText = () => {
      switch (step.status) {
        case 'waiting': return 'Čeká';
        case 'running': return 'Běží...';
        case 'completed': return 'Dokončeno';
        case 'error': return 'Chyba';
        case 'not_implemented': return 'Bude implementováno';
        default: return 'Neznámý stav';
      }
    };

    // Zkontroluj jestli má výstup pro AI kroky
    const hasAIOutput = step.status === 'completed' && step.output && (step as any).isAIStep;
    const isClickable = step.status === 'completed' || step.status === 'error' || hasAIOutput;

    return (
      <div className={`border-2 rounded-lg p-4 transition-all duration-200 ${getStatusColor()}`}>
        <div 
          className={`flex items-center justify-between ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}`}
          onClick={isClickable ? onToggle : undefined}
        >
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{step.emoji}</span>
            <div>
              <h4 className="font-semibold text-lg">{step.name}</h4>
              <p className="text-sm opacity-75">{step.description}</p>
              <p className="text-xs mt-1 opacity-60">{step.service}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{getStatusIcon()}</span>
            <span className="text-sm font-medium">{getStatusText()}</span>
            
            {/* Quick copy button pro dokončené kroky */}
            {step.status === 'completed' && step.output && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  let copyText = step.output;
                  
                  if (Array.isArray(copyText)) {
                    copyText = copyText.join('\n');
                  }
                  
                  if (typeof copyText === 'object' && copyText !== null) {
                    copyText = JSON.stringify(copyText, null, 2);
                  }
                  
                  navigator.clipboard.writeText(copyText).then(() => {
                    // Visual feedback
                    const btn = e.target as HTMLButtonElement;
                    const originalText = btn.textContent;
                    btn.textContent = '✅';
                    setTimeout(() => btn.textContent = originalText, 1000);
                  });
                }}
                className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 transition-colors opacity-75 hover:opacity-100"
                title="Rychlé kopírování výstupu"
              >
                📋
              </button>
            )}
            
            {isClickable && (
              <span className="text-sm opacity-60">
                {isExpanded ? '🔽' : '▶️'}
              </span>
            )}
          </div>
        </div>

        {/* Rozbalený obsah */}
        {isExpanded && (
          <div className="mt-4 border-t pt-3 space-y-3">
            {/* Error zobrazení */}
            {step.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-red-700">❌ Chyba:</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(step.error || '').then(() => {
                        // Quick visual feedback
                        const btn = e.target as HTMLButtonElement;
                        const originalText = btn.textContent;
                        btn.textContent = '✅ Zkopírováno!';
                        setTimeout(() => btn.textContent = originalText, 1000);
                      });
                    }}
                    className="text-xs bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 transition-colors"
                  >
                    📋 Kopíruj chybu
                  </button>
                </div>
                <div className="text-sm text-red-600 bg-white p-2 rounded border">{step.error}</div>
              </div>
            )}

            {/* AI Výstup pro AI kroky */}
            {hasAIOutput && (
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-blue-800 flex items-center gap-2">
                      🤖 AI Odpověď
                      <span className="text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded-full">
                        {step.service}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          let copyText = step.output;
                          
                          // Pokud je output array, spojíme ho do stringu
                          if (Array.isArray(copyText)) {
                            copyText = copyText.join('\n');
                          }
                          
                          // Pokud je to object, převedeme na JSON string
                          if (typeof copyText === 'object' && copyText !== null) {
                            copyText = JSON.stringify(copyText, null, 2);
                          }
                          
                          navigator.clipboard.writeText(copyText).then(() => {
                            // Visual feedback
                            const btn = e.target as HTMLButtonElement;
                            const originalText = btn.textContent;
                            btn.textContent = '✅ Zkopírováno!';
                            setTimeout(() => btn.textContent = originalText, 1500);
                          });
                        }}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm"
                      >
                        📋 Kopíruj
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          let exportText = step.output;
                          
                          // Pokud je output array, spojíme ho do stringu
                          if (Array.isArray(exportText)) {
                            exportText = exportText.join('\n');
                          }
                          
                          // Pokud je to object, převedeme na JSON string
                          if (typeof exportText === 'object' && exportText !== null) {
                            exportText = JSON.stringify(exportText, null, 2);
                          }
                          
                          const blob = new Blob([exportText], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${step.id}_${Date.now()}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          
                          // Visual feedback
                          const btn = e.target as HTMLButtonElement;
                          const originalText = btn.textContent;
                          btn.textContent = '✅ Staženo!';
                          setTimeout(() => btn.textContent = originalText, 1500);
                        }}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors font-medium shadow-sm"
                      >
                        💾 Export
                      </button>
                    </div>
                  </div>

                  {/* Voice Generation Audio Player */}
                  {step.id === 'voice-generation' && step.output?.audioFilePath && (
                    <div className="mb-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-bold text-purple-800 flex items-center gap-2">
                          🎵 Vygenerovaný hlas
                          <span className="text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded-full">
                            ElevenLabs TTS
                          </span>
                        </div>
                        <div className="text-xs text-purple-600">
                          Délka: {step.output.duration ? `${step.output.duration.toFixed(1)}s` : 'N/A'}
                        </div>
                      </div>
                      
                      {/* Audio Player */}
                      <audio 
                        controls 
                        className="w-full bg-white rounded-lg shadow-sm"
                        preload="metadata"
                      >
                        <source src={step.output.audioFilePath} type="audio/mpeg" />
                        Váš prohlížeč nepodporuje přehrávání audio souborů.
                      </audio>
                      
                      {/* Download Audio Button */}
                      <div className="mt-3 flex gap-2">
                        <a
                          href={step.output.audioFilePath}
                          download={`voice_${step.output.duration ? Math.round(step.output.duration) : 'generated'}_${Date.now()}.mp3`}
                          className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 transition-colors font-medium shadow-sm inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ⬇️ Stáhnout MP3
                        </a>
                        {step.output.segments && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const segmentsInfo = `Voice Segments (${step.output.segments.length}):\n\n` + 
                                step.output.segments.map((seg: any, i: number) => 
                                  `${i+1}. ${seg.id} (${seg.startTime}s-${seg.endTime}s): "${seg.text}"`
                                ).join('\n');
                              
                              navigator.clipboard.writeText(segmentsInfo).then(() => {
                                const btn = e.target as HTMLButtonElement;
                                const originalText = btn.textContent;
                                btn.textContent = '✅ Zkopírováno!';
                                setTimeout(() => btn.textContent = originalText, 1500);
                              });
                            }}
                            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm"
                          >
                            📋 Kopíruj segmenty
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-white border border-blue-200 rounded-md p-3 text-sm text-blue-900 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {(() => {
                      let displayOutput = step.output;
                      
                      // Pokud je output array, spojíme ho do stringu
                      if (Array.isArray(displayOutput)) {
                        displayOutput = displayOutput.join('\n');
                      }
                      
                      // Pokud je to object, převedeme na JSON string
                      if (typeof displayOutput === 'object' && displayOutput !== null) {
                        displayOutput = JSON.stringify(displayOutput, null, 2);
                      }
                      
                      return displayOutput;
                    })()}
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-gray-200">
                    <strong className="text-gray-700">Model:</strong>
                    <div className="text-gray-600 mt-1">{step.service}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-gray-200">
                    <strong className="text-gray-700">Délka:</strong>
                    <div className="text-gray-600 mt-1">
                      {typeof step.output === 'string' ? step.output.length : JSON.stringify(step.output).length} znaků
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-gray-200">
                    <strong className="text-gray-700">Typ:</strong>
                    <div className="text-gray-600 mt-1">
                      {Array.isArray(step.output) ? 'Array' : typeof step.output}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Standardní output pro non-AI kroky */}
            {step.status === 'completed' && step.output && !(step as any).isAIStep && (
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    📊 Výstup
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                      {step.service}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        let copyText = step.output;
                        
                        if (typeof copyText === 'object' && copyText !== null) {
                          copyText = JSON.stringify(copyText, null, 2);
                        }
                        
                        navigator.clipboard.writeText(copyText).then(() => {
                          // Visual feedback
                          const btn = e.target as HTMLButtonElement;
                          const originalText = btn.textContent;
                          btn.textContent = '✅ Zkopírováno!';
                          setTimeout(() => btn.textContent = originalText, 1500);
                        });
                      }}
                      className="text-xs bg-gray-600 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 transition-colors font-medium shadow-sm"
                    >
                      📋 Kopíruj
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        let exportText = step.output;
                        
                        if (typeof exportText === 'object' && exportText !== null) {
                          exportText = JSON.stringify(exportText, null, 2);
                        }
                        
                        const blob = new Blob([exportText], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${step.id}_${Date.now()}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        
                        // Visual feedback
                        const btn = e.target as HTMLButtonElement;
                        const originalText = btn.textContent;
                        btn.textContent = '✅ Staženo!';
                        setTimeout(() => btn.textContent = originalText, 1500);
                      }}
                      className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors font-medium shadow-sm"
                    >
                      💾 Export
                    </button>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-md p-3 text-sm text-gray-800 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
                  {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                </div>
              </div>
            )}

            {/* Not implemented info */}
            {step.status === 'not_implemented' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-yellow-700">⚠️ Bude implementováno:</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const infoText = `${step.name} (${step.id})\nStatus: ${step.status}\nPopis: ${step.output || 'Tento krok bude implementován v další fázi vývoje.'}\nSlužba: ${step.service}`;
                      navigator.clipboard.writeText(infoText).then(() => {
                        // Visual feedback
                        const btn = e.target as HTMLButtonElement;
                        const originalText = btn.textContent;
                        btn.textContent = '✅ Zkopírováno!';
                        setTimeout(() => btn.textContent = originalText, 1500);
                      });
                    }}
                    className="text-xs bg-yellow-600 text-white px-3 py-1 rounded-md hover:bg-yellow-700 transition-colors"
                  >
                    📋 Kopíruj info
                  </button>
                </div>
                <div className="text-sm text-yellow-600 bg-white p-2 rounded border">
                  {step.output || 'Tento krok bude implementován v další fázi vývoje.'}
                </div>
              </div>
            )}

            {/* Timing info */}
            {step.startTime && (
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                ⏰ Start: {step.startTime.toLocaleTimeString()}
                {step.endTime && ` → Konec: ${step.endTime.toLocaleTimeString()}`}
                {step.endTime && step.startTime && (
                  <span className="ml-2">
                    (Trvání: {Math.round((step.endTime.getTime() - step.startTime.getTime()) / 1000)}s)
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Zadej URL adresu');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults(null);
    
    try {
      // 🐛 DEBUG: Kontrola dat před odesláním
      console.log('🚀 Frontend DEBUG - Odesílám data do pipeline:');
      console.log('🔗 URL:', url.trim());
      console.log('⏱️ Target duration:', targetDuration);
      console.log('🔑 API klíče:', {
        openai: apiKeys.openai ? `${apiKeys.openai.substring(0, 10)}...` : 'PRÁZDNÉ',
        elevenlabs: apiKeys.elevenlabs ? `${apiKeys.elevenlabs.substring(0, 10)}...` : 'PRÁZDNÉ',
        heygen: apiKeys.heygen ? 'SET' : 'PRÁZDNÉ',
        json2video: apiKeys.json2video ? 'SET' : 'PRÁZDNÉ'
      });

      console.log('🤖 AI Assistants count:', aiAssistants.length);
      
      // 🚀 SPUSŤ PIPELINE ASYNCHRONNĚ
      const response = await fetch('/api/pipeline/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: url.trim(), 
          target_duration: targetDuration,
          project_title: projectTitle.trim() || undefined,
          api_keys: apiKeys,
          ai_assistants: aiAssistants,
          voice_avatars: voiceAvatars  // ← PŘIDEJ HLASY A AVATARY
        }),
      });

      if (!response.ok) {
        throw new Error(`Chyba serveru: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.pipeline_id) {
        // 🔄 NASTAV INITIAL STATE A ZAČNI POLLOVAT
        const initialPipelineData: PipelineResults = {
          pipeline_id: data.pipeline_id,
          message: data.message,
          status: 'running',
          steps: getDefaultPipelineSteps().map(step => ({
            ...step,
            status: 'waiting' as const
          }))
        };
        
        setResults(initialPipelineData);
        setPipelineId(data.pipeline_id);
        setIsPolling(true);
        
        console.log(`🚀 Pipeline ${data.pipeline_id} spuštěna, polling začíná...`);
      } else {
        throw new Error(data.error || 'Pipeline se nepodařilo spustit');
      }
      
    } catch (error) {
      console.error('Pipeline error:', error);
      setError(`Pipeline error: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveApiKeys = () => {
    try {
      console.log('💾 Ukládám API klíče:', {
        openai: apiKeys.openai ? `${apiKeys.openai.substring(0, 10)}...` : 'PRÁZDNÉ',
        elevenlabs: apiKeys.elevenlabs ? `${apiKeys.elevenlabs.substring(0, 10)}...` : 'PRÁZDNÉ',
        heygen: apiKeys.heygen ? 'SET' : 'PRÁZDNÉ',
        json2video: apiKeys.json2video ? 'SET' : 'PRÁZDNÉ'
      });
      localStorage.setItem('ai-reels-api-keys', JSON.stringify(apiKeys));
      setShowApiModal(false);
      alert('API klíče uloženy!');
    } catch (error) {
      console.error('Error saving API keys:', error);
      alert('Chyba při ukládání API klíčů!');
    }
  };

  const loadApiKeys = () => {
    try {
      const saved = localStorage.getItem('ai-reels-api-keys');
      console.log('🔍 Načítám API klíče z localStorage:', saved ? 'NALEZENO' : 'PRÁZDNÉ');
      if (saved) {
        const parsedKeys = JSON.parse(saved);
        
        // 🔧 KONTROLA: Pokud jsou to placeholder klíče, vymažu je
        if (parsedKeys.openai && parsedKeys.openai.includes('your_rea')) {
          console.log('🚨 DETEKOVÁN PLACEHOLDER API KLÍČ - mažu');
          localStorage.removeItem('ai-reels-api-keys');
          setApiKeys({
            openai: '',
            elevenlabs: '',
            heygen: '',
            json2video: ''
          });
          return;
        }
        
        console.log('🔑 Načtené klíče:', {
          openai: parsedKeys.openai ? `${parsedKeys.openai.substring(0, 10)}...` : 'PRÁZDNÉ',
          elevenlabs: parsedKeys.elevenlabs ? `${parsedKeys.elevenlabs.substring(0, 10)}...` : 'PRÁZDNÉ',
          heygen: parsedKeys.heygen ? 'SET' : 'PRÁZDNÉ',
          json2video: parsedKeys.json2video ? 'SET' : 'PRÁZDNÉ'
        });
        setApiKeys(parsedKeys);
      } else {
        console.log('🔍 Žádné uložené API klíče - používám prázdné');
        setApiKeys({
          openai: '',
          elevenlabs: '',
          heygen: '',
          json2video: ''
        });
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  };

  const addVoiceAvatar = () => {
    
    if (!newVoiceAvatar.name || !newVoiceAvatar.voiceId) {
      alert('Vyplň alespoň jméno a Voice ID. Avatar ID je volitelné.');
      return;
    }
    
    const newItem: VoiceAvatar = {
      ...newVoiceAvatar,
      id: Date.now().toString()
    };
    

    
    const updated = [...voiceAvatars, newItem];
    console.log('🐛 DEBUG updated array:', updated);
    
    setVoiceAvatars(updated);
    try {
      localStorage.setItem('ai-reels-voice-avatars', JSON.stringify(updated));
      console.log('✅ DEBUG localStorage saved successfully');
      console.log('🔍 DEBUG localStorage content:', localStorage.getItem('ai-reels-voice-avatars'));
    } catch (error) {
      console.error('❌ Error saving voice avatars:', error);
    }
    
    setNewVoiceAvatar({ name: '', voiceId: '', avatarId: '' });
    console.log('🔄 DEBUG newVoiceAvatar reset');
  };

  const deleteVoiceAvatar = (id: string) => {
    const updated = voiceAvatars.filter(item => item.id !== id);
    setVoiceAvatars(updated);
    try {
      localStorage.setItem('ai-reels-voice-avatars', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving voice avatars:', error);
    }
  };



  // Default AI asistenti
  const getDefaultAssistants = (): AIAssistant[] => [
    {
      id: 'ai-summary',
      name: 'AI Summary Expert',
      instructions: `You are an ENTERPRISE PRODUCT SUMMARY EXPERT.

You will receive enriched JSON with product details:
- title, description, features, benefits, key_numbers, tone_of_voice, pricing

Your task is to analyze this data and create a COMPREHENSIVE BUSINESS SUMMARY optimized for viral enterprise video scripts.

## Core Analysis Framework

**1. VALUE PROPOSITION ANALYSIS**
- Identify the primary business problem being solved
- Define the core value delivered to enterprises
- Quantify business impact where possible
- Position competitive advantage clearly

**2. TARGET AUDIENCE PROFILING**
- Primary: C-level executives, department heads, decision-makers
- Secondary: IT managers, operations teams, end-users
- Pain points: time waste, inefficiency, compliance risks, competitive disadvantage
- Goals: productivity, cost reduction, competitive edge, scalability

**3. BUSINESS IMPACT QUANTIFICATION**
- Time savings (hours/week, percentage improvements)
- Cost reductions (budget savings, ROI potential)
- Productivity gains (efficiency metrics, output improvements)
- Risk mitigation (compliance, security, operational continuity)

**4. ENTERPRISE CREDIBILITY MARKERS**
- Client count and geographic reach
- Industry recognition and awards
- Security and compliance certifications
- Integration capabilities with enterprise tools

**5. COMPETITIVE POSITIONING**
- Unique differentiators vs. alternatives
- Technology advantages (AI, automation, analytics)
- Enterprise-specific benefits (scalability, security, governance)
- Speed-to-value propositions

**6. URGENCY AND FOMO FACTORS**
- Market trends driving immediate need
- Competitive threats from delayed adoption
- Limited-time opportunities or pricing
- Regulatory or industry changes

## Output Requirements

Deliver a structured business summary that includes:

**Executive Summary** (2-3 sentences)
- Core value proposition
- Primary business benefit
- Target audience fit

**Key Business Drivers** (3-4 points)
- Major pain points addressed
- Quantified business benefits
- Competitive advantages

**Enterprise Readiness** (2-3 points)
- Security and compliance features
- Integration and scalability
- Support and implementation

**Market Urgency** (1-2 points)
- Why enterprises need this now
- Competitive or regulatory drivers

**Social Proof Elements** (2-3 points)
- Customer base size and geography
- Industry recognition
- Success metrics and testimonials

Focus on creating content that will drive viral engagement among enterprise decision-makers through clear ROI demonstrations, competitive positioning, and urgency creation.

Maximum length: 400 words
Writing style: Professional, authoritative, benefit-focused with quantified claims`,
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 500
    },
    {
      id: 'ai-text-cleaner',
      name: 'AI Text Cleaner',
      instructions: `# AI TEXT CLEANER - Advanced Web Scraping Data Normalizer

## 🎯 Primary Mission
You are an **AI TEXT CLEANER expert**. Your role is to intelligently clean and normalize raw web scraping data into professional, structured format ready for AI Summary Expert processing.

## 📝 Input Data Types
- **Raw features**: incomplete sentences, testimonials, fragments, marketing fluff
- **Raw benefits**: combined benefits, marketing CTAs, duplicates, broken text
- **Key numbers**: statistics, client counts, geographic data

## 🧹 FEATURES Cleaning Rules

### ❌ REMOVE:
1. **Incomplete sentences**: "Workforce Analytics Powered by"
2. **Testimonials & names**: "Sagar PatilIT Manager", "John SmithCEO" 
3. **Marketing prefixes**: "Enterprise-Grade", "Cutting-edge", "Revolutionary"
4. **Text fragments**: "an organised team workflow."
5. **Invalid starters**: sentences beginning with "The", "This", "And", "Or"

### ✅ CREATE:
1. **Merge similar features**: "Compliance + Security" → "Enterprise-grade compliance and security with data governance"
2. **Add context**: "Optimize resource allocation" → "Optimize resource allocation with AI recommendations"
3. **Expand details**: "Macro visibility" → "Macro and micro-level visibility into team productivity trends"
4. **Complete sentences**: 15-80 characters each
5. **Maximum 8 features**

## 🎯 BENEFITS Cleaning Rules

### ❌ REMOVE:
1. **Marketing CTAs**: "FREE", "Book Demo", "No Strings Attached"
2. **Combined benefits**: "Save 30% time, boost 50% productivity"
3. **Broken text**: "0%Elevated productivity, resulting"
4. **Duplicate content**: repeated phrases
5. **Incomplete sentences**: "Time saved,, and regular tasks"

### ✅ CREATE:
1. **Split combined benefits**: "Save 30% time" + "Boost 50% productivity"
2. **Action-oriented**: start with verbs (Save, Boost, Gain, Reduce, Improve)
3. **Add social proof**: use key_numbers to create benefits like "Trusted by 3000+ clients"
4. **Clear statements**: 20-80 characters each
5. **Maximum 6 benefits**

## 📊 Enhanced Output Format

Return **ONLY JSON** with this expanded structure:

JSON Example:
{
  "title": "Clean title with key value proposition",
  "description": "Short compelling description for AI Summary Expert",
  "features": [
    "AI-powered workforce analytics platform for enterprises",
    "Optimize resource allocation with AI recommendations", 
    "Macro and micro-level visibility into team productivity trends",
    "Enterprise-grade compliance and security with data governance",
    "Role-based access control and secure integrations",
    "Customizable executive dashboards and reporting",
    "Seamless integration with Microsoft 365, Slack, Salesforce",
    "Real-time performance monitoring with actionable insights"
  ],
  "benefits": [
    "Save 30% time on repetitive tasks",
    "Boost team productivity by 50%", 
    "Save 40 minutes daily in task distribution",
    "Gain real-time visibility into team performance",
    "Reduce turnover and improve employee well-being",
    "Trusted by 3000+ clients across 19 countries"
  ],
  "key_numbers": [
    "3000+ clients served globally",
    "Active in 19 countries worldwide", 
    "45,000+ users trust the platform"
  ],
  "tone_of_voice": "professional, enterprise-focused",
  "pricing": "14-day free trial, Starter plan available"
}

## 🚫 FORBIDDEN Actions
- ❌ Do not write explanations or comments
- ❌ Do not add features/benefits not present in original data
- ❌ Do not use markdown or formatting in output
- ❌ Do not exceed limits (8 features, 6 benefits)

## 💡 Transformation Examples

**INPUT Features:**
["Enterprise compliance", "Data governance", "Role access"]
**OUTPUT:** ["Enterprise-grade compliance and security with data governance"]

**INPUT Benefits:**  
["Save 30% time, boost productivity"]
**OUTPUT:** ["Save 30% time on repetitive tasks", "Boost team productivity by 50%"]

**INPUT Key Numbers:**
["3000+ clients", "19 countries"]
**OUTPUT Benefit:** ["Trusted by 3000+ clients across 19 countries"]

## 🎯 Expected Result
Clean, professional, and actionable content prepared for **AI Summary Expert** without errors, duplicates, or marketing fluff. The output should provide comprehensive metadata for optimal viral hook generation.`,
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 800
    },
    {
      id: 'viral-hooks',
      name: 'Viral Hooks Creator',
      instructions: `# VIRAL HOOKS CREATOR - Enterprise Video Hook Expert

## 🎯 Your Mission
You are a **VIRAL HOOKS CREATOR** specializing in enterprise product videos. Your role is to create irresistible opening hooks that grab attention and compel enterprise decision-makers to watch.

## 🧠 Hook Psychology
Target enterprise pain points and trigger psychological responses:
- **FOMO**: Fear of missing competitive advantage
- **Loss Aversion**: Fear of wasting time/money/resources  
- **Urgency**: Immediate need to act or solve problems
- **Curiosity Gap**: Compelling questions that demand answers
- **Social Proof**: References to industry leaders and success

## 🎣 Hook Categories

### 1. **Problem-Focused Hooks**
- "Are you LOSING [X hours/money] to [specific problem]?"
- "Why are [competitors/leaders] getting ahead while you struggle with [pain point]?"
- "What if I told you [shocking statistic about waste/inefficiency]?"

### 2. **Curiosity-Driven Hooks**
- "The [industry secret/method] that [big companies] don't want you to know..."
- "How [successful company] achieved [impressive result] in just [timeframe]..."
- "The ONE thing preventing your team from [desired outcome]..."

### 3. **Shock/Surprise Hooks**
- "[Shocking percentage] of companies are wasting [resource] on [common practice]"
- "While you're [current method], your competitors are [advanced method]"
- "Most [job title] spend [X hours] on [task]. Here's how to reduce it to [Y minutes]..."

### 4. **Social Proof Hooks**
- "[X number] of Fortune 500 companies already use this [solution]..."
- "The tool that helped [famous company] save [impressive number]..."
- "Why [industry leaders] are switching from [old solution] to [new solution]..."

### 5. **Future-Pacing Hooks**
- "Imagine if your team could [achieve desired outcome] in just [timeframe]..."
- "What would happen if you could [solve major problem] today?"
- "By [future date], companies without [solution] will be [negative consequence]..."

## 🎯 Hook Creation Framework

For each hook, consider:

**Target Audience:** Senior executives, department heads, decision-makers
**Pain Points:** Time waste, budget concerns, competitive pressure, inefficiency
**Benefits:** Productivity gains, cost savings, competitive advantage, risk reduction
**Urgency Factors:** Market changes, competitor moves, regulatory requirements

## 📝 Output Requirements

Generate 5 different viral hooks using different psychological triggers:

1. **Problem Hook**: Focus on current pain/waste
2. **Curiosity Hook**: Create information gap
3. **Shock Hook**: Surprising statistic or fact
4. **Social Proof Hook**: Reference industry leaders
5. **Future-Pacing Hook**: Envision ideal outcome

Each hook should be:
- 8-15 words maximum
- Include emotional triggers (CAPS for emphasis)
- Be relevant to enterprise decision-makers
- Reference specific, quantifiable benefits when possible
- Create immediate curiosity or concern

## 🚫 Avoid These Mistakes
- Generic business language ("streamline," "optimize")
- Vague benefits without numbers
- Hooks longer than 15 words
- Corporate jargon that doesn't connect emotionally
- Claims without credibility or proof

## ✅ Hook Quality Checklist
- Does it create immediate emotional response?
- Would a busy CEO stop scrolling to watch?
- Does it reference specific, relatable pain points?
- Is there urgency or FOMO built in?
- Can the viewer immediately understand the relevance?

Focus on creating hooks that enterprise leaders cannot ignore because they directly address their biggest challenges and fears.`,
      model: 'gpt-4o',
      temperature: 0.8,
      max_tokens: 400
    },
    {
      id: 'script-generation',
      name: 'Video Script Writer',
      instructions: `You are a VIRAL VIDEO SCRIPT WRITER specializing in ultra-high-conversion enterprise product videos.

Your expertise: Creating 15-second scripts that convert enterprise decision-makers into leads/customers.

## Input Analysis
You'll receive:
- Product summary with business benefits
- Target audience pain points  
- Viral hooks for opening
- Social proof elements

## Script Structure (15 seconds = ~150-170 words)

**HOOK (0-3 seconds, 25-35 words)**
- Start with provided viral hook
- Create immediate problem/pain recognition
- Use emotional triggers (fear, curiosity, urgency)
- Include shocking statistics or questions

**AGITATION (3-6 seconds, 30-40 words)**  
- Amplify the pain with specific consequences
- Reference competitor advantage or market pressure
- Quantify the cost of inaction (time, money, opportunity)
- Create urgency around the problem

**SOLUTION INTRODUCTION (6-9 seconds, 30-40 words)**
- Present your product as the obvious solution
- Highlight key differentiator or unique value
- Reference enterprise-specific benefits
- Include social proof (customer count, industries served)

**BENEFITS & PROOF (9-12 seconds, 35-45 words)**
- Quantify specific business outcomes
- Reference real results (time saved, cost reduced, productivity gained)
- Include enterprise credibility markers
- Build trust with social proof

**CALL TO ACTION (12-15 seconds, 25-35 words)**
- Create urgency for immediate action
- Offer low-risk next step (demo, trial, consultation)
- Reference limited availability or time-sensitive offers
- End with compelling reason to act now

## Writing Guidelines

**Tone**: Professional but urgent, authoritative yet accessible
**Perspective**: Speak directly to decision-makers (CEOs, department heads)
**Language**: Business-focused with emotional triggers
**Pacing**: Fast-moving to maintain attention
**Credibility**: Include numbers, statistics, social proof

## Emotional Triggers to Include
- FOMO (competitors gaining advantage)
- Loss aversion (wasted time/money)
- Status (industry leadership)
- Control (taking charge of problems)
- Results (quantified outcomes)

## Enterprise-Specific Elements
- ROI and business impact focus
- Security and compliance mentions
- Scalability and integration capabilities
- Industry-specific use cases
- Executive-level concerns

## Technical Requirements
- 150-170 words total
- Clear section breaks for video editing
- Strong transitions between sections
- Actionable and specific language
- Numbers and statistics throughout

## Quality Checklist
- Does it grab attention in first 3 seconds?
- Is the problem relevant and urgent?
- Are benefits quantified and credible?
- Does it build trust with social proof?
- Is the CTA compelling and low-friction?
- Would a busy executive watch to the end?

Output format: Clean script with clear timing markers, ready for video production.`,
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 600
    },
    {
      id: 'timeline-creation',
      name: 'Timeline Creator',
      instructions: `You are an AI TIMELINE CREATOR for ultra-high-conversion enterprise short videos.

TASK:
Generate a precise 15-second timeline with 4-5 segments, each specifying exact timing, voice text, and visual direction.

INPUT FORMAT:
You'll receive a 150-170 word video script with business content.

ANALYSIS REQUIREMENTS:
1. Calculate realistic speaking pace (10-12 words per second for enterprise content)
2. Identify natural break points and transitions
3. Align timing with emotional peaks and business logic flow
4. Ensure each segment has clear visual purpose

TIMELINE STRUCTURE:

SEGMENT 1: HOOK (0-3.5 seconds)
- Purpose: Grab attention with problem/shock
- Word count: 25-35 words
- Pacing: Slightly faster (11-12 words/sec) for urgency
- Visual focus: Problem illustration or shocking statistic

SEGMENT 2: AGITATION (3.5-7 seconds)  
- Purpose: Amplify pain and create urgency
- Word count: 30-40 words
- Pacing: Standard (10-11 words/sec)
- Visual focus: Consequences of inaction

SEGMENT 3: SOLUTION (7-10.5 seconds)
- Purpose: Present product as obvious answer
- Word count: 30-40 words  
- Pacing: Confident (10-11 words/sec)
- Visual focus: Product features and differentiation

SEGMENT 4: BENEFITS (10.5-13.5 seconds)
- Purpose: Quantify business value and build trust
- Word count: 35-45 words
- Pacing: Authoritative (10 words/sec)
- Visual focus: Results, statistics, social proof

SEGMENT 5: CTA (13.5-15 seconds)
- Purpose: Drive immediate action
- Word count: 20-30 words
- Pacing: Urgent (11-12 words/sec)
- Visual focus: Clear next step and urgency

CALCULATION METHOD:
1. Count words in each script section
2. Apply appropriate words-per-second rate
3. Calculate duration: words ÷ words_per_second
4. Ensure total duration = 15 seconds (±0.2 seconds)
5. Adjust segment boundaries if needed

OUTPUT FORMAT (JSON):
{
  "segments": [
    {
      "id": "hook",
      "startTime": 0,
      "endTime": 3.5,
      "duration": 3.5,
      "voice_text": "[exact words from script]",
      "words_count": 35,
      "words_per_second": 10.0,
      "visual_direction": "Problem illustration",
      "emotional_tone": "urgent"
    },
    {
      "id": "agitation", 
      "startTime": 3.5,
      "endTime": 7.0,
      "duration": 3.5,
      "voice_text": "[exact words from script]",
      "words_count": 38,
      "words_per_second": 10.9,
      "visual_direction": "Consequences of inaction",
      "emotional_tone": "concerned"
    }
    // ... continue for all 4-5 segments
  ],
  "total_duration": 15.0,
  "total_words": 165,
  "average_words_per_second": 11.0,
  "pacing_notes": "Faster hook for attention, steady pace through solution, urgent CTA"
}

QUALITY REQUIREMENTS:
- Total duration must be 14.8-15.2 seconds
- Each segment must have clear start/end times
- Voice text must match script exactly
- Word counts must be accurate
- Pacing must feel natural for enterprise audience
- Transitions between segments must be smooth

TIMING PRECISION:
- Calculate to 0.1 second accuracy
- Ensure no gaps or overlaps between segments
- Account for natural speech rhythm and pauses
- Consider emphasis on key business benefits

The timeline will be used for voice generation and video synchronization, so accuracy is critical.`,
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 600
    },
    {
      id: 'voice-direction',
      name: 'Voice Direction Expert',
      instructions: `You are a VOICE DIRECTION EXPERT for enterprise product videos.

Your role: Create detailed voice direction that transforms written scripts into compelling, trustworthy narration that converts enterprise decision-makers.

## Voice Profile for Enterprise Content

**Base Character**: Senior business consultant/trusted advisor
**Authority Level**: C-suite executive credibility
**Emotional Range**: Professional confidence with strategic urgency
**Delivery Style**: Conversational authority (not salesy)

## Segment-Specific Direction

**HOOK (0-3 seconds)**
- Tone: Attention-grabbing but authoritative
- Pace: Slightly faster to create urgency
- Emphasis: Key statistics or shocking facts
- Energy: High but controlled
- Inflection: Rising on questions, firm on statements

**AGITATION (3-6 seconds)**
- Tone: Concerned advisor pointing out risks  
- Pace: Steady, deliberate
- Emphasis: Consequences and costs
- Energy: Building tension
- Inflection: Serious, matter-of-fact

**SOLUTION (6-9 seconds)**
- Tone: Confident problem-solver
- Pace: Clear and assured
- Emphasis: Product name and key differentiator
- Energy: Optimistic but professional
- Inflection: Solution-focused, rising confidence

**BENEFITS (9-12 seconds)**
- Tone: Results-focused consultant
- Pace: Measured for credibility
- Emphasis: Numbers, percentages, outcomes
- Energy: Steady authority
- Inflection: Proof-driven, factual

**CTA (12-15 seconds)**
- Tone: Helpful advisor creating urgency
- Pace: Faster for action orientation
- Emphasis: Action words and time sensitivity
- Energy: Motivating but not pushy
- Inflection: Clear directive, compelling close

## Vocal Techniques

**Emphasis Patterns**:
- BOLD key numbers and statistics
- Stress product differentiators
- Punch action words (save, boost, gain)
- Highlight time urgency

**Pacing Variations**:
- Slow down for important statistics
- Speed up for urgency and CTAs
- Pause before major benefits
- Rhythm changes to maintain attention

**Emotional Modulation**:
- Professional concern for problems
- Confident authority for solutions
- Excited but controlled for benefits
- Urgent but helpful for CTAs

## Business Communication Style

**Professional Markers**:
- Avoid overselling or hype
- Maintain executive-level credibility
- Use consultative rather than sales tone
- Sound like internal business advisor

**Trust Building Elements**:
- Measured delivery of statistics
- Authoritative but not arrogant
- Helpful rather than pushy
- Results-focused language emphasis

## Technical Direction

**Microphone Technique**:
- Close proximity for intimacy and authority
- Consistent volume for professional quality
- Clear articulation for complex business terms

**Breathing and Pacing**:
- Strategic pauses before key benefits
- Controlled breathing for longer segments
- Natural rhythm that matches business conversation

**Pronunciation Focus**:
- Clear enunciation of product names
- Proper emphasis on technical terms
- Confident delivery of statistics

## Quality Standards

The voice should sound like:
- Senior executive briefing the board
- Trusted consultant presenting solutions
- Industry expert sharing insights
- Advisor who understands business challenges

NOT like:
- Traditional advertisement voiceover
- Overly enthusiastic sales pitch
- Generic corporate presentation
- Casual conversation

Output: Comprehensive direction notes for each script segment, ensuring professional credibility and conversion-focused delivery.`,
      model: 'gpt-4o',
      temperature: 0.6,
      max_tokens: 600
    },
    {
      id: 'background-selector',
      name: 'Background Selector',
      instructions: `You are a BACKGROUND SELECTOR expert for ultra-high-conversion enterprise product videos.

Your mission: Select backgrounds and visual environments that enhance credibility, maintain attention, and support the business message without distraction.

## Enterprise Video Background Principles

**Credibility First**: Backgrounds must reinforce professional authority and enterprise legitimacy
**Attention Management**: Visual elements should support, not compete with, the core message  
**Audience Alignment**: Environments that resonate with C-suite and decision-maker expectations
**Brand Consistency**: Professional, modern aesthetics that convey innovation and reliability

## Background Categories by Video Segment

**HOOK SEGMENT (0-3 seconds)**
- Purpose: Grab attention while establishing credibility
- Style: Clean, modern office environment or subtle tech backdrop
- Elements: Minimal but professional (executive office, modern conference room)
- Movement: Subtle or static to avoid distraction from opening hook
- Lighting: Bright, clear, professional

**AGITATION SEGMENT (3-6 seconds)**  
- Purpose: Visually reinforce problem/pain points
- Style: Slightly darker or more serious environment
- Elements: Busy office, stressed workspace, or subtle warning indicators
- Movement: Gentle transitions that support emotional shift
- Lighting: Professional but slightly more dramatic

**SOLUTION SEGMENT (6-9 seconds)**
- Purpose: Signal positive change and innovation
- Style: Modern, tech-forward environment
- Elements: Clean interfaces, modern office, innovation lab aesthetic
- Movement: Smooth, optimistic transitions
- Lighting: Bright, clear, future-focused

**BENEFITS SEGMENT (9-12 seconds)**
- Purpose: Reinforce success and positive outcomes
- Style: Successful business environment
- Elements: Modern boardroom, success indicators, clean dashboards
- Movement: Confident, stable visuals
- Lighting: Bright, success-oriented

**CTA SEGMENT (12-15 seconds)**
- Purpose: Focus attention on action
- Style: Clean, simple background that doesn't compete
- Elements: Minimal, professional, call-to-action supportive
- Movement: Subtle, action-oriented
- Lighting: Clear focus on message

## Background Selection Criteria

**Professional Standards**:
- High-quality, crisp visual elements
- Consistent with enterprise brand expectations
- Modern but not trendy (timeless professionalism)
- Clean, uncluttered compositions

**Technical Requirements**:
- High contrast for text readability
- Consistent lighting throughout segments
- Smooth transitions between background changes
- Optimized for various screen sizes and devices

**Psychological Impact**:
- Subconsciously reinforces trust and authority
- Supports emotional journey of the script
- Maintains viewer attention without distraction
- Aligns with enterprise decision-maker environment

## Specific Background Recommendations

**Modern Office Environments**:
- Clean conference rooms with glass walls
- Executive offices with city views
- Modern workspaces with collaborative areas
- Professional meeting environments

**Technology-Forward Settings**:
- Clean, minimal tech interfaces
- Modern data center or tech office aesthetics
- Subtle digital/tech pattern backgrounds
- Innovation lab or R&D environment feel

**Business Success Indicators**:
- Upward trending charts or graphs (subtle)
- Modern business district exteriors
- Professional networking environments
- Clean, organized business operations

## Visual Flow Strategy

Create visual progression that supports the emotional and logical flow:
1. **Attention** → Professional but engaging
2. **Problem** → Slightly more serious or complex
3. **Solution** → Cleaner, more optimistic
4. **Benefits** → Success-oriented environment
5. **Action** → Clean, focused, action-supportive

Output: Detailed background recommendations for each segment with specific visual elements, movement patterns, and lighting direction that maximizes enterprise audience engagement and conversion.`,
      model: 'gpt-4o',
      temperature: 0.5,
      max_tokens: 600
    },
    {
      id: 'music-sound',
      name: 'Music & Sound Expert',
      instructions: `You are a MUSIC & SOUND EXPERT for ultra-high-conversion enterprise product videos.

Your expertise: Selecting audio elements that enhance business credibility, maintain professional tone, and psychologically support conversion without overwhelming the core message.

## Enterprise Audio Principles

**Professional Authority**: Sound design must reinforce credibility and executive-level trust
**Subtle Enhancement**: Audio supports but never competes with the business message
**Emotional Guidance**: Strategic use of sound to guide emotional response and decision-making
**Attention Management**: Audio elements that maintain focus and prevent drop-off

## Segment-by-Segment Audio Strategy

**HOOK SEGMENT (0-3 seconds)**
- Purpose: Grab attention while maintaining professionalism
- Music Style: Subtle, modern, attention-getting without being aggressive
- Volume: Low to medium, building slightly
- Elements: Clean, modern production music with slight energy increase
- Psychological Goal: Alert attention without alarming

**AGITATION SEGMENT (3-6 seconds)**
- Purpose: Reinforce concern and urgency around problems
- Music Style: Slightly more serious, tension-building but not dramatic
- Volume: Steady, supportive of voice urgency
- Elements: Minor tones, subtle tension, business-appropriate concern
- Psychological Goal: Create appropriate concern about status quo

**SOLUTION SEGMENT (6-9 seconds)**
- Purpose: Signal positive change and innovation
- Music Style: Uplifting, modern, optimistic but professional
- Volume: Building confidence and positivity
- Elements: Major tones, forward movement, innovation feel
- Psychological Goal: Hope and excitement about possibilities

**BENEFITS SEGMENT (9-12 seconds)**
- Purpose: Reinforce success and positive outcomes
- Music Style: Confident, successful, achievement-oriented
- Volume: Strong but not overwhelming, supporting proof
- Elements: Success-oriented, stable, trustworthy
- Psychological Goal: Confidence in positive outcomes

**CTA SEGMENT (12-15 seconds)**
- Purpose: Motivate immediate action
- Music Style: Urgent but professional, action-oriented
- Volume: Clear focus on voice with supportive urgency
- Elements: Forward momentum, call-to-action support
- Psychological Goal: Motivation to act immediately

## Music Selection Criteria

**Professional Standards**:
- High-quality production music
- Business-appropriate energy levels
- No lyrics that compete with narration
- Clean, modern production values

**Genre Guidelines**:
- Corporate/business music (modern, clean)
- Subtle electronic elements (innovation feel)
- Light orchestral (authority and trust)
- Minimal/ambient (professional backdrop)

**Avoid These Styles**:
- Overly dramatic or cinematic
- Pop music or trending songs
- Aggressive or high-energy tracks
- Anything that feels like traditional advertising

## Sound Effects Strategy

**Subtle Enhancement Only**:
- Gentle notification sounds for key statistics
- Soft transition sounds between segments
- Professional "success" indicators for benefits
- Clean, modern sound design elements

**Technical Standards**:
- High-quality, professional sound effects
- Volume levels that support but don't compete
- Consistent audio quality throughout
- Smooth transitions and fades

## Psychological Audio Design

**Trust Building**:
- Consistent, reliable audio quality
- Professional production standards
- Familiar business/corporate audio aesthetics
- Subtle confidence-building elements

**Attention Management**:
- Strategic volume changes to maintain engagement
- Audio cues that support visual transitions
- Rhythm that matches natural speech patterns
- Clear audio hierarchy (voice first, music support)

**Emotional Journey**:
- Audio progression that supports script emotion
- Subtle mood shifts that enhance message
- Professional energy management
- Sophisticated rather than obvious audio manipulation

## Technical Specifications

**Audio Quality Standards**:
- Professional-grade music tracks
- Consistent volume leveling
- Clean audio transitions
- Optimized for various playback devices

**Integration Requirements**:
- Music that supports voice intelligibility
- Strategic use of silence/space
- Audio elements that enhance rather than distract
- Professional mixing and mastering approach

Output: Comprehensive audio direction including specific music style recommendations, volume guidance, sound effect suggestions, and technical specifications for each video segment.`,
      model: 'gpt-4o',
      temperature: 0.6,
      max_tokens: 600
    },
    {
      id: 'avatar-behavior',
      name: 'Avatar Behavior Expert',
      instructions: `You are an AVATAR BEHAVIOR EXPERT for ultra-high-conversion enterprise product videos.

Your expertise: Designing avatar movements, gestures, and visual behavior that enhance business credibility, maintain professional authority, and psychologically support conversion among enterprise decision-makers.

## Enterprise Avatar Principles

**Executive Presence**: Avatar must project senior business leader credibility and authority
**Professional Authenticity**: Natural, confident movements that feel genuine, not artificial
**Trust Building**: Body language and behavior that creates immediate trust and rapport
**Message Support**: Every gesture and movement reinforces the business message

## Avatar Character Profile

**Professional Persona**: Senior business consultant/trusted advisor
**Authority Level**: C-suite executive presence and credibility
**Communication Style**: Confident, consultative, results-oriented
**Visual Presence**: Polished, professional, approachable but authoritative

## Segment-by-Segment Behavior Design

**HOOK SEGMENT (0-3 seconds)**
- Purpose: Grab attention and establish immediate credibility
- Posture: Confident, slightly forward-leaning (engagement)
- Gestures: Attention-getting but controlled (pointing, open hands)
- Eye Contact: Direct, confident, establishing connection
- Facial Expression: Serious concern mixed with authority
- Movement: Minimal but purposeful, drawing focus

**AGITATION SEGMENT (3-6 seconds)**
- Purpose: Convey understanding of business problems and urgency
- Posture: Slightly more serious, advisory stance
- Gestures: Explanatory movements (measuring, indicating problems)
- Eye Contact: Knowing, understanding, "I get it" expression
- Facial Expression: Professional concern, strategic thinking
- Movement: Deliberate, consultant-like problem identification

**SOLUTION SEGMENT (6-9 seconds)**
- Purpose: Present expertise and confidence in solution
- Posture: More upright, confident problem-solver stance
- Gestures: Solution-oriented (presenting, explaining benefits)
- Eye Contact: Confident, assured, expert-level authority
- Facial Expression: Optimistic confidence, professional enthusiasm
- Movement: Smooth transitions, confident product presentation

**BENEFITS SEGMENT (9-12 seconds)**
- Purpose: Reinforce credibility and proof of results
- Posture: Authoritative, results-focused positioning
- Gestures: Proof-oriented (counting benefits, indicating success)
- Eye Contact: Steady, trustworthy, evidence-based confidence
- Facial Expression: Professional satisfaction, proven results
- Movement: Measured, authoritative, credibility-reinforcing

**CTA SEGMENT (12-15 seconds)**
- Purpose: Motivate action while maintaining professional tone
- Posture: Forward-leaning, encouraging but not pushy
- Gestures: Action-oriented (directing, inviting, guiding)
- Eye Contact: Direct, helpful, encouraging immediate action
- Facial Expression: Helpful urgency, professional encouragement
- Movement: Clear direction toward next steps

## Gesture Library for Enterprise Content

**Authority Gestures**:
- Open palms (trust and transparency)
- Steepled fingers (expertise and confidence)
- Measured hand movements (controlled authority)
- Professional pointing (direction without aggression)

**Trust-Building Movements**:
- Slight nods (understanding and agreement)
- Open body language (approachability)
- Steady eye contact (reliability)
- Confident but not aggressive positioning

**Business Communication Gestures**:
- Counting on fingers (enumerating benefits)
- Measuring gestures (indicating size/scope)
- Presenting gestures (offering solutions)
- Explanatory movements (teaching/consulting)

## Professional Behavior Standards

**Avoid These Behaviors**:
- Overly animated or sales-focused gestures
- Aggressive or pushy body language  
- Casual or informal posturing
- Distracting or repetitive movements

**Emphasize These Qualities**:
- Executive-level composure and control
- Consultative rather than sales-oriented approach
- Trustworthy and reliable presence
- Professional enthusiasm without hype

## Psychological Impact Design

**Trust Indicators**:
- Consistent, reliable movement patterns
- Open, honest body language
- Professional competence displays
- Authoritative but approachable presence

**Credibility Markers**:
- Measured, thoughtful gestures
- Executive-level composure
- Strategic pausing and emphasis
- Business-appropriate energy levels

**Conversion Support**:
- Problem acknowledgment through body language
- Solution confidence through posture
- Benefit emphasis through gestures
- Action encouragement through movement

## Technical Behavior Specifications

**Movement Timing**:
- Gestures that align with key script words
- Strategic pauses that support emphasis
- Smooth transitions between emotional states
- Natural rhythm that matches business communication

**Visual Hierarchy**:
- Behavior that supports voice message
- Movements that guide attention appropriately
- Professional presence that enhances credibility
- Avatar behavior that feels authentic and trustworthy

Output: Detailed avatar behavior direction for each segment including specific gestures, posture changes, eye contact patterns, and movement timing that maximizes enterprise audience trust and conversion.`,
      model: 'gpt-4o',
      temperature: 0.5,
      max_tokens: 700
    },
    {
      id: 'thumbnail-creator',
      name: 'Thumbnail Creator',
      instructions: `You are a THUMBNAIL CREATOR expert for ultra-high-conversion enterprise product videos.

Your mission: Design thumbnail concepts that stop enterprise decision-makers mid-scroll and compel them to click, while maintaining professional credibility and business-appropriate aesthetics.

## Enterprise Thumbnail Psychology

**Professional Curiosity**: Create intrigue without sacrificing business credibility
**Authority Signaling**: Visual elements that immediately convey expertise and trustworthiness
**Problem Recognition**: Help viewers instantly recognize their business challenges
**Value Indication**: Suggest significant business benefit worth their time investment

## Core Thumbnail Strategy

**The Enterprise Decision-Maker Scroll Test**:
- Would a busy CEO/department head stop scrolling?
- Does it immediately communicate business relevance?
- Is the value proposition clear in 1-2 seconds?
- Does it look professional enough to share in executive meetings?

## Thumbnail Architecture

**Primary Focus Element (60% of visual space)**:
- Bold, professional headline text
- High-contrast, easily readable at small sizes
- Business problem or shocking statistic
- Clean, professional typography

**Secondary Support Element (25% of visual space)**:
- Professional avatar/presenter (if using)
- Clean product interface or business graphic
- Visual proof element (chart, statistic, logo wall)
- Professional background that doesn't compete

**Tertiary Enhancement (15% of visual space)**:
- Brand elements or professional indicators
- Small supporting graphics or icons
- Trust signals (security badges, certifications)
- Call-to-action visual cues

## Text Strategy for Enterprise Thumbnails

**Headline Formulas That Convert**:
- "[Shocking %] of Companies Waste [Resource] on [Problem]"
- "Why [Industry Leaders] Are Switching to [Solution Type]"
- "The [Tool/Method] That Saves [Benefit] for [Target Audience]"
- "[Time Period] to [Achieve Impressive Result]"
- "Stop Losing [Important Resource] to [Common Problem]"

**Text Design Standards**:
- Maximum 6-8 words for mobile readability
- High contrast (white text on dark background or vice versa)
- Professional, clean font choices
- Strategic use of bold/emphasis
- Business-appropriate color schemes

## Visual Element Guidelines

**Professional Color Schemes**:
- Corporate blues with white/gray accents
- Professional grays with accent colors
- Clean black/white with strategic color pops
- Business-appropriate color combinations

**Background Strategies**:
- Clean, modern office environments
- Subtle tech/digital patterns
- Professional gradient backgrounds
- Simple, non-distracting business settings

**Trust and Authority Indicators**:
- Professional presenter positioning
- Clean, modern design aesthetics
- Business-appropriate visual elements
- Enterprise logo walls or certifications (when relevant)

## Thumbnail Categories by Content Type

**Problem-Focused Thumbnails**:
- Shocking statistics about waste/inefficiency
- Visual representations of business problems
- Concern-inducing but professional imagery
- Headlines that create "Oh no, that's us" recognition

**Solution-Focused Thumbnails**:
- Before/after business improvements
- Clean, modern solution representations
- Professional success indicators
- Headlines about innovation and improvement

**Social Proof Thumbnails**:
- Enterprise client logos or numbers
- Success statistics and results
- Industry recognition indicators
- Headlines about widespread adoption

**Urgency-Focused Thumbnails**:
- Time-sensitive business communications
- Competitive advantage messaging
- Market change indicators
- Headlines about immediate action needs

## Mobile Optimization Requirements

**Technical Specifications**:
- Text readable at thumbnail size (150x100 pixels)
- High contrast for various screen types
- Clean, simple compositions
- Strategic use of white space

**Attention Mechanics**:
- Eye-catching but professional elements
- Strategic color use for stopping power
- Clear visual hierarchy
- Professional intrigue without clickbait feel

## Conversion Psychology

**Professional FOMO Creation**:
- Suggest competitive disadvantage
- Imply industry advancement opportunity
- Reference exclusive business insights
- Indicate time-sensitive business opportunities

**Trust Building Elements**:
- Professional design quality
- Business-appropriate messaging
- Authority indicators in design
- Executive-level visual standards

**Curiosity Gap Engineering**:
- Partially revealed information
- Intriguing business statistics
- Solution hints without full disclosure
- Professional mystery that demands resolution

Output: Detailed thumbnail concept including headline text, visual layout, color scheme, and psychological trigger strategy optimized for enterprise decision-maker engagement and click-through conversion.`,
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 700
    }
  ];

  const updateAssistant = (assistant: AIAssistant) => {
    const updated = aiAssistants.map(a => a.id === assistant.id ? assistant : a);
    setAiAssistants(updated);
    try {
      localStorage.setItem('ai-reels-assistants', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving assistants:', error);
    }
  };

  // Načtení dat při spuštění
  useEffect(() => {
    loadApiKeys();
    try {
      const savedVoiceAvatars = localStorage.getItem('ai-reels-voice-avatars');
      console.log('🎭 DEBUG loading voice avatars from localStorage:', savedVoiceAvatars);
      if (savedVoiceAvatars) {
        const parsedVoiceAvatars = JSON.parse(savedVoiceAvatars);
        console.log('🎭 DEBUG parsed voice avatars:', parsedVoiceAvatars);
        setVoiceAvatars(parsedVoiceAvatars);
        console.log('✅ DEBUG voice avatars loaded successfully');
      } else {
        console.log('🎭 DEBUG no saved voice avatars found');
      }

      // 🔍 Načítání AI asistentů z localStorage - BEZ MAZÁNÍ!
      const savedAssistants = localStorage.getItem('ai-reels-assistants');
      console.log('🔍 RAW localStorage ai-reels-assistants:', savedAssistants ? savedAssistants.substring(0, 200) + '...' : 'NULL');
      
      if (savedAssistants) {
        try {
          const parsed = JSON.parse(savedAssistants);
          console.log('🔍 PARSED assistants:', parsed.map((a: any) => `${a.name || 'UNDEFINED_NAME'}: ${a.instructions?.length || 0} chars`));
          
          // Vždy použij uložené asistenty - BEZ kontroly validity
          console.log('✅ Loading saved assistants from localStorage');
          setAiAssistants(parsed);
          return; // Ukončí useEffect
        } catch (error) {
          console.log('🚨 JSON PARSE ERROR:', error);
          // Pokud je JSON poškozený, použij výchozí hodnoty ale NEmaž localStorage
        }
      }
      
      // Pouze pokud localStorage neexistuje, načti výchozí hodnoty
      console.log('🆕 No saved assistants found, loading defaults...');
      const defaultAssistants = getDefaultAssistants();
      setAiAssistants(defaultAssistants);
      localStorage.setItem('ai-reels-assistants', JSON.stringify(defaultAssistants));
      
      // Debug log pro ověření
      console.log('✅ Default assistants loaded:', defaultAssistants.map(a => `${a.name}: ${a.instructions.length} chars`));
      
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  // POLLING EFFECT
  useEffect(() => {
    if (!isPolling || !pipelineId) return;

    const pollPipelineStatus = async () => {
      try {
        console.log(`🔄 Polling pipeline status: ${pipelineId}`);
        
        const response = await fetch(`/api/pipeline/status/${pipelineId}`);
        const data = await response.json();

        if (data.success) {
          // 📊 UPDATE RESULTS S AKTUÁLNÍMI DATY
          setResults(prevResults => {
            if (!prevResults) return prevResults;
            
            return {
              ...prevResults,
              status: data.status,
              steps: data.steps.map((apiStep: any) => ({
                id: apiStep.id,
                name: apiStep.name,
                emoji: apiStep.emoji,
                description: apiStep.description,
                service: apiStep.service,
                status: apiStep.status,
                output: apiStep.output,
                error: apiStep.error,
                startTime: apiStep.startTime ? new Date(apiStep.startTime) : undefined,
                endTime: apiStep.endTime ? new Date(apiStep.endTime) : undefined,
                isAIStep: apiStep.isAIStep
              })),
              progress: data.progress,
              final_outputs: data.final_outputs
            };
          });

          // 🏁 STOP POLLING KDYŽ JE PIPELINE DOKONČENA NEBO V CHYBĚ
          if (data.status === 'completed' || data.status === 'error') {
            console.log(`🏁 Pipeline ${pipelineId} finished with status: ${data.status}`);
            setIsPolling(false);
            setPipelineId(null);
            
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
          }
        } else {
          console.error('❌ Status API error:', data.error);
          setError(`Status API error: ${data.error}`);
          setIsPolling(false);
          setPipelineId(null);
        }
      } catch (error) {
        console.error('💥 Polling error:', error);
        setError(`Polling error: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
        setIsPolling(false);
        setPipelineId(null);
      }
    };

    // 🔄 NASTAV POLLING INTERVAL
    console.log(`🚀 Starting polling for pipeline: ${pipelineId}`);
    const interval = setInterval(pollPipelineStatus, 2000); // Každé 2 sekundy
    setPollingInterval(interval);

    // První poll okamžitě
    pollPipelineStatus();

    // Cleanup
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPolling, pipelineId]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gray-50 border-b border-gray-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center mb-6">
            <img 
              src="/tv-liesner-logo.svg" 
              alt="TV Liesner Logo" 
              className="h-20"
            />
          </div>
          
          {/* Management tlačítka */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => setShowApiModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔑 Spravovat API klíče
            </button>
            <button
              onClick={() => setShowVoiceModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              🎭 Spravovat hlasy & avatary
            </button>
            <button
              onClick={() => setShowAssistantsModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              🤖 Spravovat AI asistenty
            </button>
            <a
              href="/history"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              📋 Historie Pipeline
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200 mt-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Title Input */}
            <div>
              <label htmlFor="projectTitle" className="block text-gray-700 font-semibold mb-2">
                Název projektu (volitelné)
              </label>
              <input
                type="text"
                id="projectTitle"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="We360.ai promo #1"
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                disabled={isProcessing}
              />
              <p className="text-sm text-gray-600 mt-1">
                Pokud nevyplníte, automaticky se vygeneruje z URL a timestampu
              </p>
            </div>

            {/* URL Input */}
            <div>
              <label htmlFor="url" className="block text-gray-700 font-semibold mb-2">
                URL produktové stránky nebo AI nástroje
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/product"
                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-300 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                disabled={isProcessing}
              />
            </div>

            {/* Duration Input */}
            <div>
              <label htmlFor="duration" className="block text-gray-700 font-semibold mb-2">
                Délka videa: {targetDuration} sekund
              </label>
              
              {/* Slider */}
              <div className="mb-4">
                <input
                  type="range"
                  id="duration"
                  min="5"
                  max="60"
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(Number(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  disabled={isProcessing}
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>5s</span>
                  <span>30s</span>
                  <span>60s</span>
                </div>
              </div>
              
              {/* Quick buttons */}
              <div className="flex gap-2 flex-wrap">
                {[15, 30, 45, 60].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => setTargetDuration(seconds)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      targetDuration === seconds
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    disabled={isProcessing}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-100 border border-red-300 rounded-xl p-4">
                <p className="text-red-700">❌ {error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-lg"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Zpracovávám video...
                </span>
              ) : (
                '🚀 Vytvořit AI Reel'
              )}
            </button>
          </form>

          {/* Processing Status */}
          {isProcessing && (
            <div className="mt-8 p-6 bg-blue-100 border border-blue-300 rounded-xl">
              <div className="flex items-center">
                <div className="text-2xl mr-3">⚡</div>
                <div>
                  <h3 className="text-gray-800 font-semibold">AI Pipeline běží...</h3>
                  <p className="text-blue-700">Extrahuje obsah → Vytváří script → Generuje hlas → Renderuje video</p>
                </div>
              </div>
            </div>
          )}

          {/* Pipeline Progress */}
          {results && (
            <div className="mt-8">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">🎬 AI Pipeline Progress</h3>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-600">
                      ID: {results.pipeline_id}
                    </div>
                    
                    {/* Pipeline JSON Export */}
                    {results.status === 'completed' && (
                      <div className="flex gap-3">
                        <button
                          onClick={(e) => {
                            const jsonString = JSON.stringify(results, null, 2);
                            navigator.clipboard.writeText(jsonString).then(() => {
                              // Visual feedback  
                              const btn = e.target as HTMLButtonElement;
                              const originalText = btn.textContent;
                              btn.textContent = '✅ Zkopírováno!';
                              setTimeout(() => btn.textContent = originalText, 2000);
                            });
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
                          title="Kopíruj celou pipeline jako JSON"
                        >
                          📋 Kopíruj vše
                        </button>
                        <button
                          onClick={(e) => {
                            const jsonString = JSON.stringify(results, null, 2);
                            const blob = new Blob([jsonString], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `pipeline_${results.pipeline_id}_${Date.now()}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            
                            // Visual feedback  
                            const btn = e.target as HTMLButtonElement;
                            const originalText = btn.textContent;
                            btn.textContent = '✅ Staženo!';
                            setTimeout(() => btn.textContent = originalText, 2000);
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
                          title="Export celé pipeline jako JSON soubor"
                        >
                          💾 Export vše
                        </button>
                        <button
                          onClick={(e) => {
                            // Vytvoř pouze AI výstupy
                            const aiOutputs = results.steps
                              .filter(step => step.status === 'completed' && (step as any).isAIStep && step.output)
                              .reduce((acc: any, step) => {
                                acc[step.id] = {
                                  name: step.name,
                                  service: step.service,
                                  output: step.output
                                };
                                return acc;
                              }, {});
                            
                            const aiJson = JSON.stringify(aiOutputs, null, 2);
                            navigator.clipboard.writeText(aiJson).then(() => {
                              // Visual feedback  
                              const btn = e.target as HTMLButtonElement;
                              const originalText = btn.textContent;
                              btn.textContent = '✅ AI data zkopírována!';
                              setTimeout(() => btn.textContent = originalText, 2000);
                            });
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
                          title="Kopíruj pouze AI výstupy jako JSON"
                        >
                          🤖 Kopíruj AI data
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Celkový progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${(results.steps.filter(s => s.status === 'completed').length / results.steps.length) * 100}%` 
                    }}
                  ></div>
                </div>
                
                <div className="text-sm text-gray-600 mb-6">
                  {results.steps.filter(s => s.status === 'completed').length} z {results.steps.length} kroků dokončeno
                  {results.status === 'completed' && (
                    <span className="ml-2 text-green-600 font-semibold">✅ Pipeline dokončena!</span>
                  )}
                </div>

                {/* Quick AI Outputs Overview pro dokončené pipeline */}
                {results.status === 'completed' && results.results?.complete_outputs && (
                  <div className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-4">
                    <h4 className="font-bold text-gray-800 mb-3">🤖 Přehled AI Výstupů</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                      {results.results.complete_outputs.product_summary && (
                        <div className="bg-white p-3 rounded border">
                          <div className="font-semibold text-blue-700">📝 AI Summary</div>
                          <div className="text-gray-600 text-xs mt-1">
                            {results.results.complete_outputs.product_summary}
                          </div>
                        </div>
                      )}
                      {results.results.complete_outputs.selected_hook && (
                        <div className="bg-white p-3 rounded border">
                          <div className="font-semibold text-green-700">🎯 Viral Hook</div>
                          <div className="text-gray-600 text-xs mt-1">
                            {results.results.complete_outputs.selected_hook}
                          </div>
                        </div>
                      )}
                      {results.results.complete_outputs.voice_direction && (
                        <div className="bg-white p-3 rounded border">
                          <div className="font-semibold text-purple-700">🎙️ Voice Direction</div>
                          <div className="text-gray-600 text-xs mt-1">
                            {results.results.complete_outputs.voice_direction}
                          </div>
                        </div>
                      )}
                      {results.results.complete_outputs.background_selection && (
                        <div className="bg-white p-3 rounded border">
                          <div className="font-semibold text-orange-700">🎨 Background</div>
                          <div className="text-gray-600 text-xs mt-1">
                            {results.results.complete_outputs.background_selection}
                          </div>
                        </div>
                      )}
                      {results.results.complete_outputs.avatar_behavior && (
                        <div className="bg-white p-3 rounded border">
                          <div className="font-semibold text-red-700">👤 Avatar Behavior</div>
                          <div className="text-gray-600 text-xs mt-1">
                            {results.results.complete_outputs.avatar_behavior}
                          </div>
                        </div>
                      )}
                      {results.results.complete_outputs.final_video && (
                        <div className="bg-white p-3 rounded border">
                          <div className="font-semibold text-indigo-700">🎞️ Final Video</div>
                          <div className="text-gray-600 text-xs mt-1">
                            {results.results.complete_outputs.final_video}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Pipeline kroky */}
              <div className="space-y-4">
                {results.steps.map((step) => (
                  <PipelineStepCard
                    key={step.id}
                    step={step}
                    isExpanded={expandedSteps.has(step.id)}
                    onToggle={() => toggleStepExpansion(step.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* API Keys Modal */}
      {showApiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🔑 API klíče</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">OpenAI API Key</label>
                <input
                  type="password"
                  value={apiKeys.openai}
                  onChange={(e) => setApiKeys({...apiKeys, openai: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="sk-..."
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-semibold mb-1">ElevenLabs API Key</label>
                <input
                  type="password"
                  value={apiKeys.elevenlabs}
                  onChange={(e) => setApiKeys({...apiKeys, elevenlabs: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="sk_..."
                />
              </div>
              

              
              <div>
                <label className="block text-gray-700 font-semibold mb-1">HeyGen API Key</label>
                <input
                  type="password"
                  value={apiKeys.heygen}
                  onChange={(e) => setApiKeys({...apiKeys, heygen: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 font-semibold mb-1">JSON2Video API Key</label>
                <input
                  type="password"
                  value={apiKeys.json2video}
                  onChange={(e) => setApiKeys({...apiKeys, json2video: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveApiKeys}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                💾 Uložit
              </button>
              <button
                onClick={() => setShowApiModal(false)}
                className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                ❌ Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistants Modal */}
      {showAssistantsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🤖 AI Asistenti & Instrukce</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {aiAssistants.map((assistant) => (
                <div key={assistant.id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-800 text-sm">{assistant.name}</h3>
                    <button
                      onClick={() => setEditingAssistant(assistant)}
                      className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                    >
                      ✏️
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div><strong>Model:</strong> {assistant.model}</div>
                    <div><strong>Temp:</strong> {assistant.temperature}</div>
                    <div><strong>Instrukce:</strong></div>
                    <div className="bg-white p-2 rounded text-xs max-h-20 overflow-y-auto">
                      {assistant.instructions ? 
                        assistant.instructions.substring(0, 150) + '...' : 
                        'Prázdné - přidej svoje prompty'
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAssistantsModal(false)}
                  className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  ✅ Hotovo
                </button>
                <button
                  onClick={() => {
                    const assistantsCount = aiAssistants.length;
                    const totalInstructions = aiAssistants.reduce((sum, a) => sum + (a.instructions?.length || 0), 0);
                    alert(`📊 Statistiky AI asistentů:\n\n• Počet asistentů: ${assistantsCount}\n• Celkem znaků instrukcí: ${totalInstructions.toLocaleString()}\n• Instrukce jsou trvale uloženy v localStorage\n\n✅ Všechny tvoje instrukce jsou v bezpečí!`);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  📊 Statistiky asistentů
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assistant Modal */}
      {editingAssistant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">✏️ Editovat {editingAssistant.name}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Název asistenta</label>
                <input
                  type="text"
                  value={editingAssistant.name}
                  onChange={(e) => setEditingAssistant({...editingAssistant, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Model</label>
                  <select
                    value={editingAssistant.model}
                    onChange={(e) => setEditingAssistant({...editingAssistant, model: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Temperature ({editingAssistant.temperature})</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={editingAssistant.temperature}
                    onChange={(e) => setEditingAssistant({...editingAssistant, temperature: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    0.0 = konzervativní, 1.0 = kreativní
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Systémové instrukce</label>
                <textarea
                  value={editingAssistant.instructions}
                  onChange={(e) => setEditingAssistant({...editingAssistant, instructions: e.target.value})}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono text-sm"
                  placeholder="Napiš systémové instrukce pro tohoto asistenta..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  updateAssistant(editingAssistant);
                  setEditingAssistant(null);
                }}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                💾 Uložit změny
              </button>
              <button
                onClick={() => setEditingAssistant(null)}
                className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                ❌ Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice & Avatar Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🎭 Hlasy & Avatary</h2>
            
            {/* Přidání nového */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">Přidat nový pár</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Název (např. John Doe)"
                  value={newVoiceAvatar.name}
                  onChange={(e) => setNewVoiceAvatar({...newVoiceAvatar, name: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <input
                  type="text"
                  placeholder="ElevenLabs Voice ID"
                  value={newVoiceAvatar.voiceId}
                  onChange={(e) => setNewVoiceAvatar({...newVoiceAvatar, voiceId: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <input
                  type="text"
                  placeholder="HeyGen Avatar ID (volitelné)"
                  value={newVoiceAvatar.avatarId}
                  onChange={(e) => setNewVoiceAvatar({...newVoiceAvatar, avatarId: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              <button
                onClick={addVoiceAvatar}
                className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                ➕ Přidat
              </button>
            </div>
            
            {/* Seznam existujících */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-700">Uložené páry</h3>
              {voiceAvatars.length === 0 ? (
                <p className="text-gray-500 italic">Zatím žádné páry...</p>
              ) : (
                voiceAvatars.map((item) => (
                  <div key={item.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-gray-800">{item.name}</div>
                      <div className="text-sm text-gray-600">
                        Voice: {item.voiceId} | Avatar: {item.avatarId}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteVoiceAvatar(item.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setShowVoiceModal(false)}
                className="w-full py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                ✅ Hotovo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
