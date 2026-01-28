
import { GoogleGenAI, Type } from "@google/genai";
import { TrackData } from "../types";

const GEMINI_API_KEY = process.env.API_KEY || '';

// System instruction to guide the model towards minimalist techno generation
const SYSTEM_INSTRUCTION = `
You are an expert producer of Minimalist Electronic Music (Micro-house, Minimal Techno, Glitch, IDM).
Your task is to analyze an image and translate its visual properties into a 16-step track configuration using principles of reductionism.

GENRE AESTHETICS:
- "Less is More". Silence is as important as sound.
- Rhythms should be skeletal, funky, and precise (Micro-timing).
- Timbres should be digital, microscopic, glitchy, or deep/sub-aquatic.

VISUAL -> AUDIO MAPPING:

1. COLOR & TIMBRE:
   - Palette extraction:
     - Monochromatic/Grayscale -> Static noise, clicks, metallic hits (Industrial Minimal).
     - Pastels/Light -> Sine waves, soft bleeps, airy textures (Organic Minimal).
     - Dark/High Contrast -> Sub-bass pulses, heavy compression (Dark Minimal).
     - Vibrant/Neon -> Digital glitches, high-resonance zaps (Glitch).
   - Color Count maps to complexity: Fewer colors = purer waveforms (Sine). More colors = more harmonics (FM/Saw).

2. SHAPE & RHYTHM:
   - Grid/Geometric -> Strictly quantized, locked 4/4 loops.
   - Organic/Fluid -> Swing, off-grid feel, syncopated rhythms.
   - Texture/Noise -> Introduction of random hi-hat glitches or background static.

3. CUSTOM LAYER RHYTHM (for user samples):
   - Analyze the visual pattern/texture density to create a rhythm for the user-uploaded sound ('custom' sequence).
   - Scattered/Dotted Texture -> Syncopated, sporadic triggers (e.g., steps 2, 5, 11, 14).
   - Solid/Blocky Shapes -> Steady, anchoring triggers (e.g., steps 0, 4, 8, 12).
   - Chaotic/Messy -> Erratic bursts.
   - Empty/Minimal -> Very sparse, single accent.

4. AUDIO CREATURE & OBJECT DETECTION:
   - Analyze the image for specific creatures or objects that produce distinct sounds.
   - If found, map to 'soundEffect': 
     - 'cat' (meow)
     - 'dog' (bark/woof)
     - 'bird' (chirp)
     - 'water' (splash/rain)
     - 'thunder'
     - 'traffic'
     - 'wind'
     - 'machinery'
   - Note: If people, faces, or crowds are detected, set 'soundEffect' to 'none'. Do not generate sound effects for humans.
   - If none found, use 'none'.
   - Trigger these sound effects sparsely (e.g., once or twice per loop) in the 'sfx' sequence.

OUTPUT REQUIREMENTS:
- BPM: 118 - 128 (Typical for Minimal).
- Sequences: EXACTLY 16 steps.
- Density: Keep note density LOW. Use 'null' frequently for the lead.
- SFX Sequence: Trigger detected sound effect sparingly (e.g. step 1 or 12).
- Custom Sequence: A 16-step boolean pattern derived from visual texture for the user layer.
- Bass: Deep, simple, sustaining or short pulses.
- Lead: Short plucks, stabs, or background texture.
- Key: Minor or chromatic.

Return a JSON object strictly adhering to the schema.
`;

export const analyzeImage = async (base64Image: string): Promise<TrackData> => {
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    // Remove header if present (data:image/jpeg;base64,)
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg", // Assuming JPEG for simplicity, or detect from header
              data: cleanBase64
            }
          },
          {
            text: "Analyze this image and generate a minimalist techno track configuration JSON. Look for sound-producing creatures and objects (excluding humans)."
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bpm: { type: Type.INTEGER, description: "Beats per minute (118-128)" },
            key: { type: Type.STRING, description: "Musical key (e.g., Am, F#)" },
            mood: { type: Type.STRING, description: "One word mood (e.g., 'Glitchy', 'Sub-aquatic')" },
            visualSummary: { type: Type.STRING, description: "Short description of mapped visual features" },
            soundEffect: { 
              type: Type.STRING, 
              enum: ['cat', 'dog', 'bird', 'water', 'thunder', 'traffic', 'wind', 'machinery', 'people', 'none'],
              description: "Dominant sound-producing creature or object detected" 
            },
            synthSettings: {
              type: Type.OBJECT,
              properties: {
                waveform: { type: Type.STRING, enum: ["sawtooth", "square", "sine", "triangle"] },
                cutoff: { type: Type.NUMBER, description: "Filter cutoff frequency in Hz" },
                resonance: { type: Type.NUMBER, description: "Filter resonance (Q)" },
                attack: { type: Type.NUMBER, description: "Envelope attack time in seconds (usually short)" },
                decay: { type: Type.NUMBER, description: "Envelope decay time in seconds (usually short)" }
              }
            },
            bassSettings: {
              type: Type.OBJECT,
              properties: {
                waveform: { type: Type.STRING, enum: ["sawtooth", "square", "sine", "triangle"] },
                filterFreq: { type: Type.NUMBER }
              }
            },
            drumSettings: {
              type: Type.OBJECT,
              properties: {
                kickPunch: { type: Type.NUMBER },
                hatBright: { type: Type.NUMBER }
              }
            },
            sequences: {
              type: Type.OBJECT,
              properties: {
                kick: { type: Type.ARRAY, items: { type: Type.BOOLEAN } },
                hat: { type: Type.ARRAY, items: { type: Type.BOOLEAN } },
                bass: { type: Type.ARRAY, items: { type: Type.STRING, nullable: true } },
                lead: { type: Type.ARRAY, items: { type: Type.STRING, nullable: true } },
                sfx: { type: Type.ARRAY, items: { type: Type.BOOLEAN }, description: "Triggers for the sound effect" },
                custom: { type: Type.ARRAY, items: { type: Type.BOOLEAN }, description: "Rhythm pattern for user uploaded sample based on visual texture" }
              }
            }
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("No response from Gemini");
    }

    const data = JSON.parse(response.text) as TrackData;
    
    // Safety checks for array lengths
    if (data.sequences.kick.length !== 16) data.sequences.kick = Array(16).fill(false);
    if (!data.sequences.sfx) data.sequences.sfx = Array(16).fill(false);
    if (!data.sequences.custom) data.sequences.custom = Array(16).fill(false); // Default to empty if missing
    
    return data;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
