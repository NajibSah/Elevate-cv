
import React, { useState, useEffect, useRef } from 'react';
import { AgentMode, AppState, CareerAgentResponse, SkillGap, Course } from './types';
import { processCareerTask, refineSectionContent } from './services/geminiService';
import { 
  Search, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Layout, 
  ArrowRight,
  Loader2,
  Sparkles,
  Mail,
  Phone,
  Globe,
  Award,
  Plus,
  X,
  Edit2,
  Eye,
  Upload,
  ChevronDown,
  Wand2,
  Download,
  Printer,
  FileText,
  MapPin,
  Linkedin
} from 'lucide-react';

const THEMES = {
  tech: {
    bg: 'bg-[#0a0f1a]',
    accent: 'text-cyan-400',
    accentBg: 'bg-cyan-400',
    border: 'border-slate-800',
    badge: 'bg-cyan-950/50 text-cyan-400 border-cyan-800',
    heading: 'text-white',
    text: 'text-slate-300',
    font: 'font-mono'
  },
  corporate: {
    bg: 'bg-white',
    accent: 'text-blue-700',
    accentBg: 'bg-blue-700',
    border: 'border-slate-100',
    badge: 'bg-blue-50 text-blue-700 border-blue-100',
    heading: 'text-slate-900',
    text: 'text-slate-600',
    font: 'font-sans'
  },
  creative: {
    bg: 'bg-[#fafafa]',
    accent: 'text-rose-500',
    accentBg: 'bg-rose-500',
    border: 'border-rose-100',
    badge: 'bg-rose-50 text-rose-600 border-rose-100',
    heading: 'text-slate-900',
    text: 'text-slate-700',
    font: 'font-serif'
  },
  medical: {
    bg: 'bg-[#f0f9ff]',
    accent: 'text-emerald-700',
    accentBg: 'bg-emerald-700',
    border: 'border-emerald-100',
    badge: 'bg-white text-emerald-800 border-emerald-200',
    heading: 'text-slate-800',
    text: 'text-slate-600',
    font: 'font-sans'
  },
  finance: {
    bg: 'bg-slate-950',
    accent: 'text-amber-500',
    accentBg: 'bg-amber-500',
    border: 'border-slate-800',
    badge: 'bg-amber-950/40 text-amber-500 border-amber-900',
    heading: 'text-white',
    text: 'text-slate-400',
    font: 'font-serif'
  }
};

