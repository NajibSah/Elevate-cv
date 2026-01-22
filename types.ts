
export enum AgentMode {
  GENERATE = 'generate',
  CHECK = 'check'
}

export interface Course {
  course_name: string;
  platform: string;
  clean_url: string;
}

export interface SkillGap {
  skill: string;
  courses: Course[];
}

export interface SectionContent {
  title: string;
  draft_content: string;
}

export interface CareerAgentResponse {
  mode: AgentMode;
  suggested_skills?: string[];
  suggested_sections_v2?: SectionContent[];
  skill_gaps?: SkillGap[];
  canva_cta?: boolean;
  theme?: 'tech' | 'corporate' | 'creative' | 'medical' | 'finance';
  niche_summary?: string;
  grounding_sources?: { title: string; uri: string }[];
}

export interface AppState {
  loading: boolean;
  error: string | null;
  result: CareerAgentResponse | null;
}
