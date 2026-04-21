import { useState, useRef, useEffect, FormEvent, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
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
  Trash2,
  Mic,
  MicOff,
  RefreshCw,
  Volume2,
  VolumeX
} from 'lucide-react';
import { CommandResponse, HistoryItem, UserMemory } from './types';

const SYSTEM_PROMPT = (memory: UserMemory) => `You are JARVIS, a highly sophisticated AI assistant for Windows automation, inspired by Tony Stark's personal OS.
Your goal is to help users manage their PC through natural dialogue with a professional, sharp, and helpful tone.

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
5. run_command {"cmd": string} - EXECUTED IN POWERSHELL. Use PS syntax.
6. system_control {"action": "shutdown|restart|sleep"}
7. file_operation {"operation": "create|delete|read", "path": string} (Supports glob)
8. update_memory {"key": string, "value": any}
9. network_filter {"net_action": "list_active|block|unblock", "process_info": string} - Use to find/block/unblock app network access.

Return ONLY the JSON object.`;

import pkg from '../package.json';

import { NetworkControl } from './NetworkControl';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'network'>('chat');
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
  
  // Bridge Token & Connection Status
  const [bridgeToken, setBridgeToken] = useState(() => {
    const saved = localStorage.getItem('WIN_AGENT_BRIDGE_TOKEN');
    if (saved) return saved;
    const newToken = Math.random().toString(36).substring(2).toUpperCase() + Math.random().toString(36).substring(2).toUpperCase();
    localStorage.setItem('WIN_AGENT_BRIDGE_TOKEN', newToken);
    return newToken;
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const pingLocal = async () => {
      try {
        const res = await fetch('http://127.0.0.1:5000/ping');
        if (res.ok) setIsConnected(true);
        else setIsConnected(false);
      } catch (e) {
        setIsConnected(false);
      }
    };
    pingLocal();
    const interval = setInterval(pingLocal, 5000);
    return () => clearInterval(interval);
  }, []);

  // Multi-Provider Keys
  const [provider, setProvider] = useState<'gemini' | 'openai' | 'anthropic'>(localStorage.getItem('WIN_AGENT_PROVIDER') as any || 'gemini');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('WIN_AGENT_KEY') || '');
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('WIN_AGENT_OPENAI_KEY') || '');
  const [anthropicKey, setAnthropicKey] = useState(localStorage.getItem('WIN_AGENT_ANTHROPIC_KEY') || '');

  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('WIN_AGENT_MODEL') || 'gemini-3.1-flash-lite-preview');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(localStorage.getItem('WIN_AGENT_VOICE') === 'true');
  const [isAIVoiceEnabled, setIsAIVoiceEnabled] = useState(localStorage.getItem('WIN_AGENT_AI_VOICE') === 'true');
  const [aiVoiceName, setAiVoiceName] = useState(localStorage.getItem('WIN_AGENT_AI_VOICE_NAME') || 'Kore');
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('WIN_AGENT_VOICE', String(isVoiceEnabled));
  }, [isVoiceEnabled]);

  useEffect(() => {
    localStorage.setItem('WIN_AGENT_AI_VOICE', String(isAIVoiceEnabled));
  }, [isAIVoiceEnabled]);

  useEffect(() => {
    localStorage.setItem('WIN_AGENT_AI_VOICE_NAME', aiVoiceName);
  }, [aiVoiceName]);

  const playRawPCM = (base64Data: string) => {
    try {
      const sampleRate = 24000;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768;
      }

      const buffer = audioContext.createBuffer(1, float32Array.length, sampleRate);
      buffer.getChannelData(0).set(float32Array);
      
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  };

  const speak = async (text: string) => {
    if (!isVoiceEnabled) return;

    // Use AI Voice if enabled and key is present
    if (isAIVoiceEnabled && ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: aiVoiceName },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          playRawPCM(base64Audio);
          return;
        }
      } catch (e) {
        console.error("AI TTS failed, falling back to system voice:", e);
      }
    }

    // Default System Voice Fallback
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    window.speechSynthesis.speak(utterance);
  };

  // --- RESTORED SPEECH REC ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ru-RU';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        setTimeout(() => {
          const submitBtn = document.getElementById('submit-prompt');
          submitBtn?.click();
        }, 500);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Ваш браузер не поддерживает голосовое управление. Пожалуйста, используйте Google Chrome.");
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    } else {
      try {
        setIsListening(true);
        recognitionRef.current.start();
      } catch (e) {
        setIsListening(false);
      }
    }
  };
  // --- END RESTORED ---
  
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
      const key = geminiKey || getEnvironmentApiKey();
      if (!key) return null;
      return new GoogleGenAI({ apiKey: key });
    } catch (e) {
      console.error("Failed to initialize Gemini AI:", e);
      return null;
    }
  }, [geminiKey]);

  const hasApiKey = useMemo(() => {
    if (provider === 'gemini') return !!(geminiKey || getEnvironmentApiKey());
    if (provider === 'openai') return !!openaiKey;
    if (provider === 'anthropic') return !!anthropicKey;
    return false;
  }, [provider, geminiKey, openaiKey, anthropicKey]);

  useEffect(() => {
    localStorage.setItem('WIN_AGENT_HISTORY', JSON.stringify(history));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    localStorage.setItem('WIN_AGENT_MEMORY', JSON.stringify(memory));
  }, [memory]);

  useEffect(() => {
    localStorage.setItem('WIN_AGENT_VOICE', String(isVoiceEnabled));
  }, [isVoiceEnabled]);

  const saveKey = (e: FormEvent) => {
    e.preventDefault();
    localStorage.setItem('WIN_AGENT_PROVIDER', provider);
    localStorage.setItem('WIN_AGENT_KEY', geminiKey);
    localStorage.setItem('WIN_AGENT_OPENAI_KEY', openaiKey);
    localStorage.setItem('WIN_AGENT_ANTHROPIC_KEY', anthropicKey);
    localStorage.setItem('WIN_AGENT_MODEL', selectedModel);
    setIsSettingsOpen(false);
    window.location.reload();
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
      const activeKey = provider === 'gemini' ? (geminiKey || getEnvironmentApiKey()) : (provider === 'openai' ? openaiKey : anthropicKey);
      
      if (!activeKey) {
        throw new Error(`Missing API Key for ${provider}. Please check Settings.`);
      }

      let responseText = "";

      if (provider === 'gemini' && ai) {
        const conversationContext = history.slice(-10).map(item => ({
          role: item.role,
          parts: [{ text: item.content }]
        }));

        const fallbacks = [selectedModel, "gemini-2.5-flash-8b", "gemini-2.5-flash", "gemini-3.1-flash-lite-preview", "gemini-2.5-pro"];
        const uniqueFallbacks = [...new Set(fallbacks)];

        let success = false;
        let lastError = null;

        for (const modelToTry of uniqueFallbacks) {
          try {
            console.log(`[Gemini] Attempting to use model: ${modelToTry}`);
            const result = await ai.models.generateContent({
              model: modelToTry,
              contents: [...conversationContext, { role: 'user', parts: [{ text: userQuery }] }],
              config: { systemInstruction: SYSTEM_PROMPT(memory), responseMimeType: "application/json" },
            });
            responseText = result.text || "";
            success = true;
            break; 
          } catch (err: any) {
            lastError = err;
            if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.status === 429) {
              console.warn(`[Gemini] Model ${modelToTry} quota exceeded, falling back to next model...`);
              continue;
            } else {
              throw err; 
            }
          }
        }
        
        if (!success && lastError) {
          throw lastError;
        }
      } 
      else if (provider === 'openai') {
        const client = new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true });
        const messages: any[] = [
          { role: 'system', content: SYSTEM_PROMPT(memory) + "\nIMPORTANT: Return ONLY valid JSON." },
          ...history.slice(-10).map(i => ({ role: i.role === 'model' ? 'assistant' : 'user', content: i.content })),
          { role: 'user', content: userQuery }
        ];
        const res = await client.chat.completions.create({ model: selectedModel, messages, response_format: { type: "json_object" } });
        responseText = res.choices[0].message.content || "";
      }
      else if (provider === 'anthropic') {
        const client = new Anthropic({ apiKey: anthropicKey, dangerouslyAllowBrowser: true });
        const res = await client.messages.create({
          model: selectedModel,
          system: SYSTEM_PROMPT(memory) + "\nIMPORTANT: Return ONLY valid JSON.",
          max_tokens: 1024,
          messages: [
            ...history.slice(-10).map(i => ({ role: i.role === 'model' ? 'assistant' : 'user', content: i.content })),
            { role: 'user', content: userQuery }
          ] as any
        });
        responseText = (res.content[0] as any).text || "";
      }

      if (!responseText) throw new Error("Empty response from AI service");
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
            const runnerRes = await fetch('http://127.0.0.1:5000/execute', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${bridgeToken}`
              },
              body: JSON.stringify(parsed.command)
            });
            const runnerData = await runnerRes.json();
            
            if (runnerData.status === 'error') {
               parsed.message += `\n\n[SYSTEM ERROR]: ${runnerData.msg}`;
            } else if (runnerData.msg) {
               parsed.message += `\n\n[SYSTEM SUCCESS]: ${runnerData.msg}`;
            }
          } catch (e) {
            console.log("Local runner not responding", e);
            parsed.message += `\n\n[SYSTEM ERROR]: Local runner not responding. Please make sure run_local.bat is running.`;
          }
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
      
      // Voice feedback
      if (parsed.message) {
        speak(parsed.message);
      }
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
                {settingsTab === 'api' && (
                  <>
                    <h3 className="text-xl font-bold text-win-blue mb-2 flex items-center gap-2">
                       Intelligence Configuration
                    </h3>
                    <p className="text-sm text-sleek-dim mb-6">Select your AI provider and configure your API keys.</p>
                    
                    <form onSubmit={saveKey} className="space-y-4 max-h-[450px] overflow-y-auto pr-2 sleek-scroll">
                      <div>
                        <label className="text-[11px] uppercase text-sleek-dim font-bold mb-2 block">AI Provider</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'gemini', label: 'Gemini' },
                            { id: 'openai', label: 'OpenAI' },
                            { id: 'anthropic', label: 'Claude' }
                          ].map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setProvider(p.id as any);
                                // Default model suggestions based on provider
                                if (p.id === 'gemini') setSelectedModel('gemini-3.1-flash-lite-preview');
                                if (p.id === 'openai') setSelectedModel('gpt-4o-mini');
                                if (p.id === 'anthropic') setSelectedModel('claude-3-5-sonnet-latest');
                              }}
                              className={`py-2 text-[10px] uppercase font-bold rounded border transition-all ${provider === p.id ? 'bg-win-blue border-win-blue text-white' : 'border-sleek-border hover:border-sleek-dim text-sleek-dim'}`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {provider === 'gemini' && (
                        <div>
                          <label className="text-[11px] uppercase text-sleek-dim font-bold mb-2 block">Gemini API Key</label>
                          <input 
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AQ.Ab8RN6..."
                            className="w-full bg-sleek-card border border-sleek-border rounded-lg px-4 py-3 text-sm focus:border-win-blue focus:outline-none"
                          />
                        </div>
                      )}

                      {provider === 'openai' && (
                        <div>
                          <label className="text-[11px] uppercase text-sleek-dim font-bold mb-2 block">OpenAI API Key</label>
                          <input 
                            type="password"
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-sleek-card border border-sleek-border rounded-lg px-4 py-3 text-sm focus:border-win-blue focus:outline-none"
                          />
                        </div>
                      )}

                      {provider === 'anthropic' && (
                        <div>
                          <label className="text-[11px] uppercase text-sleek-dim font-bold mb-2 block">Claude API Key</label>
                          <input 
                            type="password"
                            value={anthropicKey}
                            onChange={(e) => setAnthropicKey(e.target.value)}
                            placeholder="sk-ant-..."
                            className="w-full bg-sleek-card border border-sleek-border rounded-lg px-4 py-3 text-sm focus:border-win-blue focus:outline-none"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[11px] uppercase text-sleek-dim font-bold mb-2 block">AI Model Selection</label>
                        <select 
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full bg-sleek-card border border-sleek-border rounded-lg px-4 py-3 text-sm focus:border-win-blue focus:outline-none text-sleek-text appearance-none"
                        >
                          {provider === 'gemini' && (
                            <>
                              <option value="gemini-3.1-flash-lite-preview">3.1 Flash-Lite (Insanely Fast)</option>
                              <option value="gemini-2.5-flash-8b">2.5 Flash-8B (Highest Limit)</option>
                              <option value="gemini-2.5-flash">2.5 Flash (Balanced Default)</option>
                              <option value="gemini-2.5-pro">2.5 Pro (Precision & Logic)</option>
                            </>
                          )}
                          {provider === 'openai' && (
                            <>
                              <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                              <option value="gpt-4o">GPT-4o (Premium)</option>
                              <option value="o1-mini">o1 Mini (Logic)</option>
                            </>
                          )}
                          {provider === 'anthropic' && (
                            <>
                              <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
                              <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku</option>
                              <option value="claude-3-opus-latest">Claude 3 Opus</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div className="pt-4 border-t border-sleek-border/30">
                        <label className="text-[11px] uppercase text-win-blue font-bold mb-4 block">Neural AI Voice (TTS)</label>
                        <div className="flex items-center justify-between mb-4 bg-black/20 p-3 rounded-lg border border-sleek-border/50">
                          <span className="text-sm">Enable Human-like AI Voice</span>
                          <button 
                            type="button"
                            onClick={() => setIsAIVoiceEnabled(!isAIVoiceEnabled)}
                            className={`w-10 h-5 rounded-full transition-all relative ${isAIVoiceEnabled ? 'bg-win-blue shadow-[0_0_8px_rgba(0,120,212,0.4)]' : 'bg-sleek-border'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isAIVoiceEnabled ? 'left-6' : 'left-1'}`} />
                          </button>
                        </div>

                        {isAIVoiceEnabled && (
                          <div className="space-y-3">
                            <label className="text-[10px] uppercase text-sleek-dim font-bold block">Select Personality</label>
                            <select 
                              value={aiVoiceName}
                              onChange={(e) => setAiVoiceName(e.target.value)}
                              className="w-full bg-sleek-card border border-sleek-border rounded-lg px-4 py-3 text-sm focus:border-win-blue focus:outline-none text-sleek-text appearance-none"
                            >
                              <option value="Kore">Kore (Balanced & Warm)</option>
                              <option value="Puck">Puck (Cheerful & High-pitched)</option>
                              <option value="Charon">Charon (Deep & Professional)</option>
                              <option value="Fenrir">Fenrir (Mysterious & Robotic-Human)</option>
                              <option value="Zephyr">Zephyr (Soft & Calm)</option>
                            </select>
                            <p className="text-[10px] text-sleek-dim italic leading-relaxed">
                              *AI Voice uses Gemini TTS API Units. Fallback to System Voice if quota is low.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-sleek-border/30">
                        <label className="text-[11px] uppercase text-win-blue font-bold mb-4 block">Local PC Bridge Token</label>
                        <p className="text-[10px] text-sleek-dim mb-3">Copy the <strong className="text-white">Agent Token</strong> displayed in your Launcher's console window and paste it here, so the Web UI has permission to execute commands on your PC.</p>
                        <div className="flex gap-2">
                          <input 
                            value={bridgeToken}
                            onChange={(e) => {
                               setBridgeToken(e.target.value);
                               localStorage.setItem('WIN_AGENT_BRIDGE_TOKEN', e.target.value);
                            }}
                            className="flex-1 bg-black/40 border border-win-blue/30 rounded-lg px-3 py-2 text-sm font-mono text-win-blue"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(bridgeToken);
                              alert("Token copied!");
                            }}
                            className="p-2 bg-win-blue/20 hover:bg-win-blue/40 text-win-blue rounded-lg transition-all"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-6 border-t border-sleek-border/30">
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
                )}

                {settingsTab === 'memory' && (
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

                    <div className="flex gap-3 pt-4" />
                    <button 
                      onClick={() => setIsSettingsOpen(false)}
                      className="w-full py-3 text-sm font-semibold text-sleek-dim hover:text-white transition-colors"
                    >
                      Close Settings
                    </button>
                  </div>
                )}

                {settingsTab === 'sync' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-win-blue mb-2 flex items-center gap-2">
                       Direct OTA Sync
                    </h3>
                    <p className="text-sm text-sleek-dim">
                      Skip GitHub and sync JARVIS code directly from this browser context to your local PC.
                    </p>

                    <div className="bg-black/30 p-4 rounded-xl border border-sleek-border/50 space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase text-win-blue font-bold">Your Sync URL</label>
                        <div className="flex gap-2">
                          <input 
                            readOnly
                            value={window.location.origin}
                            className="flex-1 bg-sleek-card border border-sleek-border rounded-lg px-3 py-2 text-xs font-mono text-sleek-text"
                          />
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.origin);
                              alert("URL Copied!");
                            }}
                            className="p-2 bg-win-blue/20 hover:bg-win-blue/40 text-win-blue rounded-lg transition-all"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 bg-win-blue/5 border border-win-blue/20 rounded-lg">
                        <p className="text-[11px] text-sleek-dim leading-relaxed">
                          <strong className="text-win-blue">Instruction:</strong><br />
                          1. Copy the URL above.<br />
                          2. Run <code className="text-white">run_local.bat</code> on your PC.<br />
                          3. Select <code className="text-white">y</code> for "Sync with AI Studio Cloud?".<br />
                          4. Paste this URL when prompted.
                        </p>
                      </div>
                    </div>

                    <div className="pt-4">
                       <button 
                        onClick={() => setIsSettingsOpen(false)}
                        className="w-full py-3 text-sm font-semibold text-sleek-dim hover:text-white transition-colors"
                      >
                        Close Settings
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
          <div className="w-4 h-4 bg-win-blue rounded-full shadow-[0_0_12px_rgba(0,120,212,0.6)]" />
          JARVIS v{pkg.version}
        </div>

        <div className="space-y-4">
          <div className="bg-sleek-card border border-sleek-border rounded-xl p-4">
            <span className="text-[11px] uppercase text-sleek-dim tracking-wider mb-2 block font-semibold">Local PC Bridge</span>
            <div className="text-sm flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-sleek-green indicator-glow' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
              {isConnected ? 'Online & Secured' : 'Offline'}
            </div>
            {!isConnected && <p className="text-[10px] text-red-400 mt-2">Run run_local.bat on PC to connect</p>}
          </div>

          <div className="bg-sleek-card border border-sleek-border rounded-xl p-4">
            <span className="text-[11px] uppercase text-sleek-dim tracking-wider mb-2 block font-semibold flex justify-between items-center">
              Voice Mode
              <button 
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className={`w-8 h-4 rounded-full transition-all relative ${isVoiceEnabled ? 'bg-win-blue' : 'bg-sleek-border'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isVoiceEnabled ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            </span>
            <div className="text-sm flex items-center gap-2">
              {isVoiceEnabled ? <Volume2 className="w-4 h-4 text-win-blue" /> : <VolumeX className="w-4 h-4 text-sleek-dim" />}
              {isVoiceEnabled ? 'Audio Feedback ON' : 'Audio Feedback OFF'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <span className="text-[11px] uppercase text-sleek-dim tracking-wider mb-1 block font-semibold flex justify-between items-center">
             Navigation
          </span>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 p-3 border rounded-xl transition-all text-sm font-medium ${activeTab === 'chat' ? 'bg-win-blue/10 border-win-blue text-win-blue shadow-[0_0_10px_rgba(0,120,212,0.15)]' : 'bg-sleek-card border-sleek-border text-sleek-text hover:border-sleek-border/80'}`}
          >
            <Terminal className="w-4 h-4" /> Agent Chat
          </button>
          <button 
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-2 p-3 border rounded-xl transition-all text-sm font-medium ${activeTab === 'network' ? 'bg-win-blue/10 border-win-blue text-win-blue shadow-[0_0_10px_rgba(0,120,212,0.15)]' : 'bg-sleek-card border-sleek-border text-sleek-text hover:border-sleek-border/80'}`}
          >
            <CommandIcon className="w-4 h-4" /> Network Control
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
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
      <main className="flex-1 flex flex-col bg-linear-to-b from-[#121215] to-sleek-bg overflow-hidden">
        {activeTab === 'network' ? (
          <NetworkControl bridgeToken={bridgeToken} />
        ) : (
          <>
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
                    type="button"
                    onClick={toggleListening}
                    className={`p-2 transition-all rounded-full ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-sleek-dim hover:text-win-blue hover:bg-win-blue/10'}`}
                  >
                    {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button 
                    id="submit-prompt"
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="p-2 text-sleek-blue hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}



