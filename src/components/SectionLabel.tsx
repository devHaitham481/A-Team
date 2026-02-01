'use client';

import { motion } from 'framer-motion';

interface SectionLabelProps {
  children: React.ReactNode;
  color?: 'red' | 'green' | 'blue';
}

const colorMap = {
  red: 'text-[#ff3b30]',
  green: 'text-[#34c759]',
  blue: 'text-[#00b4d8]',
};

export default function SectionLabel({ children, color = 'blue' }: SectionLabelProps) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`
        inline-block text-xs font-semibold uppercase tracking-[0.25em]
        ${colorMap[color]}
      `}
    >
      {children}
    </motion.span>
  );
}
