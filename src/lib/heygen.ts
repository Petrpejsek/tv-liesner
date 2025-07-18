// HeyGen AI Avatar Integration
export interface HeyGenVideoRequest {
  video_inputs: Array<{
    character: {
      type: string;
      avatar_id: string;
      avatar_style?: string;
    };
    voice: {
      type: string;
      input_text?: string;
      voice_id?: string;
      audio_url?: string;
    };
    background?: {
      type: string;
      url?: string;
      color?: string;
    };
  }>;
  dimension?: {
    width: number;
    height: number;
  };
  aspect_ratio?: string;
}

export interface HeyGenVideoResponse {
  code: number;
  data: {
    video_id: string;
  };
  message: string;
}

export interface HeyGenVideoStatus {
  code: number;
  data: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    video_url?: string;
    thumbnail_url?: string;
    duration?: number;
    error_message?: string;
  };
}

export async function createAvatarVideo(
  text: string,
  avatarId: string,
  voiceId: string,
  apiKey: string,
  audioUrl?: string
): Promise<HeyGenVideoResponse> {
  if (!apiKey) {
    throw new Error('HeyGen API klíč je povinný');
  }

  if (!avatarId) {
    throw new Error('Avatar ID je povinné');
  }

  const requestBody: HeyGenVideoRequest = {
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: avatarId,
        avatar_style: 'normal'
      },
      voice: audioUrl ? {
        type: 'audio',
        audio_url: audioUrl
      } : {
        type: 'text',
        input_text: text,
        voice_id: voiceId
      },
      background: {
        type: 'color',
        color: '#00FF00' // Green screen pro pozdější nahrazení
      }
    }],
    aspect_ratio: '9:16' // Vertikální pro TikTok/Shorts
  };

  const response = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HeyGen chyba ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function getVideoStatus(videoId: string, apiKey: string): Promise<HeyGenVideoStatus> {
  const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: {
      'X-API-KEY': apiKey
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HeyGen status chyba ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function waitForVideoCompletion(
  videoId: string, 
  apiKey: string, 
  maxWaitTime: number = 300000 // 5 minut
): Promise<string> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const status = await getVideoStatus(videoId, apiKey);
    
    if (status.data.status === 'completed' && status.data.video_url) {
      return status.data.video_url;
    }
    
    if (status.data.status === 'failed') {
      throw new Error(`HeyGen video selhalo: ${status.data.error_message}`);
    }
    
    // Čekej 10 sekund před dalším pokusem
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  throw new Error('HeyGen video trvalo příliš dlouho (timeout)');
}

// Získání dostupných avatarů
export async function getAvailableAvatars(apiKey: string) {
  const response = await fetch('https://api.heygen.com/v1/avatar.list', {
    headers: {
      'X-API-KEY': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Chyba při načítání avatarů: ${response.status}`);
  }

  return response.json();
} 