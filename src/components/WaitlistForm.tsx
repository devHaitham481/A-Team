'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setStatus('error');
      setErrorMessage('Please enter a valid email');
      return;
    }

    setStatus('loading');

    // Simulate API call - replace with actual Supabase integration later
    await new Promise(resolve => setTimeout(resolve, 1000));
    setStatus('success');
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-full bg-[rgba(52,199,89,0.1)] border border-[rgba(52,199,89,0.2)]"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              className="text-[#34c759] text-xl"
            >
              ✓
            </motion.span>
            <span className="text-[#34c759] font-medium">You&apos;re in. We&apos;ll be in touch.</span>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'error') setStatus('idle');
                }}
                placeholder="you@email.com"
                disabled={status === 'loading'}
                className={`
                  w-full px-5 py-4 rounded-full
                  bg-[#111] border transition-all duration-200
                  text-white placeholder-[#555]
                  focus:outline-none focus:border-[rgba(255,255,255,0.2)]
                  disabled:opacity-50
                  ${status === 'error'
                    ? 'border-[rgba(255,59,48,0.5)]'
                    : 'border-[rgba(255,255,255,0.1)]'
                  }
                `}
              />
              <AnimatePresence>
                {status === 'error' && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute -bottom-6 left-5 text-sm text-[#ff3b30]"
                  >
                    {errorMessage}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <motion.button
              type="submit"
              disabled={status === 'loading'}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="
                px-6 py-4 rounded-full
                bg-white text-black font-semibold
                transition-opacity duration-200
                hover:opacity-90
                disabled:opacity-70
                flex items-center justify-center gap-2
                min-w-[140px]
              "
            >
              {status === 'loading' ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full"
                  style={{ animation: 'spinner 0.8s linear infinite' }}
                />
              ) : (
                'Get early access'
              )}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
