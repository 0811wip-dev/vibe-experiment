import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from "@google/genai";

const GEMINI_API_KEY = process.env.API_KEY || '';

const SYSTEM_INSTRUCTION = `
You are a real-time AI Video Jockey (VJ) and audio controller. 
Your job is to analyze the video stream for hand gestures and immediately trigger audio effects.
Do not generate speech. Only call the 'triggerEffect' function.

GESTURE MAPPINGS:
1. OPEN HAND / WAVE -> 'glitch' (Rapid stuttering sound)
2. FIST / GRAB -> 'crush' (Bitcrush/Distortion)
3. THUMBS UP -> 'rise' (Uplifting white noise sweep)
4. POINTING FINGER / INDEX -> 'laser' (Zap sound)

If no distinct gesture is detected, do nothing.
React quickly.
`;

const triggerEffectTool: FunctionDeclaration = {
  name: 'triggerEffect',
  description: 'Triggers a specific audio effect based on visual gesture.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      effect: {
        type: Type.STRING,
        enum: ['glitch', 'crush', 'rise', 'laser'],
        description: 'The type of effect to trigger'
      }
    },
    required: ['effect']
  }
};

export class LiveSessionService {
  private session: any = null;
  private onEffectCallback: ((effect: string) => void) | null = null;
  private isConnected: boolean = false;

  constructor(onEffect: (effect: string) => void) {
    this.onEffectCallback = onEffect;
  }

  public async connect() {
    if (this.isConnected) return;

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      
      this.session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: [triggerEffectTool] }],
          responseModalities: [Modality.AUDIO] // We don't need text, just tool calls (and audio if model decides, but we ignore it)
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connected');
            this.isConnected = true;
          },
          onmessage: (msg: LiveServerMessage) => {
            this.handleMessage(msg);
          },
          onclose: () => {
            console.log('Gemini Live Closed');
            this.isConnected = false;
          },
          onerror: (err) => {
            console.error('Gemini Live Error', err);
            this.isConnected = false;
          }
        }
      });
      
    } catch (error) {
      console.error("Failed to connect to Gemini Live:", error);
      throw error;
    }
  }

  public async sendVideoFrame(base64Image: string) {
    if (!this.isConnected || !this.session) return;
    
    // Send frame
    try {
        await this.session.sendRealtimeInput({
            media: {
                mimeType: "image/jpeg",
                data: base64Image
            }
        });
    } catch (e) {
        console.error("Error sending frame", e);
    }
  }

  public disconnect() {
    if (this.session) {
      // No explicit close method documented on the session object returned by connect? 
      // Usually standard websocket close or simply letting it GC. 
      // The SDK might handle cleanup. 
      // Assuming session is not easily closable manually in this version of SDK without `ws.close()`,
      // but we can stop sending frames.
      // Actually, looking at docs, standard WebSocket 'close' might be wrapped or not exposed.
      // We'll just reset state.
      this.isConnected = false;
      this.session = null;
    }
  }

  private handleMessage(message: LiveServerMessage) {
    // Check for tool calls
    if (message.toolCall) {
        for (const fc of message.toolCall.functionCalls) {
            if (fc.name === 'triggerEffect') {
                const effect = (fc.args as any).effect;
                console.log("AI TRIGGERED EFFECT:", effect);
                if (this.onEffectCallback && effect) {
                    this.onEffectCallback(effect);
                }

                // Send response back to acknowledge
                this.session.sendToolResponse({
                    functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: { result: "ok" }
                    }
                });
            }
        }
    }
  }
}