const AutoResizeTextarea: React.FC<{ 
  value: string; 
  onChange: (val: string) => void; 
  className?: string;
  placeholder?: string;
}> = ({ value, onChange, className, placeholder }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full overflow-hidden resize-none bg-transparent focus:outline-none focus:ring-0 ${className}`}
      rows={1}
    />
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AgentMode>(AgentMode.GENERATE);
  const [goal, setGoal] = useState('');
  const [cvText, setCvText] = useState('');
  const [jdText, setJdText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [state, setState] = useState<AppState>({ loading: false, error: null, result: null });
  
  const [cvEditor, setCvEditor] = useState<{
    sections: Record<string, string>;
    skills: string[];
    suggesting: Record<string, boolean>;
    userName: string;
    userLocation: string;
  }>({ 
    sections: {}, 
    skills: [], 
    suggesting: {},
    userName: "YOUR FULL NAME",
    userLocation: "City, Country"
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      setIsExtracting(true);
      try {
        const { getDocument, GlobalWorkerOptions } = await import('https://esm.sh/pdfjs-dist@4.0.379');
        GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          fullText += strings.join(" ") + "\n";
        }
        
        setCvText(fullText.trim());
      } catch (err) {
        console.error("PDF extraction failed:", err);
        alert("Failed to extract text from PDF. Please paste the text manually.");
      } finally {
        setIsExtracting(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setCvText(e.target?.result as string);
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ loading: true, error: null, result: null });
    try {
      const data = await processCareerTask(activeTab, { goal, cv: cvText, jd: jdText });
      
      if (data.mode === AgentMode.GENERATE) {
        const initialSecs: Record<string, string> = {};
        if (data.suggested_sections_v2 && data.suggested_sections_v2.length > 0) {
          data.suggested_sections_v2.forEach(s => initialSecs[s.title] = s.draft_content);
          setCvEditor(prev => ({
            ...prev,
            sections: initialSecs,
            skills: data.suggested_skills || [],
            suggesting: {}
          }));
          setState({ loading: false, error: null, result: data });
        } else {
          throw new Error("AI failed to generate CV sections. Please try with a more specific goal.");
        }
      } else {
        setState({ loading: false, error: null, result: data });
      }
    } catch (err: any) {
      console.error(err);
      setState({ loading: false, error: err.message || "AI analysis failed. Please try again.", result: null });
    }
  };

  const handleRefine = async (section: string) => {
    if (!goal) return;
    setCvEditor(prev => ({ ...prev, suggesting: { ...prev.suggesting, [section]: true } }));
    try {
      const refined = await refineSectionContent(section, cvEditor.sections[section], goal);
      setCvEditor(prev => ({ 
        ...prev, 
        sections: { ...prev.sections, [section]: refined },
        suggesting: { ...prev.suggesting, [section]: false }
      }));
    } catch (e) {
      setCvEditor(prev => ({ ...prev, suggesting: { ...prev.suggesting, [section]: false } }));
    }
  };

  const [expandedGaps, setExpandedGaps] = useState<Record<number, boolean>>({});
  const currentTheme = THEMES[state.result?.theme || 'tech'];

  return (
    <div className={`min-h-screen bg-[#f8fafc] pb-24 px-4 pt-12 md:px-8 print:p-0 print:bg-white`}>
      <div className="max-w-6xl mx-auto print:max-w-none">
        
        <div className="print:hidden">
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 shadow-sm border border-slate-100">
              <Sparkles size={14} className="text-indigo-500 animate-pulse" />
              Elite Career Strategist
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter mb-4">
              Elevate<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">CV</span>
            </h1>
          </header>

          <div className="flex justify-center mb-10">
            <div className="bg-white p-1.5 rounded-2xl shadow-xl border border-slate-100 flex gap-1">
              <button
                onClick={() => { setActiveTab(AgentMode.GENERATE); setState({ ...state, result: null }); }}
                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${activeTab === AgentMode.GENERATE ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Layout size={18} /> Builder
              </button>
              <button
                onClick={() => { setActiveTab(AgentMode.CHECK); setState({ ...state, result: null }); }}
                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${activeTab === AgentMode.CHECK ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Search size={18} /> Gap Check
              </button>
            </div>
          </div>

          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-slate-50 mb-12">
            <form onSubmit={handleSubmit} className="space-y-8">
              {activeTab === AgentMode.GENERATE ? (
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Career Goal / Target Position</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Designer at Airbnb"
                    className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none text-xl font-bold text-black focus:border-indigo-400 focus:bg-white transition-all shadow-inner"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your Current CV</label>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-indigo-600 flex items-center gap-1 hover:underline" disabled={isExtracting}>
                        {isExtracting ? <Loader2 className="animate-spin" size={12}/> : <Upload size={12}/>} Upload PDF
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.txt" />
                    </div>
                    <textarea value={cvText} onChange={(e) => setCvText(e.target.value)} placeholder="Paste CV content or upload PDF..." className="w-full h-48 px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none text-black font-medium focus:border-indigo-400 focus:bg-white shadow-inner resize-none" required />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Description</label>
                    <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder="Paste the target job requirements..." className="w-full h-48 px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none text-black font-medium focus:border-indigo-400 focus:bg-white shadow-inner resize-none" required />
                  </div>
                </div>
              )}
              <button type="submit" disabled={state.loading || isExtracting} className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-xl flex items-center justify-center gap-3 shadow-2xl hover:bg-slate-800 transition-all disabled:opacity-50 group">
                {state.loading ? <Loader2 className="animate-spin" size={24} /> : (activeTab === AgentMode.GENERATE ? 'Generate CV Architecture' : 'Begin Analysis')}
                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
            {state.error && <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl font-bold flex items-center gap-2 animate-pulse"><AlertCircle size={18}/> {state.error}</div>}
          </div>
        </div>

        {state.result && (
          <div className="space-y-12">
            {state.result.mode === AgentMode.GENERATE && (
              <div className="animate-in fade-in zoom-in-95 duration-700">
                <div className="print:hidden flex flex-col lg:flex-row justify-between items-center mb-8 gap-6 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <div>
                    <h3 className="font-black text-2xl text-slate-900">Blueprint Ready</h3>
                    <p className="text-slate-400 text-sm font-medium">Click any text to edit. Use "Refine" to polish with AI.</p>
                  </div>
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                      {Object.keys(THEMES).map(t => (
                        <button key={t} onClick={() => setState({...state, result: {...state.result!, theme: t as any}})} className={`w-10 h-10 rounded-lg border-2 transition-all ${state.result?.theme === t ? 'border-slate-900 scale-105' : 'border-transparent opacity-60'} ${THEMES[t as keyof typeof THEMES].bg}`} />
                      ))}
                    </div>
                    <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg hover:bg-slate-800 transition-all">
                      <Download size={18} /> Print as PDF
                    </button>
                  </div>
                </div>

                <div className={`relative p-12 md:p-20 shadow-2xl transition-all duration-700 print:shadow-none print:p-0 print:m-0 ${currentTheme.bg} ${currentTheme.font} rounded-[3rem] print:rounded-none overflow-hidden`}>
                  <div className={`absolute top-0 left-0 w-full h-4 ${currentTheme.accentBg} opacity-20`}></div>
                  <div className="flex flex-col md:flex-row justify-between items-start border-b-2 pb-12 mb-12 border-current opacity-10">
                    <div className="space-y-4 flex-1">
                      <input value={cvEditor.userName} onChange={(e) => setCvEditor({...cvEditor, userName: e.target.value.toUpperCase()})} className={`text-6xl font-black tracking-tighter leading-none bg-transparent outline-none border-none p-0 w-full ${currentTheme.heading}`} />
                      <p className={`text-2xl font-bold tracking-[0.2em] uppercase opacity-80 ${currentTheme.accent}`}>{state.result.niche_summary}</p>
                    </div>
                    <div className={`flex flex-col gap-3 mt-8 md:mt-0 text-[11px] font-black uppercase tracking-[0.2em] opacity-70 ${currentTheme.text}`}>
                      <div className="flex items-center gap-3"><Mail size={16} className={currentTheme.accent} /> <input defaultValue="CONTACT@DOMAIN.COM" className="bg-transparent border-none outline-none p-0 w-48" /></div>
                      <div className="flex items-center gap-3"><Phone size={16} className={currentTheme.accent} /> <input defaultValue="+1 (555) 000-0000" className="bg-transparent border-none outline-none p-0 w-48" /></div>
                      <div className="flex items-center gap-3"><MapPin size={16} className={currentTheme.accent} /> <input value={cvEditor.userLocation} onChange={(e) => setCvEditor({...cvEditor, userLocation: e.target.value})} className="bg-transparent border-none outline-none p-0 w-48" /></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                    <div className="lg:col-span-8 space-y-16">
                      {Object.keys(cvEditor.sections).map((sec, i) => (
                        <div key={i} className="group relative">
                          <div className="flex items-center gap-4 mb-6">
                            <h4 className={`text-sm font-black uppercase tracking-[0.5em] border-l-4 pl-4 ${currentTheme.accent} ${currentTheme.border}`}>
                              {sec}
                            </h4>
                            <div className="flex-1 h-px bg-current opacity-10"></div>
                            <button onClick={() => handleRefine(sec)} disabled={cvEditor.suggesting[sec]} className="print:hidden opacity-0 group-hover:opacity-100 transition-all bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105">
                              {cvEditor.suggesting[sec] ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Refine
                            </button>
                          </div>
                          <AutoResizeTextarea value={cvEditor.sections[sec]} onChange={(val) => setCvEditor(p => ({...p, sections: {...p.sections, [sec]: val}}))} className={`text-lg leading-relaxed font-medium ${currentTheme.text}`} />
                        </div>
                      ))}
                    </div>
                    <div className="lg:col-span-4 space-y-12">
                      <div className="space-y-8">
                        <h4 className={`text-sm font-black uppercase tracking-[0.5em] border-l-4 pl-4 ${currentTheme.accent} ${currentTheme.border}`}>Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {cvEditor.skills.map((s, idx) => (
                            <span key={idx} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 ${currentTheme.badge}`}>{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {state.result.mode === AgentMode.CHECK && (
              <div className="animate-in fade-in slide-in-from-bottom-10 duration-700 space-y-8">
                <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-50">
                  <div className="flex items-center gap-6 mb-12">
                    <div className="p-6 bg-orange-100 text-orange-600 rounded-3xl"><AlertCircle size={40} /></div>
                    <div>
                      <h3 className="font-black text-4xl text-slate-900">Gap Remediation Plan</h3>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Strategic Learning Roadmap</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-8">
                    {state.result.skill_gaps?.map((gap, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 hover:shadow-xl transition-all">
                        <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
                          <h4 className="text-3xl font-black text-slate-900 flex items-center gap-4">
                            <span className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-xl font-black">{idx+1}</span>
                            {gap.skill}
                          </h4>
                          <button onClick={() => setExpandedGaps(p => ({...p, [idx]: !p[idx]}))} className="bg-white px-6 py-3 rounded-2xl border-2 border-slate-200 font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white">
                            {expandedGaps[idx] ? 'Close' : 'Courses'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {gap.courses.slice(0, expandedGaps[idx] ? undefined : 1).map((c, ci) => (
                            <div key={ci} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between hover:border-indigo-400 transition-all">
                              <div>
                                <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg uppercase mb-4 inline-block">{c.platform}</span>
                                <h5 className="font-black text-xl text-slate-800 leading-tight mb-2">{c.course_name}</h5>
                              </div>
                              <a href={c.clean_url} target="_blank" className="mt-8 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm text-center flex items-center justify-center gap-2 hover:bg-indigo-600 shadow-lg group"> 
                                Enroll <ExternalLink size={16} />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          .print\\:p-0 { padding: 0 !important; }
          @page { size: A4; margin: 1cm; }
          textarea { height: auto !important; overflow: visible !important; }
        }
      `}</style>
    </div>
  );
};

export default App;
