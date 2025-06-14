# OpenAI Realtime API Proxy Server

This Node.js server acts as a proxy between your Supabase Edge Function and OpenAI's Realtime API, handling the WebSocket connection with proper authorization headers.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your OpenAI API key to `.env`:
```
PORT=3001
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## Running Locally

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will run on:
- HTTP: `http://localhost:3001`
- WebSocket: `ws://localhost:3002`

## Deployment Options

### Option 1: Fly.io (Recommended)

1. Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/

2. Create `fly.toml`:
```toml
app = "your-openai-proxy"
primary_region = "iad"

[build]

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true

[[services]]
  internal_port = 8081
  protocol = "tcp"
  auto_stop_machines = true
  auto_start_machines = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
```

3. Deploy:
```bash
fly launch
fly secrets set OPENAI_API_KEY=sk-your-key-here
fly deploy
```

### Option 2: Render

1. Connect your GitHub repo to Render
2. Create a new Web Service
3. Set environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
4. Deploy

### Option 3: Railway

1. Connect your GitHub repo to Railway
2. Add environment variables
3. Deploy

## Health Check

Visit `http://your-domain/health` to verify the server is running.

## WebSocket Connection

Connect to `wss://your-domain:PORT` (where PORT is usually 443 for HTTPS deployments).