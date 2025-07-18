// 🚀 AI Reels Pipeline Start API - COMPLETE IMPLEMENTATION
import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite } from '@/lib/scraper';
import { initializeOpenAI, generateProductSummary, generateViralHooks, generateVideoScript, generateVoiceDirection, generateBackgroundSelection, generateMusicSelection, generateAvatarBehavior, generateThumbnailConcept, cleanTextWithAI, generateTimeline } from '@/lib/openai';
import { generateVoiceFromScript } from '@/lib/voice-pipeline';
import { checkFFmpegInstallation } from '@/lib/ffmpeg';
import { PipelineStateManager, getDefaultPipelineSteps } from '@/lib/pipeline-state';

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
  console.log('🚀 Spouštím AI Reels Pipeline s real-time tracking...');
  
  const pipelineId = `pipeline_${Date.now()}`;
  
  try {
    // Parse request body
    let body;
    try {
      const text = await request.text();
      if (!text.trim()) {
        return NextResponse.json({
          success: false,
          error: 'Request body je prázdný. Odešli URL a target_duration.',
        }, { status: 400 });
      }
      body = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: 'Nevalidní JSON v request body',
      }, { status: 400 });
    }

    const { url, target_duration, api_keys, ai_assistants, voice_avatars, project_title } = body;

    // Validace inputs
    if (!url || !url.startsWith('http')) {
      return NextResponse.json({
        success: false,
        error: 'Nevalidní URL. URL musí začínat http:// nebo https://',
      }, { status: 400 });
    }

    if (!target_duration || target_duration < 5 || target_duration > 60) {
      return NextResponse.json({
        success: false,
        error: 'Target duration musí být mezi 5-60 sekund',
      }, { status: 400 });
    }

    // Check FFmpeg installation
    const ffmpegInstalled = await checkFFmpegInstallation();
    if (!ffmpegInstalled) {
      return NextResponse.json({
        success: false,
        error: 'FFmpeg není nainstalován. Spusť: brew install ffmpeg (macOS) nebo apt install ffmpeg (Linux)',
      }, { status: 500 });
    }

    // Vytvoř pipeline state
    const steps = getDefaultPipelineSteps();
    
    // Generování názvu pipeline
    const title = project_title || generatePipelineTitle(url);
    
    const pipelineState = await PipelineStateManager.create(pipelineId, steps, title, target_duration);
    
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
    processPipelineAsync(pipelineId, url, target_duration, apiKeys, ai_assistants, voice_avatars).catch(async (error) => {
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
  voice_avatars: any[]
) {
  let scrapedContent: any;
  let productSummary: string;
  let viralHooks: string[];
  let videoScript: string;
  let timeline: any;
  let voiceDirection: string;
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
      metadata: timeline.metadata || {},
      segmentsCount: timeline.segments?.length || 0,
      totalDuration: timeline.metadata?.totalDuration || target_duration
    });
    console.log('✅ Timeline Creator dokončen');

    // KROKY 6-10: AI Asistenti s správnými parametry
    
    // KROK 7: Voice Direction 🎙️
    console.log('🎙️ Voice Direction KROK: 🎙️ Voice Direction...');
    await PipelineStateManager.updateStep(pipelineId, 'voice-direction', 'running');
    
    const voiceAssistant = ai_assistants?.find((a: any) => a.id === 'voice-direction');
    voiceDirection = await generateVoiceDirection(videoScript, timeline, voiceAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'voice-direction', 'completed', voiceDirection);
    console.log('✅ 🎙️ Voice Direction dokončen');

    // KROK 8: Background Selection 🎨
    console.log('🎨 Background Selection KROK: 🎨 Background Selection...');
    await PipelineStateManager.updateStep(pipelineId, 'background-selection', 'running');
    
    const backgroundAssistant = ai_assistants?.find((a: any) => a.id === 'background-selector');
    backgroundSelection = await generateBackgroundSelection(videoScript, backgroundAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'background-selection', 'completed', backgroundSelection);
    console.log('✅ 🎨 Background Selection dokončen');

    // KROK 9: Music & Sound 🎵
    console.log('🎵 Music & Sound KROK: 🎵 Music & Sound...');
    await PipelineStateManager.updateStep(pipelineId, 'music-sound', 'running');
    
    const musicAssistant = ai_assistants?.find((a: any) => a.id === 'music-sound');
    musicSelection = await generateMusicSelection(videoScript, viralHooks, musicAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'music-sound', 'completed', musicSelection);
    console.log('✅ 🎵 Music & Sound dokončen');

    // KROK 10: Avatar Behavior 👤
    console.log('👤 Avatar Behavior KROK: 👤 Avatar Behavior...');
    await PipelineStateManager.updateStep(pipelineId, 'avatar-behavior', 'running');
    
    const avatarAssistant = ai_assistants?.find((a: any) => a.id === 'avatar-behavior');
    avatarBehavior = await generateAvatarBehavior(videoScript, voiceDirection, avatarAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'avatar-behavior', 'completed', avatarBehavior);
    console.log('✅ 👤 Avatar Behavior dokončen');

    // KROK 11: Thumbnail Concept 🖼️
    console.log('🖼️ Thumbnail Concept KROK: 🖼️ Thumbnail Concept...');
    await PipelineStateManager.updateStep(pipelineId, 'thumbnail-concept', 'running');
    
    const thumbnailAssistant = ai_assistants?.find((a: any) => a.id === 'thumbnail-creator');
    // Bezpečné získání prvního hook pro thumbnail
    const selectedHookForThumbnail = Array.isArray(viralHooks) ? viralHooks[0] : (typeof viralHooks === 'string' ? viralHooks : 'Amazing productivity tool!');
    thumbnailConcept = await generateThumbnailConcept(selectedHookForThumbnail, productSummary, backgroundSelection, thumbnailAssistant);
    
    await PipelineStateManager.updateStep(pipelineId, 'thumbnail-concept', 'completed', thumbnailConcept);
    console.log('✅ 🖼️ Thumbnail Concept dokončen');

    // KROK 12: Voice Generation 🗣️
    console.log('🗣️ KROK 12: Voice Generation...');
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
      
      // ✅ PRIORITNÍ POŘADÍ PRO VOICE ID: Modal > Environment > API Keys
      const voiceIdFromModal = voice_avatars?.[0]?.voiceId;
      const voiceIdFromEnv = process.env.ELEVENLABS_VOICE_ID;
      const voiceId = voiceIdFromModal || (voiceIdFromEnv !== 'VLOŽTE_SVŮJ_VOICE_ID_TADY' ? voiceIdFromEnv : null) || apiKeys.voiceId;
      const avatarId = voice_avatars?.[0]?.avatarId;
      
      console.log('🔍 Voice ID sources - DETAILNÍ ANALÝZA:');
      console.log('🎭 Z modalu (voice_avatars[0].voiceId):', voiceIdFromModal || 'PRÁZDNÉ');
      console.log('🌍 Z environment (process.env.ELEVENLABS_VOICE_ID):', voiceIdFromEnv || 'PRÁZDNÉ');
      console.log('🔑 Z apiKeys (apiKeys.voiceId):', apiKeys.voiceId || 'PRÁZDNÉ');
      console.log('🔑 FINÁLNÍ voiceId po prioritě:', voiceId || 'STÁLE CHYBÍ!!!');
      console.log('👤 avatarId:', avatarId || 'NENÍ VYŽADOVÁNO');
      
      // ❌ KRITICKÁ KONTROLA VOICE ID
      if (!voiceId) {
        const errorMsg = `❌ KRITICKÁ CHYBA: Voice ID není nastaveno!
        
🔍 DEBUG INFO:
- voice_avatars length: ${voice_avatars?.length || 0}
- voice_avatars[0]: ${JSON.stringify(voice_avatars?.[0] || 'undefined')}
- process.env.ELEVENLABS_VOICE_ID: "${voiceIdFromEnv}"
- apiKeys.voiceId: "${apiKeys.voiceId}"

🛠️ ŘEŠENÍ:
1️⃣ Otevři modal "🎭 Spravovat hlasy & avatary" a přidej Voice ID z ElevenLabs
2️⃣ NEBO uprav .env.local: ELEVENLABS_VOICE_ID=your_voice_id_here (ne placeholder)
3️⃣ NEBO nastav apiKeys.voiceId v UI

📋 PŘÍKLAD SPRÁVNÉHO VOICE ID: qKpVWFjZyvaOXILFD0VR`;
        
        console.error(errorMsg);
        throw new Error(errorMsg);
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
        voiceId: voiceId,
        avatarId: avatarId || undefined
      };
      
      console.log('🎤 SPOUŠTÍM ELEVENLABS VOICE GENERATION...');
      console.log('🔑 Enhanced API Keys:', {
        elevenlabs: enhancedApiKeys.elevenlabs ? `${enhancedApiKeys.elevenlabs.substring(0, 10)}...` : 'MISSING',
        voiceId: enhancedApiKeys.voiceId,
        avatarId: enhancedApiKeys.avatarId || 'NENÍ'
      });
      
      // 🗣️ SKUTEČNÉ VOLÁNÍ ELEVENLABS API
      voiceGeneration = await generateVoiceFromScript(videoScript, timeline, voiceDirection, enhancedApiKeys, target_duration);
      
      console.log('🎉 Voice Generation SUCCESS - Výstupní data:');
      console.log('📊 segments count:', voiceGeneration.segments?.length || 0);
      console.log('⏰ total duration:', voiceGeneration.totalDuration, 'sekund');
      console.log('🎯 target time:', voiceGeneration.targetTime, 'sekund');
      console.log('🎚️ speaking rate:', voiceGeneration.speakingRate);
      console.log('💾 audio files generated:', voiceGeneration.segments?.every(s => s.audioFilePath) ? 'ALL OK' : 'CHYBÍ');
      
      await PipelineStateManager.updateStep(pipelineId, 'voice-generation', 'completed', {
        segments: voiceGeneration.segments,
        totalDuration: voiceGeneration.totalDuration,
        targetTime: voiceGeneration.targetTime,
        speakingRate: voiceGeneration.speakingRate,
        voiceId: voiceId,
        generatedAt: new Date().toISOString(),
        success: true
      });
      
      console.log('✅ 🗣️ Voice Generation ÚSPĚŠNĚ DOKONČEN!');
      
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
        error: error instanceof Error ? error.message : 'Neznámá chyba',
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
    }

    // Nastav final outputs (včetně voice generation)
    PipelineStateManager.setFinalOutputs(pipelineId, {
      scraped_content: scrapedContent,
      product_summary: productSummary,
      viral_hooks: viralHooks,
      video_script: videoScript,
      timeline: timeline,
      voice_direction: voiceDirection,
      background_selection: backgroundSelection,
      music_selection: musicSelection,
      avatar_behavior: avatarBehavior,
      thumbnail_concept: thumbnailConcept,
      voice_generation: voiceGeneration
    });

    // Kroky 13-15 označit jako "not_implemented"
    const notImplementedSteps = ['avatar-generation', 'background-video', 'final-merge'];
    for (const stepId of notImplementedSteps) {
      await PipelineStateManager.updateStep(pipelineId, stepId, 'not_implemented', 
        'Tento krok bude implementován v další fázi s externí APIs integracemi.');
    }

    // Dokončení pipeline
    await PipelineStateManager.updateStatus(pipelineId, 'completed');
    console.log(`🎉 Pipeline ${pipelineId} dokončena úspěšně! (12/15 kroků)`);

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
