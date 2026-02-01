'use client';

import { motion } from 'framer-motion';

export default function HeroGradientArc() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Main gradient arc - blue/teal themed */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        {/* Outer glow layer */}
        <div 
          className="absolute -inset-20 blur-3xl opacity-40"
          style={{
            background: 'radial-gradient(ellipse 100% 100% at 50% 50%, rgba(0, 200, 200, 0.3) 0%, transparent 70%)',
          }}
        />
        
        {/* The arc/ring */}
        <div 
          className="relative w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full"
          style={{
            background: `
              conic-gradient(
                from 180deg at 50% 50%,
                rgba(0, 180, 216, 0) 0deg,
                rgba(0, 180, 216, 0.4) 60deg,
                rgba(0, 200, 200, 0.6) 120deg,
                rgba(72, 202, 228, 0.8) 180deg,
                rgba(0, 200, 200, 0.6) 240deg,
                rgba(0, 180, 216, 0.4) 300deg,
                rgba(0, 180, 216, 0) 360deg
              )
            `,
            mask: 'radial-gradient(ellipse 50% 50% at 50% 50%, transparent 60%, black 61%, black 100%)',
            WebkitMask: 'radial-gradient(ellipse 50% 50% at 50% 50%, transparent 60%, black 61%, black 100%)',
          }}
        />
        
        {/* Inner subtle glow */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(ellipse 40% 40% at 50% 50%, rgba(0, 180, 216, 0.1) 0%, transparent 70%)',
          }}
        />
      </motion.div>

      {/* Accent glow - top left */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(0, 150, 180, 0.15) 0%, transparent 60%)',
        }}
      />

      {/* Accent glow - bottom right */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.7 }}
        className="absolute -bottom-[10%] -right-[10%] w-[400px] h-[400px] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(72, 202, 228, 0.12) 0%, transparent 60%)',
        }}
      />
    </div>
  );
}
