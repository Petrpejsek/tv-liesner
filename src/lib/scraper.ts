// Web Scraper for AI Product Pages
import { load } from 'cheerio';

export interface ScrapedContent {
  title: string;
  description: string;
  features: string[];
  pricing: string;
  benefits: string[];
  key_numbers: string[];
  tone_of_voice: string;
  fullText: string;
  meta: {
    url: string;
    scrapedAt: Date;
    wordCount: number;
  };
}

// 🧹 Helper: Deduplikace textu
function deduplicateText(texts: string[]): string[] {
  const seen = new Set<string>();
  const normalized = new Set<string>();
  
  return texts.filter(text => {
    const cleanText = text.trim().toLowerCase();
    const normalizedText = cleanText.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
    
    if (seen.has(cleanText) || normalized.has(normalizedText) || cleanText.length < 10) {
      return false;
    }
    
    seen.add(cleanText);
    normalized.add(normalizedText);
    return true;
  });
}

// 🎯 Helper: Extrakce čísel a statistik
function extractKeyNumbers(text: string): string[] {
  const patterns = [
    /(\d+(?:,\d+)*(?:\.\d+)?)\s*%\s*(?:increase|improvement|boost|save|reduction|faster|more)/gi,
    /(?:save|saved|boost|increase|improve)\s+(?:up to\s+)?(\d+(?:,\d+)*(?:\.\d+)?)\s*%/gi,
    /(\d+(?:,\d+)*)\s*\+?\s*(?:clients|customers|users|companies|businesses)/gi,
    /(?:over|more than|serving)\s+(\d+(?:,\d+)*)\s*(?:clients|customers|users|companies)/gi,
    /(\d+(?:,\d+)*)\s*(?:countries|nations|markets)/gi,
    /(?:saves?\s+|reduction of\s+)?(\d+)\s*(?:minutes|hours|days)\s*(?:daily|per day|weekly|monthly)/gi
  ];

  const numbers: string[] = [];
  const fullText = text.toLowerCase();

  patterns.forEach(pattern => {
    const matches = Array.from(fullText.matchAll(pattern));
    matches.forEach(match => {
      if (match[0]) {
        // Normalizujeme a otagujeme
        const normalized = match[0]
          .replace(/\s+/g, ' ')
          .replace(/(\d+)\s*%/, '$1%')
          .trim();
        
        if (normalized.length > 3) {
          numbers.push(normalized);
        }
      }
    });
  });

  return deduplicateText(numbers);
}

// 🔍 Helper: Rozpoznání features vs benefits
function categorizeContent(text: string): { type: 'feature' | 'benefit' | 'other', confidence: number } {
  const featureKeywords = [
    'dashboard', 'analytics', 'reporting', 'integration', 'api', 'compliance', 
    'security', 'automation', 'workflow', 'platform', 'tool', 'system',
    'interface', 'module', 'engine', 'algorithm', 'technology'
  ];
  
  const benefitKeywords = [
    'save', 'boost', 'improve', 'increase', 'reduce', 'enhance', 'optimize',
    'faster', 'better', 'easier', 'efficient', 'productive', 'cost-effective',
    'ušetří', 'zlepší', 'zvýší', 'sníží', 'rychlejší'
  ];

  const lowerText = text.toLowerCase();
  
  const featureScore = featureKeywords.reduce((score, keyword) => 
    score + (lowerText.includes(keyword) ? 1 : 0), 0);
  
  const benefitScore = benefitKeywords.reduce((score, keyword) => 
    score + (lowerText.includes(keyword) ? 1 : 0), 0);

  if (benefitScore > featureScore && benefitScore > 0) {
    return { type: 'benefit', confidence: benefitScore };
  } else if (featureScore > 0) {
    return { type: 'feature', confidence: featureScore };
  }
  
  return { type: 'other', confidence: 0 };
}

// 📝 ENHANCED MARKETING NOISE FILTER
function filterMarketingNoise(texts: string[]): string[] {
  const noisePatterns = [
    /only for limited customers/i,
    /workforce analytics is broken/i,
    /join us for.*episode/i,
    /see how it works/i,
    /book a demo/i,
    /contact us/i,
    /learn more/i,
    /get started/i,
    /try now/i,
    /tab \d+/i,
    /sub tab/i,
    /click here/i,
    /read more/i,
    /watch video/i,
    /download now/i,
    /sign up/i,
    /register/i,
    /^\s*(the|this|that|it|and|or|but)\s+/i,
    /\b(lorem ipsum|placeholder|test|example)\b/i
  ];
  
  return texts.filter(text => {
    // Kontrola na noise patterns
    const hasNoise = noisePatterns.some(pattern => pattern.test(text));
    if (hasNoise) return false;
    
    // Kontrola na duplicitní slova v textu
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const duplicateRatio = (words.length - uniqueWords.size) / words.length;
    
    return duplicateRatio < 0.4; // Max 40% duplicate words
  });
}

