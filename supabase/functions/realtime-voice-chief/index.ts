import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, text, action } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found');
    }

    console.log("🎯 Processing request with action:", action);

    // Handle voice-to-text conversion
    if (action === 'transcribe' && audio) {
      console.log("🎤 Transcribing audio...");
      
      // Decode base64 audio
      const binaryString = atob(audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create form data for Whisper API
      const formData = new FormData();
      const blob = new Blob([bytes], { type: 'audio/webm' });
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-1');

      const transcribeResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      });

      if (!transcribeResponse.ok) {
        throw new Error(`Transcription failed: ${await transcribeResponse.text()}`);
      }

      const transcription = await transcribeResponse.json();
      console.log("✅ Transcription:", transcription.text);

      return new Response(JSON.stringify({ 
        text: transcription.text,
        action: 'transcription_complete'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle AI chat response
    if (action === 'chat' && text) {
      console.log("🤖 Getting AI response for:", text);

      const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `CRITICAL INSTRUCTION: You MUST respond ONLY in English language. Never use any other language.

You are Chief, an AI executive assistant. You help busy professionals manage their day efficiently.

Key capabilities:
- Calendar management and scheduling
- Email prioritization and drafting
- Task organization and reminders
- Meeting preparation and follow-ups
- Daily briefings and summaries

Personality:
- Professional yet approachable
- Concise but thorough
- Proactive in suggesting improvements
- Always respectful of time
- Confident in handling executive-level tasks

MANDATORY: Your response must be in English only, regardless of what language the user speaks. If the user speaks in Korean, Chinese, Spanish, or any other language, you must respond in English. This is non-negotiable.

Keep responses concise and actionable. Speak naturally as if you're a trusted assistant.

REMINDER: ENGLISH ONLY - NO EXCEPTIONS.`
            },
            { role: 'user', content: `User said: "${text}". Please respond ONLY in English, regardless of the language the user used.` }
          ],
          max_tokens: 500,
          temperature: 0.8
        }),
      });

      if (!chatResponse.ok) {
        throw new Error(`Chat failed: ${await chatResponse.text()}`);
      }

      const chatResult = await chatResponse.json();
      const aiResponse = chatResult.choices[0].message.content;
      console.log("✅ AI Response:", aiResponse);

      return new Response(JSON.stringify({ 
        text: aiResponse,
        action: 'chat_complete'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle text-to-speech conversion
    if (action === 'speak' && text) {
      console.log("🔊 Converting text to speech...");

      // Ensure text is in English before TTS conversion
      let englishText = text;
      
      // Check if text contains non-English characters and translate if needed
      const hasNonEnglish = /[^\x00-\x7F]/.test(text);
      if (hasNonEnglish) {
        console.log("⚠️ Non-English text detected, translating to English...");
        
        const translateResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'Translate the following text to English. Return ONLY the translated text, nothing else.'
              },
              { role: 'user', content: text }
            ],
            max_tokens: 300,
            temperature: 0
          }),
        });

        if (translateResponse.ok) {
          const translateResult = await translateResponse.json();
          englishText = translateResult.choices[0].message.content.trim();
          console.log("✅ Translated to English:", englishText);
        } else {
          console.warn("❌ Translation failed, using fallback English text");
          englishText = "Hello! How can I assist you today?";
        }
      }

      const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'alloy',
          input: englishText,
          response_format: 'mp3'
        }),
      });

      if (!ttsResponse.ok) {
        throw new Error(`TTS failed: ${await ttsResponse.text()}`);
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      
      // Convert to base64 in chunks to avoid stack overflow
      const uint8Array = new Uint8Array(audioBuffer);
      let base64Audio = '';
      const chunkSize = 0x8000; // 32KB chunks
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        base64Audio += btoa(String.fromCharCode.apply(null, Array.from(chunk)));
      }

      console.log("✅ Audio generated successfully");

      return new Response(JSON.stringify({ 
        audio: base64Audio,
        action: 'speech_complete'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action or missing required parameters');

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});