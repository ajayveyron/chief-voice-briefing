#!/bin/bash

echo "🚀 Deploying OpenAI Realtime Proxy to Fly.io..."

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    echo "❌ flyctl is not installed. Please install it first:"
    echo "   curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if user is logged in
if ! flyctl auth whoami &> /dev/null; then
    echo "🔑 Please log in to Fly.io:"
    flyctl auth login
fi

# Check if app already exists
if flyctl apps list | grep -q "openai-realtime-proxy"; then
    echo "📱 App exists, deploying update..."
    flyctl deploy
else
    echo "🆕 Creating new app..."
    flyctl launch --no-deploy
    
    echo "🔑 Setting up secrets..."
    echo "Please enter your OpenAI API key:"
    read -s OPENAI_API_KEY
    flyctl secrets set OPENAI_API_KEY="$OPENAI_API_KEY"
    
    echo "🚀 Deploying app..."
    flyctl deploy
fi

echo "✅ Deployment complete!"
echo "🔗 Your proxy URL: https://openai-realtime-proxy.fly.dev"
echo "🔌 WebSocket URL: wss://openai-realtime-proxy.fly.dev:8082"
echo ""
echo "📝 Next steps:"
echo "1. Update your Supabase Edge Function with the WebSocket URL above"
echo "2. Test the connection by visiting: https://openai-realtime-proxy.fly.dev/health"