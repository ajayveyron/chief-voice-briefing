import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  console.log("🔌 Realtime voice chief function called");
  
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log("❌ Expected WebSocket connection");
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  // Get OpenAI API key from environment
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY not found");
    return new Response("Server configuration error", { status: 500 });
  }
  
  console.log("✅ API Key found, length:", OPENAI_API_KEY.length);

  console.log("✅ Upgrading to WebSocket");
  
  try {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let proxySocket: WebSocket | null = null;

    // WebSocket connection opened
    socket.onopen = async () => {
      console.log("🎯 Client WebSocket connected, connecting to proxy...");
      
      try {
        // Connect to Node.js proxy server instead of OpenAI directly
        // TODO: Replace this URL with your deployed proxy server URL
        const proxyUrl = "wss://your-proxy-server.fly.dev"; // Replace with your actual proxy URL
        
        console.log("🔗 Connecting to proxy:", proxyUrl);
        
        // Add API key as query parameter for the proxy
        const urlWithKey = `${proxyUrl}?api_key=${encodeURIComponent(OPENAI_API_KEY)}`;
        proxySocket = new WebSocket(urlWithKey);

        proxySocket.onopen = () => {
          console.log("✅ Connected to proxy server");
        };
      } catch (error) {
        console.error("❌ Failed to create OpenAI WebSocket:", error);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "error",
            message: `Failed to connect to OpenAI: ${error.message}`
          }));
        }
        return;
      }

        proxySocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("📦 Proxy -> Client:", data.type);

            // Forward all messages to client (the proxy handles session management)
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(event.data);
            }
          } catch (error) {
            console.error("❌ Error processing proxy message:", error);
          }
        };

        proxySocket.onerror = (error) => {
          console.error("❌ Proxy WebSocket error:", error);
          const errorMessage = error instanceof ErrorEvent ? error.message : 
                             error instanceof Error ? error.message : 
                             'Proxy WebSocket connection failed';
          
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "error",
              message: errorMessage
            }));
          }
        };

        proxySocket.onclose = (event) => {
          console.log("🔌 Proxy WebSocket closed:", event.code, event.reason);
          const closeMessage = event.reason || `Connection closed with code ${event.code}`;
          
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "error", 
              message: `Proxy connection closed: ${closeMessage}`
            }));
            socket.close();
          }
        };
      } catch (error) {
        console.error("❌ Failed to connect to proxy:", error);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "error",
            message: `Failed to connect to proxy: ${error.message}`
          }));
        }
        return;
      }
    };

    // Forward client messages to proxy
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📦 Client -> Proxy:", data.type);
        
        if (proxySocket?.readyState === WebSocket.OPEN) {
          proxySocket.send(event.data);
        } else {
          console.warn("⚠️ Proxy socket not ready, message dropped");
        }
      } catch (error) {
        console.error("❌ Error processing client message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("❌ Client WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("🔌 Client WebSocket closed");
      if (proxySocket?.readyState === WebSocket.OPEN) {
        proxySocket.close();
      }
    };

    return response;
  } catch (error) {
    console.error("❌ WebSocket upgrade failed:", error);
    return new Response("WebSocket upgrade failed", { status: 500 });
  }
});