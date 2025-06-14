const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Create WebSocket server
const wss = new WebSocket.Server({ 
  port: port + 1, // WebSocket on port 3002 by default
  perMessageDeflate: false 
});

console.log(`🚀 HTTP server starting on port ${port}`);
console.log(`🔌 WebSocket server starting on port ${port + 1}`);

wss.on('connection', (clientSocket, req) => {
  console.log('🎯 New client connected from:', req.socket.remoteAddress);
  
  let openAISocket = null;
  let sessionCreated = false;

  // Extract API key from query params or headers
  const url = new URL(req.url, `http://${req.headers.host}`);
  const apiKey = url.searchParams.get('api_key') || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ No OpenAI API key provided');
    clientSocket.send(JSON.stringify({
      type: 'error',
      message: 'No OpenAI API key provided'
    }));
    clientSocket.close();
    return;
  }

  console.log('🔑 Using API key with length:', apiKey.length);

  // Connect to OpenAI Realtime API
  const connectToOpenAI = () => {
    try {
      const openAIUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
      
      console.log('🔗 Connecting to OpenAI:', openAIUrl);
      
      openAISocket = new WebSocket(openAIUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      openAISocket.on('open', () => {
        console.log('✅ Connected to OpenAI Realtime API');
        
        // Notify client that connection is ready
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({
            type: 'connection_established',
            message: 'Connected to OpenAI'
          }));
        }
      });

      openAISocket.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📦 OpenAI -> Client:', message.type);

          // Handle session creation - send session update after creation
          if (message.type === 'session.created' && !sessionCreated) {
            sessionCreated = true;
            console.log('🎯 Session created, sending session update');
            
            const sessionUpdate = {
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: `You are Chief, an AI executive assistant. You help busy professionals manage their day efficiently.

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

Remember to be helpful, efficient, and speak naturally as if you're a trusted assistant who knows the user's preferences and work style.`,
                voice: 'alloy',
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: {
                  model: 'whisper-1'
                },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 1000
                },
                temperature: 0.8,
                max_response_output_tokens: 'inf'
              }
            };

            if (openAISocket.readyState === WebSocket.OPEN) {
              openAISocket.send(JSON.stringify(sessionUpdate));
            }
          }

          // Forward message to client
          if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(data);
          }
        } catch (error) {
          console.error('❌ Error processing OpenAI message:', error);
        }
      });

      openAISocket.on('error', (error) => {
        console.error('❌ OpenAI WebSocket error:', error);
        
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({
            type: 'error',
            message: `OpenAI connection error: ${error.message}`
          }));
        }
      });

      openAISocket.on('close', (code, reason) => {
        console.log('🔌 OpenAI WebSocket closed:', code, reason.toString());
        
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({
            type: 'error',
            message: `OpenAI connection closed: ${reason.toString() || code}`
          }));
          clientSocket.close();
        }
      });

    } catch (error) {
      console.error('❌ Failed to connect to OpenAI:', error);
      
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({
          type: 'error',
          message: `Failed to connect to OpenAI: ${error.message}`
        }));
        clientSocket.close();
      }
    }
  };

  // Handle messages from client
  clientSocket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📦 Client -> OpenAI:', message.type);
      
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(data);
      } else {
        console.warn('⚠️ OpenAI socket not ready, message dropped');
      }
    } catch (error) {
      console.error('❌ Error processing client message:', error);
    }
  });

  clientSocket.on('error', (error) => {
    console.error('❌ Client WebSocket error:', error);
  });

  clientSocket.on('close', () => {
    console.log('🔌 Client disconnected');
    if (openAISocket) {
      openAISocket.close();
    }
  });

  // Initialize OpenAI connection
  connectToOpenAI();
});

// Start HTTP server
app.listen(port, () => {
  console.log(`✅ HTTP server running on port ${port}`);
  console.log(`✅ WebSocket server running on port ${port + 1}`);
  console.log(`🔍 Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  wss.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});