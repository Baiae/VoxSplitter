import { GoogleGenAI, Type } from "@google/genai";
import { DiarizationResult } from "../types";

const processAudio = async (audioBase64: string, mimeType: string): Promise<DiarizationResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not set in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze this audio file for speaker diarization. 
    Identify distinct speakers (e.g., Speaker 1, Speaker 2).
    Return a list of speech segments. 
    For each segment, strictly provide:
    - speaker: The label of the speaker.
    - start: Start time in seconds (float).
    - end: End time in seconds (float).
    - text: A brief transcription of what was said.
    
    Ensure the timestamps are as accurate as possible to the audio source.
    Group consecutive speech by the same speaker into single segments if the pause is less than 1 second.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType, // Use the correct mime type (e.g. 'audio/mpeg' or 'audio/wav')
              data: audioBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING },
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                  text: { type: Type.STRING },
                },
                required: ["speaker", "start", "end", "text"],
              },
            },
          },
          required: ["segments"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("No response from Gemini.");
    }
    
    const result = JSON.parse(jsonText) as DiarizationResult;
    return result;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const geminiService = {
  processAudio,
};