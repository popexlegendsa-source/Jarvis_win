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
  VolumeX,
  Cloud
} from 'lucide-react';
import { CommandResponse, HistoryItem, UserMemory } from './types';
import { LLMManager } from './ai/LLMManager';
import { ActionExecutor } from './executor/ActionExecutor';
import { CommandParser } from './command/CommandParser';
import { VersionManager } from './system/VersionManager';

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
10. change_branding {"botName": string, "agentTitle": string}
11. update_memory {"key": string, "value": any}
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
  const [settingsTab, setSettingsTab] = useState<'api' | 'memory' | 'sync'>('api');
  
  // Bridge Token & Connection Status
  const [bridgeToken, setBridgeToken] = useState(() => {
    const saved = localStorage.getItem('WIN_AGENT_BRIDGE_TOKEN');
    if (saved) return saved;
    const newToken = Math.random().toString(36).substring(2).toUpperCase() + Math.random().toString(36).substring(2).toUpperCase();
    localStorage.setItem('WIN_AGENT_BRIDGE_TOKEN', newToken);
    return newToken;
  });
  const [botName, setBotName] = useState(localStorage.getItem('WIN_AGENT_NAME') || 'JARVIS');
  const [agentTitle, setAgentTitle] = useState(localStorage.getItem('WIN_AGENT_TITLE') || 'Your Assistant');

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
  const [updateAvailable, setUpdateAvailable] = useState<{available: boolean, version: string, downloadUrl?: string} | null>(null);

  useEffect(() => {
    VersionManager.check().then(result => {
      if (result.available) setUpdateAvailable(result);
    });
  }, []);

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
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // --- RESTORED SPEECH REC ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

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
      alert("SYSTEM ERR: SPEECH RECOGNITION NOT SUPPORTED IN CURRENT BROWSER CONTEXT.");
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

  const llmManager = useMemo(() => new LLMManager(
    geminiKey || getEnvironmentApiKey(),
    openaiKey,
    anthropicKey
  ), [geminiKey, openaiKey, anthropicKey]);

  const ai = useMemo(() => {
    const apiKey = geminiKey || getEnvironmentApiKey();
    if (provider === 'gemini' && apiKey) {
      return new GoogleGenAI({ apiKey });
    }
    return null;
  }, [geminiKey, provider]);

  const actionExecutor = useMemo(() => new ActionExecutor(bridgeToken), [bridgeToken]);

  const hasApiKey = useMemo(() => {
    if (provider === 'gemini') return !!(geminiKey || getEnvironmentApiKey());
    if (provider === 'openai') return !!openaiKey;
    if (provider === 'anthropic') return !!anthropicKey;
    return false;
  }, [provider, geminiKey, openaiKey, anthropicKey]);

  useEffect(() => {
    if (activeTab === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('WIN_AGENT_HISTORY', JSON.stringify(history));
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
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

    if (!hasApiKey) {
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

      const responseText = await llmManager.generateContent(
        provider, 
        selectedModel, 
        history, 
        userQuery, 
        memory, 
        SYSTEM_PROMPT(memory)
      );

      if (!responseText) throw new Error("Empty response from AI service");
      const parsed = CommandParser.parse(responseText);

      // Execute command if present
      if (parsed.command) {
        if (parsed.command.action === 'change_branding') {
          const { botName, agentTitle } = parsed.command.params;
          localStorage.setItem('WIN_AGENT_NAME', botName);
          localStorage.setItem('WIN_AGENT_TITLE', agentTitle);
          setBotName(botName);
          setAgentTitle(agentTitle);
          parsed.message += "\nBranding updated successfully.";
        } else {
            const executionResult = await actionExecutor.execute(parsed.command);
            parsed.message += executionResult;
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
    <div className="flex h-screen w-full bg-hud-bg font-sans overflow-hidden">
      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-hud-panel border-2 border-hud-cyan/50 w-full max-w-lg rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,240,255,0.2)] text-hud-text relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-hud-cyan to-transparent opacity-50" />
              
              <div className="flex border-b border-hud-border bg-black/50">
                <button 
                  onClick={() => setSettingsTab('api')}
                  className={`flex-1 py-4 text-[11px] uppercase tracking-widest font-mono font-bold flex items-center justify-center gap-2 transition-all ${settingsTab === 'api' ? 'text-hud-cyan border-b-2 border-hud-cyan bg-hud-cyan/10 shadow-[inset_0_-10px_20px_-10px_rgba(0,240,255,0.3)]' : 'text-hud-dim hover:text-hud-text'}`}
                >
                  <Monitor className="w-4 h-4" /> System Core
                </button>
                <button 
                  onClick={() => setSettingsTab('memory')}
                  className={`flex-1 py-4 text-[11px] uppercase tracking-widest font-mono font-bold flex items-center justify-center gap-2 transition-all ${settingsTab === 'memory' ? 'text-hud-cyan border-b-2 border-hud-cyan bg-hud-cyan/10 shadow-[inset_0_-10px_20px_-10px_rgba(0,240,255,0.3)]' : 'text-hud-dim hover:text-hud-text'}`}
                >
                  <Brain className="w-4 h-4" /> Memory
                </button>
                <button 
                  onClick={() => setSettingsTab('sync')}
                  className={`flex-1 py-4 text-[11px] uppercase tracking-widest font-mono font-bold flex items-center justify-center gap-2 transition-all ${settingsTab === 'sync' ? 'text-hud-cyan border-b-2 border-hud-cyan bg-hud-cyan/10 shadow-[inset_0_-10px_20px_-10px_rgba(0,240,255,0.3)]' : 'text-hud-dim hover:text-hud-text'}`}
                >
                  <Cloud className="w-4 h-4" /> OTA Sync
                </button>
              </div>

              <div className="p-8">
                {settingsTab === 'api' && (
                  <>
                    <h3 className="text-xl font-bold text-hud-cyan mb-2 flex items-center gap-2 uppercase tracking-wide text-shadow-cyan">
                       Intelligence Configuration
                    </h3>
                    <p className="text-xs font-mono text-hud-dim mb-6">DEFINE UPLINK PARAMETERS AND CORE NEURAL PROCESSOR.</p>
                    
                    <form onSubmit={saveKey} className="space-y-4 max-h-[450px] overflow-y-auto pr-2 hud-scroll">
                      <div>
                        <label className="text-[10px] uppercase text-hud-dim font-bold mb-2 block tracking-widest font-mono">Neural Provider</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'gemini', label: 'Gemini' },
                            { id: 'openai', label: 'OpenAI' },
                            { id: 'anthropic', label: 'Claude' },
                            { id: 'ollama', label: 'Ollama' }
                          ].map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setProvider(p.id as any);
                                if (p.id === 'gemini') setSelectedModel('gemini-3.1-flash-lite-preview');
                                if (p.id === 'openai') setSelectedModel('gpt-4o-mini');
                                if (p.id === 'anthropic') setSelectedModel('claude-3-5-sonnet-latest');
                              }}
                              className={`py-2 text-[10px] uppercase font-bold rounded border transition-all font-mono tracking-widest ${provider === p.id ? 'bg-hud-cyan/20 border-hud-cyan text-hud-cyan shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'border-hud-border hover:border-hud-cyan/50 text-hud-dim bg-hud-card'}`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {provider === 'gemini' && (
                        <div>
                          <label className="text-[10px] uppercase text-hud-dim font-bold mb-2 block tracking-widest font-mono">Gemini API Key</label>
                          <input 
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AQ.Ab8RN6..."
                            className="w-full bg-black/40 border border-hud-border rounded-lg px-4 py-3 text-sm focus:border-hud-cyan focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] focus:outline-none font-mono text-hud-cyan transition-all"
                          />
                        </div>
                      )}

                      {provider === 'openai' && (
                        <div>
                          <label className="text-[10px] uppercase text-hud-dim font-bold mb-2 block tracking-widest font-mono">OpenAI API Key</label>
                          <input 
                            type="password"
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-black/40 border border-hud-border rounded-lg px-4 py-3 text-sm focus:border-hud-cyan focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] focus:outline-none font-mono text-hud-cyan transition-all"
                          />
                        </div>
                      )}

                      {provider === 'anthropic' && (
                        <div>
                          <label className="text-[10px] uppercase text-hud-dim font-bold mb-2 block tracking-widest font-mono">Claude API Key</label>
                          <input 
                            type="password"
                            value={anthropicKey}
                            onChange={(e) => setAnthropicKey(e.target.value)}
                            placeholder="sk-ant-..."
                            className="w-full bg-black/40 border border-hud-border rounded-lg px-4 py-3 text-sm focus:border-hud-cyan focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] focus:outline-none font-mono text-hud-cyan transition-all"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] uppercase text-hud-dim font-bold mb-2 block tracking-widest font-mono">Processor Core Selection</label>
                        <select 
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full bg-black/40 border border-hud-border rounded-lg px-4 py-3 text-[12px] focus:border-hud-cyan focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] focus:outline-none text-hud-text appearance-none font-mono tracking-wide transition-all"
                        >
                          {provider === 'gemini' && (
                            <>
                              <option value="gemini-3.1-flash-lite-preview" className="bg-hud-bg text-hud-text">3.1 Flash-Lite (Insanely Fast)</option>
                              <option value="gemini-2.5-flash-8b" className="bg-hud-bg text-hud-text">2.5 Flash-8B (Highest Limit)</option>
                              <option value="gemini-2.5-flash" className="bg-hud-bg text-hud-text">2.5 Flash (Balanced Default)</option>
                              <option value="gemini-2.5-pro" className="bg-hud-bg text-hud-text">2.5 Pro (Precision & Logic)</option>
                            </>
                          )}
                          {provider === 'openai' && (
                            <>
                              <option value="gpt-4o-mini" className="bg-hud-bg text-hud-text">GPT-4o Mini (Fast)</option>
                              <option value="gpt-4o" className="bg-hud-bg text-hud-text">GPT-4o (Premium)</option>
                              <option value="o1-mini" className="bg-hud-bg text-hud-text">o1 Mini (Logic)</option>
                            </>
                          )}
                          {provider === 'anthropic' && (
                            <>
                              <option value="claude-3-5-sonnet-latest" className="bg-hud-bg text-hud-text">Claude 3.5 Sonnet</option>
                              <option value="claude-3-5-haiku-latest" className="bg-hud-bg text-hud-text">Claude 3.5 Haiku</option>
                              <option value="claude-3-opus-latest" className="bg-hud-bg text-hud-text">Claude 3 Opus</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div className="pt-4 border-t border-hud-border/50">
                        <label className="text-[10px] uppercase text-hud-dim font-bold mb-4 block tracking-widest font-mono">Neural Vocals (TTS)</label>
                        <div className="flex items-center justify-between mb-4 bg-black/40 p-3 rounded-lg border border-hud-border/50">
                          <span className="text-[11px] font-mono tracking-widest text-hud-text uppercase">Bypass System Voice</span>
                          <button 
                            type="button"
                            onClick={() => setIsAIVoiceEnabled(!isAIVoiceEnabled)}
                            className={`w-10 h-5 rounded-full transition-all relative ${isAIVoiceEnabled ? 'bg-hud-cyan shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'bg-hud-border'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${isAIVoiceEnabled ? 'left-6 bg-black' : 'left-1 bg-hud-dim'}`} />
                          </button>
                        </div>

                        {isAIVoiceEnabled && (
                          <div className="space-y-3">
                            <label className="text-[10px] uppercase text-hud-dim font-bold block tracking-widest font-mono">Select Personality</label>
                            <select 
                              value={aiVoiceName}
                              onChange={(e) => setAiVoiceName(e.target.value)}
                              className="w-full bg-black/40 border border-hud-border rounded-lg px-4 py-3 text-[12px] focus:border-hud-cyan focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] focus:outline-none text-hud-text appearance-none font-mono tracking-wide transition-all"
                            >
                              <option value="Kore" className="bg-hud-bg text-hud-text">Kore (Balanced & Warm)</option>
                              <option value="Puck" className="bg-hud-bg text-hud-text">Puck (Cheerful & High-pitched)</option>
                              <option value="Charon" className="bg-hud-bg text-hud-text">Charon (Deep & Professional)</option>
                              <option value="Fenrir" className="bg-hud-bg text-hud-text">Fenrir (Mysterious & Robotic-Human)</option>
                              <option value="Zephyr" className="bg-hud-bg text-hud-text">Zephyr (Soft & Calm)</option>
                            </select>
                            <p className="text-[10px] text-hud-cyan/50 italic leading-relaxed font-mono mt-2">
                              *VOICE PROCESSING REQUIRES TTS API UNITS.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-hud-border/50">
                        <label className="text-[10px] uppercase text-hud-dim font-bold mb-3 block tracking-widest font-mono">Local Bridge Token</label>
                        <p className="text-[10px] text-hud-cyan/70 mb-3 font-mono">AUTHORIZED TOKEN REQUIRED FOR SECURE UPLINK COMMAND EXECUTION.</p>
                        <div className="flex gap-2">
                          <input 
                            value={bridgeToken}
                            onChange={(e) => {
                               setBridgeToken(e.target.value);
                               localStorage.setItem('WIN_AGENT_BRIDGE_TOKEN', e.target.value);
                            }}
                            className="flex-1 bg-black/40 border border-hud-cyan/30 rounded-lg px-3 py-2 text-sm font-mono text-hud-cyan focus:border-hud-cyan focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] focus:outline-none transition-all"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(bridgeToken);
                              alert("Token copied!");
                            }}
                            className="p-2 bg-hud-cyan/10 hover:bg-hud-cyan/30 text-hud-cyan rounded-lg border border-hud-cyan/30 flex items-center justify-center transition-all"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-6 border-t border-hud-border/50">
                        <button 
                          type="button"
                          onClick={() => setIsSettingsOpen(false)}
                          className="flex-1 py-3 text-[11px] font-mono tracking-widest text-hud-dim hover:text-hud-text transition-colors uppercase border border-hud-border hover:border-hud-dim/50 rounded-lg"
                        >
                          Abort
                        </button>
                        <button 
                          type="submit"
                          className="flex-1 py-3 bg-hud-cyan text-black rounded-lg text-[11px] font-mono tracking-widest font-bold hover:shadow-[0_0_15px_rgba(0,240,255,0.6)] uppercase transition-all"
                        >
                          Save Config
                        </button>
                      </div>
                    </form>
                  </>
                )}

                {settingsTab === 'memory' && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xl font-bold text-hud-cyan mb-2 flex items-center gap-2 uppercase tracking-wide text-shadow-cyan">
                       Neural Memory Bank
                    </h3>
                    <p className="text-xs font-mono text-hud-dim mb-4">LONG-TERM PERSONALIZATION DATA CAPTURED IN CURRENT CYCLE.</p>
                    
                    <div className="bg-black/40 border border-hud-border rounded-xl p-4 max-h-[250px] overflow-y-auto hud-scroll">
                      {Object.keys(memory).length === 0 ? (
                        <div className="text-[11px] text-hud-cyan/50 italic text-center py-6 font-mono tracking-widest">NO MEMORY BLOCKS ALLOCATED YET.</div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          {Object.entries(memory).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center bg-hud-panel/30 p-2 rounded border border-hud-cyan/20">
                              <span className="text-[10px] font-mono font-bold text-hud-cyan uppercase tracking-widest">{key}</span>
                              <span className="text-[11px] font-mono text-hud-text truncate max-w-[150px]">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4" />
                    <button 
                      onClick={() => setIsSettingsOpen(false)}
                      className="w-full py-3 text-[11px] font-mono tracking-widest text-hud-dim border border-hud-border hover:border-hud-cyan hover:text-hud-cyan transition-colors rounded-lg uppercase"
                    >
                      Close Matrix
                    </button>
                  </div>
                )}

                {settingsTab === 'sync' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold text-hud-cyan mb-2 flex items-center gap-2 uppercase tracking-wide text-shadow-cyan">
                       Direct OTA Sync
                    </h3>
                    <p className="text-xs font-mono text-hud-dim mb-4">
                      SKIP GITHUB AND SYNC DIRECTLY FROM CLOUD CONTEXT OVER RPC.
                    </p>

                    <div className="bg-hud-panel/50 p-4 rounded-xl border border-hud-border space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase text-hud-cyan font-bold tracking-widest font-mono">Your Sync URL</label>
                        <div className="flex gap-2">
                          <input 
                            readOnly
                            value={window.location.origin}
                            className="flex-1 bg-black/40 border border-hud-cyan/30 rounded-lg px-3 py-2 text-sm font-mono text-hud-cyan focus:outline-none"
                          />
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.origin);
                              alert("URL Copied!");
                            }}
                            className="p-2 bg-hud-cyan/10 hover:bg-hud-cyan/30 text-hud-cyan rounded-lg border border-hud-cyan/30 flex items-center justify-center transition-all"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 bg-hud-cyan/5 border border-hud-cyan/20 rounded-lg">
                        <p className="text-[11px] text-hud-dim leading-relaxed font-mono">
                          <strong className="text-hud-cyan uppercase tracking-widest">Instruction:</strong><br />
                          1. Copy the URL above.<br />
                          2. Run <code className="text-hud-text">run_local.bat</code> on your PC.<br />
                          3. Select <code className="text-hud-text">y</code> for "Sync with AI Studio Cloud?".<br />
                          4. Paste this URL when prompted.
                        </p>
                      </div>
                    </div>

                    <div className="pt-4">
                       <button 
                        onClick={() => setIsSettingsOpen(false)}
                        className="w-full py-3 text-[11px] font-mono tracking-widest text-hud-dim border border-hud-border hover:border-hud-cyan hover:text-hud-cyan transition-colors rounded-lg uppercase"
                      >
                        Close Matrix
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
        <aside className="w-[280px] bg-hud-panel/40 backdrop-blur-md border-r border-hud-border p-6 flex flex-col gap-6">
        <div className="flex items-center gap-2 text-xl font-bold text-hud-cyan tracking-widest font-mono uppercase">
          <div className="w-4 h-4 bg-hud-cyan rounded-full shadow-[0_0_15px_rgba(0,240,255,0.8)] animate-pulse" />
          {botName} <span className="opacity-50 text-sm">v{pkg.version}</span>
        </div>

        <div className="space-y-4">
          <div className="hud-panel p-4">
            <span className="text-[10px] text-hud-dim tracking-widest mb-3 block font-mono uppercase border-b border-hud-border/50 pb-2">Uplink Status</span>
            <div className="text-sm flex items-center gap-2 font-mono">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-hud-green indicator-glow' : 'bg-hud-red indicator-glow-red'}`} />
              {isConnected ? <span className="text-hud-green tracking-wide overflow-hidden text-ellipsis whitespace-nowrap">SECURE_LINK_ACTIVE</span> : <span className="text-hud-red tracking-wide">OFFLINE</span>}
            </div>
            {!isConnected && <p className="text-[10px] text-hud-red/80 mt-3 font-mono">ERR: AWAITING LAUNCHER CONNECTION</p>}
          </div>

          <div className="hud-panel p-4">
            <span className="text-[10px] text-hud-dim tracking-widest mb-3 block font-mono uppercase border-b border-hud-border/50 pb-2 flex justify-between items-center">
              Vocal Override
              <button 
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className={`w-8 h-4 rounded-full transition-all relative ${isVoiceEnabled ? 'bg-hud-cyan shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'bg-hud-border'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-black rounded-full transition-all ${isVoiceEnabled ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            </span>
            <div className="text-[11px] font-mono tracking-wide flex items-center gap-2 text-hud-text">
              {isVoiceEnabled ? <Volume2 className="w-4 h-4 text-hud-cyan" /> : <VolumeX className="w-4 h-4 text-hud-dim" />}
              {isVoiceEnabled ? 'FEEDBACK: ENABLED' : 'FEEDBACK: MUTED'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <span className="text-[10px] text-hud-dim tracking-widest mb-2 block font-mono uppercase flex justify-between items-center">
             Subsystems
          </span>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-3 p-3 border rounded-lg transition-all text-[11px] font-mono tracking-widest uppercase ${activeTab === 'chat' ? 'bg-hud-cyan/10 border-hud-cyan text-hud-cyan shadow-[0_0_10px_rgba(0,240,255,0.15)]' : 'bg-hud-card border-hud-border text-hud-text hover:border-hud-cyan/50'}`}
          >
            <Terminal className="w-4 h-4" /> Command Terminal
          </button>
          <button 
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-3 p-3 border rounded-lg transition-all text-[11px] font-mono tracking-widest uppercase ${activeTab === 'network' ? 'bg-hud-cyan/10 border-hud-cyan text-hud-cyan shadow-[0_0_10px_rgba(0,240,255,0.15)]' : 'bg-hud-card border-hud-border text-hud-text hover:border-hud-cyan/50'}`}
          >
            <CommandIcon className="w-4 h-4" /> Firewall Telemetry
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
           <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 p-3 bg-hud-card hover:bg-hud-cyan/10 border border-hud-border hover:border-hud-cyan rounded-xl transition-all text-[12px] text-hud-dim hover:text-hud-cyan mt-auto mt-8"
          >
            <Monitor className="w-4 h-4" /> CONFIGURATION MATRIX
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-transparent overflow-hidden">
        {activeTab === 'network' ? (
          <NetworkControl bridgeToken={bridgeToken} />
        ) : (
          <>
            <header className="px-10 py-6 border-b border-hud-border flex justify-between items-center bg-black/40 backdrop-blur-md">
              <div>
                <h2 className="text-sm font-semibold text-hud-text uppercase tracking-widest text-shadow-cyan">{agentTitle}</h2>
                <p className="text-[12px] text-hud-cyan/70 font-mono mt-1">SECURE ENCLAVE ACTIVE</p>
              </div>
              <div className="text-[11px] text-hud-green font-mono tracking-widest flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-hud-green rounded-full animate-pulse indicator-glow" />
                 SYSTEM_READY
              </div>
            </header>

            <section 
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-10 py-10 flex flex-col gap-6 hud-scroll"
            >
              <AnimatePresence initial={false}>
                {history.length === 0 && !loading && (
                  <div className="h-full flex items-center justify-center text-hud-dim text-[11px] font-mono tracking-widest uppercase opacity-70">
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
                      <div className="bg-hud-cyan/20 border border-hud-cyan/40 text-hud-cyan px-5 py-3 rounded-md text-[13px] font-mono tracking-wide max-w-[80%] shadow-[0_0_15px_rgba(0,240,255,0.15)]">
                        {item.content}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 max-w-[85%]">
                        <div className="hud-panel px-5 py-4 text-[13px] leading-relaxed border-l-2 border-l-hud-cyan">
                          {item.content}
                        </div>
                        {item.metadata?.command && (
                          <div className="bg-black/60 border border-hud-border rounded-md p-3 font-mono text-[11px] text-hud-cyan group relative overflow-x-auto hud-scroll">
                            <div className="text-[10px] text-hud-dim font-bold uppercase tracking-widest mb-2 flex justify-between items-center border-b border-hud-border/50 pb-2">
                              <span><Cpu className="w-3 h-3 inline mr-1 text-hud-cyan" /> EXECUTING ROUTINE</span>
                              <button 
                                onClick={() => navigator.clipboard.writeText(JSON.stringify(item.metadata?.command, null, 2))}
                                className="text-hud-dim hover:text-hud-text transition-colors"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            <pre className="whitespace-pre-wrap text-shadow-cyan opacity-90">
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
                    className="flex flex-row-reverse items-center gap-2 self-start bg-hud-cyan/10 border border-hud-cyan/20 px-4 py-2 rounded-md font-mono"
                  >
                    <div className="w-1.5 h-1.5 bg-hud-cyan rounded-full animate-bounce shadow-[0_0_8px_rgba(0,240,255,0.8)]" style={{ animationDelay: '0.4s' }} />
                    <div className="w-1.5 h-1.5 bg-hud-cyan rounded-full animate-bounce shadow-[0_0_8px_rgba(0,240,255,0.8)]" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1.5 h-1.5 bg-hud-cyan rounded-full animate-bounce shadow-[0_0_8px_rgba(0,240,255,0.8)]" style={{ animationDelay: '0s' }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest mr-2 text-hud-cyan">PROCESSING UPLINK</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <div className="px-10 py-8 bg-black/40 backdrop-blur-md border-t border-hud-cyan/20">
              <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter prompt directive..."
                  className="w-full bg-hud-card border border-hud-cyan/50 px-6 py-4 rounded-md text-hud-text font-mono focus:outline-none focus:border-hud-cyan focus:shadow-[0_0_15px_rgba(0,240,255,0.3)] placeholder:text-hud-dim/50 pr-28 transition-all"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={toggleListening}
                    className={`p-2 transition-all rounded-md ${isListening ? 'bg-hud-red/20 text-hud-red border border-hud-red/50 shadow-[0_0_10px_rgba(255,0,60,0.5)] animate-pulse' : 'text-hud-dim hover:text-hud-cyan hover:bg-hud-cyan/10'}`}
                  >
                    {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                  <button 
                    id="submit-prompt"
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="p-2 bg-hud-cyan text-black hover:shadow-[0_0_15px_rgba(0,240,255,0.8)] rounded-md disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    <Send className="w-4 h-4" />
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



