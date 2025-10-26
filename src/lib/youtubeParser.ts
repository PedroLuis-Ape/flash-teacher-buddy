/**
 * Parse YouTube URL and extract video ID
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/
 */
export function parseYouTubeUrl(url: string): { videoId: string; thumbnailUrl: string } | null {
  try {
    const urlObj = new URL(url);
    let videoId: string | null = null;

    // youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
      videoId = urlObj.searchParams.get('v');
    }
    // youtu.be/VIDEO_ID
    else if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.slice(1);
    }
    // youtube.com/shorts/VIDEO_ID
    else if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/shorts/')) {
      videoId = urlObj.pathname.split('/')[2];
    }

    if (!videoId || videoId.length < 10) {
      return null;
    }

    // Clean video ID (remove any remaining query params)
    videoId = videoId.split('?')[0].split('&')[0];

    return {
      videoId,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

/**
 * Validate if URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname.includes('youtube.com') ||
      urlObj.hostname === 'youtu.be'
    );
  } catch {
    return false;
  }
}
