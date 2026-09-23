/* eslint-disable no-unused-vars */
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Truck, Recycle, Send, Package, ArrowRight, LogIn, UserPlus, Building2,
} from 'lucide-react';
import Hero3D from '../../components/Hero3D';
import GlassCard from '../../components/GlassCard';

const components = [
  { icon: Truck, title: 'Collection', desc: 'Pickup scheduling and drop-off tracking for households, corporates and collectors.', locked: true },
  { icon: Recycle, title: 'Processing', desc: 'Sorting, dismantling and material recovery workflows on the collected e-waste.', locked: true },
  { icon: Send, title: 'Submission', desc: 'Submit items for recovery and have staff review and approve each submission.' },
  { icon: Package, title: 'Sales', desc: 'Price recovered materials, manage buyers, sales & export orders, and revenue.' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export const LandingPage = () => (
  <div className="relative min-h-screen overflow-hidden">
    <div className="circuit-bg" />

    {/* Hero */}
    <section className="relative isolate min-h-[92vh] flex flex-col">
      <div className="absolute inset-0 -z-[1]">
        <Hero3D density="full" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2 font-display font-bold text-ink-900">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-mint-400 to-mint-700 flex items-center justify-center text-white text-sm shadow-lg shadow-mint-500/30">♻</div>
          E-Waste<span className="text-mint-600">.</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/login" className="btn-glass-light px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5">
            <LogIn size={14} /> Sign in
          </Link>
          <Link to="/register" className="btn-glass px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5">
            <UserPlus size={14} /> Get started
          </Link>
        </nav>
      </header>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
        <motion.p
          initial="hidden" animate="show" custom={0} variants={fadeUp}
          className="font-mono text-xs tracking-[0.25em] uppercase text-mint-700 mb-4"
        >
          Electronic Waste Management System
        </motion.p>
        <motion.h1
          initial="hidden" animate="show" custom={1} variants={fadeUp}
          className="font-display text-4xl md:text-6xl font-extrabold text-ink-900 max-w-3xl leading-tight"
        >
          Turn e-waste into <span className="text-mint-600">recovered value</span>.
        </motion.h1>
        <motion.p
          initial="hidden" animate="show" custom={2} variants={fadeUp}
          className="mt-5 text-ink-600 max-w-xl"
        >
          Collect, process, submit and sell recovered materials — all in one platform,
          from the first pickup to the export order.
        </motion.p>
        <motion.div
          initial="hidden" animate="show" custom={3} variants={fadeUp}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link to="/register" className="btn-glass px-6 py-3 rounded-full font-semibold text-sm flex items-center gap-2">
            Create an account <ArrowRight size={16} />
          </Link>
          <Link to="/register/buyer" className="btn-glass-light px-6 py-3 rounded-full font-semibold text-sm flex items-center gap-2">
            <Building2 size={16} /> Register as a buyer
          </Link>
        </motion.div>
      </div>
    </section>

    {/* Component overview */}
    <section className="relative z-10 px-6 md:px-12 py-16 max-w-6xl mx-auto">
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5 }}
        className="font-display text-2xl md:text-3xl font-bold text-center text-ink-900 mb-2"
      >
        One system, four components
      </motion.h2>
      <p className="text-center text-ink-600 text-sm mb-10">
        Built as a modular platform — each piece owned by a different part of the team.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {components.map(({ icon: Icon, title, desc, locked }, i) => (
          <GlassCard
            key={title}
            className="p-6"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: 0.06 * i, duration: 0.45 }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mint-400 to-mint-700 flex items-center justify-center text-white mb-4 shadow-md shadow-mint-500/30">
              <Icon size={18} />
            </div>
            <h3 className="font-display font-bold text-ink-900 mb-1.5 flex items-center gap-2">
              {title}
              {locked && <span className="text-[10px] font-mono uppercase text-ink-600/60 font-normal">soon</span>}
            </h3>
            <p className="text-sm text-ink-600 leading-relaxed">{desc}</p>
          </GlassCard>
        ))}
      </div>
    </section>

    <footer className="relative z-10 px-6 md:px-12 py-8 text-center text-xs text-ink-600 font-mono">
      ♻ E-Waste Management System
    </footer>
  </div>
);

export default LandingPage;
