'use client';

import { motion } from 'motion/react';

export default function Hero() {
  return (
    <section className="px-4 py-3 sm:px-0">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-cover bg-center flex flex-col justify-end overflow-hidden bg-background-dark rounded-2xl min-h-[240px] md:min-h-[320px] lg:min-h-[400px] relative shadow-2xl"
        style={{
          backgroundImage: `linear-gradient(0deg, rgba(25, 16, 34, 0.9) 0%, rgba(25, 16, 34, 0.2) 60%), url("https://lh3.googleusercontent.com/aida-public/AB6AXuAX2z95u4Hg1pJZUBnwRvdYOsgj-8zaxRRHcruVPoYcNBIMU0cXE2OAbVPAO2vckyhXWbLlQRzU2IKz-XhIby6CRJ2x9WXcrQofDcKQBMn1RL5KSsOFNLyD6FCuPDoad7yMtcN9VIMYWqGE7WBg5H_n6D33_YWJYlUxQGYG0ysAMa5OTl0rBnLQz2iabRAhrSulA-DLwMvKf7Wz9eJfmPpo6NTdL8PHgeSzKblBQm0k4-Wnu7_Zl3asP36U9tPtt79ktk6CYz6355IH")`
        }}
      >
        <div className="flex flex-col p-6 gap-2">
          <motion.span 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-primary font-semibold tracking-widest text-sm uppercase"
          >
            Dia 01
          </motion.span>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-slate-100 tracking-tight text-[32px] font-bold leading-tight font-display"
          >
            A nova identidade feminina
          </motion.h1>
        </div>
      </motion.div>
    </section>
  );
}
