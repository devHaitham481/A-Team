'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const tools = [
  { 
    name: 'ChatGPT', 
    logo: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/openai.png',
  },
  { 
    name: 'Claude', 
    logo: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/anthropic.png',
  },
  { 
    name: 'Gemini', 
    logo: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/gemini-color.png',
  },
  { 
    name: 'Cursor', 
    logo: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/cursor.png',
  },
  { 
    name: 'Perplexity', 
    logo: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/perplexity-color.png',
  },
];

export default function WorksWith() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="py-20 border-y border-[rgba(255,255,255,0.03)]"
    >
      <div className="max-w-5xl mx-auto px-6">
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-[11px] uppercase tracking-[0.4em] text-[#444] mb-10"
        >
          Works with any AI tool
        </motion.p>
        <div className="flex flex-wrap items-center justify-center gap-10 md:gap-14">
          {tools.map((tool, i) => (
            <motion.div
              key={tool.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -2, opacity: 1 }}
              className="flex items-center gap-3 opacity-60 hover:opacity-100 transition-all cursor-default group"
            >
              <div className="relative w-6 h-6">
                <Image
                  src={tool.logo}
                  alt={`${tool.name} logo`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <span className="text-sm font-medium text-[#888] group-hover:text-white transition-colors tracking-wide">
                {tool.name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
