'use client';

import { Brain, CheckSquare, Square } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'motion/react';

export default function BehavioralExercise() {
  const [checked, setChecked] = useState(false);

  return (
    <section className="px-4 py-6 sm:px-0">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="size-5 text-primary" />
        <h2 className="text-slate-100 text-xl font-bold tracking-tight font-display">Exercício Comportamental</h2>
      </div>
      
      <div className="flex flex-col gap-4">
        <motion.div 
          initial={{ x: -10, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          className="p-4 rounded-2xl bg-primary/10 border-l-4 border-primary"
        >
          <p className="text-sm font-medium leading-relaxed text-slate-200">
            Observe suas reações automáticas hoje. Quantas vezes você se diminuiu para caber na expectativa de outros?
          </p>
        </motion.div>
        
        <motion.button 
          onClick={() => setChecked(!checked)}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-white/5 hover:bg-white/10 transition-colors text-left"
        >
          {checked ? (
            <CheckSquare className="size-5 text-primary" />
          ) : (
            <Square className="size-5 text-slate-500" />
          )}
          <span className={`text-sm transition-colors ${checked ? 'text-primary font-medium' : 'text-slate-300'}`}>
            Identificar 3 gatilhos de autossabotagem
          </span>
        </motion.button>
      </div>
    </section>
  );
}
