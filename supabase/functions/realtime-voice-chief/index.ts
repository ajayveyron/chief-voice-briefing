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

      // Check if user is asking for emails, calendar, or slack
      const lowerText = text.toLowerCase();
      const isEmailRequest = lowerText.includes('mail') || lowerText.includes('email') || lowerText.includes('message');
      const isCalendarRequest = lowerText.includes('calendar') || lowerText.includes('meeting') || lowerText.includes('schedule');
      const isSlackRequest = lowerText.includes('slack');

      let aiResponseText = '';

      // Get user from request headers for authentication
      const authHeader = req.headers.get('Authorization');
      
      if ((isEmailRequest || isCalendarRequest || isSlackRequest) && authHeader) {
        try {
          // Create Supabase client for function calls
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
          
          if (isEmailRequest) {
            console.log("📧 Fetching Gmail emails...");
            const emailResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-gmail-emails`, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
            });
            
            if (emailResponse.ok) {
              const emailData = await emailResponse.json();
              const emails = emailData.emails || [];
              
              if (emails.length === 0) {
                aiResponseText = "You have no new emails to review right now. Your inbox is all caught up!";
              } else {
                aiResponseText = `You have ${emails.length} recent email${emails.length !== 1 ? 's' : ''}:\n\n`;
                emails.slice(0, 3).forEach((email: any, index: number) => {
                  aiResponseText += `${index + 1}. From: ${email.from.split('<')[0].trim()}\n   Subject: ${email.subject}\n\n`;
                });
                
                if (emails.length > 3) {
                  aiResponseText += `...and ${emails.length - 3} more. `;
                }
                aiResponseText += "Would you like me to read any specific email or help you respond to any of them?";
              }
            } else {
              aiResponseText = "I couldn't fetch your emails right now. Please make sure your Gmail is connected in the integrations.";
            }
          } else if (isCalendarRequest) {
            console.log("📅 Fetching calendar events...");
            const calendarResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-calendar-events`, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
            });
            
            if (calendarResponse.ok) {
              const calendarData = await calendarResponse.json();
              const events = calendarData.events || [];
              
              if (events.length === 0) {
                aiResponseText = "Your calendar is clear today. No meetings or events scheduled.";
              } else {
                aiResponseText = `You have ${events.length} upcoming event${events.length !== 1 ? 's' : ''}:\n\n`;
                events.slice(0, 3).forEach((event: any, index: number) => {
                  const startTime = new Date(event.start?.dateTime || event.start?.date).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  aiResponseText += `${index + 1}. ${event.summary} at ${startTime}\n`;
                });
                
                if (events.length > 3) {
                  aiResponseText += `...and ${events.length - 3} more events today.`;
                }
              }
            } else {
              aiResponseText = "I couldn't fetch your calendar right now. Please make sure your calendar is connected in the integrations.";
            }
          } else if (isSlackRequest) {
            console.log("💬 Fetching Slack messages...");
            const slackResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-slack-messages`, {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
              },
            });
            
            if (slackResponse.ok) {
              const slackData = await slackResponse.json();
              const messages = slackData.messages || [];
              
              if (messages.length === 0) {
                aiResponseText = "No new Slack messages to review right now.";
              } else {
                aiResponseText = `You have ${messages.length} recent Slack message${messages.length !== 1 ? 's' : ''}:\n\n`;
                messages.slice(0, 3).forEach((message: any, index: number) => {
                  aiResponseText += `${index + 1}. From ${message.user}: ${message.text.substring(0, 100)}${message.text.length > 100 ? '...' : ''}\n\n`;
                });
                
                if (messages.length > 3) {
                  aiResponseText += `...and ${messages.length - 3} more messages.`;
                }
              }
            } else {
              aiResponseText = "I couldn't fetch your Slack messages right now. Please make sure Slack is connected in the integrations.";
            }
          }
        } catch (error) {
          console.error("Error fetching data:", error);
          aiResponseText = "I encountered an error while fetching your data. Please try again or check your integrations.";
        }
      } else {
        // Regular AI chat response
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

You are Chief, an AI executive assistant and Chief of Staff. You help busy professionals manage their day efficiently.

Key capabilities:
- Calendar management and scheduling
- Email prioritization and drafting
- Task organization and reminders
- Meeting preparation and follow-ups
- Daily briefings and summaries

When users ask about emails, calendar, or Slack, I will automatically fetch that data for them.

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
        aiResponseText = chatResult.choices[0].message.content;
      }

      console.log("✅ AI Response:", aiResponseText);

      return new Response(JSON.stringify({ 
        text: aiResponseText,
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
      
      // Convert to base64 using a more reliable method
      const uint8Array = new Uint8Array(audioBuffer);
      
      // Use TextDecoder approach to avoid issues with special characters
      let binaryString = '';
      const chunkSize = 32768; // 32KB chunks
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        // Convert chunk to binary string more safely
        const chunkString = Array.from(chunk, byte => String.fromCharCode(byte)).join('');
        binaryString += chunkString;
      }
      
      const base64Audio = btoa(binaryString);

      // Validate the base64 string
      if (!base64Audio || base64Audio.length < 100) {
        throw new Error('Generated base64 audio is too short or empty');
      }

      console.log("✅ Audio generated successfully, base64 length:", base64Audio.length);

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