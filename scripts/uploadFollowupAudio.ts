import { synthesizeHebrewSpeech } from '../server/ttsService';
import { uploadYemotAudio } from '../server/yemotService';

async function main() {
  console.log('Synthesizing 001.wav (followup message)...');
  const followupBuf = await synthesizeHebrewSpeech('לשאלה נוספת, אנא אמרו את שאלתכם לאחר הצליל, ולסיום הקש סולמית.');
  console.log(`Generated buffer: ${followupBuf.length} bytes`);

  for (const ext of ['6', '7', '8']) {
    console.log(`Uploading 001 to extension ${ext}...`);
    const ok = await uploadYemotAudio(ext, '001', followupBuf);
    console.log(`Upload 001 to ${ext}: ${ok ? 'SUCCESS' : 'FAILED'}`);
  }

  console.log('Ensuring 000.wav in extension 6...');
  const welcome6Buf = await synthesizeHebrewSpeech('שלום וברוכים הבאים לעוזר הקולי החכם. אנא אמור את שאלתך לאחר הצליל, ולסיום הקש סולמית.');
  const ok6 = await uploadYemotAudio('6', '000', welcome6Buf);
  console.log(`Upload 000 to 6: ${ok6 ? 'SUCCESS' : 'FAILED'}`);
}

main().catch(console.error);