export async function scrapeProductPage(url: string): Promise<ScrapedContent> {
  if (!url || !url.startsWith('http')) {
    throw new Error('Nevalidní URL adresa');
  }

  try {
    console.log('🕷️ Scraping URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = load(html);

    // 🧹 AGRESIVNÍ ČIŠTĚNÍ HTML
    // Odstranění navigace, menu, buttony, taby
    $(
      'script, style, nav, footer, header, aside, ' +
      '.nav, .navigation, .menu, .header, .footer, .sidebar, ' +
      '.cookie, .popup, .modal, .overlay, .banner, ' +
      '.breadcrumb, .pagination, .social, .share, ' +
      'button, .button, .btn, .cta, [class*="button"], ' +
      '.tab, .tabs, [class*="tab"], [role="tab"], ' +
      '.demo, [class*="demo"], [class*="trial"], ' +
      '.signup, .register, .login, .auth, ' +
      'form, input, select, textarea'
    ).remove();

    // Odstranění elementů s navigačními texty
    $('*').filter((_, elem) => {
      const text = $(elem).text().toLowerCase();
      return text.includes('book a demo') || 
             text.includes('get started') || 
             text.includes('sign up') ||
             text.includes('try free') ||
             text.match(/tab\s+\d+/i) ||
             text.match(/sub\s+tab/i);
    }).remove();

    // Extrakce title
    const title = $('title').text().trim() || 
                  $('h1').first().text().trim() || 
                  $('meta[property="og:title"]').attr('content') || 
                  'Neznámý produkt';

    // Extrakce description  
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || 
                       $('p').first().text().trim() ||
                       '';

    // 📊 EXTRAKCE OBSAHU S KATEGORIZACÍ
    const allTexts: string[] = [];
    
    // Získej všechny texty z relevantních elementů
    $('h1, h2, h3, h4, h5, h6, p, li, span, div').each((_, element) => {
      const text = $(element).text().trim();
      if (text.length > 15 && text.length < 300) {
        allTexts.push(text);
      }
    });

    // Deduplikace a filtering marketingu
    const uniqueTexts = deduplicateText(allTexts);
    const cleanTexts = filterMarketingNoise(uniqueTexts);

    // Kategorizace na features a benefits
    const rawFeatures: string[] = [];
    const rawBenefits: string[] = [];
    
    cleanTexts.forEach(text => {
      const category = categorizeContent(text);
      if (category.type === 'feature' && category.confidence > 0) {
        rawFeatures.push(text);
      } else if (category.type === 'benefit' && category.confidence > 0) {
        rawBenefits.push(text);
      }
    });

    // 🔧 Základní filtrování features
    const features = deduplicateText(rawFeatures).slice(0, 8);
    
    // 🎯 Základní filtrování benefits  
    const benefits = deduplicateText(rawBenefits).slice(0, 6);

    // 💰 EXTRAKCE PRICING
    let pricing = '';
    const priceSelectors = [
      '[class*="price"]', '[class*="cost"]', '[class*="pricing"]',
      '[data-testid*="price"]', 'span:contains("$")', 'span:contains("€")',
      'span:contains("free")', 'span:contains("trial")'
    ];

    for (const selector of priceSelectors) {
      const priceElement = $(selector).first();
      if (priceElement.length) {
        pricing = priceElement.text().trim();
        break;
      }
    }

    // 📈 EXTRAKCE KEY NUMBERS
    const fullContentForNumbers = cleanTexts.join(' ');
    const key_numbers = extractKeyNumbers(fullContentForNumbers);

    // 🎭 URČENÍ TONE OF VOICE
    const fullContentLower = fullContentForNumbers.toLowerCase();
    let tone_of_voice = 'professional';
    
    if (fullContentLower.includes('enterprise') || fullContentLower.includes('business')) {
      tone_of_voice = 'professional, enterprise-focused';
    } else if (fullContentLower.includes('innovation') || fullContentLower.includes('cutting-edge')) {
      tone_of_voice = 'innovative, forward-thinking';
    } else if (fullContentLower.includes('easy') || fullContentLower.includes('simple')) {
      tone_of_voice = 'friendly, accessible';
    }

    // 📝 VYČIŠTĚNÝ FULL TEXT
    const cleanedFullText = cleanTexts
      .slice(0, 15) // Max 15 nejrelevantnějších textů
      .join(' ')
      .substring(0, 800); // Max 800 znaků pro kompaktnější obsah

    const result: ScrapedContent = {
      title: title.substring(0, 100),
      description: description.substring(0, 300),
      features: features.slice(0, 8),        // Max 8 features
      pricing: pricing.substring(0, 100),
      benefits: benefits.slice(0, 6),        // Max 6 benefits  
      key_numbers: key_numbers.slice(0, 5),  // Max 5 key numbers
      tone_of_voice,
      fullText: cleanedFullText,
      meta: {
        url,
        scrapedAt: new Date(),
        wordCount: cleanedFullText.split(' ').length
      }
    };

    console.log('✅ Scraping dokončen:', {
      title: result.title.substring(0, 50),
      featuresCount: result.features.length,
      benefitsCount: result.benefits.length,
      keyNumbersCount: result.key_numbers.length,
      wordCount: result.meta.wordCount,
      toneOfVoice: result.tone_of_voice
    });

    return result;

  } catch (error) {
    console.error('❌ Scraping chyba:', error);
    throw new Error(`Chyba při scrapingu: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
  }
}

// Alternatívny scraper pre JavaScript-heavy stránky (budoucí rozšíření)
export async function scrapeWithPuppeteer(_url: string): Promise<ScrapedContent> {
  // TODO: Implementace s Puppeteer pro SPA aplikace
  throw new Error('Puppeteer scraper není zatím implementován');
}

// Validace a čištění scraped content
export function validateScrapedContent(content: ScrapedContent): boolean {
  return !!(
    content.title && 
    content.title.length > 5 &&
    content.fullText &&
    content.fullText.length > 50 &&
    (content.features.length > 0 || content.benefits.length > 0)
  );
}

// Alias export pro konzistenci s route.ts
export const scrapeWebsite = scrapeProductPage; 

// Export aliases pro různé import styles
export const scrapeWebsiteContent = scrapeProductPage;
export default scrapeProductPage; 