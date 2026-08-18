'use client';

import { PlayCircle, Play } from 'lucide-react';
import { motion } from 'motion/react';

export default function VideoSection() {
  return (
    <section className="px-4 py-6 sm:px-0">
      <div className="flex items-center gap-2 mb-4">
        <PlayCircle className="size-5 text-primary" />
        <h2 className="text-slate-100 text-xl font-bold tracking-tight font-display">Vídeo Estratégico</h2>
      </div>
      
      <motion.div 
        whileHover={{ scale: 1.02 }}
        className="relative flex items-center justify-center bg-primary/20 bg-cover bg-center aspect-video rounded-2xl p-4 overflow-hidden border border-primary/30 shadow-lg group cursor-pointer"
        style={{
          backgroundImage: `url("https://lh3.googleusercontent.com/aida-public/AB6AXuC3u4yCcbtrJjaH-n25yP7E8yFYy7LcFS1O01rgeh3MvwzzTvZVWyBm1GOxYNq4Jk44gnAB4iDnUDDgAOsjkKW9noQJeop6aHPzS_aVkbqfsP-bAthsy4hzVKEfIGDd9y2WitHVJh7XTFUaS8lzXt7_jEfuy3oX9MbIZwPHOP31FTEBGfmqJKgXQzZbN939uaCytyM_MFsxWoUEjVgVnvgv-pIvgRyce9QfVIp8S9kFtTQ2Zrkt6NFeJ1wfCuGx8W1eokIIIgNBL-1X")`
        }}
      >
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors"></div>
        
        <button className="relative flex shrink-0 items-center justify-center rounded-full size-16 bg-primary text-white shadow-lg shadow-primary/40 group-hover:scale-110 transition-transform">
          <Play className="size-8 fill-current" />
        </button>
        
        <div className="absolute inset-x-0 bottom-0 px-4 py-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex h-1.5 items-center justify-center mb-2">
            <div className="h-full flex-1 rounded-full bg-primary"></div>
            <div className="relative">
              <div className="absolute -left-1.5 -top-1.5 size-3 rounded-full bg-white shadow-md"></div>
            </div>
            <div className="h-full flex-[3] rounded-full bg-white/30"></div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-white text-xs font-medium opacity-90">04:12</p>
            <p className="text-white text-xs font-medium opacity-90">12:45</p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
