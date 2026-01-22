
import { GoogleGenAI, Type } from "@google/genai";
import { CareerAgentResponse, AgentMode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const GENERATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING },
    suggested_skills: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }
    },
    suggested_sections_v2: { 
      type: Type.ARRAY, 
      items: { 
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          draft_content: { type: Type.STRING }
        },
        required: ["title", "draft_content"]
      }
    },
    theme: { type: Type.STRING },
    niche_summary: { type: Type.STRING },
    canva_cta: { type: Type.BOOLEAN }
  },
  required: ["mode", "suggested_skills", "suggested_sections_v2", "theme", "niche_summary", "canva_cta"]
};

const CHECK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING },
    skill_gaps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          skill: { type: Type.STRING },
          courses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                course_name: { type: Type.STRING },
                platform: { type: Type.STRING },
                clean_url: { type: Type.STRING }
              },
              required: ["course_name", "platform", "clean_url"]
            }
          }
        },
        required: ["skill", "courses"]
      }
    }
  },
  required: ["mode", "skill_gaps"]
};

export async function processCareerTask(
  mode: AgentMode,
  params: { goal?: string; cv?: string; jd?: string }
): Promise<CareerAgentResponse> {
  if (mode === AgentMode.GENERATE) {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Design a CV architecture for: "${params.goal}". Focus on high-impact keywords.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: GENERATE_SCHEMA
      }
    });
    const result = JSON.parse(response.text!) as CareerAgentResponse;
    return { ...result, mode: AgentMode.GENERATE };
  } else {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Identify skill gaps between CV: "${params.cv}" and Job: "${params.jd}". Find 3 real courses for each gap.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: CHECK_SCHEMA
      }
    });

    const result = JSON.parse(response.text!) as CareerAgentResponse;
    
    // Extract grounding sources
    const groundingSources: { title: string; uri: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          groundingSources.push({
            title: chunk.web.title || 'Source',
            uri: chunk.web.uri
          });
        }
      });
    }

    return { ...result, mode: AgentMode.CHECK, grounding_sources: groundingSources };
  }
}

export async function refineSectionContent(section: string, currentContent: string, goal: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Refine this "${section}" for "${goal}". Original: "${currentContent}". Output only refined text.`,
  });
  return response.text?.trim() || currentContent;
}
