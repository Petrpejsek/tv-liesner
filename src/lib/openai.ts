import OpenAI from 'openai';

let openai: OpenAI | null = null;

export function initializeOpenAI(apiKey: string) {
  if (!apiKey) {
    throw new Error('OpenAI API klíč je povinný');
  }
  openai = new OpenAI({ apiKey });
  return openai;
}

export function getOpenAI(): OpenAI {
  if (!openai) {
    throw new Error('OpenAI není inicializováno. Zavolej initializeOpenAI() nejdříve.');
  }
  return openai;
}

// Extrakce produktu/nástroje z content
export async function generateProductSummary(
  content: string, 
  assistant?: { instructions: string; model: string; temperature: number; max_tokens: number }
): Promise<string> {
  const client = getOpenAI();
  
  const defaultAssistant = {
    instructions: '',
    model: "gpt-4o",
    temperature: 0.7,
    max_tokens: 500
  };

  const config = assistant || defaultAssistant;
  
  // 🐛 DEBUG: Kontrola konfigurace před voláním OpenAI
  console.log('🐛 DEBUG - OpenAI konfigurace:', {
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.max_tokens,
    instructions_length: config.instructions?.length || 0,
    instructions_preview: config.instructions?.substring(0, 150) + '...',
    using_default: !assistant
  });
  
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: config.instructions
      },
      {
        role: "user",
        content: `Analyzuj tento obsah webové stránky:\n\n${content}`
      }
    ],
    max_tokens: config.max_tokens,
    temperature: config.temperature
  });

  return response.choices[0]?.message?.content || '';
}

// Generování virálních hooks
export async function generateViralHooks(
  productSummary: string, 
  targetDuration: number,
  assistant?: { instructions: string; model: string; temperature: number; max_tokens: number }
): Promise<string[]> {
  const client = getOpenAI();
  
  const defaultAssistant = {
    instructions: '',
    model: "gpt-4o",
    temperature: 0.9,
    max_tokens: 300
  };

  const config = assistant || defaultAssistant;
  
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: config.instructions.replace('${targetDuration}', targetDuration.toString())
      },
      {
        role: "user",
        content: `Produkt: ${productSummary}`
      }
    ],
    max_tokens: config.max_tokens,
    temperature: config.temperature
  });

  const content = response.choices[0]?.message?.content || '';
  return content.split('\n').filter(line => line.trim().length > 0);
}

// Generování kompletního scriptu
export async function generateVideoScript(
  productSummary: string, 
  selectedHook: string, 
  targetDuration: number,
  assistant?: { instructions: string; model: string; temperature: number; max_tokens: number }
): Promise<string> {
  const client = getOpenAI();
  
  // ✅ Unified: 2.3 slov/s pro konzistenci s Timeline Creator a ElevenLabs
  const wordsPerSecond = 2.3; // Optimální rychlost pro pochopení
  const targetWords = Math.floor(targetDuration * wordsPerSecond);
  const minWords = Math.max(targetWords - 5, Math.floor(targetWords * 0.85)); // ±5 slov tolerance
  
  console.log(`🎯 Video Script Writer: targetDuration=${targetDuration}s, targetWords=${targetWords}, minWords=${minWords}`);
  
  const defaultAssistant = {
    instructions: '',
    model: "gpt-4o",
    temperature: 0.8,
    max_tokens: 800
  };

  const config = assistant || defaultAssistant;
  
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: config.instructions
          .replace('${targetDuration}', targetDuration.toString())
          .replace('${targetWords}', targetWords.toString())
          .replace('${minWords}', minWords.toString())
          .replace('${selectedHook}', selectedHook)
      },
      {
        role: "user",
        content: `Produkt: ${productSummary}\nZačni s: ${selectedHook}`
      }
    ],
    max_tokens: config.max_tokens,
    temperature: config.temperature
  });

  const generatedScript = response.choices[0]?.message?.content || '';
  
  // ✅ Validace délky vygenerovaného scriptu
  const scriptWords = generatedScript.split(/\s+/).filter(w => w.length > 0).length;
  console.log(`📝 Generated script: ${scriptWords} words (target: ${targetWords}, min: ${minWords})`);
  
  if (scriptWords < minWords) {
    console.warn(`⚠️ Script má jen ${scriptWords} slov, minimum je ${minWords} → mohlo by být krátké pro ${targetDuration}s`);
  }
  
  if (scriptWords > targetWords + 10) {
    console.warn(`⚠️ Script má ${scriptWords} slov, maximum je ${targetWords + 10} → mohlo by být dlouhé pro ${targetDuration}s`);
  }
  
  return generatedScript;
} 

