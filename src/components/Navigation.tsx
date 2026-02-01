'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`
        fixed top-0 left-0 right-0 z-50
        transition-all duration-300
        ${scrolled 
          ? 'bg-[rgba(3,3,3,0.8)] backdrop-blur-xl border-b border-[rgba(255,255,255,0.06)]' 
          : 'bg-transparent'
        }
      `}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <motion.a
          href="#"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="font-display text-2xl font-bold tracking-tight"
        >
          dip
        </motion.a>

        {/* Nav Links - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className="text-sm text-[#888] hover:text-white transition-colors">
            How it works
          </a>
          <a href="#features" className="text-sm text-[#888] hover:text-white transition-colors">
            Features
          </a>
        </div>

        {/* CTA Button */}
        <motion.a
          href="#waitlist"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="
            px-5 py-2.5 rounded-full text-sm font-medium
            bg-white text-black
            hover:bg-[#f0f0f0] transition-colors
          "
        >
          Join waitlist
        </motion.a>
      </div>
    </motion.nav>
  );
}
