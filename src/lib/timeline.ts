// Timeline Creation - Custom Script for Time Calculation
export interface TimelineSegment {
  id: string;
  text: string;
  startTime: number;  // v sekundách
  endTime: number;    // v sekundách
  duration: number;   // v sekundách
  wordCount: number;
}

export interface TimelineResult {
  segments: TimelineSegment[];
  totalDuration: number;
  totalWords: number;
  averageWordsPerSecond: number;
}

/**
 * Vytvoří timeline z text scriptu na základě cílové délky videa
 * @param script - Kompletní script text
 * @param targetDuration - Cílová délka videa v sekundách
 * @param segmentCount - Počet segmentů (vychozí 5)
 */
export function createTimeline(
  script: string, 
  targetDuration: number, 
  segmentCount: number = 5
): TimelineResult {
  console.log('⏱️ Vytvářím timeline pro script:', script.substring(0, 100) + '...');
  console.log(`🎯 Pipeline targetDuration: ${targetDuration}s`);
  
  // Základní validace
  if (!script || script.trim().length === 0) {
    throw new Error('Script nemůže být prázdný');
  }
  
  if (targetDuration < 5 || targetDuration > 60) {
    throw new Error('Target duration musí být mezi 5-60 sekund');
  }
  
  // ✅ Timeline musí respektovat targetDuration - zkrátit script když je moc dlouhý
  const wordsPerSecond = 2.3;
  const maxWords = Math.floor(targetDuration * wordsPerSecond);
  const originalWords = script.split(/\s+/).filter(w => w.length > 0);
  
  console.log(`📊 Max words allowed: ${maxWords} (≈ ${wordsPerSecond} wps)`);
  console.log(`📝 Original script: ${originalWords.length} words`);
  
  let limitedScript = script;
  if (originalWords.length > maxWords) {
    console.warn(`⏱️ Script má ${originalWords.length} slov, max pro ${targetDuration}s je ${maxWords} → zkracuji...`);
    limitedScript = originalWords.slice(0, maxWords).join(' ');
  }
  
  script = limitedScript; // Použij zkrácený script

  // Rozdělení scriptu na věty
  const sentences = script
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length === 0) {
    throw new Error('Nepodařilo se najít žádné věty v scriptu');
  }

  // Výpočet slov a rychlosti
  const words = script.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  const wordsPerSecond = totalWords / targetDuration;

  console.log(`📊 Timeline stats: ${totalWords} slov, ${wordsPerSecond.toFixed(2)} slov/sec`);

  // ✅ Generuj segmenty tak, aby každý měl ~3–4s → cca 12–15 slov na segment
  const wordsPerSegment = Math.floor((12 + 15) / 2); // průměr 13.5 slov
  const targetSegmentDuration = wordsPerSegment / wordsPerSecond; // ~3-4s
  
  console.log(`📊 Target: ${wordsPerSegment} slov/segment, ${targetSegmentDuration.toFixed(1)}s/segment`);
  
  const segments: TimelineSegment[] = [];
  const allWords = words; // používáme už omezené slova
  let currentTime = 0;
  let wordIndex = 0;

  // ✅ Debug: očekávaný počet segmentů
  const expectedSegmentCount = Math.ceil(allWords.length / wordsPerSegment);
  console.log(`🎬 Segments: očekává se ${expectedSegmentCount} segmentů, ~${(targetDuration/expectedSegmentCount).toFixed(2)}s per segment`);

  // Vytvoř segmenty po ~13 slovech
  let segmentId = 1;
  while (wordIndex < allWords.length) {
    const segmentWords = allWords.slice(wordIndex, wordIndex + wordsPerSegment);
    const segmentText = segmentWords.join(' ');
    const segmentWordCount = segmentWords.length;
    const segmentDuration = segmentWordCount / wordsPerSecond;
    
    segments.push({
      id: `segment_${segmentId}`,
      text: segmentText,
      startTime: currentTime,
      endTime: currentTime + segmentDuration,
      duration: segmentDuration,
      wordCount: segmentWordCount
    });
    
    currentTime += segmentDuration;
    wordIndex += wordsPerSegment;
    segmentId++;
  }

  // Normalizace časů na target duration
  const totalCalculatedTime = segments[segments.length - 1]?.endTime || 0;
  const scaleFactor = targetDuration / totalCalculatedTime;
  
  let adjustedTime = 0;
  segments.forEach(segment => {
    const adjustedDuration = segment.duration * scaleFactor;
    segment.startTime = adjustedTime;
    segment.endTime = adjustedTime + adjustedDuration;
    segment.duration = adjustedDuration;
    adjustedTime += adjustedDuration;
  });

  const result: TimelineResult = {
    segments,
    totalDuration: targetDuration,
    totalWords,
    averageWordsPerSecond: wordsPerSecond
  };

  console.log('✅ Timeline vytvořena:', {
    segmentsCount: segments.length,
    totalDuration: result.totalDuration.toFixed(2),
    avgWordsPerSec: result.averageWordsPerSecond.toFixed(2)
  });

  return result;
}

/**
 * Validace timeline výsledku
 */
export function validateTimeline(timeline: TimelineResult): boolean {
  if (!timeline.segments || timeline.segments.length === 0) {
    return false;
  }

  // Check že časy jsou logické
  for (let i = 0; i < timeline.segments.length; i++) {
    const segment = timeline.segments[i];
    
    if (segment.startTime < 0 || segment.endTime <= segment.startTime) {
      return false;
    }
    
    if (i > 0) {
      const prevSegment = timeline.segments[i - 1];
      if (segment.startTime < prevSegment.endTime) {
        return false; // Překrývající se segmenty
      }
    }
  }

  return true;
}

/**
 * Export timeline do různých formátů
 */
export function exportTimeline(timeline: TimelineResult, format: 'srt' | 'vtt' | 'json' = 'json'): string {
  switch (format) {
    case 'srt':
      return timeline.segments.map((segment, index) => {
        const startSrt = formatTimeForSrt(segment.startTime);
        const endSrt = formatTimeForSrt(segment.endTime);
        return `${index + 1}\n${startSrt} --> ${endSrt}\n${segment.text}\n`;
      }).join('\n');
      
    case 'vtt':
      const vttContent = 'WEBVTT\n\n' + timeline.segments.map(segment => {
        const startVtt = formatTimeForVtt(segment.startTime);
        const endVtt = formatTimeForVtt(segment.endTime);
        return `${startVtt} --> ${endVtt}\n${segment.text}`;
      }).join('\n\n');
      return vttContent;
      
    case 'json':
    default:
      return JSON.stringify(timeline, null, 2);
  }
}

// Helper funkce pro formátování času
function formatTimeForSrt(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function formatTimeForVtt(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  
  return `${minutes.toString().padStart(2, '0')}:${secs.padStart(6, '0')}`;
}

// Export aliases pro různé import styles
export const generateTimeline = createTimeline;
export default createTimeline; 