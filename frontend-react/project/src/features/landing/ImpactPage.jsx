/* eslint-disable no-unused-vars */
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import PublicNav from '../../components/PublicNav';
import SiteFooter from '../../components/SiteFooter';
import GlassCard from '../../components/GlassCard';

import earthImg from '../../assets/ewaste/earth-on-ewaste.jpg';
import recycleBinImg from '../../assets/ewaste/recycle-bin.jpg';
import shreddedImg from '../../assets/ewaste/shredded-ewaste.jpg';
import copperImg from '../../assets/ewaste/recovered-copper.jpg';

const categories = [
  { title: 'Home & office', examples: ['LCD TVs & monitors', 'Printers & scanners', 'Phones, laptops & chargers', 'LED lamps', 'UPS batteries', 'Network equipment'] },
  { title: 'Automobile', examples: ['EV & hybrid batteries', 'LED headlights', 'Dashboard electronics', 'Sensors & alternators'] },
  { title: 'Industrial', examples: ['Inverters & VFDs', 'CNC machines', 'Solar power equipment', 'Switches & relays'] },
  { title: 'Medical', examples: ['Ventilators & insulin pumps', 'X-ray & CT equipment', 'Glucometers', 'Hearing aids'] },
];

const hazards = [
  { title: 'Soil & water contamination', desc: 'Lead, mercury and cadmium leach out of dumped electronics and into groundwater and soil.' },
  { title: 'Toxic fumes', desc: 'Informal burning to recover metals releases brominated and chlorinated toxins into the air.' },
  { title: 'Health risks', desc: 'Long-term exposure to e-waste toxins is linked to neurological, respiratory and developmental harm.' },
];

const steps = [
  { title: 'You submit', desc: 'Describe the item and its condition. Our AI reads back a category and hazard level, and flags anything that needs a human look.' },
  { title: 'We collect', desc: 'Approved submissions become a collection job. A collector — using a dedicated app with GPS and navigation — picks it up from you.' },
  { title: 'We dismantle & classify', desc: 'In the warehouse, items are sorted, dismantled and classified by material, with hazardous components handled separately.' },
  { title: 'Materials are recovered', desc: 'Once safety-validated, recovered materials are priced and sold to verified buyers — kept in the supply chain instead of a landfill.' },
];

const inView = (i = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { delay: 0.07 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
});

const Eyebrow = ({ children, tone = 'text-mint-700' }) => (
  <p className={`mb-3 font-mono text-xs uppercase tracking-[0.25em] ${tone}`}>{children}</p>
);

