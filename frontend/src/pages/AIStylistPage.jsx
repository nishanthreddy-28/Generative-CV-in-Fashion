import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, ArrowRight, Shirt } from 'lucide-react';
import { Button } from '../components/ui/Button';

const suggestionPills = [
  { label: 'Parisian Summer Chic', query: 'Plan a Parisian summer look with neutral tones' },
  { label: 'Corporate Avant-Garde', query: 'Recommend a smart office silhouette that stands out' },
  { label: 'Cozy Autumn Minimalist', query: 'Assemble a textured knitwear casual outfit for fall' },
];

export default function AIStylistPage() {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      role: 'ai', 
      content: 'Good morning. I am your editorial stylist. Describe your desired aesthetic or occasion, or select one of the styling templates below.' 
    }
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages, thinking]);

  const sendMessage = (text) => {
    const userMessage = text || input.trim();
    if (!userMessage) return;

    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: userMessage }]);
    setInput('');
    setThinking(true);

    setTimeout(() => {
      setThinking(false);
      
      // Determine response type based on query keywords
      const lower = userMessage.toLowerCase();
      let outfitItems = null;
      let replyText = 'I recommend a minimal structured approach: tailored outerwear with neutral linen tops and slim chinos.';
      
      if (lower.includes('parisian') || lower.includes('summer')) {
        replyText = 'Here is a curated Parisian Summer Look. A light trench coat draped over a relaxed white linen shirt and neutral chinos:';
        outfitItems = [
          { name: 'Minimal Trench Coat', brand: 'Massimo Dutti', category: 'Outerwear', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=300' },
          { name: 'White Linen Shirt', brand: 'Uniqlo', category: 'Tops', image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=300' },
          { name: 'Slim-Fit Chinos', brand: 'J.Crew', category: 'Bottoms', image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=300' }
        ];
      } else if (lower.includes('autumn') || lower.includes('knit') || lower.includes('fall') || lower.includes('cozy')) {
        replyText = 'I have assembled a cozy Autumn Minimalist outfit focusing on warm textures and leather boots:';
        outfitItems = [
          { name: 'Textured Knit Sweater', brand: 'Zara', category: 'Tops', image: 'https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?auto=format&fit=crop&q=80&w=300' },
          { name: 'Slim-Fit Chinos', brand: 'J.Crew', category: 'Bottoms', image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=300' },
          { name: 'Leather Chelsea Boots', brand: 'Thursday Boot', category: 'Shoes', image: 'https://images.unsplash.com/photo-1638247025967-b4e38f6893b4?auto=format&fit=crop&q=80&w=300' }
        ];
      } else if (lower.includes('corporate') || lower.includes('office') || lower.includes('avant-garde')) {
        replyText = 'For a Corporate Avant-Garde statement, try layering this premium outerwear silhouette with sleek leather boots:';
        outfitItems = [
          { name: 'Minimal Trench Coat', brand: 'Massimo Dutti', category: 'Outerwear', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=300' },
          { name: 'Leather Chelsea Boots', brand: 'Thursday Boot', category: 'Shoes', image: 'https://images.unsplash.com/photo-1638247025967-b4e38f6893b4?auto=format&fit=crop&q=80&w=300' }
        ];
      }

      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'ai',
        content: replyText,
        outfit: outfitItems
      }]);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="max-w-[850px] mx-auto h-[calc(100vh-120px)] flex flex-col bg-white dark:bg-[#09090b] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden transition-colors duration-300">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#09090b] flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-black dark:text-white" strokeWidth={1.5} />
          <div>
            <h2 className="text-sm font-medium text-black dark:text-white uppercase tracking-widest">AI Stylist</h2>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Active concierge</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-neutral-50/50 dark:bg-[#0c0c0d]">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`max-w-[80%] px-5 py-3 rounded-lg ${
              msg.role === 'user' 
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-md' 
                : 'bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 text-black dark:text-white shadow-soft'
            }`}>
              <p className="text-sm font-light leading-relaxed">{msg.content}</p>
            </div>
            
            {/* Visual Outfit Recommendations */}
            {msg.outfit && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-[500px]">
                {msg.outfit.map((item, index) => (
                  <div key={index} className="bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-md overflow-hidden p-2 flex flex-col shadow-soft">
                    <div className="aspect-[3/4] bg-neutral-100 dark:bg-neutral-900 rounded overflow-hidden mb-2">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{item.category}</span>
                    <h4 className="text-xs font-medium text-black dark:text-white truncate">{item.name}</h4>
                    <p className="text-[9px] text-neutral-500 dark:text-neutral-450 truncate">{item.brand}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
        
        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="px-5 py-3 bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 text-sm font-light rounded-lg shadow-soft">
              <span className="animate-pulse flex items-center gap-2">
                <Sparkles className="h-4 w-4 animate-spin text-neutral-450" /> Curating looks...
              </span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Pills */}
      {messages.length === 1 && (
        <div className="px-6 py-3 bg-white dark:bg-[#09090b] border-t border-neutral-100 dark:border-neutral-900 flex flex-wrap gap-2">
          {suggestionPills.map((pill) => (
            <button
              key={pill.label}
              onClick={() => sendMessage(pill.query)}
              className="text-[11px] font-medium uppercase tracking-wider px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:border-black dark:hover:border-white transition-all rounded"
            >
              {pill.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#09090b]">
        <div className="flex items-center gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your occasion or desired aesthetic..."
            rows={1}
            className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm text-black dark:text-white placeholder:text-neutral-400 focus:border-black dark:focus:border-white outline-none px-4 py-3 resize-none rounded transition-colors"
          />
          <Button onClick={() => sendMessage()} disabled={!input.trim() || thinking} size="icon" className="h-[46px] w-[46px] rounded bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