// Generování voice direction parametrů
export async function generateVoiceDirection(
  videoScript: string,
  timeline: any,
  assistant?: { instructions: string; model: string; temperature: number; max_tokens: number }
): Promise<string> {
  const client = getOpenAI();
  
  const defaultAssistant = {
    instructions: '',
    model: "gpt-4o",
    temperature: 0.6,
    max_tokens: 400
  };

  const config = assistant || defaultAssistant;
  
  console.log(`🐛 DEBUG - Voice Direction konfigurace: {
  model: '${config.model}',
  temperature: ${config.temperature},
  max_tokens: ${config.max_tokens},
  instructions_length: ${config.instructions?.length || 0},
  instructions_preview: '${config.instructions?.substring(0, 100) || '...'}',
  using_default: ${!assistant}
}`);

  // Debug timeline input
  console.log(`🎙️ Voice Direction INPUT: {
  scriptLength: ${videoScript?.length || 0},
  timelineType: ${typeof timeline},
  hasSegments: ${timeline?.segments ? 'YES' : 'NO'},
  segmentsCount: ${timeline?.segments?.length || 0},
  timelinePreview: ${JSON.stringify(timeline)?.substring(0, 200) || 'null'}...
}`);

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: config.instructions
        },
        {
          role: "user",
          content: `Voiceover Script: "${videoScript}"

Timeline Segments:
${JSON.stringify(timeline, null, 2)}

Create voice direction instructions for each segment with proper intonation, emphasis, and pacing for ElevenLabs voice synthesis.`
        }
      ],
      max_tokens: config.max_tokens,
      temperature: config.temperature
    });

    const rawOutput = response.choices[0]?.message?.content || '';
    console.log(`🎙️ Voice Direction RAW OUTPUT (${rawOutput.length} chars):`, rawOutput.substring(0, 200) + '...');
    
    return rawOutput;
  } catch (error) {
    console.error('❌ Voice Direction API Error:', error);
    throw new Error(`❌ PIPELINE STOPPED: Voice Direction API failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Generování background selection
export async function generateBackgroundSelection(
  videoScript: string,
  productSummary: string,
  assistant?: { instructions: string; model: string; temperature: number; max_tokens: number }
): Promise<string> {
  const client = getOpenAI();
  
  const defaultAssistant = {
    instructions: '',
    model: "gpt-4o",
    temperature: 0.5,
    max_tokens: 300
  };

  const config = assistant || defaultAssistant;
  
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: config.instructions
      },
      {
        role: "user",
        content: `Produkt: ${productSummary}\nScript: ${videoScript}`
      }
    ],
    max_tokens: config.max_tokens,
    temperature: config.temperature
  });

  return response.choices[0]?.message?.content || '';
}

// Generování music & sound selection
export async function generateMusicSelection(
  videoScript: string,
  viralHooks: string[] | string,
  assistant?: { instructions: string; model: string; temperature: number; max_tokens: number }
): Promise<string> {
  const client = getOpenAI();
  
  const defaultAssistant = {
    instructions: '',
    model: "gpt-4o",
    temperature: 0.7,
    max_tokens: 350
  };

  const config = assistant || defaultAssistant;
  
  // Bezpečné zpracování viralHooks
  let hooksString = '';
  if (Array.isArray(viralHooks)) {
    hooksString = viralHooks.join(', ');
  } else if (typeof viralHooks === 'string') {
    hooksString = viralHooks;
  } else {
    hooksString = String(viralHooks || '');
  }
  
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: config.instructions
      },
      {
        role: "user",
        content: `Script: ${videoScript}\nHooks: ${hooksString}`
      }
    ],
    max_tokens: config.max_tokens,
    temperature: config.temperature
  });

  return response.choices[0]?.message?.content || '';
}

// Generování avatar behavior instrukcí
export async function generateAvatarBehavior(
  videoScript: string,
  voiceDirection: string,
  assistant?: { instructions: string; model: string; temperature: number; max_tokens: number }
): Promise<string> {
  const client = getOpenAI();
  
  const defaultAssistant = {
    instructions: '',
    model: "gpt-4o",
    temperature: 0.6,
    max_tokens: 400
  };

  const config = assistant || defaultAssistant;
  
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: config.instructions
      },
      {
        role: "user",
        content: `Script: ${videoScript}\nVoice Direction: ${voiceDirection}`
      }
    ],
    max_tokens: config.max_tokens,
    temperature: config.temperature
  });

  return response.choices[0]?.message?.content || '';
}

// Generování thumbnail concept
export async function generateThumbnailConcept(
  selectedHook: string,
  productSummary: string,
  backgroundSelection: string,
  assistant?: { instructions: string; model: string; temperature: number; max_tokens: number }
): Promise<string> {
  const client = getOpenAI();
  
  const defaultAssistant = {
    instructions: '',
    model: "gpt-4o",
    temperature: 0.8,
    max_tokens: 500
  };

  const config = assistant || defaultAssistant;
  
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: "system",
        content: config.instructions
      },
      {
        role: "user",
        content: `Hook: ${selectedHook}\nProdukt: ${productSummary}\nBackground: ${backgroundSelection}`
      }
    ],
    max_tokens: config.max_tokens,
    temperature: config.temperature
  });

  return response.choices[0]?.message?.content || '';
} 

// 🎯 AI TEXT CLEANER: Čištění features pomocí AI
export async function cleanFeaturesWithAI(rawFeatures: string[], assistant?: any): Promise<string[]> {
  if (rawFeatures.length === 0) return [];
  
  const client = getOpenAI();
  
  // Použij custom instrukce z assistanta nebo fallback
  const systemPrompt = assistant?.instructions || `You are a TEXT CLEANER expert. Clean and normalize product features into clear, professional feature statements.

RULES:
1. Remove incomplete sentences or broken text
2. Remove testimonials, quotes, and person names (e.g. "Sagar PatilIT Manager")
3. Convert fragments into complete feature descriptions
4. Remove marketing fluff and CTAs
5. Each feature should be 15-60 characters
6. Return max 8 clean features
7. Return JSON array only

INPUT: ${JSON.stringify(rawFeatures)}
OUTPUT: Clean JSON array of features`;

  try {
    const response = await client.chat.completions.create({
      model: assistant?.model || 'gpt-4o',
      temperature: assistant?.temperature || 0.3,
      max_tokens: assistant?.max_tokens || 600,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: `Clean these features: ${JSON.stringify(rawFeatures)}`
        }
      ]
    });

    const cleanedText = response.choices[0]?.message?.content?.trim() || '';
    
    try {
      const parsed = JSON.parse(cleanedText);
      return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
    } catch {
      throw new Error('❌ PIPELINE STOPPED: Features cleaning AI parsing failed');
    }
  } catch (error) {
    console.error('❌ cleanFeaturesWithAI error:', error);
    throw new Error(`❌ PIPELINE STOPPED: Features cleaning failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// 🎯 AI TEXT CLEANER: Čištění benefits pomocí AI  
export async function cleanBenefitsWithAI(rawBenefits: string[], assistant?: any): Promise<string[]> {
  if (rawBenefits.length === 0) return [];
  
  const client = getOpenAI();
  
  // Použij custom instrukce z assistanta nebo fallback
  const systemPrompt = assistant?.instructions || `You are a TEXT CLEANER expert. Clean and normalize product benefits into clear, actionable benefit statements.

RULES:
1. Remove incomplete sentences or broken text  
2. Remove testimonials and person names
3. Convert fragments into complete benefit statements
4. Remove marketing CTAs and fluff
5. Each benefit should be 20-80 characters
6. Return max 6 clean benefits
7. Return JSON array only

INPUT: ${JSON.stringify(rawBenefits)}
OUTPUT: Clean JSON array of benefits`;

  try {
    const response = await client.chat.completions.create({
      model: assistant?.model || 'gpt-4o',
      temperature: assistant?.temperature || 0.3,
      max_tokens: assistant?.max_tokens || 600,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Clean these benefits: ${JSON.stringify(rawBenefits)}`
        }
      ]
    });

    const cleanedText = response.choices[0]?.message?.content?.trim() || '';
    
    try {
      const parsed = JSON.parse(cleanedText);
      return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
    } catch {
      throw new Error('❌ PIPELINE STOPPED: Benefits cleaning AI parsing failed');
    }
  } catch (error) {
    console.error('❌ cleanBenefitsWithAI error:', error);
    throw new Error(`❌ PIPELINE STOPPED: Benefits cleaning failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 

// 🎯 AI TEXT CLEANER: Kompletní čištění a enrichment textu
export async function cleanTextWithAI(scrapedContent: any, assistant?: any): Promise<any> {
  const client = getOpenAI();
  
  // Použij custom instrukce z assistanta
  const systemPrompt = assistant?.instructions || `You are a TEXT CLEANER expert. Clean and enrich scraped content into professional format.`;

  console.log(`🔍 AI Text Cleaner INPUT:`, {
    title: scrapedContent.title?.slice(0, 100),
    featuresCount: scrapedContent.features?.length || 0,
    benefitsCount: scrapedContent.benefits?.length || 0,
    fullTextLength: scrapedContent.fullText?.length || 0,
    keyNumbersCount: scrapedContent.key_numbers?.length || 0
  });

  const inputData = {
    title: scrapedContent.title || '',
    description: scrapedContent.description || '',
    features: scrapedContent.features || [],
    benefits: scrapedContent.benefits || [],
    key_numbers: scrapedContent.key_numbers || [],
    fullText: scrapedContent.fullText?.slice(0, 3000) || '', // Omezíme pro AI
    wordCount: scrapedContent.wordCount || 0
  };

  try {
    const response = await client.chat.completions.create({
      model: assistant?.model || 'gpt-4o',
      temperature: assistant?.temperature || 0.3,
      max_tokens: assistant?.max_tokens || 800,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: `Clean and enrich this scraped content:\n\n${JSON.stringify(inputData, null, 2)}`
        }
      ]
    });

    const cleanedText = response.choices[0]?.message?.content?.trim() || '';
    console.log(`🧹 AI Text Cleaner RAW OUTPUT (${cleanedText.length} chars):`, cleanedText.slice(0, 500));
    
    try {
      // Odstraň markdown wrapper pokud existuje
      let jsonText = cleanedText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Pokus o parsování JSON
      const cleaned = JSON.parse(jsonText);
      
      console.log(`✅ AI Text Cleaner PARSED OUTPUT:`, {
        title: cleaned.title?.slice(0, 50),
        featuresCount: cleaned.features?.length || 0,
        benefitsCount: cleaned.benefits?.length || 0,
        keyNumbersCount: cleaned.key_numbers?.length || 0,
        hasToneOfVoice: !!cleaned.tone_of_voice,
        hasPricing: !!cleaned.pricing
      });
      
      return cleaned;
    } catch (parseError) {
      console.error('❌ AI Text Cleaner JSON Parse Error:', parseError);
      console.log('🔍 Problematic output:', cleanedText);
      
      // Fallback: vrátíme původní data
      return scrapedContent;
    }
  } catch (error) {
    console.error('❌ AI Text Cleaner API Error:', error);
    throw new Error(`❌ PIPELINE STOPPED: AI Text Cleaner failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// AI Timeline Creator - generování časové segmentace
export async function generateTimeline(
  videoScript: string,
  targetDuration: number = 15,
  assistant?: { instructions: string; model: string; temperature: number; max_tokens: number }
): Promise<any> {
  const client = getOpenAI();
  
  // 🎯 KALKULACE MAX WORDS podle target duration
  const wordsPerSecond = 2.3; // Optimální rychlost pro pochopení
  const maxWords = Math.floor(targetDuration * wordsPerSecond);
  
  const defaultAssistant = {
    instructions: `# TIMELINE CREATOR EXPERT

Create precise timeline JSON for video script with ${targetDuration}s duration.

RULES:
- Split into 2-4 segments only
- Each segment needs: id, text, startTime, endTime, duration
- Total duration must equal ${targetDuration}s

OUTPUT FORMAT (STRICT):
\`\`\`json
{
  "segments": [
    {
      "id": "segment_1", 
      "text": "Your text here",
      "startTime": 0,
      "endTime": 3,
      "duration": 3
    }
  ],
  "totalDuration": ${targetDuration},
  "segmentsCount": 2
}
\`\`\``,
    model: "gpt-4o",
    temperature: 0.3,
    max_tokens: 600
  };

  const config = assistant || defaultAssistant;
  
  console.log(`🐛 DEBUG - Timeline Creator konfigurace: {
  model: '${config.model}',
  temperature: ${config.temperature},
  max_tokens: ${config.max_tokens},
  targetDuration: ${targetDuration}s,
  maxWords: ${maxWords},
  wordsPerSecond: ${wordsPerSecond},
  instructions_length: ${config.instructions?.length || 0},
  instructions_preview: '${config.instructions?.substring(0, 100) || '...'}',
  using_default: ${!assistant}
}`);

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: config.instructions + `

CRITICAL: Return ONLY valid JSON with this exact schema, no markdown, no explanations:

{
  "segments": [
    {
      "id": "segment_1", 
      "text": "string",
      "startTime": number,
      "endTime": number,
      "duration": number
    }
  ],
  "metadata": {
    "totalDuration": number
  }
}

If you cannot generate valid JSON, return exactly: {"error":"invalid_timeline"}`
        },
        {
          role: "user",
          content: `Voiceover Script: "${videoScript}"
Target Duration: ${targetDuration} seconds
Maximum Words: ${maxWords} words (${wordsPerSecond} words/second)

CRITICAL REQUIREMENTS:
1. Generate EXACTLY 2-4 segments (never just 1)
2. Each segment should be ${Math.floor(targetDuration/3)}-${Math.floor(targetDuration/2)} seconds
3. If script is too long, trim to exactly ${maxWords} words while keeping most important parts
4. Segments must have proper startTime/endTime/duration

STRUCTURE EXAMPLE:
- Segment 1: Hook/Problem (${Math.floor(targetDuration*0.3)}s)
- Segment 2: Solution/Benefit (${Math.floor(targetDuration*0.4)}s) 
- Segment 3: Call to Action (${Math.floor(targetDuration*0.3)}s)

RETURN ONLY VALID JSON WITH MINIMUM 2 SEGMENTS.`
        }
      ],
      max_tokens: config.max_tokens,
      temperature: config.temperature
    });

    const rawOutput = response.choices[0]?.message?.content || '{}';
    console.log(`⏱️ Timeline Creator RAW OUTPUT (${rawOutput.length} chars):`, rawOutput.substring(0, 200) + '...');
    
    // Parse JSON output with strict validation - NO FALLBACKS
    let timeline;
    try {
      // Remove potential markdown wrapper
      let jsonText = rawOutput.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      timeline = JSON.parse(jsonText);
      
      // ✅ STRICT VALIDATION - NO FALLBACKS
      if (!timeline.segments || !Array.isArray(timeline.segments)) {
        throw new Error("❌ AI returned timeline without segments array");
      }
      
      if (timeline.segments.length < 2) {
        throw new Error(`❌ AI returned too few segments (${timeline.segments.length} < 2)`);
      }
      
      // ✅ FLEXIBLE VALIDATION: Accept both timeline.totalDuration OR timeline.metadata.totalDuration
      const totalDuration = timeline.totalDuration || timeline.metadata?.totalDuration;
      
      console.log('🔍 DEBUG timeline.totalDuration:', timeline.totalDuration);
      console.log('🔍 DEBUG timeline.metadata?.totalDuration:', timeline.metadata?.totalDuration);
      console.log('🔍 DEBUG final totalDuration:', totalDuration);
      
      if (typeof totalDuration !== 'number') {
        throw new Error("❌ AI returned timeline without valid totalDuration (checked both root and metadata levels)");
      }
      
      // ✅ Normalize structure: ensure totalDuration is on root level
      timeline.totalDuration = totalDuration;
      
      // Validate each segment
      for (let i = 0; i < timeline.segments.length; i++) {
        const segment = timeline.segments[i];
        if (!segment.text || segment.text.trim().length < 5) {
          throw new Error(`❌ Segment ${i + 1} has invalid text: "${segment.text}"`);
        }
        if (typeof segment.startTime !== 'number' || typeof segment.endTime !== 'number') {
          throw new Error(`❌ Segment ${i + 1} has invalid timing`);
        }
      }
      
      console.log(`✅ Timeline validation successful: ${timeline.segments.length} segments, ${timeline.totalDuration}s`);
      
    } catch (parseError) {
      console.error('❌ Timeline JSON parsing/validation failed:', parseError);
      console.log('🔍 Problematic AI output:', rawOutput);
      throw new Error(`Pipeline STOPPED: Invalid AI timeline response - ${parseError.message}`);
    }
    
    return timeline;
    
  } catch (error) {
    console.error('❌ Timeline Creator API Error:', error);
    throw new Error(`❌ PIPELINE STOPPED: Timeline Creator API failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}