import { useState, useRef, useEffect, FormEvent, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Terminal, 
  Send, 
  History as HistoryIcon, 
  Copy, 
  RotateCcw, 
  AlertTriangle,
  Command as CommandIcon,
  Cpu,
  Monitor,
  Brain,
  User,
  Trash2
} from 'lucide-react';
import { CommandResponse, HistoryItem, UserMemory } from './types';

const SYSTEM_PROMPT = (memory: UserMemory) => `You are WinAutomate Agent v2.4, a conversational expert in Windows automation.
Your goal is to help users manage their PC through natural dialogue.

Current User Profile/Memory:
${JSON.stringify(memory, null, 2)}
(Note: Use this to personalize responses. You can update this via the 'update_memory' command).

Response Guidelines:
- ALWAYS return valid JSON.
- Include a "message" field with a friendly, helpful explanation of what you are doing.
- If an action is required, include a "command" object with "action" and "params".
- If the user is just chatting or asking a question, omit the "command" field.
- Maintain context from previous messages.

Available commands:
1. open_app {"name": string}
2. open_url {"url": string}
3. type_text {"text": string}
4. press_keys {"keys": string}
5. run_command {"cmd": string}
6. system_control {"action": "shutdown|restart|sleep"}
7. file_operation {"operation": "create|delete|read", "path": string}
8. update_memory {"key": string, "value": any} - Use this to remember things about the user (e.g. name, preferences).

Return ONLY the JSON object.`;

