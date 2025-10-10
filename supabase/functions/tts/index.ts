import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const text = url.searchParams.get("text");
    const voice = url.searchParams.get("voice") || "en-US-JennyNeural";

    if (!text) {
      return new Response(JSON.stringify({ error: "Text parameter required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[TTS] Generating speech for: "${text.substring(0, 50)}..." with voice: ${voice}`);

    // Generate unique request ID
    const requestId = crypto.randomUUID().replace(/-/g, "");
    const timestamp = new Date().toISOString();

    // Build SSML
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${voice.substring(0, 5)}'>
        <voice name='${voice}'>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</voice>
    </speak>`;

    // Connect to Edge TTS WebSocket
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${requestId}`;
    
    const ws = new WebSocket(wsUrl);
    const audioChunks: Uint8Array[] = [];
    
    const audioPromise = new Promise<Uint8Array>((resolve, reject) => {
      let resolved = false;

      ws.onopen = () => {
        console.log("[TTS] WebSocket connected");
        
        // Send configuration
        const configMessage = `Path: speech.config\r\nX-Timestamp: ${timestamp}\r\nContent-Type: application/json\r\n\r\n{"context":{"system":{"name":"SpeechSDK","version":"1.19.0","build":"JavaScript","lang":"JavaScript"},"os":{"platform":"Browser/Linux x86_64","name":"Mozilla/5.0 (X11; Linux x86_64; rv:78.0) Gecko/20100101 Firefox/78.0","version":"5.0 (X11)"}}}`;
        ws.send(configMessage);

        // Send SSML
        const ssmlMessage = `Path: ssml\r\nX-RequestId: ${requestId}\r\nX-Timestamp: ${timestamp}\r\nContent-Type: application/ssml+xml\r\n\r\n${ssml}`;
        ws.send(ssmlMessage);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          if (event.data.includes("Path:turn.end")) {
            console.log("[TTS] Received turn.end, closing connection");
            if (!resolved) {
              resolved = true;
              ws.close();
              
              // Combine all audio chunks
              const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
              const combined = new Uint8Array(totalLength);
              let offset = 0;
              for (const chunk of audioChunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
              }
              resolve(combined);
            }
          }
        } else if (event.data instanceof Blob) {
          event.data.arrayBuffer().then((buffer) => {
            const view = new Uint8Array(buffer);
            
            // Skip header (find audio data after "Path:audio\r\n")
            const headerEnd = findHeaderEnd(view);
            if (headerEnd > 0) {
              const audioData = view.slice(headerEnd);
              audioChunks.push(audioData);
              console.log(`[TTS] Received audio chunk: ${audioData.length} bytes`);
            }
          });
        }
      };

      ws.onerror = (error) => {
        console.error("[TTS] WebSocket error:", error);
        if (!resolved) {
          resolved = true;
          reject(new Error("WebSocket connection failed"));
        }
      };

      ws.onclose = () => {
        console.log("[TTS] WebSocket closed");
        if (!resolved) {
          resolved = true;
          
          // Return whatever we have
          if (audioChunks.length > 0) {
            const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of audioChunks) {
              combined.set(chunk, offset);
              offset += chunk.length;
            }
            resolve(combined);
          } else {
            reject(new Error("No audio data received"));
          }
        }
      };

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          reject(new Error("TTS request timeout"));
        }
      }, 30000);
    });

    const audioData = await audioPromise;
    
    console.log(`[TTS] Successfully generated ${audioData.length} bytes of audio`);

    // Convert to regular Uint8Array to satisfy TypeScript
    const audioBytes = new Uint8Array(audioData);

    return new Response(new Blob([audioBytes], { type: "audio/mpeg" }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("[TTS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function findHeaderEnd(data: Uint8Array): number {
  // Look for "\r\n\r\n" which marks end of headers
  for (let i = 0; i < data.length - 3; i++) {
    if (
      data[i] === 13 &&
      data[i + 1] === 10 &&
      data[i + 2] === 13 &&
      data[i + 3] === 10
    ) {
      return i + 4;
    }
  }
  return -1;
}