export const ImpactPage = () => (
  <div className="relative min-h-screen overflow-hidden">
    <div className="circuit-bg" />
    <PublicNav />

    {/* Header */}
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-32 md:px-12">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <Eyebrow>Environmental impact</Eyebrow>
          <h1 className="mb-5 font-display text-4xl font-extrabold leading-tight text-ink-900 md:text-6xl">
            E-waste doesn't disappear when you throw it away.
          </h1>
          <p className="text-lg text-ink-600">
            It's one of the fastest-growing waste streams in the world. Here's what counts as e-waste,
            why it's dangerous when it's mishandled, and how we collect, dismantle and recover it safely instead.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1 }}
          className="glass overflow-hidden rounded-3xl p-2"
        >
          <img src={earthImg} alt="The Earth sitting on a heap of discarded electronics" className="h-72 w-full rounded-[1.25rem] object-cover md:h-96" />
        </motion.div>
      </div>
    </section>

    {/* What counts as e-waste */}
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-12">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
        <motion.div {...inView()} className="glass rounded-3xl p-2">
          <div className="flex items-center justify-center rounded-[1.25rem] bg-white p-6">
            <img src={recycleBinImg} alt="Illustration of old electronics going into a recycling bin" className="h-72 w-auto object-contain md:h-96" loading="lazy" />
          </div>
        </motion.div>

        <div>
          <motion.div {...inView()}>
            <Eyebrow>What counts as e-waste?</Eyebrow>
            <h2 className="mb-3 font-display text-3xl font-bold text-ink-900 md:text-4xl">
              Almost anything with a circuit, a battery or a plug.
            </h2>
            <p className="mb-7 text-ink-600">These are just some examples — not an exhaustive list.</p>
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2">
            {categories.map(({ title, examples }, i) => (
              <GlassCard key={title} className="relative overflow-hidden p-5 pt-6" {...inView(i)}>
                <span className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-gradient-to-r from-mint-400 to-mint-700" />
                <h3 className="mb-3 font-display font-bold text-ink-900">{title}</h3>
                <ul className="flex flex-col gap-1.5 text-sm text-ink-700">
                  {examples.map((e) => (
                    <li key={e} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-mint-500" /> {e}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* Why it's dangerous */}
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-12">
      <motion.div {...inView()} className="mx-auto mb-10 max-w-2xl text-center">
        <Eyebrow tone="text-red-600">The danger</Eyebrow>
        <h2 className="mb-3 font-display text-3xl font-bold text-ink-900 md:text-4xl">Why it's dangerous, released untreated</h2>
        <p className="text-ink-600">
          A dumped phone or broken monitor looks inert. It isn't — circuit boards, batteries and display panels
          contain heavy metals and flame retardants that stay in the environment for decades.
        </p>
      </motion.div>
      <div className="grid gap-5 md:grid-cols-3">
        {hazards.map(({ title, desc }, i) => (
          <GlassCard key={title} className="p-6" {...inView(i)}>
            <span className="mb-3 block font-display text-4xl font-extrabold text-red-500/80">0{i + 1}</span>
            <h4 className="mb-2 font-display text-lg font-bold text-ink-900">{title}</h4>
            <p className="text-sm leading-relaxed text-ink-600">{desc}</p>
          </GlassCard>
        ))}
      </div>
    </section>

    {/* How we handle it */}
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-12">
      <motion.div {...inView()} className="mx-auto mb-10 max-w-2xl text-center">
        <Eyebrow>How we handle it</Eyebrow>
        <h2 className="mb-3 font-display text-3xl font-bold text-ink-900 md:text-4xl">Collected, dismantled and recovered — safely.</h2>
        <p className="text-ink-600">Every item follows the same tracked, hazard-aware pipeline.</p>
      </motion.div>

      <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(({ title, desc }, i) => (
          <GlassCard key={title} className="p-6" {...inView(i)}>
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 to-mint-700 font-display text-sm font-bold text-white shadow-md shadow-mint-500/30">
              {i + 1}
            </span>
            <h3 className="mb-1.5 font-display font-bold text-ink-900">{title}</h3>
            <p className="text-sm leading-relaxed text-ink-600">{desc}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[
          { img: shreddedImg, alt: 'Piles of shredded circuit boards at a recycling yard', caption: 'Dismantled and sorted by material' },
          { img: copperImg, alt: 'Copper granules recovered from e-waste', caption: 'Recovered copper, ready to re-enter the supply chain' },
        ].map(({ img, alt, caption }, i) => (
          <GlassCard key={caption} hover={false} className="overflow-hidden p-2" {...inView(i)}>
            <img src={img} alt={alt} className="h-64 w-full rounded-[1.25rem] object-cover" loading="lazy" />
            <p className="px-4 py-3 text-sm font-semibold text-ink-800">{caption}</p>
          </GlassCard>
        ))}
      </div>
    </section>

    {/* Closing */}
    <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-8 md:px-12">
      <GlassCard hover={false} className="p-10 text-center md:p-14" {...inView()}>
        <h2 className="mb-3 font-display text-3xl font-bold text-ink-900 md:text-4xl">
          Every item you submit is one less thing in a landfill.
        </h2>
        <p className="mx-auto mb-8 max-w-md text-ink-600">
          Submit e-waste for pickup, or register as a buyer to give recovered materials a second life.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className="btn-glass flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold">
            Create an account <ArrowRight size={16} />
          </Link>
          <Link to="/welcome" className="btn-glass-light flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold">
            Back to home
          </Link>
        </div>
      </GlassCard>
    </section>

    <SiteFooter />
  </div>
);

export default ImpactPage;