export default function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('WIN_AGENT_HISTORY');
    return saved ? JSON.parse(saved) : [];
  });
  const [memory, setMemory] = useState<UserMemory>(() => {
    const saved = localStorage.getItem('WIN_AGENT_MEMORY');
    return saved ? JSON.parse(saved) : {};
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'api' | 'memory'>('api');
  const [localApiKey, setLocalApiKey] = useState(localStorage.getItem('WIN_AGENT_KEY') || '');
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('WIN_AGENT_MODEL') || 'gemini-3.1-flash-lite-preview');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Safe detection for API Key in various environments (Vite/Node/Manual)
  const getEnvironmentApiKey = () => {
    try {
      // @ts-ignore - Check for Vite-style env
      if (import.meta.env?.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
      // @ts-ignore - Check for standard Node process env
      if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    } catch (e) {}
    return '';
  };

  const ai = useMemo(() => {
    try {
      const key = localApiKey || getEnvironmentApiKey();
      if (!key) return null;
      return new GoogleGenAI({ apiKey: key });
    } catch (e) {
      console.error("Failed to initialize Gemini AI:", e);
      return null;
    }
  }, [localApiKey]);

  const hasApiKey = useMemo(() => {
    return !!(localApiKey || getEnvironmentApiKey());
  }, [localApiKey]);

  useEffect(() => {
    localStorage.setItem('WIN_AGENT_HISTORY', JSON.stringify(history));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    localStorage.setItem('WIN_AGENT_MEMORY', JSON.stringify(memory));
  }, [memory]);

  const saveKey = (e: FormEvent) => {
    e.preventDefault();
    localStorage.setItem('WIN_AGENT_KEY', localApiKey);
    localStorage.setItem('WIN_AGENT_MODEL', selectedModel);
    setIsSettingsOpen(false);
    window.location.reload(); // Refresh to re-init AI
  };

  const clearAllData = () => {
    if (confirm("Are you sure you want to delete all activity history and learned memory?")) {
      localStorage.removeItem('WIN_AGENT_HISTORY');
      localStorage.removeItem('WIN_AGENT_MEMORY');
      setHistory([]);
      setMemory({});
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    if (!ai) {
      setIsSettingsOpen(true);
      setSettingsTab('api');
      return;
    }

    const userQuery = input.trim();
    const userTimestamp = new Date().toLocaleTimeString();
    
    // Add user message to UI immediately
    const userMsg: HistoryItem = {
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(7),
      role: 'user',
      content: userQuery,
      timestamp: userTimestamp
    };
    
    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build conversation context from the last 10 messages
      const conversationContext = history.slice(-10).map(item => ({
        role: item.role,
        parts: [{ text: item.content }]
      }));

      const result = await ai.models.generateContent({
        model: selectedModel,
        contents: [
          ...conversationContext,
          { role: 'user', parts: [{ text: userQuery }] }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT(memory),
          responseMimeType: "application/json",
        },
      });

      if (!result.text) {
        throw new Error("Empty response from AI service");
      }

      const responseText = result.text.trim();
      const parsed: CommandResponse = JSON.parse(responseText);

      // Execute command if present
      if (parsed.command) {
        if (parsed.command.action === 'update_memory') {
          const { key, value } = parsed.command.params;
          if (key) {
            setMemory(prev => ({ ...prev, [key]: value }));
          }
        } else {
          try {
            fetch('http://localhost:5000/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(parsed.command)
            }).catch(() => {
              console.log("Local runner not responding (this is expected if not running locally)");
            });
          } catch (e) {}
        }
      }

      const modelMsg: HistoryItem = {
        id: crypto.randomUUID?.() || Math.random().toString(36).substring(7),
        role: 'model',
        content: parsed.message || "Request handled successfully.",
        metadata: parsed,
        timestamp: new Date().toLocaleTimeString(),
      };

      setHistory(prev => [...prev, modelMsg]);
    } catch (error: any) {
      console.error('WinAutomate API Error:', error);
      
      let errorMessage = `Error: ${error?.message || "Unknown processing error"}`;
      
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = "Quota Exceeded (429): You've reached the free limit for today. Please wait a bit or try again later.";
      } else if (error?.message?.includes('API_KEY_INVALID')) {
        errorMessage = "Your API Key is invalid or has expired. Please update it in Settings.";
      } else if (error?.message?.includes('fetch')) {
        errorMessage = "Connection error: Failed to reach the AI server. Please check your internet.";
      }

      const errorMsg: HistoryItem = {
        id: crypto.randomUUID?.() || Math.random().toString(36).substring(7),
        role: 'model',
        content: errorMessage,
        timestamp: new Date().toLocaleTimeString(),
      };
      setHistory(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-sleek-bg font-sans overflow-hidden">
      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-sleek-surface border border-sleek-border w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl text-sleek-text"
            >
              <div className="flex border-b border-sleek-border bg-sleek-card/50">
                <button 
                  onClick={() => setSettingsTab('api')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${settingsTab === 'api' ? 'text-win-blue border-b-2 border-win-blue bg-win-blue/5' : 'text-sleek-dim hover:text-white'}`}
                >
                  <Monitor className="w-4 h-4" /> System API
                </button>
                <button 
                  onClick={() => setSettingsTab('memory')}
                  className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${settingsTab === 'memory' ? 'text-win-blue border-b-2 border-win-blue bg-win-blue/5' : 'text-sleek-dim hover:text-white'}`}
                >
                  <Brain className="w-4 h-4" /> Agent Memory
                </button>
              </div>

              <div className="p-8">
                {settingsTab === 'api' ? (
                  <>
                    <h3 className="text-xl font-bold text-win-blue mb-2 flex items-center gap-2">
                       Local Configuration
                    </h3>
                    <p className="text-sm text-sleek-dim mb-6">Enter your Gemini API Key below to use the agent locally.</p>
                    
                    <form onSubmit={saveKey} className="space-y-4">
                      <div>
                        <label className="text-[11px] uppercase text-sleek-dim font-bold mb-2 block">Gemini API Key</label>
                        <input 
                          type="password"
                          value={localApiKey}
                          onChange={(e) => setLocalApiKey(e.target.value)}
                          placeholder="AQ.Ab8RN6..."
                          className="w-full bg-sleek-card border border-sleek-border rounded-lg px-4 py-3 text-sm focus:border-win-blue focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] uppercase text-sleek-dim font-bold mb-2 block">AI Model Selection</label>
                        <select 
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full bg-sleek-card border border-sleek-border rounded-lg px-4 py-3 text-sm focus:border-win-blue focus:outline-none text-sleek-text appearance-none"
                        >
                          <option value="gemini-3.1-flash-lite-preview">Gemini 1.5 Flash-Lite (Highest Quota)</option>
                          <option value="gemini-3-flash-preview">Gemini 1.5 Flash (Balanced)</option>
                          <option value="gemini-3-pro-preview">Gemini 1.5 Pro (Most Capable)</option>
                        </select>
                        <p className="text-[10px] text-sleek-dim mt-2 italic">
                          Tip: Use Flash-Lite to avoid "Quota Exceeded" errors on free accounts.
                        </p>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button 
                          type="button"
                          onClick={() => setIsSettingsOpen(false)}
                          className="flex-1 py-3 text-sm font-semibold text-sleek-dim hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit"
                          className="flex-1 py-3 bg-win-blue text-white rounded-lg text-sm font-semibold hover:bg-win-blue/80 transition-all"
                        >
                          Save Config
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xl font-bold text-win-blue mb-2 flex items-center gap-2">
                       Personalization
                    </h3>
                    <p className="text-sm text-sleek-dim mb-4">This is what the agent has learned about you across sessions.</p>
                    
                    <div className="bg-sleek-card border border-sleek-border rounded-xl p-4 max-h-[250px] overflow-y-auto sleek-scroll">
                      {Object.keys(memory).length === 0 ? (
                        <div className="text-sm text-sleek-dim italic text-center py-6">The agent hasn't learned anything yet. Try talking to it!</div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          {Object.entries(memory).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center bg-black/20 p-2 rounded border border-sleek-border/50">
                              <span className="text-[11px] font-mono text-win-blue uppercase">{key}</span>
                              <span className="text-[12px] text-sleek-text truncate max-w-[150px]">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => setIsSettingsOpen(false)}
                        className="flex-1 py-3 text-sm font-semibold text-sleek-dim hover:text-white transition-colors"
                      >
                        Close
                      </button>
                      <button 
                        onClick={clearAllData}
                        className="flex-1 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm font-semibold hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" /> Reset All Data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sidebar */}
      <aside className="w-[280px] bg-sleek-surface border-r border-sleek-border p-6 flex flex-col gap-6">
        <div className="flex items-center gap-2 text-lg font-bold text-sleek-blue tracking-tight">
          <div className="w-4 h-4 bg-sleek-blue rounded-[2px]" />
          WinAutomate v2.4
        </div>

        <div className="space-y-4">
          <div className="bg-sleek-card border border-sleek-border rounded-xl p-4">
            <span className="text-[11px] uppercase text-sleek-dim tracking-wider mb-2 block font-semibold">System Link</span>
            <div className="text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sleek-green indicator-glow" />
              Connected
            </div>
          </div>

          <div className="bg-sleek-card border border-sleek-border rounded-xl p-4">
            <span className="text-[11px] uppercase text-sleek-dim tracking-wider mb-2 block font-semibold">AI Assistant</span>
            <div className="text-sm flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-win-blue shadow-[0_0_8px_rgba(0,120,212,0.5)]' : 'bg-red-500 animate-pulse'}`} />
              {hasApiKey ? 'Ready (API Active)' : 'Action Required'}
            </div>
            {!hasApiKey && <p className="text-[10px] text-red-400 mt-2 italic">No API Key detected</p>}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
           <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 p-3 bg-sleek-card hover:bg-sleek-blue/10 border border-sleek-border hover:border-win-blue rounded-xl transition-all text-[12px] text-sleek-dim hover:text-win-blue"
          >
            <Monitor className="w-4 h-4" /> Settings & API Key
          </button>
          <div className="p-3 bg-win-blue/5 border border-win-blue/20 rounded-xl">
            <span className="text-[10px] text-win-blue font-bold uppercase block mb-1">Local Mode</span>
            <p className="text-[11px] text-sleek-dim leading-relaxed">Download project to run natively on Windows.</p>
          </div>
        </div>

        <div className="mt-auto bg-sleek-card border border-sleek-border rounded-xl p-4 flex flex-col gap-2">
          <span className="text-[11px] uppercase text-sleek-dim tracking-wider mb-2 block font-semibold flex justify-between">
            Activity History
            <button onClick={() => setHistory([])} className="hover:text-red-400 transition-colors">
              <RotateCcw className="w-3 h-3" />
            </button>
          </span>
          <div className="flex flex-col gap-1 overflow-y-auto sleek-scroll max-h-[200px]">
            {history.length === 0 ? (
              <div className="text-[12px] text-sleek-dim italic">• No recent activity</div>
            ) : (
              history.filter(i => i.role === 'user').map(item => (
                <div key={item.id} className="text-[12px] text-sleek-dim truncate">• {item.content}</div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-linear-to-b from-[#121215] to-sleek-bg">
        <header className="px-10 py-6 border-b border-sleek-border flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold text-sleek-text">Automation Bridge</h2>
            <p className="text-[12px] text-sleek-dim">Live conversation with system agent</p>
          </div>
          <div className="text-[11px] opacity-50 font-mono tracking-tighter">AGENT_READY</div>
        </header>

        <section 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-10 py-10 flex flex-col gap-6 sleek-scroll"
        >
          <AnimatePresence initial={false}>
            {history.length === 0 && !loading && (
              <div className="h-full flex items-center justify-center text-sleek-dim text-sm italic opacity-50">
                Awaiting first command directive...
              </div>
            )}
            {history.map((item) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${item.role === 'user' ? 'items-end' : 'items-start'} gap-2`}
              >
                {item.role === 'user' ? (
                  <div className="bg-win-blue text-white px-5 py-3 rounded-2xl rounded-tr-none text-sm max-w-[80%] shadow-lg">
                    {item.content}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 max-w-[85%]">
                    <div className="bg-sleek-card border border-sleek-border text-sleek-text px-5 py-4 rounded-2xl rounded-tl-none text-sm leading-relaxed shadow-sm">
                      {item.content}
                    </div>
                    {item.metadata?.command && (
                      <div className="bg-black/40 border border-sleek-border rounded-lg p-3 font-mono text-[11px] text-[#9cdcfe] group relative">
                        <div className="text-[10px] text-win-blue font-bold mb-2 flex justify-between items-center">
                          <span>EXECUTING COMMAND</span>
                          <button 
                            onClick={() => navigator.clipboard.writeText(JSON.stringify(item.metadata?.command, null, 2))}
                            className="text-text-dim hover:text-white transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(item.metadata.command, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
            {loading && (
              <motion.div 
                initial={{ opacity: 1 }}
                className="flex items-center gap-2 text-win-blue animate-pulse"
              >
                <div className="w-1.5 h-1.5 bg-win-blue rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="w-1.5 h-1.5 bg-win-blue rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 h-1.5 bg-win-blue rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                <span className="text-xs font-bold uppercase tracking-widest ml-2">Agent is thinking</span>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <div className="px-10 py-8 bg-sleek-surface border-t border-sleek-border">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Talk to your Windows Agent..."
              className="w-full bg-sleek-card border border-sleek-blue px-6 py-4 rounded-[30px] text-sleek-text focus:outline-none focus:ring-1 focus:ring-sleek-blue/50 placeholder:text-sleek-dim pr-28"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
              <button 
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2 text-sleek-blue hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}



