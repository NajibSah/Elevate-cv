
import { GoogleGenAI, Type } from "@google/genai";
import { CareerAgentResponse, AgentMode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const GENERATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING, description: "Must be 'generate'" },
    suggested_skills: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "A list of 8-10 high-impact professional skills relevant to the goal."
    },
    suggested_sections_v2: { 
      type: Type.ARRAY, 
      items: { 
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "The section heading, e.g., 'Professional Summary', 'Core Experience', 'Key Projects'." },
          draft_content: { type: Type.STRING, description: "3-4 recruiter-ready bullet points using the Action+Task+Result formula." }
        },
        required: ["title", "draft_content"]
      },
      description: "Exactly 5-6 essential CV sections populated with attractive content."
    },
    theme: { 
      type: Type.STRING, 
      description: "One of: 'tech', 'corporate', 'creative', 'medical', 'finance'." 
    },
    niche_summary: { 
      type: Type.STRING, 
      description: "A punchy one-liner role title for the CV header." 
    },
    canva_cta: { type: Type.BOOLEAN }
  },
  required: ["mode", "suggested_skills", "suggested_sections_v2", "theme", "niche_summary", "canva_cta"]
};

const CHECK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING, description: "Must be 'check'" },
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
      contents: `You are an elite Executive Career Coach. Create a high-impact, modern CV architecture for the career goal: "${params.goal}".
      
      Requirements:
      1. Use the most relevant theme: 'tech', 'corporate', 'creative', 'medical', or 'finance'.
      2. Provide 10 specific skills that recruiters look for in this role.
      3. Draft 5 distinct sections. Each section must have a title and 3-4 professional, achievement-oriented bullet points.
      4. Use the "Action Verb + Task + Result" formula for every bullet point.
      5. The 'niche_summary' should be a professional job title like 'Senior Cloud Solutions Architect'.
      
      Output strictly valid JSON matching the schema.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: GENERATE_SCHEMA
      }
    });
    
    try {
      const result = JSON.parse(response.text!) as CareerAgentResponse;
      return { ...result, mode: AgentMode.GENERATE };
    } catch (e) {
      console.error("JSON Parsing failed for generate mode:", response.text);
      throw new Error("Failed to parse AI response. Please try again.");
    }
  } else {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Compare the candidate's CV: "${params.cv}" with the Job Description: "${params.jd}".
      
      Identify exactly 3-5 major skill gaps. For each gap, use Google Search to find 3 REAL, reputable courses from platforms like Coursera, Udemy, or LinkedIn Learning.
      
      Return the results as a JSON object matching the provided schema.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: CHECK_SCHEMA
      }
    });

    try {
      const result = JSON.parse(response.text!) as CareerAgentResponse;
      return { ...result, mode: AgentMode.CHECK, canva_cta: true };
    } catch (e) {
      console.error("JSON Parsing failed for check mode:", response.text);
      throw new Error("Failed to parse AI analysis results.");
    }
  }
}

export async function refineSectionContent(section: string, currentContent: string, goal: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are a professional resume writer. Refine the following CV section to be more attractive to recruiters for the goal: "${goal}".
    
    SECTION TITLE: ${section}
    CURRENT CONTENT:
    "${currentContent}"
    
    Refinement Goals:
    - Use stronger action verbs.
    - Focus on quantifiable achievements.
    - Match the industry tone.
    - Keep it concise but powerful.
    
    Return ONLY the refined text.`,
  });
  return response.text?.trim() || "Refinement unavailable. Please try again.";
}
