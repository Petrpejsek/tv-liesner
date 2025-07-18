// FFmpeg Video Processing and Merging
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface VideoInputs {
  avatarVideoUrl: string;
  backgroundVideoUrl: string;
  audioFilePath: string;
  duration: number;
}

export interface FFmpegOutput {
  outputPath: string;
  duration: number;
  size: string;
  resolution: string;
}

export interface VoiceSegment {
  id: string;
  text: string;
  audioFilePath: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface MergeVoiceSegmentsResult {
  outputPath: string;
  finalDuration: number;
  targetTime: number;
  speedAdjustment: number;
  segmentsCount: number;
}

// Download video/audio from URL
async function downloadFile(url: string, outputPath: string): Promise<void> {
  console.log(`⬇️ Stahování ${url} do ${outputPath}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download selhalo: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, new Uint8Array(buffer));
}

// Merge avatar video s background a audio
export async function mergeVideoComponents(
  inputs: VideoInputs,
  outputFilename: string = `reel_${Date.now()}.mp4`
): Promise<FFmpegOutput> {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });

  const tempDir = path.join(uploadsDir, 'temp');
  await fs.mkdir(tempDir, { recursive: true });

  const avatarPath = path.join(tempDir, 'avatar.mp4');
  const backgroundPath = path.join(tempDir, 'background.mp4');
  const outputPath = path.join(uploadsDir, outputFilename);

  try {
    // Download avatar a background videa
    await downloadFile(inputs.avatarVideoUrl, avatarPath);
    await downloadFile(inputs.backgroundVideoUrl, backgroundPath);

    console.log('🎬 Spouštím FFmpeg merge...');

    // FFmpeg command pro složitý kompozit:
    // 1. Background video jako spodní vrstva
    // 2. Avatar video s green screen removal (chroma key)
    // 3. Audio overlay
    // 4. Škálování na 9:16 formát
    const ffmpegArgs = [
      '-i', backgroundPath,           // Input 0: Background
      '-i', avatarPath,              // Input 1: Avatar
      '-i', inputs.audioFilePath,    // Input 2: Audio
      
      // Filter complex pro layering
      '-filter_complex', `
        [0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg];
        [1:v]chromakey=0x00ff00:0.1:0.2,scale=540:960[avatar];
        [bg][avatar]overlay=(W-w)/2:(H-h)/2[final]
      `,
      
      '-map', '[final]',             // Use final video
      '-map', '2:a',                 // Use audio from input 2
      
      // Video nastavení
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      
      // Audio nastavení  
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      
      // Časování
      '-t', inputs.duration.toString(),
      
      // Output
      '-f', 'mp4',
      '-y', // Přepiš existující soubor
      outputPath
    ];

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
        // Základní progress log
        if (data.toString().includes('time=')) {
          console.log('⏳ FFmpeg progress:', data.toString().match(/time=\S+/)?.[0]);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ FFmpeg merge dokončen');
          resolve();
        } else {
          console.error('❌ FFmpeg stderr:', stderr);
          reject(new Error(`FFmpeg selhalo s kódem ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg chyba: ${error.message}`));
      });
    });

    // Získání info o výsledném videu
    const stats = await fs.stat(outputPath);
    const videoInfo = await getVideoInfo(outputPath);

    // Cleanup temp souborů
    await cleanupTempFiles([avatarPath, backgroundPath]);

    return {
      outputPath,
      duration: inputs.duration,
      size: formatBytes(stats.size),
      resolution: videoInfo.resolution || '1080x1920'
    };

  } catch (error) {
    // Cleanup při chybě
    await cleanupTempFiles([avatarPath, backgroundPath]);
    throw error;
  }
}

// Získání informací o videu
async function getVideoInfo(videoPath: string): Promise<{ duration?: number; resolution?: string }> {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      videoPath
    ]);

    let stdout = '';
    ffprobe.stdout.on('data', (data) => stdout += data);
    
    ffprobe.on('close', () => {
      try {
        const info = JSON.parse(stdout);
        const videoStream = info.streams.find((s: { codec_type: string; width: number; height: number }) => s.codec_type === 'video');
        
        resolve({
          duration: parseFloat(info.format.duration),
          resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : undefined
        });
      } catch {
        resolve({});
      }
    });
  });
}

// Cleanup temp souborů
async function cleanupTempFiles(paths: string[]): Promise<void> {
  for (const filePath of paths) {
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Smazán temp soubor: ${path.basename(filePath)}`);
    } catch (error) {
      console.warn(`⚠️ Nepovedlo se smazat ${filePath}:`, error);
    }
  }
}

// Formátování velikosti souboru
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check jestli je FFmpeg nainstalováno
export async function checkFFmpegInstallation(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    
    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
    
    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}

