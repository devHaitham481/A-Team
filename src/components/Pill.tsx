'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

type PillState = 'idle' | 'recording' | 'processing' | 'done';

const states: { state: PillState; duration: number }[] = [
  { state: 'idle', duration: 2000 },
  { state: 'recording', duration: 3000 },
  { state: 'processing', duration: 2000 },
  { state: 'done', duration: 2000 },
];

const stateConfig = {
  idle: {
    bg: 'bg-[#1a1a1a]',
    border: 'border-[rgba(255,255,255,0.1)]',
    text: 'Ready to dip',
    dotColor: 'bg-[#555]',
    glow: '',
  },
  recording: {
    bg: 'bg-[#00b4d8]',
    border: 'border-transparent',
    text: 'Recording',
    dotColor: 'bg-white',
    glow: 'shadow-[0_0_60px_rgba(0,180,216,0.5)]',
  },
  processing: {
    bg: 'bg-[#1a1a1a]',
    border: 'border-[rgba(255,255,255,0.1)]',
    text: 'Processing',
    dotColor: '',
    glow: '',
  },
  done: {
    bg: 'bg-[#34c759]',
    border: 'border-transparent',
    text: 'Copied',
    dotColor: 'bg-white',
    glow: 'shadow-[0_0_60px_rgba(52,199,89,0.5)]',
  },
};

export default function Pill() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentState = states[currentIndex].state;
  const config = stateConfig[currentState];

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % states.length);
    }, states[currentIndex].duration);

    return () => clearTimeout(timer);
  }, [currentIndex]);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.05 }}
      className="relative"
    >
      {/* Pulsing ring for recording state */}
      <AnimatePresence>
        {currentState === 'recording' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-full"
            style={{
              animation: 'pulse-ring 1.5s ease-out infinite',
            }}
          />
        )}
      </AnimatePresence>

      {/* Main pill */}
      <motion.div
        layout
        className={`
          relative flex items-center gap-3 px-6 py-4 rounded-full border
          transition-colors duration-300 cursor-pointer
          ${config.bg} ${config.border} ${config.glow}
        `}
      >
        {/* Indicator */}
        <div className="relative flex items-center justify-center w-3 h-3">
          {currentState === 'processing' ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-3 h-3 border-2 border-[#888] border-t-white rounded-full"
              style={{ animation: 'spinner 0.8s linear infinite' }}
            />
          ) : (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`}
              style={{
                animation: currentState === 'recording' ? 'dot-pulse 1s ease-in-out infinite' : 'none',
              }}
            />
          )}
        </div>

        {/* Text */}
        <AnimatePresence mode="wait">
          <motion.span
            key={currentState}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="text-lg font-semibold text-white whitespace-nowrap"
          >
            {config.text}
            {currentState === 'done' && (
              <motion.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="ml-1"
              >
                ✓
              </motion.span>
            )}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
