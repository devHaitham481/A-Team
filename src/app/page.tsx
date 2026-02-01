'use client';

import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import GradientOrbs from '@/components/GradientOrbs';
import WaitlistForm from '@/components/WaitlistForm';
import SectionLabel from '@/components/SectionLabel';
import Stats from '@/components/Stats';
import WorksWith from '@/components/WorksWith';
import HeroVisual from '@/components/HeroVisual';
import HeroGradientArc from '@/components/HeroGradientArc';
import WordWorth from '@/components/WordWorth';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function Home() {
  return (
    <main className="relative min-h-screen">
      {/* Background elements */}
      <GradientOrbs />
      <div className="grain" />

      {/* Navigation */}
      <Navigation />

      {/* Hero Section - Centered with gradient arc */}
      <section id="waitlist" className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 overflow-hidden">
        {/* Gradient Arc Background */}
        <HeroGradientArc />

        <motion.div
          initial="initial"
          animate="animate"
          variants={stagger}
          className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto"
        >
          {/* Prominent tagline */}
          <motion.div
            variants={fadeInUp}
            className="mb-6"
          >
            <span className="text-lg md:text-xl font-medium text-[#48cae4] tracking-wide">
              Screen Recording for AI
            </span>
          </motion.div>

          {/* Main headline - "dip" in display font */}
          <motion.h1
            variants={fadeInUp}
            className="font-display text-[clamp(6rem,20vw,14rem)] font-extrabold leading-[0.85] tracking-tight mb-6"
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            dip
          </motion.h1>

          {/* Tagline */}
          <motion.p
            variants={fadeInUp}
            className="text-xl md:text-2xl text-[#999] max-w-lg mb-3 leading-relaxed"
          >
            Show AI what you mean.
          </motion.p>

          {/* Subheadline */}
          <motion.p
            variants={fadeInUp}
            className="text-base md:text-lg text-[#555] max-w-md mb-10 leading-relaxed"
          >
            Record once. Paste forever. AI finally gets it.
          </motion.p>

          {/* Waitlist form */}
          <motion.div variants={fadeInUp} className="w-full max-w-md">
            <WaitlistForm />
          </motion.div>

          {/* Micro-copy - removed macOS */}
          <motion.p
            variants={fadeInUp}
            className="text-sm text-[#444] mt-5"
          >
            Free during beta
          </motion.p>

          {/* Stats */}
          <Stats />
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 rounded-full border-2 border-[#222] flex items-start justify-center p-2"
          >
            <motion.div className="w-1 h-2 bg-[#444] rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* Works With Section */}
      <WorksWith />

      {/* Problem Section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-32">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto text-center"
        >
          <SectionLabel color="blue">The Problem</SectionLabel>

          <h2 className="text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-tight mt-6 mb-8">
            You&apos;re chatting with AI and think<br />
            <span className="text-[#48cae4]">&quot;If you could just see what I&apos;m doing...&quot;</span>
          </h2>

          <p className="text-xl md:text-2xl text-[#888] leading-relaxed">
            So you screenshot. Describe. Type paragraphs.<br />
            <span className="italic text-[#48cae4]/60">AI still doesn&apos;t get it.</span>
          </p>
        </motion.div>
      </section>

      {/* Solution Section - Now with the app mockup */}
      <section id="how-it-works" className="min-h-screen flex flex-col items-center justify-center px-6 py-32">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto"
        >
          <div className="text-center mb-16">
            <SectionLabel color="green">The Solution</SectionLabel>

            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-[clamp(2.5rem,8vw,5rem)] font-bold leading-[1.1] mt-6 mb-6"
            >
              Now it can see.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-xl text-[#666] max-w-xl mx-auto"
            >
              Three steps. Ten seconds. Done.
            </motion.p>
          </div>

          {/* App mockup + Steps in 2 columns */}
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - App Visual */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <HeroVisual />
            </motion.div>

            {/* Right - Steps */}
            <div className="space-y-8">
              {[
                { num: '01', title: 'Record', desc: 'Hit the shortcut. Do your thing on screen. Dip captures everything.' },
                { num: '02', title: 'Process', desc: 'AI watches your recording and understands the context instantly.' },
                { num: '03', title: 'Paste', desc: 'Context is on your clipboard. Paste it anywhere. AI gets it.' },
              ].map((step, i) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                  className="flex gap-6 items-start"
                >
                  <span className="text-sm font-mono text-[#00b4d8] bg-[rgba(0,180,216,0.1)] px-3 py-1 rounded-full">
                    {step.num}
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                    <p className="text-[#888] leading-relaxed">{step.desc}</p>
                  </div>
                </motion.div>
              ))}

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="text-2xl md:text-3xl font-bold text-[#00b4d8] pt-4"
              >
                Do. Dip. Done.
              </motion.p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Before/After Section */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Before Card */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              whileHover={{ borderColor: 'rgba(255, 255, 255, 0.15)' }}
              className="p-8 md:p-10 rounded-3xl bg-gradient-to-br from-[rgba(255,255,255,0.03)] to-transparent border border-[rgba(255,255,255,0.06)] transition-colors duration-300"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#666]">
                Before
              </span>
              <p className="mt-6 font-mono text-sm md:text-base text-[#666] leading-relaxed">
                &quot;So I have this spreadsheet, and column B has dates, and I clicked the filter dropdown, then selected &apos;Last 7 days&apos;, and then I exported it by going to File → Export → CSV →...&quot;
              </p>
            </motion.div>

            {/* After Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ borderColor: 'rgba(0, 180, 216, 0.3)' }}
              className="p-8 md:p-10 rounded-3xl bg-gradient-to-br from-[rgba(0,180,216,0.05)] to-transparent border border-[rgba(0,180,216,0.1)] transition-colors duration-300"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00b4d8]">
                After
              </span>
              <div className="mt-6">
                <p className="text-sm text-[#555] italic mb-4">*pastes*</p>
                <p className="text-2xl md:text-3xl font-bold text-white">
                  &quot;Do this for me.&quot;
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Word Worth Section - The clever "picture = 1000 words" concept */}
      <WordWorth />

      {/* Final CTA Section */}
      <section className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-[clamp(2.5rem,8vw,5rem)] font-bold leading-[0.95] mb-6">
            Ready to stop explaining?
          </h2>
          <p className="text-xl text-[#888] mb-12">
            Get early access. Be first to dip.
          </p>
          <WaitlistForm />
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[rgba(255,255,255,0.04)]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#555]">
            <span className="font-display font-semibold text-[#888]">dip</span>
            <span className="mx-3 text-[#333]">•</span>
            Stop explaining. Start dipping.
          </p>
          <p className="text-sm text-[#333]">
            © 2026
          </p>
        </div>
      </footer>
    </main>
  );
}