// 🎞️ MERGE VOICE SEGMENTS s duration validation a auto-speed adjustment
export async function mergeVoiceSegments(
  segments: VoiceSegment[],
  targetTime: number,
  outputFilename: string = `merged_voice_${Date.now()}.mp3`
): Promise<MergeVoiceSegmentsResult> {
  console.log('🎞️ Spouštím merge voice segments...');
  console.log(`📊 Segments: ${segments.length}, Target time: ${targetTime}s`);

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });

  const tempDir = path.join(uploadsDir, 'temp');
  await fs.mkdir(tempDir, { recursive: true });

  const outputPath = path.join(uploadsDir, outputFilename);

  try {
    // 📊 KALKULACE CELKOVÉ DÉLKY
    const totalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0);
    console.log(`⏱️ Celková délka segmentů: ${totalDuration.toFixed(1)}s`);

    // 🎚️ DETERMINE SPEED ADJUSTMENT
    let speedAdjustment = 1.0;
    const tolerance = 1.0; // Tolerance 1 sekunda
    
    if (totalDuration > targetTime + tolerance) {
      speedAdjustment = totalDuration / targetTime;
      console.log(`⚡ Audio je příliš dlouhé (${totalDuration.toFixed(1)}s > ${targetTime + tolerance}s) - zrychlují na ${speedAdjustment.toFixed(2)}x`);
    } else if (totalDuration < targetTime - tolerance) {
      speedAdjustment = totalDuration / targetTime;
      console.log(`🐌 Audio je příliš krátké (${totalDuration.toFixed(1)}s < ${targetTime - tolerance}s) - zpomalují na ${speedAdjustment.toFixed(2)}x`);
    } else {
      console.log(`✅ Audio délka je optimální (${totalDuration.toFixed(1)}s ≈ ${targetTime}s)`);
    }

    // 🔗 CONCATENATE SEGMENTS
    if (segments.length === 1) {
      // Jeden segment - jednoduché speed adjustment
      const inputPath = path.join(process.cwd(), 'public', segments[0].audioFilePath);
      
      let ffmpegArgs: string[];
      if (speedAdjustment !== 1.0) {
        ffmpegArgs = [
          '-i', inputPath,
          '-filter:a', `atempo=${Math.min(2.0, Math.max(0.5, speedAdjustment))}`, // FFmpeg atempo limit 0.5-2.0
          '-c:a', 'mp3',
          '-y',
          outputPath
        ];
      } else {
        ffmpegArgs = [
          '-i', inputPath,
          '-c:a', 'mp3',
          '-y',
          outputPath
        ];
      }

      await runFFmpegCommand(ffmpegArgs, 'single segment merge');
      
    } else {
      // Více segmentů - concat + speed adjustment
      
      // Vytvoř concat file
      const concatFilePath = path.join(tempDir, `concat_${Date.now()}.txt`);
      const concatContent = segments.map(segment => {
        const absolutePath = path.join(process.cwd(), 'public', segment.audioFilePath);
        return `file '${absolutePath}'`;
      }).join('\n');
      
      await fs.writeFile(concatFilePath, concatContent);
      console.log(`📝 Concat file vytvořen: ${concatFilePath}`);

      let ffmpegArgs: string[];
      if (speedAdjustment !== 1.0) {
        ffmpegArgs = [
          '-f', 'concat',
          '-safe', '0',
          '-i', concatFilePath,
          '-filter:a', `atempo=${Math.min(2.0, Math.max(0.5, speedAdjustment))}`,
          '-c:a', 'mp3',
          '-y',
          outputPath
        ];
      } else {
        ffmpegArgs = [
          '-f', 'concat',
          '-safe', '0',
          '-i', concatFilePath,
          '-c:a', 'mp3',
          '-y',
          outputPath
        ];
      }

      await runFFmpegCommand(ffmpegArgs, 'multiple segments merge');
      
      // Cleanup concat file
      await fs.unlink(concatFilePath);
    }

    // 📊 GET FINAL DURATION
    const finalDuration = totalDuration / speedAdjustment;
    
    console.log(`🎉 Voice merge dokončen!`);
    console.log(`📄 Output: ${outputPath}`);
    console.log(`⏱️ Final duration: ${finalDuration.toFixed(1)}s`);
    console.log(`🎚️ Speed adjustment: ${speedAdjustment.toFixed(2)}x`);

    return {
      outputPath: `/uploads/${outputFilename}`, // Return web-accessible path
      finalDuration,
      targetTime,
      speedAdjustment,
      segmentsCount: segments.length
    };

  } catch (error) {
    console.error('❌ Voice merge chyba:', error);
    throw new Error(`Voice merge selhal: ${error.message}`);
  }
}

// Helper function pro spuštění FFmpeg command
async function runFFmpegCommand(args: string[], operation: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    console.log(`🎬 Running FFmpeg for ${operation}:`, args.join(' '));
    
    const ffmpeg = spawn('ffmpeg', args);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ FFmpeg ${operation} dokončen`);
        resolve();
      } else {
        console.error(`❌ FFmpeg ${operation} selhal s kódem ${code}`);
        console.error('FFmpeg stderr:', stderr);
        reject(new Error(`FFmpeg ${operation} selhal: ${stderr}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      console.error(`❌ FFmpeg ${operation} spawn error:`, error);
      reject(error);
    });
  });
} 