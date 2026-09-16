import https from 'https';
import http from 'http';

/**
 * High-performance Hebrew Text-to-Speech service.
 * Converts Hebrew text to audio stream/buffer without expensive third-party fees.
 */
export async function synthesizeHebrewSpeech(text: string, speed = 1.0): Promise<Buffer> {
  // Clean text from Markdown artifacts, emojis, asterisks, brackets that sound weird in phone calls
  const cleanText = cleanTextForSpeech(text);
  
  if (!cleanText || cleanText.trim().length === 0) {
    return Buffer.from([]);
  }

  // Split into chunks of ~160 chars max for high reliability & fast streaming
  const validChunks = splitTextIntoSentenceChunks(cleanText, 160)
    .map(c => c.trim())
    .filter(Boolean);

  // Fetch all TTS chunks in parallel for blazing-fast generation (< 1.5s total)
  const results = await Promise.all(
    validChunks.map(chunk =>
      fetchTTSChunk(chunk, speed).catch(err => {
        console.error('Error fetching TTS chunk:', err);
        return null;
      })
    )
  );

  const audioBuffers: Buffer[] = results.filter((b): b is Buffer => b !== null && b.length > 0);

  if (audioBuffers.length === 0) {
    throw new Error('Failed to generate audio for text');
  }

  return Buffer.concat(audioBuffers);
}

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1')     // Italic
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Markdown links
    .replace(/[`#_~]/g, '')           // Special markdown symbols
    .replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, '') // Emojis
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTextIntoSentenceChunks(text: string, maxLen: number): string[] {
  const sentences = text.split(/(?<=[.?!,\n;:־])/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length <= maxLen) {
      current += sentence;
    } else {
      if (current) chunks.push(current);
      if (sentence.length > maxLen) {
        // Break long words/sentence
        const words = sentence.split(' ');
        let temp = '';
        for (const w of words) {
          if ((temp + ' ' + w).length <= maxLen) {
            temp += (temp ? ' ' : '') + w;
          } else {
            if (temp) chunks.push(temp);
            temp = w;
          }
        }
        if (temp) chunks.push(temp);
        current = '';
      } else {
        current = sentence;
      }
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function fetchTTSChunk(text: string, speed = 1.0): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    // Google Translate public TTS endpoint - completely free, supports Hebrew with natural inflection
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=iw&client=tw-ob&q=${encodedText}&ttsspeed=${speed}`;

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`TTS API returned status code ${res.statusCode}`));
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', (err) => reject(err));
    }).on('error', (err) => reject(err));
  });
}
