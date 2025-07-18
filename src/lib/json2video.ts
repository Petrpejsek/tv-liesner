// JSON2Video Background Video Generation
export interface JSON2VideoProject {
  comment: string;
  resolution: string;
  quality: string;
  draft: boolean;
  scenes: Array<{
    comment: string;
    duration: number;
    elements: Array<{
      type: string;
      src: string;
      filename?: string;
      start: number;
      duration: number;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      settings?: {
        volume?: number;
        speed?: number;
      };
    }>;
  }>;
}

export interface JSON2VideoResponse {
  success: boolean;
  project: string;
  message?: string;
}

export interface JSON2VideoStatus {
  success: boolean;
  project: string;
  status: 'draft' | 'queued' | 'rendering' | 'finished' | 'error';
  url?: string;
  thumbnail?: string;
  error?: string;
}

export async function createBackgroundVideo(
  duration: number,
  apiKey: string,
  style: 'tech' | 'lifestyle' | 'business' | 'creative' = 'tech'
): Promise<JSON2VideoResponse> {
  if (!apiKey) {
    throw new Error('JSON2Video API klíč je povinný');
  }

  // Výběr background videa podle stylu
  const backgroundVideos = {
    tech: [
      'https://cdn.json2video.com/backgrounds/tech_1.mp4',
      'https://cdn.json2video.com/backgrounds/tech_2.mp4',
      'https://cdn.json2video.com/backgrounds/tech_3.mp4'
    ],
    lifestyle: [
      'https://cdn.json2video.com/backgrounds/lifestyle_1.mp4',
      'https://cdn.json2video.com/backgrounds/lifestyle_2.mp4'
    ],
    business: [
      'https://cdn.json2video.com/backgrounds/business_1.mp4',
      'https://cdn.json2video.com/backgrounds/business_2.mp4'
    ],
    creative: [
      'https://cdn.json2video.com/backgrounds/creative_1.mp4',
      'https://cdn.json2video.com/backgrounds/creative_2.mp4'
    ]
  };

  const selectedVideo = backgroundVideos[style][Math.floor(Math.random() * backgroundVideos[style].length)];

  const project: JSON2VideoProject = {
    comment: `AI Reels Background - ${style} style`,
    resolution: "1080x1920", // Vertikální pro TikTok/Shorts
    quality: "high",
    draft: false,
    scenes: [{
      comment: "Background scene",
      duration: duration,
      elements: [{
        type: "video",
        src: selectedVideo,
        start: 0,
        duration: duration,
        x: 0,
        y: 0,
        width: 1080,
        height: 1920,
        settings: {
          volume: 0 // Beze zvuku, jen vizuální background
        }
      }]
    }]
  };

  const response = await fetch('https://api.json2video.com/v2/movies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify(project)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JSON2Video chyba ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function getVideoStatus(projectId: string, apiKey: string): Promise<JSON2VideoStatus> {
  const response = await fetch(`https://api.json2video.com/v2/movies/${projectId}`, {
    headers: {
      'x-api-key': apiKey
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JSON2Video status chyba ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function waitForVideoCompletion(
  projectId: string,
  apiKey: string,
  maxWaitTime: number = 600000 // 10 minut
): Promise<string> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const status = await getVideoStatus(projectId, apiKey);
    
    if (status.status === 'finished' && status.url) {
      return status.url;
    }
    
    if (status.status === 'error') {
      throw new Error(`JSON2Video selhalo: ${status.error}`);
    }
    
    // Čekej 15 sekund před dalším pokusem
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  
  throw new Error('JSON2Video rendering trval příliš dlouho (timeout)');
} 