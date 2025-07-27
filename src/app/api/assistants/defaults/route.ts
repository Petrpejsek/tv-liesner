import { NextResponse } from 'next/server';
import { getDefaultAssistants } from '@/lib/default-assistants';

export async function GET() {
  try {
    console.log('🤖 API: Načítám výchozí AI asistenty...');
    
    const defaultAssistants = getDefaultAssistants();
    
    console.log(`✅ API: Načteno ${defaultAssistants.length} výchozích asistentů`);
    
    return NextResponse.json({
      success: true,
      assistants: defaultAssistants,
      count: defaultAssistants.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ API: Chyba při načítání výchozích asistentů:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Nepodařilo se načíst výchozí asistenty',
      assistants: [],
      count: 0
    }, { status: 500 });
  }
} 