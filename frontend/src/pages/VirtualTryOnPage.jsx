import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanFace, Upload, ArrowRight, Check, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';

const modelTemplates = [
  { id: 'm1', name: 'Editorial Model A', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300' },
  { id: 'm2', name: 'Editorial Model B', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300' },
];

const garmentTemplates = [
  { id: 'g1', name: 'Minimal Trench Coat', category: 'Outerwear', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=300', result: '/images/hero_fashion_female.png' },
  { id: 'g2', name: 'Textured Knit Sweater', category: 'Tops', image: 'https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?auto=format&fit=crop&q=80&w=300', result: '/images/knit_sweater_card.png' },
  { id: 'g3', name: 'White Linen Shirt', category: 'Tops', image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=300', result: '/images/virtual_tryon_showcase.png' },
];

export default function VirtualTryOnPage() {
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let interval;
    if (rendering) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setRendering(false);
            // set result image based on selected garment
            setResult(selectedGarment.result);
            return 100;
          }
          return prev + 10;
        });
      }, 250);
    }
    return () => clearInterval(interval);
  }, [rendering]);

  const handleGenerate = () => {
    if (!selectedModel || !selectedGarment) return;
    setResult(null);
    setRendering(true);
  };

  const handleReset = () => {
    setSelectedModel(null);
    setSelectedGarment(null);
    setResult(null);
    setProgress(0);
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 pb-12 text-black dark:text-white transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col items-center text-center pb-8 border-b border-neutral-200 dark:border-neutral-800">
        <ScanFace className="h-8 w-8 text-black dark:text-white mb-4" strokeWidth={1} />
        <h1 className="text-3xl font-light tracking-tight font-display mb-2">Virtual Fitting.</h1>
        <p className="text-neutral-500 dark:text-neutral-450 max-w-md">Select a model and choose a garment from your catalog to render virtual try-ons.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Step 1: Select Model */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">1. Select Subject</h2>
          <div className="grid grid-cols-2 gap-3">
            {modelTemplates.map((m) => (
              <button
                key={m.id}
                onClick={() => { setSelectedModel(m); setResult(null); }}
                className={`relative aspect-[3/4] rounded-lg overflow-hidden border transition-all ${
                  selectedModel?.id === m.id 
                    ? 'border-black dark:border-white ring-2 ring-black dark:ring-white scale-[1.02]' 
                    : 'border-neutral-200 dark:border-neutral-800 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                {selectedModel?.id === m.id && (
                  <div className="absolute top-2 right-2 bg-black dark:bg-white text-white dark:text-black p-1 rounded-full">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
          {selectedModel && (
            <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg flex items-center gap-3">
              <img src={selectedModel.image} className="w-10 h-10 object-cover rounded" />
              <div className="text-xs">
                <p className="font-medium">{selectedModel.name}</p>
                <p className="text-neutral-450 uppercase tracking-widest text-[9px] mt-0.5">Subject Set</p>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Choose Garment */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">2. Pick Garment</h2>
          <div className="grid grid-cols-3 gap-2">
            {garmentTemplates.map((g) => (
              <button
                key={g.id}
                onClick={() => { setSelectedGarment(g); setResult(null); }}
                className={`relative aspect-[3/4] rounded-lg overflow-hidden border transition-all ${
                  selectedGarment?.id === g.id 
                    ? 'border-black dark:border-white ring-2 ring-black dark:ring-white scale-[1.02]' 
                    : 'border-neutral-200 dark:border-neutral-800 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={g.image} alt={g.name} className="w-full h-full object-cover" />
                {selectedGarment?.id === g.id && (
                  <div className="absolute top-2 right-2 bg-black dark:bg-white text-white dark:text-black p-1 rounded-full">
                    <Check className="h-2 w-2" />
                  </div>
                )}
              </button>
            ))}
          </div>
          {selectedGarment && (
            <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg flex items-center gap-3">
              <img src={selectedGarment.image} className="w-10 h-10 object-cover rounded" />
              <div className="text-xs">
                <p className="font-medium">{selectedGarment.name}</p>
                <p className="text-neutral-450 uppercase tracking-widest text-[9px] mt-0.5">{selectedGarment.category}</p>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Interactive Fitting Room */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">3. Fitting Outcome</h2>
          <div className="border border-neutral-200 dark:border-neutral-850 bg-neutral-50 dark:bg-neutral-900 rounded-lg overflow-hidden aspect-[3/4] flex flex-col items-center justify-center p-6 relative">
            <AnimatePresence mode="wait">
              {rendering ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 text-center"
                >
                  <Sparkles className="h-8 w-8 text-neutral-450 animate-spin" />
                  <p className="text-xs font-semibold uppercase tracking-widest">Rendering Try-on...</p>
                  <div className="w-32 bg-neutral-200 dark:bg-neutral-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-black dark:bg-white h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[10px] text-neutral-400">{progress}%</span>
                </motion.div>
              ) : result ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0"
                >
                  <img src={result} alt="Fitting Result" className="w-full h-full object-cover animate-fade-in" />
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-black/90 backdrop-blur-sm p-3 rounded border border-white/20 text-xs">
                    <span className="font-semibold text-black dark:text-white">Rendering Complete</span>
                    <p className="text-neutral-500 dark:text-neutral-400 text-[10px] mt-0.5">{selectedGarment.name} on {selectedModel.name}</p>
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center text-center text-neutral-400 max-w-[200px]">
                  <div className="w-12 h-12 border border-neutral-200 dark:border-neutral-800 rounded-full flex items-center justify-center mb-4 bg-white dark:bg-[#111113]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-xs uppercase tracking-widest font-semibold mb-1">Awaiting Setup</p>
                  <p className="text-[10px] leading-relaxed">Select a subject and a garment, then click Generate below.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Control Actions */}
      <div className="flex justify-center gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-900">
        {(selectedModel || selectedGarment || result) && (
          <Button 
            variant="outline" 
            onClick={handleReset}
            className="border-black text-black hover:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-neutral-900"
          >
            Reset Room
          </Button>
        )}
        <Button 
          size="lg" 
          onClick={handleGenerate}
          className="px-12 gap-2 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black" 
          disabled={!selectedModel || !selectedGarment || rendering}
        >
          {rendering ? 'Fitting...' : 'Generate Fitting'} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
