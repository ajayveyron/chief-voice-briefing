# Realtime Voice Chief Setup Guide

## Overview

This guide helps you set up the OpenAI Realtime API with proper WebSocket authentication using a Node.js proxy server. The issue was that Deno's WebSocket API doesn't support custom headers, which OpenAI requires for authentication.

## Architecture

```
Client (Browser) → Supabase Edge Function → Node.js Proxy → OpenAI Realtime API
```

## Step 1: Deploy the Node.js Proxy

### Option A: Quick Deploy with Fly.io (Recommended)

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Navigate to the proxy directory:**
   ```bash
   cd nodejs-proxy
   ```

3. **Run the deployment script:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. **Follow the prompts to:**
   - Login to Fly.io
   - Enter your OpenAI API key when prompted
   - Wait for deployment to complete

### Option B: Manual Fly.io Deploy

1. **Navigate to proxy directory:**
   ```bash
   cd nodejs-proxy
   ```

2. **Login to Fly.io:**
   ```bash
   flyctl auth login
   ```

3. **Launch the app:**
   ```bash
   flyctl launch
   ```

4. **Set your OpenAI API key:**
   ```bash
   flyctl secrets set OPENAI_API_KEY=sk-your-openai-api-key-here
   ```

5. **Deploy:**
   ```bash
   flyctl deploy
   ```

### Option C: Other Platforms

#### Render
1. Connect your GitHub repo to Render
2. Create a new Web Service
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variable: `OPENAI_API_KEY`

#### Railway
1. Connect your GitHub repo to Railway
2. Deploy from the `nodejs-proxy` folder
3. Add environment variable: `OPENAI_API_KEY`

## Step 2: Update Supabase Edge Function

1. **Get your proxy URL** from the deployment (e.g., `https://your-app.fly.dev`)

2. **Update the proxy URL in `supabase/functions/realtime-voice-chief/index.ts`:**
   
   Find line 37:
   ```typescript
   const proxyUrl = "wss://your-proxy-server.fly.dev"; // Replace with your actual proxy URL
   ```
   
   Replace with your actual WebSocket URL:
   ```typescript
   const proxyUrl = "wss://your-app.fly.dev:8082"; // For Fly.io
   // OR
   const proxyUrl = "wss://your-app.onrender.com"; // For Render
   ```

3. **The Edge Function will automatically redeploy** when you save the file.

## Step 3: Test the Setup

1. **Check proxy health:**
   ```bash
   curl https://your-app.fly.dev/health
   ```

2. **Test in your app:**
   - Go to your application
   - Click "Start Conversation"
   - Check the browser console for connection logs

## Troubleshooting

### Common Issues

#### 1. "Connection refused" error
- **Cause:** Wrong proxy URL or proxy not running
- **Fix:** Verify the proxy URL and check if the service is running

#### 2. "Authentication failed" error
- **Cause:** OpenAI API key not set or invalid
- **Fix:** Check that `OPENAI_API_KEY` is correctly set in your proxy environment

#### 3. "WebSocket connection failed"
- **Cause:** Firewall or network issues
- **Fix:** Try using the HTTP URL first to test basic connectivity

### Debugging Commands

```bash
# Check if proxy is running
curl https://your-app.fly.dev/health

# Check Fly.io logs
flyctl logs

# Check Fly.io status
flyctl status

# Test WebSocket connection (requires wscat)
npm install -g wscat
wscat -c wss://your-app.fly.dev:8082
```

## Architecture Benefits

1. **Security:** API key stays on the server side
2. **Compatibility:** Works around Deno WebSocket limitations
3. **Scalability:** Node.js proxy can handle many connections
4. **Reliability:** Proper error handling and reconnection logic

## Cost Considerations

- **Fly.io:** Free tier includes 3 shared-cpu-1x machines
- **Render:** Free tier with some limitations
- **Railway:** $5/month for hobby plan

## Next Steps

Once everything is working:

1. Monitor proxy logs for any issues
2. Consider adding authentication to the proxy for additional security
3. Set up monitoring/alerting for the proxy service
4. Scale the proxy if needed for high traffic

## Support

If you encounter issues:

1. Check the proxy logs: `flyctl logs`
2. Check browser console for client-side errors
3. Verify OpenAI API key is valid and has sufficient credits
4. Test the proxy health endpoint