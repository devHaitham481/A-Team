'use client';

import { motion } from 'framer-motion';

const stats = [
  { value: '10s', label: 'Not 10 min typing' },
  { value: '5', label: 'Beta feedback', hasStar: true },
  { value: '1 dip', label: '= 10,000 words' },
];

export default function Stats() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.6 }}
      className="flex items-center justify-center gap-8 md:gap-14 mt-16"
    >
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }}
          className="text-center"
        >
          <div className="text-2xl md:text-3xl font-bold text-white flex items-center justify-center gap-1">
            {stat.value}
            {stat.hasStar && <span className="text-[#fbbf24]">★</span>}
          </div>
          <div className="text-xs md:text-sm text-[#555] mt-1">
            {stat.label}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
