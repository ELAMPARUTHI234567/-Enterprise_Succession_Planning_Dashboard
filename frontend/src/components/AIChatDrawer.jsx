import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, X, Bot, User as UserIcon, RefreshCw, 
  ChevronDown, MessageSquare, ArrowRight, ShieldCheck, Minimize2
} from 'lucide-react';
import { aiService } from '../services/api';

export const AIChatDrawer = ({ isManager = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: isManager 
        ? "Hello! I am your AI Team Workforce Assistant. Ask me anything about your direct reports, team readiness, competency gaps, burnout risks, or role succession candidates."
        : "Hello! I am your Enterprise AI Workforce Assistant. Ask me about organizational succession readiness, top successors for any leadership role, competency deficits, or assessment statistics.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const quickPrompts = isManager ? [
    "Who on my team is eligible for Team Lead?",
    "Show team burnout and workload risk analysis",
    "What are my team's major competency gaps?",
    "Team assessment completion status"
  ] : [
    "Who are the top eligible successors for Project Manager?",
    "What are our biggest competency gaps across the company?",
    "Show executive workforce succession summary",
    "How many assessments are completed vs pending?"
  ];

  const handleSend = async (queryText = null) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || sending) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setSending(true);

    try {
      const res = await aiService.sendChatQuery(textToSend);
      if (res && res.success) {
        const botMsg = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: res.reply || 'No response generated.',
          suggestedPrompts: res.suggested_prompts || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'bot',
            text: res?.message || 'Sorry, I encountered an issue analyzing the database records. Please try again.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: 'Unable to reach the AI intelligence service. Please check your connection.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-cleared',
        sender: 'bot',
        text: "Conversation cleared. How can I assist with succession or workforce intelligence?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Helper to format bot markdown text
  const renderBotText = (text) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="font-bold text-slate-900 text-xs mt-2 mb-1">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('#### ')) {
        return <h5 key={idx} className="font-semibold text-slate-800 text-[11px] mt-2 mb-0.5">{line.replace('#### ', '')}</h5>;
      }
      if (line.startsWith('- ')) {
        const content = line.replace('- ', '');
        return (
          <li key={idx} className="text-[11px] text-slate-700 ml-3 list-disc leading-relaxed">
            {formatInlineFormatting(content)}
          </li>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-[11px] text-slate-700 leading-relaxed">
          {formatInlineFormatting(line)}
        </p>
      );
    });
  };

  const formatInlineFormatting = (str) => {
    // Basic bold **text** and code `text` replacement
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-indigo-700">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Trigger Pill */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center space-x-2.5 border border-indigo-400/40"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-indigo-900"></span>
          </div>
          <span className="text-xs font-extrabold tracking-wide">
            {isManager ? 'AI Team Assistant' : 'AI Workforce Assistant'}
          </span>
        </button>
      )}

      {/* Slide-out Drawer Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-md h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-slideUp">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 flex items-center justify-between border-b border-indigo-950">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-indigo-500/20 border border-indigo-400/30 rounded-lg text-indigo-300">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-xs font-bold text-white">AI Workforce Intelligence</h3>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                </div>
                <p className="text-[10px] text-slate-300">
                  {isManager ? 'Manager Team Scope • Isolated RBAC' : 'Enterprise HR Scope • Grounded in DB'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={clearChat}
                title="Clear conversation"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize assistant"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Prompt Pills */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[10px] no-scrollbar">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={sending}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 font-medium transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start space-x-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">
                    AI
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <p className="text-white font-medium">{msg.text}</p>
                  ) : (
                    <div>{renderBotText(msg.text)}</div>
                  )}
                  <span className={`block text-[9px] mt-1 text-right ${msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {msg.timestamp}
                  </span>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">
                    You
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex items-center space-x-2 text-slate-400 text-xs py-2">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                  AI
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl px-3 py-2 flex items-center space-x-1.5 shadow-sm">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span className="text-[11px] text-slate-600">Retrieving database intelligence...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder={isManager ? "Ask about team readiness, gaps, risks..." : "Ask about successors, roles, gaps..."}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputQuery.trim() || sending}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl shadow-md transition-all flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatDrawer;
