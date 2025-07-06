import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingProgress {
  step: string;
  progress: number;
  status: string;
  data?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get user integrations
    const { data: integrations } = await supabaseClient
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!integrations || integrations.length === 0) {
      throw new Error('No active integrations found');
    }

    // Create a readable stream for real-time progress
    const stream = new ReadableStream({
      start(controller) {
        const sendProgress = (progress: ProcessingProgress) => {
          const data = `data: ${JSON.stringify(progress)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        };

        const processData = async () => {
          try {
            let totalEmails = 0;
            let contactsExtracted = 0;
            const extractedContacts: Array<{name: string, email: string, frequency: number}> = [];
            const communicationPatterns: string[] = [];

            // Step 1: Fetch Gmail data
            sendProgress({ step: 'Fetching Gmail emails...', progress: 10, status: 'processing' });
            
            const gmailIntegration = integrations.find(i => i.integration_type === 'gmail');
            if (gmailIntegration) {
              try {
                const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50', {
                  headers: {
                    'Authorization': `Bearer ${gmailIntegration.access_token}`,
                  },
                });

                if (gmailResponse.ok) {
                  const gmailData = await gmailResponse.json();
                  totalEmails = gmailData.messages?.length || 0;

                  // Fetch detailed email data for analysis
                  if (gmailData.messages) {
                    const emailDetails = await Promise.all(
                      gmailData.messages.slice(0, 20).map(async (message: any) => {
                        const detailResponse = await fetch(
                          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
                          {
                            headers: {
                              'Authorization': `Bearer ${gmailIntegration.access_token}`,
                            },
                          }
                        );
                        return detailResponse.ok ? await detailResponse.json() : null;
                      })
                    );

                    // Extract contacts and patterns
                    emailDetails.forEach(email => {
                      if (email?.payload?.headers) {
                        const fromHeader = email.payload.headers.find((h: any) => h.name === 'From');
                        if (fromHeader) {
                          const emailMatch = fromHeader.value.match(/<(.+?)>/);
                          const emailAddr = emailMatch ? emailMatch[1] : fromHeader.value;
                          const nameMatch = fromHeader.value.match(/^(.+?)\s*</);
                          const name = nameMatch ? nameMatch[1].replace(/"/g, '') : emailAddr.split('@')[0];

                          const existingContact = extractedContacts.find(c => c.email === emailAddr);
                          if (existingContact) {
                            existingContact.frequency++;
                          } else {
                            extractedContacts.push({ name, email: emailAddr, frequency: 1 });
                          }
                        }
                      }
                    });

                    contactsExtracted = extractedContacts.length;
                  }
                }
              } catch (error) {
                console.error('Gmail fetch error:', error);
              }
            }

            sendProgress({ step: 'Analyzing communication patterns...', progress: 35, status: 'processing' });
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Step 2: Analyze patterns using OpenAI
            if (extractedContacts.length > 0) {
              try {
                const analysisPrompt = `Analyze these email contacts and provide communication insights:
                ${extractedContacts.slice(0, 10).map(c => `${c.name} (${c.email}) - ${c.frequency} emails`).join('\n')}
                
                Provide:
                1. Writing style (2-3 words)
                2. Communication tone (2-3 words)  
                3. Top 3 common topics
                
                Format as JSON: {"writingStyle": "", "tone": "", "topics": []}`;

                const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: analysisPrompt }],
                    temperature: 0.3,
                  }),
                });

                if (openaiResponse.ok) {
                  const aiResult = await openaiResponse.json();
                  try {
                    const analysis = JSON.parse(aiResult.choices[0].message.content);
                    communicationPatterns.push(analysis.writingStyle, analysis.tone, ...analysis.topics);
                  } catch (e) {
                    // Fallback analysis
                    communicationPatterns.push('Professional', 'Direct', 'Project Updates');
                  }
                }
              } catch (error) {
                console.error('Analysis error:', error);
                communicationPatterns.push('Professional', 'Collaborative', 'Business Communications');
              }
            }

            sendProgress({ step: 'Saving contacts and preferences...', progress: 60, status: 'processing' });

            // Step 3: Save contacts to database
            if (extractedContacts.length > 0) {
              const contactsToInsert = extractedContacts
                .filter(c => c.frequency > 1) // Only save frequent contacts
                .slice(0, 20) // Limit to top 20
                .map(c => ({
                  user_id: user.id,
                  name: c.name,
                  email: c.email,
                  frequency: c.frequency,
                  context: 'Extracted from email analysis'
                }));

              await supabaseClient
                .from('contacts')
                .upsert(contactsToInsert, { onConflict: 'user_id,email' });
            }

            // Save user preferences
            const preferencesToSave = {
              user_id: user.id,
              writing_style: communicationPatterns[0] || 'Professional',
              tone: communicationPatterns[1] || 'Collaborative', 
              common_topics: communicationPatterns.slice(2) || ['General Communications'],
              email_analysis_completed: true,
              total_emails_analyzed: totalEmails,
              contacts_extracted: contactsExtracted
            };

            await supabaseClient
              .from('user_preferences')
              .upsert([preferencesToSave], { onConflict: 'user_id' });

            sendProgress({ step: 'Creating embeddings...', progress: 85, status: 'processing' });
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Step 4: Create embeddings for key data
            const embeddingContent = `User communication profile:
            Writing Style: ${preferencesToSave.writing_style}
            Tone: ${preferencesToSave.tone}
            Topics: ${preferencesToSave.common_topics.join(', ')}
            Key Contacts: ${extractedContacts.slice(0, 5).map(c => c.name).join(', ')}`;

            try {
              const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'text-embedding-3-small',
                  input: embeddingContent,
                }),
              });

              if (embeddingResponse.ok) {
                const embeddingResult = await embeddingResponse.json();
                await supabaseClient
                  .from('embeddings')
                  .insert({
                    user_id: user.id,
                    content: embeddingContent,
                    embedding: JSON.stringify(embeddingResult.data[0].embedding),
                    source_type: 'user_profile',
                    source_id: user.id,
                    metadata: { 
                      type: 'onboarding_analysis',
                      total_emails: totalEmails,
                      contacts_count: contactsExtracted
                    }
                  });
              }
            } catch (error) {
              console.error('Embedding error:', error);
            }

            sendProgress({ 
              step: 'Complete!', 
              progress: 100, 
              status: 'completed', 
              data: {
                totalEmails,
                contactsExtracted,
                preferencesAnalyzed: {
                  writingStyle: preferencesToSave.writing_style,
                  tone: preferencesToSave.tone,
                  commonTopics: preferencesToSave.common_topics
                }
              }
            });

          } catch (error) {
            sendProgress({ 
              step: 'Error occurred', 
              progress: 0, 
              status: 'error', 
              data: { error: error.message }
            });
          } finally {
            controller.close();
          }
        };

        processData();
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in onboarding processor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});