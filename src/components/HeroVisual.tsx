'use client';

import { motion } from 'framer-motion';

export default function HeroVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-lg mx-auto"
    >
      {/* Ambient glow behind - teal themed */}
      <div 
        className="absolute -inset-8 blur-3xl opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(0, 180, 216, 0.2) 0%, transparent 60%)',
        }}
      />
      
      {/* Mock app window */}
      <div className="relative bg-[#0c0c0c] rounded-2xl border border-[rgba(255,255,255,0.08)] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)]">
        {/* Window header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#161616] border-b border-[rgba(255,255,255,0.05)]">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-xs text-[#444] font-medium font-display">dip</span>
        </div>
        
        {/* Content area */}
        <div className="relative p-10 md:p-14 flex flex-col items-center justify-center min-h-[320px] bg-gradient-to-b from-[#0c0c0c] to-[#080808]">
          {/* Subtle grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
            }}
          />
          
          {/* Outer pulse ring - teal */}
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
            className="absolute w-32 h-32 rounded-full border border-[#00b4d8]/30"
          />
          
          {/* Middle pulse ring */}
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
            className="absolute w-24 h-24 rounded-full border border-[#00b4d8]/40"
          />
          
          {/* Recording button with glow - teal themed */}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="relative"
          >
            {/* Glow */}
            <div className="absolute inset-0 rounded-full bg-[#00b4d8] blur-xl opacity-50" />
            
            {/* Button */}
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#48cae4] via-[#00b4d8] to-[#0096c7] flex items-center justify-center shadow-[0_0_30px_rgba(0,180,216,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]">
              {/* Stop icon */}
              <motion.div 
                animate={{ scale: [1, 0.9, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-7 h-7 rounded-[4px] bg-white shadow-sm"
              />
            </div>
          </motion.div>
          
          {/* Status text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 flex items-center gap-2"
          >
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-[#00b4d8]"
            />
            <span className="text-sm text-[#888] font-medium">Recording...</span>
          </motion.div>
          
          {/* Progress bar */}
          <div className="mt-6 w-full max-w-[200px]">
            <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="h-full bg-gradient-to-r from-[#00b4d8] via-[#48cae4] to-[#00b4d8] rounded-full"
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-[#444]">
              <span>00:00</span>
              <span>00:10</span>
            </div>
          </div>
        </div>
        
        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0a0a0a] border-t border-[rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-[#555] rounded-sm" />
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
              <div className="w-3 h-2 border-2 border-[#555] rounded-sm" />
            </div>
          </div>
          <div className="text-xs text-[#555]">shortcut</div>
        </div>
      </div>
      
      {/* Floating notification - teal */}
      <motion.div
        initial={{ opacity: 0, x: 30, y: 10 }}
        whileInView={{ opacity: 1, x: 0, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="absolute -right-2 md:-right-6 top-1/3 px-4 py-3 rounded-xl bg-[#111] border border-[rgba(0,180,216,0.2)] shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center gap-2">
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.1, type: 'spring' }}
            className="w-5 h-5 rounded-full bg-[#00b4d8] flex items-center justify-center"
          >
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
          <span className="text-xs text-[#888]">Copied to clipboard</span>
        </div>
      </motion.div>
      
      {/* Floating shortcut hint */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 1 }}
        className="absolute -left-2 md:-left-4 bottom-1/4 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)]"
      >
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-[#252525] text-[10px] text-[#666] font-mono">⌨</kbd>
          <span className="text-[10px] text-[#555]">One shortcut</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
