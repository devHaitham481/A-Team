'use client';

import { motion } from 'framer-motion';

export default function GradientOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Very subtle ambient lighting - blue/teal tinted */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        className="absolute -top-[20%] right-[5%] w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 180, 216, 0.03) 0%, transparent 60%)',
          animation: 'float 30s ease-in-out infinite',
        }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.3 }}
        className="absolute top-[40%] -left-[10%] w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(72, 202, 228, 0.02) 0%, transparent 60%)',
          animation: 'float-slow 35s ease-in-out infinite',
        }}
      />

      {/* Subtle vignette */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 0%, rgba(0, 0, 0, 0.5) 100%)',
        }}
      />
    </div>
  );
}
