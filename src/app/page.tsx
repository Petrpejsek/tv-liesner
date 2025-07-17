'use client';

import { useState, useEffect } from 'react';

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

export default function Home() {
  const [url, setUrl] = useState('');
  const [targetDuration, setTargetDuration] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  
  // Modaly
  const [showApiModal, setShowApiModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  
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
      const response = await fetch('/api/pipeline/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: url.trim(), 
          target_duration: targetDuration 
        }),
      });

      if (!response.ok) {
        throw new Error(`Chyba serveru: ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
      
    } catch (err) {
      console.error('Pipeline error:', err);
      setError(err instanceof Error ? err.message : 'Nastala neočekávaná chyba');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveApiKeys = () => {
    try {
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
      if (saved) {
        setApiKeys(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  };

  const addVoiceAvatar = () => {
    if (!newVoiceAvatar.name || !newVoiceAvatar.voiceId || !newVoiceAvatar.avatarId) {
      alert('Vyplň všechna pole');
      return;
    }
    
    const newItem: VoiceAvatar = {
      ...newVoiceAvatar,
      id: Date.now().toString()
    };
    
    const updated = [...voiceAvatars, newItem];
    setVoiceAvatars(updated);
    try {
      localStorage.setItem('ai-reels-voice-avatars', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving voice avatars:', error);
    }
    
    setNewVoiceAvatar({ name: '', voiceId: '', avatarId: '' });
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

  // Načtení dat při spuštění
  useEffect(() => {
    loadApiKeys();
    try {
      const savedVoiceAvatars = localStorage.getItem('ai-reels-voice-avatars');
      if (savedVoiceAvatars) {
        setVoiceAvatars(JSON.parse(savedVoiceAvatars));
      }
    } catch (error) {
      console.error('Error loading voice avatars:', error);
    }
  }, []);

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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200 mt-8">
          <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* Results */}
          {results && (
            <div className="mt-8 p-6 bg-green-100 border border-green-300 rounded-xl">
              <div className="flex items-center mb-4">
                <div className="text-2xl mr-3">✅</div>
                <h3 className="text-gray-800 font-semibold text-xl">Video je hotové!</h3>
              </div>
              <pre className="text-green-700 text-sm overflow-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
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
                  placeholder="HeyGen Avatar ID"
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
