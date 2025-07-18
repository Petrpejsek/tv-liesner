// Voice Generation Pipeline - ElevenLabs Integration with Segmentation
import { generateVoice, saveAudioFile } from './elevenlabs';

export interface VoiceGenerationResult {
  segments: VoiceSegment[];
  totalDuration: number;
  targetTime: number;
  speakingRate: number;
}

export interface VoiceSegment {
  id: string;
  text: string;
  audioFilePath: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface ApiKeys {
  elevenlabs?: string;
  voiceId?: string;
}

export async function generateVoiceFromScript(
  videoScript: string,
  timeline: any,
  voiceDirection: any,
  apiKeys: ApiKeys,
  targetTime: number = 15
): Promise<VoiceGenerationResult> {
  console.log('🗣️ Spouštím ElevenLabs Voice Generation s segmentací...');
  
  // 🐛 DEBUG: Detailní kontrola API klíčů
  console.log('🐛 Voice Pipeline DEBUG - API klíče:');
  console.log('🔑 apiKeys received:', Object.keys(apiKeys));
  console.log('🔑 voiceId value:', apiKeys.voiceId || 'UNDEFINED');
  console.log('🔑 elevenlabs starts with:', apiKeys.elevenlabs?.substring(0, 10) || 'UNDEFINED');
  console.log('🎯 Target time:', targetTime, 'seconds');
  
  // Validace API klíčů
  if (!apiKeys.elevenlabs) {
    console.error('❌ ElevenLabs API klíč chybí!');
    throw new Error('ElevenLabs API klíč není nastaven v environment variables');
  }
  
  if (!apiKeys.voiceId) {
    console.error('❌ Voice ID chybí!');
    throw new Error('Voice ID není nastaven v environment variables');
  }

  console.log(`🎙️ Používám Voice ID: ${apiKeys.voiceId}`);
  
  try {
    // Extrakce timeline segments
    let timelineSegments = [];
    
    if (timeline && timeline.segments) {
      timelineSegments = timeline.segments;
      console.log(`🔄 Generuji hlas pro ${timelineSegments.length} segmentů z timeline`);
    } else {
      // Fallback: vytvoř jeden segment z celého scriptu
      console.log('🔄 Timeline nedostupný - vytvářím jeden segment');
      let scriptText = '';
      if (typeof videoScript === 'object' && videoScript.voiceover_script) {
        scriptText = videoScript.voiceover_script;
      } else {
        scriptText = videoScript;
      }
      
      timelineSegments = [{
        id: 'segment_1',
        text: scriptText,
        startTime: 0,
        endTime: targetTime,
        duration: targetTime
      }];
    }

    // 🎯 KALKULACE SPEAKING RATE
    const totalWords = timelineSegments.reduce((sum: number, seg: any) => {
      const text = seg.voice_text || seg.text || '';
      return sum + text.split(' ').filter((w: string) => w.length > 0).length;
    }, 0);
    
    const wordsPerSecond = totalWords / targetTime;
    const expectedDuration = totalWords / 2.3; // Standardní rychlost 2.3 slov/sec
    
    console.log(`📊 Voice Stats - Total words: ${totalWords}, Expected duration: ${expectedDuration.toFixed(1)}s, Target: ${targetTime}s`);
    
    // 🎚️ DYNAMIC SPEAKING RATE ADJUSTMENT
    let speakingRate = 1.0;
    if (expectedDuration > targetTime) {
      speakingRate = 1.15; // Zrychli pokud je to příliš dlouhé
      console.log(`⚡ Zrychluju speaking rate na ${speakingRate} (příliš dlouhé)`);
    } else if (expectedDuration < targetTime - 3) {
      speakingRate = 0.9; // Zpomal pokud je to příliš krátké
      console.log(`🐌 Zpomaluju speaking rate na ${speakingRate} (příliš krátké)`);
    } else {
      console.log(`✅ Speaking rate zůstává 1.0 (optimální délka)`);
    }

    // Voice settings s dynamic speaking rate
    const voiceSettings = {
      stability: 0.7,
      similarity_boost: 0.8,
      style: 0.2,
      use_speaker_boost: true,
      speaking_rate: speakingRate
    };

    // 🔄 SEGMENTOVANÉ GENEROVÁNÍ
    const generatedSegments: VoiceSegment[] = [];
    let currentTime = 0;
    
    for (let i = 0; i < timelineSegments.length; i++) {
      const segment = timelineSegments[i];
      const segmentText = segment.voice_text || segment.text || '';
      
      if (!segmentText.trim()) {
        console.log(`⏭️ Přeskakujem prázdný segment ${segment.id}`);
        continue;
      }
      
      console.log(`🎤 Generuji segment ${i + 1}/${timelineSegments.length}: "${segmentText.substring(0, 50)}..."`);
      
      try {
        // Generuj audio pro tento segment
        const voiceResponse = await generateVoice(
          segmentText,
          apiKeys.voiceId,
          apiKeys.elevenlabs,
          voiceSettings
        );

        // Ulož segment audio
        const timestamp = Date.now();
        const segmentFileName = `voice_segment_${i + 1}_${timestamp}.mp3`;
        const segmentAudioPath = await saveAudioFile(voiceResponse.audio_data, segmentFileName);
        
        // Kalkuluj segment duration
        const segmentWords = segmentText.split(' ').filter(w => w.length > 0).length;
        const segmentDuration = segmentWords / (2.3 * speakingRate); // Adjusted by speaking rate
        
        generatedSegments.push({
          id: segment.id || `segment_${i + 1}`,
          text: segmentText,
          audioFilePath: segmentAudioPath,
          startTime: currentTime,
          endTime: currentTime + segmentDuration,
          duration: segmentDuration
        });
        
        currentTime += segmentDuration;
        console.log(`✅ Segment ${i + 1} uložen: ${segmentAudioPath} (${segmentDuration.toFixed(1)}s)`);
        
      } catch (segmentError) {
        console.error(`❌ Chyba při generování segmentu ${i + 1}:`, segmentError);
        throw new Error(`Generování segmentu ${i + 1} selhalo: ${segmentError.message}`);
      }
    }

    const totalGeneratedDuration = generatedSegments.reduce((sum, seg) => sum + seg.duration, 0);
    
    console.log(`🎉 Voice Generation dokončen! ${generatedSegments.length} segmentů, celková délka: ${totalGeneratedDuration.toFixed(1)}s`);

    return {
      segments: generatedSegments,
      totalDuration: totalGeneratedDuration,
      targetTime: targetTime,
      speakingRate: speakingRate
    };

  } catch (error) {
    console.error('❌ Voice Generation chyba:', error);
    throw new Error(`Voice Generation selhal: ${error.message}`);
  }
} 