// 🚀 AI Reels Pipeline Start API - COMPLETE IMPLEMENTATION
import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite } from '@/lib/scraper';
import { initializeOpenAI, generateProductSummary, generateViralHooks, generateVideoScript, generateVoiceDirection, generateBackgroundSelection, generateMusicSelection, generateAvatarBehavior, generateThumbnailConcept, cleanTextWithAI, generateTimeline } from '@/lib/openai';
import { generateVoiceFromScript } from '@/lib/voice-pipeline';
import { checkFFmpegInstallation } from '@/lib/ffmpeg';
import { PipelineStateManager, getDefaultPipelineSteps } from '@/lib/pipeline-state';
import { prisma } from '@/lib/database';

// Helper funkce pro kontrolu API klíčů
function getStoredApiKeys(): { [key: string]: string } {
  return {
    openai: process.env.OPENAI_API_KEY || '',
    elevenlabs: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || '',
    heygen: process.env.HEYGEN_API_KEY || '',
    json2video: process.env.JSON2VIDEO_API_KEY || ''
  };
}

// Helper funkce pro generování názvu pipeline
function generatePipelineTitle(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const timestamp = new Date().toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${domain} – ${timestamp}`;
  } catch {
    return `Pipeline ${new Date().toLocaleDateString('cs-CZ')}`;
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'AI Reels Generator Pipeline',
    status: 'ready',
    version: '2.0',
    features: [
      '🕷️ Web Scraping',
      '📝 AI Summary',
      '🎯 Viral Hooks',
      '📖 Script Generation',
      '⏱️ Timeline Creation',
      '🎙️ Voice Direction',
      '🎨 Background Selection',
      '🎵 Music & Sound',
      '👤 Avatar Behavior',
      '🖼️ Thumbnail Concept',
      '🗣️ Voice Generation',
      '👥 Avatar Generation', 
      '🎬 Background Video',
      '🎞️ Final Merge'
    ],
    requirements: {
      api_keys: 'OpenAI, ElevenLabs, HeyGen, JSON2Video',
      ffmpeg: 'Musí být nainstalován pro video merge'
    },
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("🚀 DEBUG /api/pipeline/start CALLED");

  // Načti tělo requestu
  const body = await request.json().catch(() => null);
  console.log("📥 Request body:", JSON.stringify(body, null, 2));

  // Debug: načtení hlasů z DB
  const storedVoices = await prisma.voiceAvatarPair.findMany();
  console.log("🎤 Stored voices in DB:", storedVoices);

  // Debug: načtení ENV
  console.log("🌍 ENV ELEVENLABS_VOICE_ID:", process.env.ELEVENLABS_VOICE_ID);

  // Debug fallback priority
  console.log("✅ Runtime voiceId:", body?.voiceId);

  let finalVoiceId =
    body?.voiceId ||               // 1️⃣ Frontend
    process.env.ELEVENLABS_VOICE_ID || // 2️⃣ ENV
    storedVoices[0]?.voiceId ||    // 3️⃣ První uložený hlas v DB
    null;

  if (!finalVoiceId) {
    console.error("❌ Voice Generation error: žádné Voice ID nenalezeno!");
    return NextResponse.json({
      success: false,
      error: "VOICE_ID_MISSING",
      message: "Pipeline nemá k dispozici žádný Voice ID. Přidej hlas v modal Hlasy & Avatary nebo nastav ENV ELEVENLABS_VOICE_ID.",
      storedVoicesCount: storedVoices.length
    }, { status: 400 });
  }

  console.log("✅ Používám voiceId:", finalVoiceId);

  console.log('🚀 Spouštím AI Reels Pipeline s real-time tracking...');
  
  const pipelineId = `pipeline_${Date.now()}`;
  
  try {
    // Validace body existence
    if (!body) {
      return NextResponse.json({
        success: false,
        error: 'Request body je prázdný. Odešli URL a target_duration.',
        storedVoicesCount: storedVoices.length
      }, { status: 400 });
    }

    const { url, target_duration, api_keys, ai_assistants, voice_avatars, project_title } = body;

    // Validace inputs
    if (!url || !url.startsWith('http')) {
      return NextResponse.json({
        success: false,
        error: 'Nevalidní URL. URL musí začínat http:// nebo https://',
        storedVoicesCount: storedVoices.length
      }, { status: 400 });
    }

    if (!target_duration || target_duration < 5 || target_duration > 60) {
      return NextResponse.json({
        success: false,
        error: 'Target duration musí být mezi 5-60 sekund',
        storedVoicesCount: storedVoices.length
      }, { status: 400 });
    }

    // ✅ Fallback pro target_duration s debugem
    const finalTargetDuration = target_duration || 15;
    console.log(`🎯 Pipeline targetDuration: ${finalTargetDuration}s (původní: ${target_duration})`);
    
    // ✅ Validace targetDuration (ochrana proti nesmyslům)
    if (finalTargetDuration < 3 || finalTargetDuration > 60) {
      return NextResponse.json({
        success: false,
        error: `❌ Invalid targetDuration: ${finalTargetDuration} (must be 3–60 seconds)`,
        storedVoicesCount: storedVoices.length
      }, { status: 400 });
    }

    // Check FFmpeg installation
    const ffmpegInstalled = await checkFFmpegInstallation();
    if (!ffmpegInstalled) {
      return NextResponse.json({
        success: false,
        error: 'FFmpeg není nainstalován. Spusť: brew install ffmpeg (macOS) nebo apt install ffmpeg (Linux)',
        storedVoicesCount: storedVoices.length
      }, { status: 500 });
    }

    // Vytvoř pipeline state
    const steps = getDefaultPipelineSteps();
    
    // Generování názvu pipeline
    const title = project_title || generatePipelineTitle(url);
    
    const pipelineState = await PipelineStateManager.create(pipelineId, steps, title, finalTargetDuration);
    
    // Získání API klíčů
    const apiKeys = api_keys || getStoredApiKeys();
    
    if (!apiKeys.openai) {
      await PipelineStateManager.updateStatus(pipelineId, 'error');
      return NextResponse.json({
        success: false,
        error: 'OpenAI API klíč není nastaven. Přidejte API klíče v "🔑 Spravovat API klíče".',
        pipeline_id: pipelineId
      }, { status: 400 });
    }

    // Debug info
    console.log('🐛 DEBUG - AI Asistenti přijati:', ai_assistants?.length || 0);
    if (ai_assistants) {
      ai_assistants.forEach((assistant: any) => {
        console.log(`🤖 ${assistant.name} (${assistant.id}): instrukce=${assistant.instructions?.length || 0} znaků`);
      });
    }

    // Spustit pipeline asynchronně (bez await - non-blocking)
    processPipelineAsync(pipelineId, url, finalTargetDuration, apiKeys, ai_assistants, voice_avatars, storedVoices).catch(async (error) => {
      console.error('💥 Pipeline Async Error:', error);
      await PipelineStateManager.updateStatus(pipelineId, 'error');
    });

    // Okamžitě vrať response s pipeline ID pro polling
    return NextResponse.json({
      success: true,
      message: '🚀 Pipeline spuštěna! Použij pipeline_id pro tracking progress.',
      pipeline_id: pipelineId,
      status: 'running',
      polling_endpoint: `/api/pipeline/status/${pipelineId}`,
      recommended_polling_interval: 2000, // 2 sekundy
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Pipeline Start Error:', error);
    PipelineStateManager.updateStatus(pipelineId, 'error');
    
    return NextResponse.json({
      success: false,
      error: `Pipeline start selhala: ${error instanceof Error ? error.message : 'Neočekávaná chyba'}`,
      pipeline_id: pipelineId,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Asynchronní zpracování pipeline (běží na pozadí)
async function processPipelineAsync(
  pipelineId: string,
  url: string,
  target_duration: number,
  apiKeys: any,
  ai_assistants: any[],
  voice_avatars: any[],
  storedVoices: any[]
) {
  console.log("📊 Using stored voices from parameter:", storedVoices);
  
  let scrapedContent: any;
  let productSummary: string;
  let viralHooks: string[];
  let videoScript: string;
  let timeline: any;
  let voiceDirection: string = ''; // ✅ REMOVED: Voice Direction step eliminated
  let backgroundSelection: string;
  let musicSelection: string;
  let avatarBehavior: string;
  let thumbnailConcept: string;
  let voiceGeneration: any;

  try {
    // KROK 1: Web Scraping 🕷️
    console.log('🕷️ KROK 1: Web Scraping...');
    await PipelineStateManager.updateStep(pipelineId, 'web-scraping', 'running');
    
    scrapedContent = await scrapeWebsite(url);
    
    await PipelineStateManager.updateStep(pipelineId, 'web-scraping', 'completed', {
      title: scrapedContent.title,
      description: scrapedContent.description,
      features: scrapedContent.features,
      benefits: scrapedContent.benefits,
      key_numbers: scrapedContent.key_numbers,
      tone_of_voice: scrapedContent.tone_of_voice,
      pricing: scrapedContent.pricing,
      fullText: scrapedContent.fullText,
      wordCount: scrapedContent.fullText.length,
      featuresCount: scrapedContent.features?.length || 0,
      benefitsCount: scrapedContent.benefits?.length || 0,
      keyNumbersCount: scrapedContent.key_numbers?.length || 0
    });
    console.log('✅ Web scraping dokončen');

    // KROK 2: AI Text Cleaner 🧹
    console.log('🧹 KROK 2: AI Text Cleaner...');
    await PipelineStateManager.updateStep(pipelineId, 'ai-text-cleaner', 'running');
    
    initializeOpenAI(apiKeys.openai);
    const cleanerAssistant = ai_assistants?.find((a: any) => a.id === 'ai-text-cleaner');
    
    // Kompletní čištění a enrichment pomocí AI s custom instrukcemi
    const cleanedContent = await cleanTextWithAI(scrapedContent, cleanerAssistant);
    
    // Aktualizuj scraped content s vyčištěnými daty (preserve original structure)
    scrapedContent = {
      ...scrapedContent,
      ...cleanedContent,
      // Zachovej originalní fullText a wordCount
      fullText: scrapedContent.fullText,
      wordCount: scrapedContent.wordCount
    };
    
    await PipelineStateManager.updateStep(pipelineId, 'ai-text-cleaner', 'completed', {
      originalTitle: cleanedContent.title || scrapedContent.title,
      featuresCount: cleanedContent.features?.length || 0,
      benefitsCount: cleanedContent.benefits?.length || 0,
      keyNumbersCount: cleanedContent.key_numbers?.length || 0,
      hasToneOfVoice: !!cleanedContent.tone_of_voice,
      hasPricing: !!cleanedContent.pricing,
      enrichedData: cleanedContent
    });
    console.log('✅ AI Text Cleaner dokončen');

    // KROK 3: AI Summary 📝
    console.log('📝 KROK 3: AI Summary...');
    await PipelineStateManager.updateStep(pipelineId, 'ai-summary', 'running');
    
    initializeOpenAI(apiKeys.openai);
    const fullContent = `Název: ${scrapedContent.title}

Popis: ${scrapedContent.description}

Klíčové funkce:
${scrapedContent.features?.map((f: any) => `• ${f}`).join('\n') || 'Žádné funkce nenalezeny'}

Výhody a benefity:
${scrapedContent.benefits?.map((b: any) => `• ${b}`).join('\n') || 'Žádné výhody nenalezeny'}

Klíčová čísla a statistiky:
${scrapedContent.key_numbers?.map((n: any) => `• ${n}`).join('\n') || 'Žádné statistiky nenalezeny'}

Tone of Voice: ${scrapedContent.tone_of_voice || 'professional'}

Ceny: ${scrapedContent.pricing || 'Ceny neuvedeny'}

Vyčištěný obsah stránky:
${scrapedContent.fullText}`;
    
    const summaryAssistant = ai_assistants?.find((a: any) => a.id === 'ai-summary');
    
    productSummary = await generateProductSummary(fullContent, summaryAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'ai-summary', 'completed', productSummary);
    console.log('✅ AI Summary dokončen');

    // KROK 4: Viral Hooks 🎯
    console.log('🎯 KROK 4: Viral Hooks...');
    await PipelineStateManager.updateStep(pipelineId, 'viral-hooks', 'running');
    
    const hooksAssistant = ai_assistants?.find((a: any) => a.id === 'viral-hooks');
    viralHooks = await generateViralHooks(productSummary, target_duration, hooksAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'viral-hooks', 'completed', viralHooks);
    console.log('✅ Viral Hooks dokončeny');

    // KROK 5: Script Generation 📖
    console.log('📖 KROK 5: Script Generation...');
    await PipelineStateManager.updateStep(pipelineId, 'script-generation', 'running');
    
    const scriptAssistant = ai_assistants?.find((a: any) => a.id === 'script-generation');
    // Bezpečné získání prvního hook
    const selectedHook = Array.isArray(viralHooks) ? viralHooks[0] : (typeof viralHooks === 'string' ? viralHooks : 'Amazing productivity tool!');
    
    // ✅ Debug log pro target_time
    const wordsPerSecond = 2.3;
    const maxWords = Math.floor(target_duration * wordsPerSecond);
    console.log(`🎯 FINAL target_time: ${target_duration}s, maxWords: ${maxWords}`);
    
    videoScript = await generateVideoScript(productSummary, selectedHook, target_duration, scriptAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'script-generation', 'completed', videoScript);
    console.log('✅ Script Generation dokončen');

    // KROK 6: Timeline Creator (AI) ⏱️
    console.log('⏱️ KROK 6: Timeline Creator...');
    await PipelineStateManager.updateStep(pipelineId, 'timeline-creation', 'running');
    
    const timelineAssistant = ai_assistants?.find((a: any) => a.id === 'timeline-creation');
    timeline = await generateTimeline(videoScript, target_duration, timelineAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'timeline-creation', 'completed', {
      segments: timeline.segments || [],
      metadata: {},
      segmentsCount: timeline.segments?.length || 0,
      totalDuration: timeline.totalDuration || target_duration
    });
    console.log('✅ Timeline Creator dokončen');

    // KROKY 7-10: AI Asistenti s správnými parametry
    
    // KROK 7: Background Selection 🎨
    console.log('🎨 Background Selection KROK: 🎨 Background Selection...');
    await PipelineStateManager.updateStep(pipelineId, 'background-selection', 'running');
    
    const backgroundAssistant = ai_assistants?.find((a: any) => a.id === 'background-selector');
    backgroundSelection = await generateBackgroundSelection(videoScript, backgroundAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'background-selection', 'completed', backgroundSelection);
    console.log('✅ 🎨 Background Selection dokončen');

    // KROK 8: Music & Sound 🎵
    console.log('🎵 Music & Sound KROK: 🎵 Music & Sound...');
    await PipelineStateManager.updateStep(pipelineId, 'music-sound', 'running');
    
    const musicAssistant = ai_assistants?.find((a: any) => a.id === 'music-sound');
    musicSelection = await generateMusicSelection(videoScript, viralHooks, musicAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'music-sound', 'completed', musicSelection);
    console.log('✅ 🎵 Music & Sound dokončen');

    // KROK 9: Avatar Behavior 👤
    console.log('👤 Avatar Behavior KROK: 👤 Avatar Behavior...');
    await PipelineStateManager.updateStep(pipelineId, 'avatar-behavior', 'running');
    
    const avatarAssistant = ai_assistants?.find((a: any) => a.id === 'avatar-behavior');
    avatarBehavior = await generateAvatarBehavior(videoScript, timeline, avatarAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'avatar-behavior', 'completed', avatarBehavior);
    console.log('✅ 👤 Avatar Behavior dokončen');

    // KROK 10: Thumbnail Concept 🖼️
    console.log('🖼️ Thumbnail Concept KROK: 🖼️ Thumbnail Concept...');
    await PipelineStateManager.updateStep(pipelineId, 'thumbnail-concept', 'running');
    
    const thumbnailAssistant = ai_assistants?.find((a: any) => a.id === 'thumbnail-creator');
    // Bezpečné získání prvního hook pro thumbnail
    const selectedHookForThumbnail = Array.isArray(viralHooks) ? viralHooks[0] : (typeof viralHooks === 'string' ? viralHooks : 'Amazing productivity tool!');
    thumbnailConcept = await generateThumbnailConcept(selectedHookForThumbnail, productSummary, backgroundSelection, thumbnailAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'thumbnail-concept', 'completed', thumbnailConcept);
    console.log('✅ 🖼️ Thumbnail Concept dokončen');

    // KROK 11: Voice Generation 🗣️
    console.log('🗣️ KROK 11: Voice Generation...');
    await PipelineStateManager.updateStep(pipelineId, 'voice-generation', 'running');
    
    let voiceGeneration = null;
    try {
      // 🐛 DEBUG: Kontrola vstupních dat
      console.log('🐛 Voice Generation DEBUG - Vstupní data:');
      console.log('📝 videoScript type:', typeof videoScript);
      console.log('📝 videoScript preview:', JSON.stringify(videoScript).substring(0, 200) + '...');
      console.log('⏱️ timeline type:', typeof timeline);
      console.log('⏱️ timeline hasSegments:', timeline && timeline.segments ? 'YES' : 'NO');
      console.log('⏱️ timeline segmentsCount:', timeline?.segments?.length || 0);
      console.log('🎙️ voiceDirection type:', typeof voiceDirection);
      console.log('🔑 apiKeys:', Object.keys(apiKeys));
      console.log('🔑 elevenlabs key:', apiKeys.elevenlabs ? `${apiKeys.elevenlabs.substring(0, 10)}...` : 'MISSING');
      console.log('🔑 voiceId z apiKeys:', apiKeys.voiceId || 'MISSING');
      console.log('🎭 voice_avatars count:', voice_avatars?.length || 0);
      if (voice_avatars?.length > 0) {
        console.log('🎭 První voice avatar:', voice_avatars[0]);
      }
      
      // ✅ PRIORITNÍ POŘADÍ PRO VOICE ID: Modal > Environment > DB Stored > API Keys
      const voiceIdFromModal = voice_avatars?.[0]?.voiceId;
      const voiceIdFromEnv = process.env.ELEVENLABS_VOICE_ID;
      const voiceIdFromDb = storedVoices?.[0]?.voiceId; // První uložený hlas z DB
      const avatarId = voice_avatars?.[0]?.avatarId || storedVoices?.[0]?.avatarId;
      
      console.log('🔍 Voice ID sources - DETAILNÍ ANALÝZA:');
      console.log('🎭 Z modalu (voice_avatars[0].voiceId):', voiceIdFromModal || 'PRÁZDNÉ');
      console.log('🌍 Z environment (process.env.ELEVENLABS_VOICE_ID):', voiceIdFromEnv || 'PRÁZDNÉ');
      console.log('🔑 Z apiKeys (apiKeys.voiceId):', apiKeys.voiceId || 'PRÁZDNÉ');
      console.log('🗄️ Z databáze (storedVoices[0].voiceId):', voiceIdFromDb || 'PRÁZDNÉ');
      console.log('👤 avatarId:', avatarId || 'NENÍ VYŽADOVÁNO');
      
      // ✅ SPRÁVNÉ PRIORITY: Modal > ENV > DB > API Keys
      let finalVoiceId = voiceIdFromModal || voiceIdFromEnv || voiceIdFromDb || apiKeys.voiceId;
      
      console.log('🔑 FINÁLNÍ voiceId po prioritě:', finalVoiceId || 'STÁLE CHYBÍ!!!');

      if (!finalVoiceId) {
        console.error("❌ Voice Generation error: Žádné Voice ID nenalezeno!");
        return NextResponse.json({
          success: false,
          error: "VOICE_ID_MISSING",
          message: "Pipeline nemá k dispozici žádný Voice ID – přidej hlas v modal Hlasy & Avatary nebo nastav ENV ELEVENLABS_VOICE_ID.",
          storedVoicesCount: storedVoices.length
        }, { status: 400 });
      }
      
      // ✅ KONTROLA ELEVENLABS API KEY
      if (!apiKeys.elevenlabs) {
        const errorMsg = `❌ CHYBA: ElevenLabs API Key chybí!
        
🔑 Nastav API Key:
1️⃣ V UI modalu "🔑 API klíče" 
2️⃣ NEBO v .env.local: ELEVENLABS_API_KEY=sk_your_key_here

💡 ElevenLabs API Key získáš na: https://elevenlabs.io/app/settings/api-keys`;
        
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      // 🚀 VYTVOŘ ENHANCED API KEYS S OVĚŘENÝMI HODNOTAMI
      const enhancedApiKeys = {
        ...apiKeys,
        voiceId: finalVoiceId,
        avatarId: avatarId || undefined
      };
      
      console.log('🎤 SPOUŠTÍM ELEVENLABS VOICE GENERATION...');
      console.log('🔑 Enhanced API Keys:', {
        elevenlabs: enhancedApiKeys.elevenlabs ? `${enhancedApiKeys.elevenlabs.substring(0, 10)}...` : 'MISSING',
        voiceId: enhancedApiKeys.voiceId,
        avatarId: enhancedApiKeys.avatarId || 'NENÍ'
      });
      
      // 🗣️ SKUTEČNÉ VOLÁNÍ ELEVENLABS API
      voiceGeneration = await generateVoiceFromScript(videoScript, timeline, enhancedApiKeys, target_duration, pipelineId);
      
      console.log('🎉 Voice Generation SUCCESS - Výstupní data:');
      console.log('📊 segments count:', voiceGeneration.segments?.length || 0);
      console.log('⏰ total duration:', voiceGeneration.totalDuration, 'sekund');
      console.log('🎯 target time:', voiceGeneration.targetTime, 'sekund');
      console.log('🎚️ speaking rate:', voiceGeneration.speakingRate);
      console.log('💾 audio files generated:', voiceGeneration.segments?.every(s => s.audioFilePath) ? 'ALL OK' : 'CHYBÍ');
      console.log('🎵 final audio path:', voiceGeneration.finalAudioPath || 'Jen segmenty');
      console.log('🎵 final audio duration:', voiceGeneration.finalAudioDuration ? `${voiceGeneration.finalAudioDuration.toFixed(2)}s` : 'N/A');
      
      // Extrahuj název audio souboru pro frontend
      const audioFilePath = voiceGeneration.segments?.[0]?.audioFilePath || null;
      const audioFileName = audioFilePath ? audioFilePath.split('/').pop() : null;
      
      // 🎬 PATCH: Přidání finalAudioPath pro frontend audio player
      const finalAudioFilePath = voiceGeneration.finalAudioPath || audioFilePath;
      const finalAudioFileName = finalAudioFilePath ? finalAudioFilePath.split('/').pop() : audioFileName;
      
      await PipelineStateManager.updateStep(pipelineId, 'voice-generation', 'completed', {
        segments: voiceGeneration.segments,
        totalDuration: voiceGeneration.totalDuration,
        targetTime: voiceGeneration.targetTime,
        speakingRate: voiceGeneration.speakingRate,
        voiceId: finalVoiceId,
        // ✅ PŮVODNÍ PATHS (fallback pro kompatibilitu)
        audioFilePath: audioFilePath,
        audioFileName: audioFileName,
        // ✅ FINÁLNÍ MERGED PATHS (priorita pro frontend)
        finalAudioPath: voiceGeneration.finalAudioPath,
        finalAudioDuration: voiceGeneration.finalAudioDuration,
        mergedAudioFilePath: voiceGeneration.finalAudioPath, // alias pro jasnost
        // ✅ Pro single entry point pro frontend
        audioFilePathMerged: finalAudioFilePath, // unified field
        generatedAt: new Date().toISOString(),
        success: true,
        duration: voiceGeneration.finalAudioDuration || voiceGeneration.totalDuration
      });
      
      console.log('✅ 🗣️ Voice Generation ÚSPĚŠNĚ DOKONČEN!');
      console.log('🎵 Audio soubor:', audioFileName);
      
      // ⏹️ Zastav pipeline po Voice Generation (dočasně vypnuty kroky 12–14)
      console.log("⏹️ Pipeline se zastavila po Voice Generation (dočasně vypnuty kroky 12–14)");
      
      // Nastav final outputs pouze s dokončenými kroky
      PipelineStateManager.setFinalOutputs(pipelineId, {
        scraped_content: scrapedContent,
        product_summary: productSummary,
        viral_hooks: viralHooks,
        video_script: videoScript,
        timeline: timeline,
        background_selection: backgroundSelection,
        music_selection: musicSelection,
        avatar_behavior: avatarBehavior,
        thumbnail_concept: thumbnailConcept,
        voice_generation: voiceGeneration
      });

      // Označit kroky 12-14 jako not_implemented
      const notImplementedSteps = ['avatar-generation', 'background-video', 'final-merge'];
      for (const stepId of notImplementedSteps) {
        await PipelineStateManager.updateStep(pipelineId, stepId, 'not_implemented', 
          'Tento krok bude implementován v další fázi s externí APIs integracemi.');
      }

      // Dokončit pipeline
      await PipelineStateManager.updateStatus(pipelineId, 'completed');
      console.log(`🎉 Pipeline ${pipelineId} dokončena úspěšně! (11/14 kroků)`);
      
      return; // Ukončit funkci zde
      
    } catch (error) {
      console.error('💥 Voice Generation Error - KOMPLETNÍ ANALÝZA:');
      console.error('❌ Error type:', error instanceof Error ? error.constructor.name : 'Unknown');
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('🔍 Context data:');
      console.error('  - voice_avatars:', voice_avatars);
      console.error('  - apiKeys.elevenlabs length:', apiKeys.elevenlabs?.length || 0);
      console.error('  - apiKeys.voiceId:', apiKeys.voiceId);
      console.error('  - videoScript type:', typeof videoScript);
      console.error('  - timeline segments:', timeline?.segments?.length || 0);
      
      await PipelineStateManager.updateStep(pipelineId, 'voice-generation', 'error', {
        success: false,
        error: "ELEVENLABS_API_ERROR",
        message: error instanceof Error ? error.message : 'Unknown error',
        details: (error as any)?.response?.data || 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        timestamp: new Date().toISOString(),
        context: {
          hasVoiceAvatars: voice_avatars?.length > 0,
          hasElevenLabsKey: !!apiKeys.elevenlabs,
          hasVoiceId: !!apiKeys.voiceId,
          videoScriptType: typeof videoScript,
          timelineSegments: timeline?.segments?.length || 0
        }
      });
      
      console.log('❌ 🗣️ Voice Generation SKONČIL S CHYBOU - viz details výše');
      throw error; // Re-throw error to stop pipeline
    }

  } catch (error) {
    console.error(`💥 Pipeline ${pipelineId} Error:`, error);
    await PipelineStateManager.updateStatus(pipelineId, 'error');
    
    // Najdi aktuální running krok a označ ho jako error
    const currentState = PipelineStateManager.get(pipelineId);
    if (currentState) {
      const runningStep = currentState.steps.find(s => s.status === 'running');
      if (runningStep) {
        await PipelineStateManager.updateStep(pipelineId, runningStep.id, 'error', null, 
          error instanceof Error ? error.message : 'Neočekávaná chyba');
      }
    }
  }
}
