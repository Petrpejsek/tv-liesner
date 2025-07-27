// Voice Generation Pipeline - ElevenLabs Integration with Segmentation
import { generateVoice, saveAudioFile } from './elevenlabs';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Vyčistí text před odesláním do ElevenLabs
 * - odstraní markdown (**bold**, atd.)
 * - odstraní meta info jako HOOK (0-3 seconds...)
 * - ořízne whitespace
 */
function cleanVoiceText(input: string): string {
  return input
    .replace(/^#{1,3}.*?\n/gm, '')            // Remove headers like ### HOOK
    .replace(/\*\*(.*?)\*\*/g, '$1')          // Remove bold markers
    .replace(/\(.*?\d+\s*seconds.*?\)/gi, '') // Remove (0–3 seconds...)
    .replace(/\b(HOOK|PROBLEM|SOLUTION|BENEFITS|CALL TO ACTION)\b/gi, '') // Remove meta labels
    .replace(/\n+/g, ' ')                     // Collapse newlines
    .replace(/\s{2,}/g, ' ')                  // Remove extra spaces
    .trim();
}

/**
 * Odhadne délku audio na základě počtu slov a speaking rate
 */
function estimateDuration(text: string, speakingRate = 0.9): number {
  const words = text.split(/\s+/).length;
  // ✅ Kalibrováno podle reálných měření ElevenLabs (~3.5 wps při normal speaking_rate)
  const baseWPS = 3.5; // reálná rychlost ElevenLabs
  const wordsPerSecond = baseWPS * (speakingRate || 1);
  return words / wordsPerSecond;
}

/**
 * Zkrátí text aby se vešel do zadané délky
 */
function truncateTextToDuration(text: string, maxDuration: number, speakingRate = 0.9): string {
  // ✅ Kalibrováno podle reálných měření ElevenLabs (~3.5 wps při normal speaking_rate)
  const baseWPS = 3.5; // reálná rychlost ElevenLabs
  const wordsPerSecond = baseWPS * (speakingRate || 1);
  const maxWords = Math.floor(maxDuration * wordsPerSecond);
  return text.split(/\s+/).slice(0, maxWords).join(' ');
}

/**
 * Slučuje audio segmenty do jednoho finálního souboru pomocí FFmpeg
 */
async function mergeAudioSegments(
  segments: VoiceSegment[],
  pipelineId: string,
  targetDuration: number
): Promise<string> {
  console.log('🎬 Spouštím slučování audio segmentů...');
  
  // 🔵 DEBUG: Preparing final merge...
  console.log("🔵 DEBUG: Preparing final merge...");
  console.log(`Files for merge: ${segments.length}`);
  segments.forEach((f, i) => console.log(`Merge file #${i+1}: ${f.audioFilePath}`));

  if (!segments || segments.length === 0) {
    throw new Error("❌ CRITICAL: No audio files received for merge!");
  }
  
  console.log('🔍 MERGE FUNC DEBUG - segments:', segments.length);
  console.log('🔍 MERGE FUNC DEBUG - pipelineId:', pipelineId);
  console.log('🔍 MERGE FUNC DEBUG - targetDuration:', targetDuration);
  console.log('🔍 MERGE FUNC DEBUG - segments paths:', segments.map(s => s.audioFilePath));
  
  if (segments.length === 0) {
    throw new Error('❌ Žádné segmenty k slučování');
  }
  
  try {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const finalFileName = `final_audio_${pipelineId}.mp3`;
    const finalFilePath = path.join(uploadsDir, finalFileName);
    
    // Pokud je jen jeden segment, zkopíruj ho jako finální s audio padding
    if (segments.length === 1) {
      const sourceFile = path.join(process.cwd(), 'public', segments[0].audioFilePath.replace(/^\//, ''));
      
      // ✅ Zkontroluj délku jednho segmentu a případně přidej padding
      const ffprobeCommand = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${sourceFile}"`;
      const { stdout } = await execAsync(ffprobeCommand);
      const segmentDuration = parseFloat(stdout.trim());
      
      console.log(`🎵 Single segment duration: ${segmentDuration.toFixed(2)}s (target: ${targetDuration}s)`);
      
      if (segmentDuration < targetDuration - 0.5) {
        // Přidej padding na přesný targetTime
        const silenceDuration = targetDuration - segmentDuration;
        console.log(`🔇 Přidávám ${silenceDuration.toFixed(2)}s ticha na konec jednho segmentu...`);
        
        const paddingCommand = `ffmpeg -i "${sourceFile}" -af "apad=pad_dur=${silenceDuration}" -y "${finalFilePath}"`;
        await execAsync(paddingCommand);
      } else {
        // Jen zkopíruj bez padding
        await fs.copyFile(sourceFile, finalFilePath);
      }
      
      console.log('✅ Jeden segment zpracován jako finální audio');
      return `/uploads/${finalFileName}`;
    }
    
    // 🎬 NOVÝ WAV-BASED MERGE FLOW podle instrukcí
    console.log('🎬 Vytvářím nový WAV-based merge flow...');
    
    // a) Každý segment MP3 → dočasný WAV
    const wavSegments: string[] = [];
    console.log('🔄 Konvertuji MP3 segmenty na WAV...');
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const sourceFile = path.join(process.cwd(), 'public', segment.audioFilePath.replace(/^\//, ''));
      const wavFileName = `segment_${i + 1}_${pipelineId}.wav`;
      const wavFilePath = path.join(uploadsDir, wavFileName);
      
      console.log(`🔄 Konvertuji segment ${i + 1}/${segments.length}: ${segment.audioFilePath} → WAV`);
      
      // Převeď MP3 na WAV s normalizovanými parametry
      const convertCommand = `ffmpeg -y -i "${sourceFile}" -ar 44100 -ac 2 "${wavFilePath}"`;
      
      try {
        const { stdout, stderr } = await execAsync(convertCommand);
        if (stderr) console.log(`⚠️ Convert stderr ${i + 1}:`, stderr);
        wavSegments.push(wavFilePath);
        console.log(`✅ Segment ${i + 1} převeden na WAV`);
      } catch (convertError) {
        console.error(`❌ Chyba při konverzi segmentu ${i + 1}:`, convertError);
        throw new Error(`MP3 to WAV conversion failed for segment ${i + 1}: ${convertError.message}`);
      }
    }
    
    // b) Vytvoř seznam WAV segmentů v concat_list_wav.txt
    const wavConcatListPath = path.join(uploadsDir, `concat_list_wav_${pipelineId}.txt`);
    const wavConcatContent = wavSegments.map(wavPath => `file '${wavPath}'`).join('\n');
    
    await fs.writeFile(wavConcatListPath, wavConcatContent);
    console.log('📋 Seznam WAV souborů pro concat vytvořen');
    
    // c) Slouč WAV segmenty do merged.wav (bez reenkódování)
    const mergedWavPath = path.join(uploadsDir, `merged_${pipelineId}.wav`);
    const mergeWavCommand = `ffmpeg -f concat -safe 0 -i "${wavConcatListPath}" -c copy -y "${mergedWavPath}"`;
    
    console.log('🎵 Slučuji WAV segmenty bez reenkódování...');
    console.log('🎵 WAV merge command:', mergeWavCommand);
    
    try {
      const { stdout, stderr } = await execAsync(mergeWavCommand);
      console.log('✅ WAV merge stdout:', stdout);
      if (stderr) console.log('⚠️ WAV merge stderr:', stderr);
    } catch (mergeError) {
      console.error('❌ WAV merge error:', mergeError);
      throw new Error(`WAV merge failed: ${mergeError.message}`);
    }
    
    // d) Reenkóduj merged.wav do MP3 (nové validní frame headers)
    console.log('🎵 Reenkóduji merged WAV do finálního MP3...');
    const reencodeCommand = `ffmpeg -y -i "${mergedWavPath}" -codec:a libmp3lame -q:a 2 "${finalFilePath}"`;
    
    try {
      const { stdout, stderr } = await execAsync(reencodeCommand);
      console.log('✅ MP3 reencode stdout:', stdout);
      if (stderr) console.log('⚠️ MP3 reencode stderr:', stderr);
      console.log('✅ WAV úspěšně reenkódováno do MP3');
    } catch (reencodeError) {
      console.error('❌ MP3 reencode error:', reencodeError);
      throw new Error(`WAV to MP3 reencode failed: ${reencodeError.message}`);
    }
    
    // Vyčisti dočasné soubory
    console.log('🧹 Čistím dočasné WAV soubory...');
    const filesToCleanup = [...wavSegments, wavConcatListPath, mergedWavPath];
    
    for (const fileToClean of filesToCleanup) {
      try {
        await fs.unlink(fileToClean);
      } catch (unlinkError) {
        console.warn(`⚠️ Nelze smazat dočasný soubor ${fileToClean}:`, unlinkError.message);
      }
    }
    
    // Ověř délku výsledného audio
    const ffprobeCommand = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${finalFilePath}"`;
    const { stdout } = await execAsync(ffprobeCommand);
    const actualDuration = parseFloat(stdout.trim());
    
    console.log(`🎵 Merged audio délka: ${actualDuration.toFixed(2)}s (target: ${targetDuration}s)`);
    
    // e) Pokud je potřeba target_time → truncate AŽ NA KONCI (podle instrukcí)
    console.log(`🎯 Kontroluji délku finálního MP3: ${actualDuration.toFixed(2)}s vs target ${targetDuration}s`);
    
    if (actualDuration > targetDuration + 0.1) {
      // Truncate na přesný target_time
      console.log(`✂️ APLIKUJI TARGET TRUNCATION: Cutting ${actualDuration.toFixed(2)}s → ${targetDuration}s`);
      
      const truncatedFilePath = path.join(uploadsDir, `truncated_${finalFileName}`);
      const truncateCommand = `ffmpeg -y -t ${targetDuration} -i "${finalFilePath}" "${truncatedFilePath}"`;
      
      try {
        await execAsync(truncateCommand);
        await fs.rename(truncatedFilePath, finalFilePath); // Replace s truncated verzí
        console.log(`✅ Audio úspěšně truncated na ${targetDuration}s`);
      } catch (truncateError) {
        console.error(`❌ Chyba při truncation:`, truncateError);
        throw new Error(`Target truncation failed: ${truncateError.message}`);
      }
    } else if (actualDuration < targetDuration - 0.5) {
      // Jen pokud je výrazně kratší, přidej ticho
      const silenceDuration = targetDuration - actualDuration;
      const tempFilePath = path.join(uploadsDir, `temp_${finalFileName}`);
      
      console.log(`🔇 Přidávám ${silenceDuration.toFixed(2)}s ticha na konec...`);
      
      const paddingCommand = `ffmpeg -i "${finalFilePath}" -af "apad=pad_dur=${silenceDuration}" -y "${tempFilePath}"`;
      
      await execAsync(paddingCommand);
      await fs.rename(tempFilePath, finalFilePath);
      
      console.log('✅ Ticho přidáno na konec audio');
    } else {
      console.log(`✅ Audio délka v pořádku: ${actualDuration.toFixed(2)}s (target: ${targetDuration}s)`);
    }
    
    // ✅ Finální validace délky merged audio
    const finalFFprobeCommand = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${finalFilePath}"`;
    const { stdout: finalStdout } = await execAsync(finalFFprobeCommand);
    const finalActualDuration = parseFloat(finalStdout.trim());
    
    console.log(`🎯 FINAL VALIDATION: audio=${finalActualDuration.toFixed(2)}s, target=${targetDuration}s, diff=${Math.abs(finalActualDuration - targetDuration).toFixed(2)}s`);
    
    // ✅ KONTROLA FINÁLNÍ DÉLKY
    console.log(`✅ Final merged audio created. Duration: ${finalActualDuration.toFixed(2)}s`);
    if (finalActualDuration < targetDuration * 0.8) {
      throw new Error(`❌ CRITICAL: Final audio only ${finalActualDuration.toFixed(2)}s but expected ${targetDuration}s!`);
    }
    
    // ✅ Truncation už byla aplikována v novém WAV flow výše
    console.log(`✅ Audio duration po novém WAV flow: ${finalActualDuration.toFixed(2)}s vs ${targetDuration}s`)
    
    console.log('✅ Audio segmenty úspěšně sloučeny');
    return `/uploads/${finalFileName}`;
    
  } catch (error) {
    console.error('❌ Chyba při slučování audio segmentů:', error);
    throw new Error(`FFmpeg merge failed: ${error.message}`);
  }
}

export interface VoiceGenerationResult {
  segments: VoiceSegment[];
  totalDuration: number;
  targetTime: number;
  speakingRate: number;
  finalAudioPath?: string;
  finalAudioDuration?: number;
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
  apiKeys: ApiKeys,
  targetDuration: number, // ✅ Unifikováno - všude targetDuration
  pipelineId?: string // ✅ Přidáno pro slučování segmentů
): Promise<VoiceGenerationResult> {
  console.log('🗣️ Spouštím ElevenLabs Voice Generation s segmentací...');
  
  // ✅ Debug logování API klíčů
  console.log('🐛 Voice Pipeline DEBUG - API klíče:');
  console.log('🔑 apiKeys received:', Object.keys(apiKeys));
  console.log('🔑 voiceId value:', apiKeys.voiceId);
  console.log('🔑 elevenlabs starts with:', apiKeys.elevenlabs ? `${apiKeys.elevenlabs.substring(0, 10)}...` : 'MISSING');
  
  // ✅ Debug logování targetDuration
  console.log(`🎯 Target duration: ${targetDuration} seconds`);
  
  // ✅ Validace targetDuration (ochrana proti nevalidním hodnotám)
  if (!targetDuration || targetDuration < 3 || targetDuration > 60) {
    throw new Error(`❌ Invalid targetDuration: ${targetDuration} (must be 3–60 seconds)`);
  }
  
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
    // Extrakce timeline segments - STRICT, NO FALLBACKS
    let timelineSegments = [];
    
    if (!timeline || !timeline.segments || !Array.isArray(timeline.segments)) {
      throw new Error(`❌ PIPELINE STOPPED: Invalid timeline data. Timeline must contain segments array. Received: ${typeof timeline}`);
    }
    
    if (timeline.segments.length < 2) {
      throw new Error(`❌ PIPELINE STOPPED: Timeline has insufficient segments (${timeline.segments.length} < 2). AI must generate at least 2 segments.`);
    }
    
    timelineSegments = timeline.segments;
    
    // 🟢 DEBUG: Preparing ElevenLabs payload...
    console.log("🟢 DEBUG: Preparing ElevenLabs payload...");
    console.log(`Total segments from Timeline: ${timelineSegments.length}`);
    timelineSegments.forEach((s: any, i: number) => {
      const text = s.voice_text || s.text || '';
      console.log(`Segment #${i+1}: "${text}" (${text.split(' ').length} words)`);
    });
    
    console.log(`🔄 Generuji hlas pro ${timelineSegments.length} segmentů z timeline`);

    // 🎯 KALKULACE SPEAKING RATE
    const totalWords = timelineSegments.reduce((sum: number, seg: any) => {
      const text = seg.voice_text || seg.text || '';
      return sum + text.split(' ').filter((w: string) => w.length > 0).length;
    }, 0);
    
    const wordsPerSecond = totalWords / targetDuration;
    const expectedDuration = totalWords / 2.3; // Standardní rychlost 2.3 slov/sec
    
    console.log(`📊 Voice Stats - Total words: ${totalWords}, Expected duration: ${expectedDuration.toFixed(1)}s, Target: ${targetDuration}s`);
    
    // 🎚️ ENHANCED DYNAMIC SPEAKING RATE ADJUSTMENT
    let speakingRate = 1.0;
    const durationDiff = expectedDuration - targetDuration;
    const diffPercentage = (durationDiff / targetDuration) * 100;
    
    console.log(`📊 Duration analysis: expected=${expectedDuration.toFixed(1)}s, target=${targetDuration}s, diff=${durationDiff.toFixed(1)}s (${diffPercentage.toFixed(1)}%)`);
    
    if (Math.abs(diffPercentage) <= 5) {
      // ±5% tolerance - perfektní
      speakingRate = 1.0;
      console.log(`✅ Speaking rate zůstává 1.0 (optimální délka, rozdíl ${diffPercentage.toFixed(1)}%)`);
    } else if (durationDiff > 0) {
      // Příliš dlouhé → zrychli
      if (diffPercentage > 20) {
        speakingRate = 1.25; // Výrazně zrychli
      } else if (diffPercentage > 10) {
        speakingRate = 1.15; // Středně zrychli
      } else {
        speakingRate = 1.05; // Mírně zrychli
      }
      console.log(`⚡ Zrychluju speaking rate na ${speakingRate} (příliš dlouhé o ${diffPercentage.toFixed(1)}%)`);
    } else {
      // Příliš krátké → zpomal
      if (Math.abs(diffPercentage) > 20) {
        speakingRate = 0.85; // Výrazně zpomal
      } else if (Math.abs(diffPercentage) > 10) {
        speakingRate = 0.9; // Středně zpomal
      } else {
        speakingRate = 0.95; // Mírně zpomal
      }
      console.log(`🐌 Zpomaluju speaking rate na ${speakingRate} (příliš krátké o ${Math.abs(diffPercentage).toFixed(1)}%)`);
    }
    
    // ✅ Clamp speaking rate do bezpečných mezí ElevenLabs
    speakingRate = Math.max(0.8, Math.min(1.3, speakingRate));
    console.log(`🎚️ Final speaking rate: ${speakingRate} (clamped to 0.8-1.3 range)`);
    
    // ✅ Předpověď finální délky s upraveným speaking rate
    const predictedDuration = expectedDuration / speakingRate;
    console.log(`🎯 Predicted final duration: ${predictedDuration.toFixed(1)}s (${((predictedDuration / targetDuration) * 100).toFixed(1)}% of target)`);
    
    if (Math.abs(predictedDuration - targetDuration) > targetDuration * 0.15) {
      console.warn(`⚠️ Predicted duration ${predictedDuration.toFixed(1)}s still differs significantly from target ${targetDuration}s`);
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
    
    // ✅ KONTROLA PŘED ELEVENLABS
    if (!timelineSegments || timelineSegments.length === 0) {
      throw new Error("❌ CRITICAL: No segments found for ElevenLabs request!");
    }
    
    for (let i = 0; i < timelineSegments.length; i++) {
      const segment = timelineSegments[i];
      
      // ✅ Vezmi čistý script z timeline (nikdy voice direction!)
      const segmentText = segment.text || segment.voice_text || '';
      
      if (!segmentText.trim()) {
        throw new Error(`❌ Empty segment text at index ${i + 1}`);
      }
      
      console.log(`🎤 Generuji segment ${i + 1}/${timelineSegments.length}: "${segmentText.substring(0, 50)}..."`);
      
      try {
        // ✅ Vyčisti text od metadat (HOOK, sekundy, markdown, apod.)
        let textToSpeak = cleanVoiceText(segmentText);
        
        // ✅ Validace že text není prázdný po čištění
        if (!textToSpeak || textToSpeak.length < 10) {
          throw new Error("❌ Text too short for ElevenLabs after cleaning");
        }
        
        // ✅ Kontrola, jestli se neposílá VOICE DIRECTION
        if (/Tone:|Pace:|Emphasis:|Inflection:/.test(textToSpeak)) {
          throw new Error("❌ Wrong input for ElevenLabs – VOICE DIRECTION DETECTED!");
        }
        
        // ✅ Pre-check délky textu vůči targetDuration
        const segmentTargetDuration = segment.duration || (targetDuration / timelineSegments.length);
        const estimatedDuration = estimateDuration(textToSpeak, voiceSettings.speaking_rate);
        
        // 🎯 DETAILNÍ DEBUG LOGY PRO LADĚNÍ
        const baseWPS = 3.5; // reálná rychlost ElevenLabs (stejné jako v estimateDuration)
        const dynamicWPS = baseWPS * (voiceSettings.speaking_rate || 1);
        console.log(`🎯 Target duration: ${segmentTargetDuration.toFixed(2)}s`);
        console.log(`📊 Expected WPS: ${dynamicWPS.toFixed(2)} (base: ${baseWPS}, rate: ${voiceSettings.speaking_rate})`);
        console.log(`🔍 Segment estimation: ${estimatedDuration.toFixed(2)}s, target: ${segmentTargetDuration.toFixed(2)}s`);
        console.log(`📊 Segment ${i + 1}: target ${segmentTargetDuration.toFixed(1)}s, estimated ${estimatedDuration.toFixed(1)}s`);
        console.log(`🎬 Max duration per segment: ${(targetDuration / timelineSegments.length).toFixed(2)}s (${targetDuration}s / ${timelineSegments.length} segments)`);
        
        // ✅ Nová tolerantní logika (20% tolerance před truncation)
        if (estimatedDuration > segmentTargetDuration * 1.2) {
          console.warn(`⚠️ Text je delší o ${Math.round((estimatedDuration / segmentTargetDuration - 1) * 100)}% → zkracuji`);
          textToSpeak = truncateTextToDuration(textToSpeak, segmentTargetDuration * 1.15, voiceSettings.speaking_rate);
        } else {
          console.log(`✅ Text je v toleranci (${estimatedDuration.toFixed(2)}s vs target ${segmentTargetDuration.toFixed(2)}s), ponechávám celý`);
        }
        
        console.log(`✅ CLEAN TEXT FOR ELEVENLABS: ${textToSpeak}`);
        console.log(`⏱️ Estimated duration: ${estimateDuration(textToSpeak, voiceSettings.speaking_rate).toFixed(1)}s (target ${segmentTargetDuration.toFixed(1)}s)`);
        if (estimatedDuration > segmentTargetDuration) console.log("✂️ Text truncated to fit timing");
        
        // ✅ ADAPTIVE SPEAKING RATE - moved to AFTER real duration measurement
        
        // Generuj audio pro tento segment
        const voiceResponse = await generateVoice(
          textToSpeak,
          apiKeys.voiceId,
          apiKeys.elevenlabs,
          voiceSettings
        );

        // ✅ Validace ElevenLabs response
        if (!voiceResponse || !voiceResponse.audio_data) {
          throw new Error(`❌ ElevenLabs generation failed for segment ${i + 1}`);
        }

        // Ulož segment audio
        const timestamp = Date.now();
        const segmentFileName = `voice_segment_${i + 1}_${timestamp}.mp3`;
        const segmentAudioPath = await saveAudioFile(voiceResponse.audio_data, segmentFileName);
        
        // ✅ MĚŘENÍ SKUTEČNÉ DÉLKY AUDIO SOUBORU místo theoretical calculation
        const actualAudioPath = path.join(process.cwd(), 'public', segmentAudioPath.replace(/^\//, ''));
        const ffprobeCommand = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${actualAudioPath}"`;
        const { stdout } = await execAsync(ffprobeCommand);
        const segmentDuration = parseFloat(stdout.trim());
        
        console.log(`🎵 Segment ${i + 1} REAL duration: ${segmentDuration.toFixed(3)}s (estimated was ${estimateDuration(textToSpeak, voiceSettings.speaking_rate).toFixed(1)}s)`);
        console.log(`⏱️ Real ElevenLabs duration: ${segmentDuration.toFixed(2)}s`);
        
        // 📏 KALIBRAČNÍ KROK - Po prvním segmentu dopočítáme reálnou rychlost ElevenLabs
        if (i === 0) {
          const segmentWords = textToSpeak.split(/\s+/).length;
          const realWPS = segmentWords / segmentDuration;
          const expectedWPS = 3.5 * voiceSettings.speaking_rate;
          const correctionFactor = realWPS / expectedWPS;
          
          console.log(`📏 CALIBRATION STEP after segment 1:`);
          console.log(`   → realWPS: ${realWPS.toFixed(2)} wps`);
          console.log(`   → expectedWPS: ${expectedWPS.toFixed(2)} wps`);
          console.log(`   → correctionFactor: ${correctionFactor.toFixed(2)}`);
          
          // Aplikuj korekci na globální estimation pro další segmenty
          // Poznámka: Toto ovlivní estimation pro truncation controls
        }
        
        generatedSegments.push({
          id: segment.id || `segment_${i + 1}`,
          text: textToSpeak,
          audioFilePath: segmentAudioPath,
          startTime: currentTime,
          endTime: currentTime + segmentDuration,
          duration: segmentDuration
        });
        
        currentTime += segmentDuration;
        console.log(`✅ Segment ${i + 1} uložen: ${segmentAudioPath} (${segmentDuration.toFixed(1)}s)`);
        
        // 🎯 SPEAKING RATE ADAPTACE - když je ElevenLabs rychlejší než očekáváno
        const expectedSegmentDuration = estimateDuration(textToSpeak, voiceSettings.speaking_rate);
        if (segmentDuration < expectedSegmentDuration * 0.8) {
          console.warn(`⚠️ ElevenLabs too fast: ${segmentDuration.toFixed(2)}s vs expected ${expectedSegmentDuration.toFixed(2)}s → slowing down`);
          voiceSettings.speaking_rate *= 0.75; // zpomalí o 25%
          voiceSettings.speaking_rate = Math.max(voiceSettings.speaking_rate, 0.6); // min limit
          console.log(`🐌 Adjusted speaking_rate to: ${voiceSettings.speaking_rate.toFixed(2)}`);
        }
        
        // ✅ GLOBAL DURATION CONTROL - aggressive approach
        if (i < timelineSegments.length - 1) { 
          const accumulatedRealDuration = generatedSegments.reduce((sum, seg) => sum + seg.duration, 0);
          const remainingTargetTime = targetDuration - accumulatedRealDuration;
          const remainingSegments = timelineSegments.length - (i + 1);
          
          console.log(`🎯 GLOBAL CONTROL: After segment ${i + 1}: accumulated ${accumulatedRealDuration.toFixed(2)}s, remaining ${remainingTargetTime.toFixed(2)}s for ${remainingSegments} segments`);
          
          if (remainingSegments > 0) {
            const avgTimePerRemainingSegment = remainingTargetTime / remainingSegments;
            
            if (avgTimePerRemainingSegment < 2.0) {
              // Velmi málo času zbývá → agresivní truncation a vysoký speaking rate
              console.warn(`🚨 EMERGENCY: Only ${avgTimePerRemainingSegment.toFixed(1)}s per remaining segment! Applying emergency controls.`);
              
              // Truncate remaining segments heavily
              const maxWordsPerRemainingSegment = Math.floor(avgTimePerRemainingSegment * 2.3 * 1.8); // Allow 1.8 speaking rate
              console.log(`✂️ EMERGENCY TRUNCATION: Max ${maxWordsPerRemainingSegment} words per remaining segment`);
              
              // Aggressive speaking rate
              voiceSettings.speaking_rate = Math.min(1.8, avgTimePerRemainingSegment > 1.5 ? 1.5 : 1.8);
            } else if (avgTimePerRemainingSegment < 3.0) {
              // Moderate time pressure → moderate adjustments
              voiceSettings.speaking_rate = Math.min(1.5, 1.2);
              console.log(`⚡ MODERATE ADJUSTMENT: ${avgTimePerRemainingSegment.toFixed(1)}s/segment → rate ${voiceSettings.speaking_rate}`);
            } else {
              // Plenty of time → slow down for quality
              voiceSettings.speaking_rate = Math.max(0.9, 1.0);
              console.log(`🐌 SLOW DOWN: ${avgTimePerRemainingSegment.toFixed(1)}s/segment → rate ${voiceSettings.speaking_rate}`);
            }
          }
        }
        
      } catch (segmentError) {
        console.error(`❌ Chyba při generování segmentu ${i + 1}:`, segmentError);
        throw new Error(`Generování segmentu ${i + 1} selhalo: ${segmentError.message}`);
      }
    }

    const totalGeneratedDuration = generatedSegments.reduce((sum, seg) => sum + seg.duration, 0);
    
    // 🟠 DEBUG: ElevenLabs API responded...
    console.log("🟠 DEBUG: ElevenLabs API responded...");
    console.log(`Expected audio segments: ${timelineSegments.length}`);
    console.log(`Returned audio segments: ${generatedSegments.length}`);
    generatedSegments.forEach((resp, i) => {
      console.log(`Audio #${i+1}: file=${resp.audioFilePath}, duration=${resp.duration?.toFixed(2) || 'unknown'}s`);
    });

    // Pokud ElevenLabs vrátí méně segmentů, stopni pipeline:
    if (generatedSegments.length !== timelineSegments.length) {
      throw new Error(`❌ CRITICAL: ElevenLabs returned ${generatedSegments.length} audios but expected ${timelineSegments.length}`);
    }
    
    console.log(`🎉 Voice Generation dokončen! ${generatedSegments.length} segmentů, celková délka: ${totalGeneratedDuration.toFixed(1)}s`);

    // 🎬 SLUČOVÁNÍ SEGMENTŮ DO FINÁLNÍHO AUDIO
    let finalAudioPath: string | undefined;
    let finalAudioDuration: number | undefined;
    
    console.log('🔍 MERGE DEBUG - pipelineId:', pipelineId);
    console.log('🔍 MERGE DEBUG - generatedSegments.length:', generatedSegments.length);
    console.log('🔍 MERGE DEBUG - targetDuration:', targetDuration);
    
    if (pipelineId && generatedSegments.length > 0) {
      try {
        console.log('🎬 Slučuji audio segmenty do finálního souboru...');
        finalAudioPath = await mergeAudioSegments(generatedSegments, pipelineId, targetDuration);
        
        // Ověř délku finálního audio pomocí ffprobe
        const finalFilePath = path.join(process.cwd(), 'public', finalAudioPath);
        const ffprobeCommand = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${finalFilePath}"`;
        const { stdout } = await execAsync(ffprobeCommand);
        finalAudioDuration = parseFloat(stdout.trim());
        
        console.log(`✅ Finální audio vytvořeno: ${finalAudioPath} (${finalAudioDuration.toFixed(2)}s)`);
        console.log(`🔍 Final ElevenLabs audio: ${finalAudioDuration.toFixed(2)}s vs target ${targetDuration.toFixed(2)}s`);
        
        // ✅ Post-generation truncation (pokud je audio delší než target)
        if (finalAudioDuration > targetDuration + 0.3) { // 300ms tolerance
          console.warn(`✂️ ElevenLabs audio je delší (${finalAudioDuration.toFixed(2)}s) → ořezávám na ${targetDuration}s`);
          const truncatedPath = finalAudioPath.replace('.mp3', '_truncated.mp3');
          const truncatedFullPath = path.join(process.cwd(), 'public', truncatedPath);
          const truncateCommand = `ffmpeg -i "${finalFilePath}" -t ${targetDuration} -c copy -y "${truncatedFullPath}"`;
          
          try {
            await execAsync(truncateCommand);
            // Změň finální soubor na ořezaný
            const moveCommand = `mv "${truncatedFullPath}" "${finalFilePath}"`;
            await execAsync(moveCommand);
            finalAudioDuration = targetDuration; // Aktualizuj délku
            console.log(`✅ Audio úspěšně ořezáno na ${targetDuration}s`);
          } catch (truncateError) {
            console.error('❌ Chyba při ořezávání audio:', truncateError);
          }
        } else {
          console.log(`✅ ElevenLabs audio je v toleranci (${finalAudioDuration.toFixed(2)}s), nechávám beze změny`);
        }
        
        // Validace délky finálního audio
        if (finalAudioDuration < targetDuration - 0.5) {
          console.warn(`⚠️ Finální audio je kratší než target: ${finalAudioDuration.toFixed(2)}s < ${targetDuration}s`);
        }
        
      } catch (mergeError) {
        console.error('❌ Chyba při slučování segmentů:', mergeError);
        // Pokračuj bez finálního audio - fallback na segmenty
        console.log('📋 Fallback: používám individuální segmenty místo finálního audio');
      }
    }

    // ✅ Enhanced result s kompletními metadaty
    const result: VoiceGenerationResult = {
      segments: generatedSegments,
      totalDuration: totalGeneratedDuration,
      targetTime: targetDuration,
      speakingRate: speakingRate,
      finalAudioPath,
      finalAudioDuration
    };
    
    // ✅ Final summary log
    console.log('🎉 VOICE GENERATION SUMMARY:');
    console.log(`   📊 Generated segments: ${generatedSegments.length}`);
    console.log(`   ⏱️ Individual segments total: ${totalGeneratedDuration.toFixed(2)}s`);
    console.log(`   🎯 Target duration: ${targetDuration}s`);
    console.log(`   🎚️ Speaking rate used: ${speakingRate}`);
    console.log(`   🎵 Final audio: ${finalAudioPath ? 'merged' : 'individual segments'}`);
    console.log(`   📏 Final duration: ${finalAudioDuration ? finalAudioDuration.toFixed(2) + 's' : 'N/A'}`);
    
    return result;

  } catch (error) {
    console.error('❌ Voice Generation chyba:', error);
    throw new Error(`Voice Generation selhal: ${error.message}`);
  }
} 