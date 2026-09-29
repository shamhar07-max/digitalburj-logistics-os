import React, { useState } from 'react';
import {
  Inbox,
  MessageSquare,
  Mail,
  Globe2,
  Phone,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  User,
} from 'lucide-react';
import { INITIAL_UNIFIED_MESSAGES } from '../../data/mockData';
import { UnifiedMessage } from '../../types';

export const UnifiedInboxView: React.FC = () => {
  const [conversations, setConversations] = useState<UnifiedMessage[]>(INITIAL_UNIFIED_MESSAGES);
  const [selectedConv, setSelectedConv] = useState<UnifiedMessage>(conversations[0]);
  const [replyText, setReplyText] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'email' | 'portal'>('whatsapp');

  const handleSend = () => {
    if (!replyText.trim()) return;

    const newMsg = {
      id: `t-${Date.now()}`,
      sender: 'user' as const,
      text: replyText.trim(),
      timestamp: 'Just now',
      channel: selectedChannel === 'whatsapp' ? 'WhatsApp' : selectedChannel === 'email' ? 'Email' : 'Portal',
    };

    const updatedConv = {
      ...selectedConv,
      lastMessage: replyText.trim(),
      lastTimestamp: 'Just now',
      thread: [...selectedConv.thread, newMsg],
    };

    setConversations((prev) => prev.map((c) => (c.id === selectedConv.id ? updatedConv : c)));
    setSelectedConv(updatedConv);
    setReplyText('');
  };

  const handleApplyAiSuggestion = (suggestion: string) => {
    setReplyText(suggestion);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#E8472B]">Omnichannel Communications</span>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
              WhatsApp First-Class Channel
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Unified Communications Inbox</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Threads WhatsApp, email, and customer portal inquiries into one single timeline per shipment. AI drafts replies, human approves.
          </p>
        </div>
      </div>

      {/* Main Inbox Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs min-h-[580px]">
        {/* Left: Conversations List */}
        <div className="border-r border-slate-200 flex flex-col bg-slate-50/50">
          <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-500">Conversations</span>
            <span className="text-[10px] bg-slate-100 font-bold px-2 py-0.5 rounded text-slate-600">3 Active</span>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                className={`flex w-full items-start gap-3 p-3.5 text-left transition ${
                  selectedConv.id === conv.id ? 'bg-white border-l-4 border-l-[#E8472B] shadow-2xs' : 'hover:bg-slate-100/60'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-xs text-white ${
                    conv.channel === 'whatsapp' ? 'bg-[#25D366]' : conv.channel === 'email' ? 'bg-blue-600' : 'bg-purple-600'
                  }`}
                >
                  {conv.channel === 'whatsapp' ? <MessageSquare className="h-4 w-4" /> : conv.channel === 'email' ? <Mail className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 truncate">{conv.contactName}</span>
                    <span className="text-[10px] text-slate-400">{conv.lastTimestamp}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{conv.lastMessage}</div>
                  {conv.shipmentRef && (
                    <span className="mt-1.5 inline-block font-mono text-[9.5px] font-bold text-[#E8472B] bg-[#E8472B]/10 px-1.5 py-0.2 rounded">
                      Linked: {conv.shipmentRef}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right (2 cols): Thread Viewer & Composer */}
        <div className="lg:col-span-2 flex flex-col bg-white">
          {/* Active Thread Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-xs">
                {selectedConv.contactAvatar}
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">{selectedConv.contactName}</h4>
                <div className="text-[11px] text-slate-400">
                  Channel: {selectedConv.channel.toUpperCase()} · Reference: {selectedConv.shipmentRef || 'General'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedChannel('whatsapp')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  selectedChannel === 'whatsapp' ? 'bg-[#25D366] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                WhatsApp
              </button>
              <button
                onClick={() => setSelectedChannel('email')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  selectedChannel === 'email' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Email
              </button>
              <button
                onClick={() => setSelectedChannel('portal')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  selectedChannel === 'portal' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Portal
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/40">
            {selectedConv.thread.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                  <span>{msg.sender === 'user' ? 'You' : selectedConv.contactName.split('(')[0]}</span>
                  <span>·</span>
                  <span className="font-bold text-slate-600">{msg.channel}</span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-[#E8472B] text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* AI Smart Reply Suggestions */}
          <div className="border-t border-slate-100 bg-purple-50/50 p-2.5 px-4 text-xs">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 mb-1.5">
              <Sparkles className="h-3 w-3" />
              <span>AI Customer Service Suggested Responses:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                'Amended COO has been submitted to Dubai Customs. Expected release 14:00 today.',
                'Container discharged at Terminal 2. Live tracking link: https://db-track.ae/s/DB-1048',
                'Payment received and allocated. Delivery order has been transmitted to your broker.',
              ].map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyAiSuggestion(sug)}
                  className="rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-[11px] text-purple-950 font-medium hover:bg-purple-100 transition text-left"
                >
                  "{sug}"
                </button>
              ))}
            </div>
          </div>

          {/* Composer Box */}
          <div className="p-3 border-t border-slate-200 bg-white flex items-end gap-2">
            <textarea
              rows={2}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Send message to customer via ${selectedChannel.toUpperCase()}...`}
              className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-hidden focus:border-[#E8472B] resize-none"
            />
            <button
              onClick={handleSend}
              className="rounded-xl bg-[#E8472B] p-2.5 text-white hover:bg-[#D13B20] transition active:scale-95"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
