// ElevenLabs TTS Integration
export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speaking_rate?: number; // 0.25 - 4.0, default 1.0 (pouze pro některé modely)
}

export interface ElevenLabsResponse {
  audio_data: ArrayBuffer;
  content_type: string;
}

export async function generateVoice(
  text: string,
  voiceId: string,
  apiKey: string,
  settings?: Partial<VoiceSettings>
): Promise<ElevenLabsResponse> {
  console.log('🗣️ ElevenLabs generateVoice() called');
  console.log('🐛 DEBUG - ElevenLabs API parameters:');
  console.log('📝 finalVoiceId:', voiceId);
  console.log('🔑 apiKey:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');
  console.log('📄 text (first 50 chars):', text.substring(0, 50) + '...');
  console.log('📝 text length:', text.length);
  
  if (!apiKey) {
    console.error('❌ ElevenLabs API klíč je prázdný!');
    throw new Error('ElevenLabs API klíč je povinný');
  }

  if (!voiceId) {
    console.error('❌ Voice ID je prázdné!');
    throw new Error('Voice ID je povinné');
  }

  const defaultSettings: VoiceSettings = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true,
    ...settings
  };

  console.log('🎛️ Voice settings:', defaultSettings);
  console.log('📡 Volám ElevenLabs API...');

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: defaultSettings
    })
  });

  console.log('📊 Response status:', response.status);
  console.log('📊 Response ok:', response.ok);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ ElevenLabs API error:', errorText);
    throw new Error(`ElevenLabs chyba ${response.status}: ${errorText}`);
  }

  console.log('✅ ElevenLabs API response successful');
  const audioData = await response.arrayBuffer();
  console.log('📄 Audio data size:', audioData.byteLength, 'bytes');

  return {
    audio_data: audioData,
    content_type: response.headers.get('content-type') || 'audio/mpeg'
  };
}

// Získání dostupných hlasů
export async function getAvailableVoices(apiKey: string) {
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: {
      'xi-api-key': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Chyba při načítání hlasů: ${response.status}`);
  }

  return response.json();
}

// Uložení audio souboru
export async function saveAudioFile(audioData: ArrayBuffer, filename: string): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // ✅ Ukládání do PUBLIC složky aby byly soubory přístupné přes web
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  
  const filePath = path.join(uploadsDir, filename);
  await fs.writeFile(filePath, Buffer.from(audioData));
  
  // ✅ Vrátím WEB URL místo absolutní cesty k souboru
  return `/uploads/${filename}`;
} 