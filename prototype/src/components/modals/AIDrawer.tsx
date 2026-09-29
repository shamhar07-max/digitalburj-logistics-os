import React, { useState } from 'react';
import { X, Sparkles, Send, Bot, ShieldCheck, ChevronRight, CornerDownLeft } from 'lucide-react';
import { AI_AGENTS } from '../../data/mockData';
import { AIAgent } from '../../types';

interface AIDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  agentName: string;
  text: string;
  timestamp: string;
}

export const AIDrawer: React.FC<AIDrawerProps> = ({ isOpen, onClose }) => {
  const [selectedAgent, setSelectedAgent] = useState<AIAgent>(AI_AGENTS[0]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      agentName: 'AI Executive',
      text: 'Good morning! I am your AI Executive copilot. I analyze whole-company operations across shipments, receivables, margin leaks, and pending approvals. Ask me anything about your business or click a preset below.',
      timestamp: 'Just now',
    },
  ]);

  if (!isOpen) return null;

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputPrompt.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      agentName: 'You',
      text,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');

    // Simulate smart agent response
    setTimeout(() => {
      let reply = selectedAgent.sampleResponses[text];
      if (!reply) {
        // Fallback intelligent response
        reply = `[${selectedAgent.name} Analysis] Query: "${text}". Based on live records in Gulf Star Logistics (Dubai HQ): Analyzed 5 active shipments, 4 quotes, and 6 employee profiles. No blocking anomalies found for this query under current ${selectedAgent.role} authorization. Try clicking one of the preset prompts above for exact domain metrics.`;
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        agentName: selectedAgent.name,
        text: reply,
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#09192D] px-6 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-[#E8472B] text-white shadow-md">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">8 Coordinated AI Agents</h3>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">RBAC Active</span>
                </div>
                <div className="text-[10.5px] text-slate-400">Strictly grounded in business records · No hallucinations</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Agent Selector Bar */}
          <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50 p-2 gap-1.5 scrollbar-none">
            {AI_AGENTS.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgent(agent);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `switch-${Date.now()}`,
                      sender: 'assistant',
                      agentName: agent.name,
                      text: `Switched persona to **${agent.name}** (${agent.role}). ${agent.description}`,
                      timestamp: 'Just now',
                    },
                  ]);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  selectedAgent.id === agent.id ? 'bg-[#0A2A2B] text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{agent.name.replace('AI ', '')}</span>
              </button>
            ))}
          </div>

          {/* Quick Prompts */}
          <div className="border-b border-slate-100 px-4 py-2 bg-purple-50/50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 mb-1.5">Suggested Prompts for {selectedAgent.name}:</div>
            <div className="flex flex-wrap gap-1.5">
              {selectedAgent.sampleQuestions.slice(0, 3).map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(q)}
                  className="rounded-full border border-purple-200 bg-white px-2.5 py-1 text-[11px] font-medium text-purple-900 transition hover:bg-purple-100 text-left line-clamp-1"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>

          {/* Message Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/40">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1 px-1">
                  <span className="font-bold text-slate-600">{m.agentName}</span>
                  <span>·</span>
                  <span>{m.timestamp}</span>
                </div>
                <div
                  className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-2xs ${
                    m.sender === 'user' ? 'bg-[#E8472B] text-white rounded-br-xs' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Governance Notice */}
          <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10.5px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>AI cannot autonomously post payments, commit liabilities, or override credit without approval.</span>
          </div>

          {/* Input Box */}
          <div className="border-t border-slate-200 p-3 bg-white">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-[#E8472B] focus-within:bg-white transition">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={`Ask ${selectedAgent.name}...`}
                className="flex-1 bg-transparent px-2.5 py-1 text-xs text-slate-900 focus:outline-hidden"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputPrompt.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8472B] text-white transition hover:bg-[#D13B20] disabled:opacity-40"
              >
                <CornerDownLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
