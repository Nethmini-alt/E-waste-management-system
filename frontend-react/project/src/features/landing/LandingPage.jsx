/* eslint-disable no-unused-vars */
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import Hero3D from '../../components/Hero3D';
import GlassCard from '../../components/GlassCard';
import PublicNav from '../../components/PublicNav';
import SiteFooter from '../../components/SiteFooter';

import dumpImg from '../../assets/ewaste/ewaste-dump.jpg';
import recyclingSceneImg from '../../assets/ewaste/recycling-scene.jpg';
import shreddedImg from '../../assets/ewaste/shredded-ewaste.jpg';
import copperImg from '../../assets/ewaste/recovered-copper.jpg';
import mountainImg from '../../assets/ewaste/ewaste-mountain.jpg';

const trustPoints = ['AI-assisted intake', 'Doorstep pickup', 'Hazard-aware processing', 'Verified buyers'];

const hazards = [
  { title: 'Poisons soil & water', desc: 'Lead, mercury and cadmium leach out of dumped electronics into the ground and groundwater.' },
  { title: 'Toxic air', desc: 'Burning e-waste to salvage metal releases toxic fumes into nearby communities.' },
  { title: 'Lost resources', desc: 'Copper, gold and aluminium that could be recovered are buried and wasted instead.' },
];

const journey = [
  { title: 'Submit', desc: 'Describe your device and add a photo. Our AI reads back its category, hazard level and estimated value in seconds.' },
  { title: 'Review & schedule', desc: 'Flagged items get a quick staff review; everything else is scheduled straight into a collection job.' },
  { title: 'Collect', desc: 'A collector picks it up from your door, guided by our dedicated collector app.' },
  { title: 'Recover & resell', desc: 'The warehouse dismantles and sorts it; recovered materials are sold to verified buyers — never to landfill.' },
];

const whyUs = [
  { title: 'AI-assisted intake', desc: 'Every submission gets an automatic category, hazard and value read — no manual triage queue.' },
  { title: 'Reviewed, not rubber-stamped', desc: 'Anything the AI flags is checked by a person before it moves forward.' },
  { title: 'Verified buyers', desc: 'Recovered materials go to vetted buyers at transparent, admin-approved prices.' },
  { title: 'A real collector network', desc: 'Collectors run pickups from a dedicated app — GPS, navigation and proof of collection built in.' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
};

const inView = (i = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { delay: 0.07 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
});

const Eyebrow = ({ children, tone = 'text-mint-700' }) => (
  <p className={`mb-3 font-mono text-xs uppercase tracking-[0.25em] ${tone}`}>{children}</p>
);

export const LandingPage = () => (
  <div className="relative min-h-screen overflow-hidden">
    <div className="circuit-bg" />
    <PublicNav />

    {/* Hero */}
    <section className="relative isolate flex min-h-screen flex-col pt-28 pb-10">
      <div className="absolute inset-0 -z-[1]">
        <Hero3D density="full" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.div initial="hidden" animate="show" custom={0} variants={fadeUp}
          className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-500" />
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-mint-800 md:text-sm">
            Electronic Waste Management System
          </span>
        </motion.div>

        <motion.h1 initial="hidden" animate="show" custom={1} variants={fadeUp}
          className="max-w-4xl font-display text-5xl font-extrabold leading-[1.05] text-ink-900 md:text-7xl"
        >
          Turn e-waste into{' '}
          <span className="bg-gradient-to-r from-mint-500 to-mint-700 bg-clip-text text-transparent">recovered value</span>.
        </motion.h1>

        <motion.p initial="hidden" animate="show" custom={2} variants={fadeUp}
          className="mt-6 max-w-2xl text-lg text-ink-600 md:text-xl"
        >
          Collect, process, submit and sell recovered materials — all in one platform,
          from the first pickup to the export order.
        </motion.p>

        <motion.div initial="hidden" animate="show" custom={3} variants={fadeUp}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Link to="/register" className="btn-glass flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold md:text-base">
            Create an account <ArrowRight size={17} />
          </Link>
          <Link to="/impact" className="btn-glass-light flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold md:text-base">
            Why e-waste matters <ArrowUpRight size={17} />
          </Link>
        </motion.div>

        <motion.div initial="hidden" animate="show" custom={4} variants={fadeUp}
          className="glass mt-12 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-full px-6 py-2.5 text-xs font-semibold text-ink-800 md:text-sm"
        >
          {trustPoints.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <span className="hidden h-1 w-1 rounded-full bg-mint-400 sm:block" />}
              <span>{label}</span>
            </React.Fragment>
          ))}
        </motion.div>
      </div>

      <a href="#the-problem" aria-label="Scroll down"
        className="relative z-10 mx-auto mt-6 flex h-10 w-10 items-center justify-center rounded-full text-mint-700 motion-safe:animate-bounce"
      >
        <ChevronDown size={22} />
      </a>
    </section>

    {/* The problem */}
    <section id="the-problem" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-20 md:px-12">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <motion.div {...inView()} className="glass overflow-hidden rounded-3xl p-2">
          <img
            src={dumpImg}
            alt="A dump of discarded monitors, keyboards, cables and circuit boards"
            className="h-72 w-full rounded-[1.25rem] object-cover md:h-96"
            loading="lazy"
          />
        </motion.div>

        <motion.div {...inView(1)}>
          <Eyebrow tone="text-red-600">The problem</Eyebrow>
          <h2 className="mb-4 font-display text-3xl font-bold text-ink-900 md:text-4xl">
            This is where unmanaged e-waste ends up.
          </h2>
          <p className="mb-7 leading-relaxed text-ink-600">
            E-waste is one of the fastest-growing waste streams in the world. Dumped instead of
            recovered, it stops being clutter and starts being a hazard.
          </p>
          <div className="mb-7 flex flex-col gap-3">
            {hazards.map(({ title, desc }, i) => (
              <GlassCard key={title} hover={false} className="flex gap-4 p-4">
                <span className="font-display text-2xl font-extrabold leading-none text-red-500/80">0{i + 1}</span>
                <div>
                  <h4 className="font-display font-bold text-ink-900">{title}</h4>
                  <p className="text-sm leading-relaxed text-ink-600">{desc}</p>
                </div>
              </GlassCard>
            ))}
          </div>
          <Link to="/impact" className="inline-flex items-center gap-1.5 font-semibold text-mint-700 hover:underline">
            See the full environmental impact <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
    </section>

    {/* How it works */}
    <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-20 md:px-12">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
        <motion.div {...inView()} className="order-2 lg:order-1">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mb-8 font-display text-3xl font-bold text-ink-900 md:text-4xl">
            From your doorstep to resale, in four steps.
          </h2>
          <GlassCard hover={false} className="p-2">
            <ol className="divide-y divide-mint-100/70">
              {journey.map(({ title, desc }, i) => (
                <li key={title} className="flex gap-5 p-5">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 to-mint-700 font-display text-sm font-bold text-white shadow-md shadow-mint-500/30">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
                    <p className="text-sm leading-relaxed text-ink-600">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </GlassCard>
        </motion.div>

        <motion.div {...inView(1)} className="glass order-1 overflow-hidden rounded-3xl p-2 lg:order-2">
          <img
            src={recyclingSceneImg}
            alt="Illustration of a recycling bin full of electronics, with a collection truck, a worker and a recycling plant"
            className="h-80 w-full rounded-[1.25rem] object-cover object-center md:h-[34rem]"
            loading="lazy"
          />
        </motion.div>
      </div>
    </section>

    {/* What we recover */}
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-20 md:px-12">
      <motion.div {...inView()} className="mx-auto mb-12 max-w-2xl text-center">
        <Eyebrow>What happens to it</Eyebrow>
        <h2 className="font-display text-3xl font-bold text-ink-900 md:text-4xl">
          From scrap, back to raw material.
        </h2>
        <p className="mt-3 text-ink-600">
          Every collected item is dismantled, sorted and recovered — so the metals inside go back into the supply chain.
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {[
          { img: shreddedImg, alt: 'Piles of shredded circuit boards at a recycling yard', step: 'Dismantle & sort', text: 'Devices are broken down and separated by material, with hazardous parts handled on their own.' },
          { img: copperImg, alt: 'Copper granules recovered from e-waste', step: 'Recover', text: 'Copper, aluminium and other metals are recovered, safety-validated and priced for verified buyers.' },
        ].map(({ img, alt, step, text }, i) => (
          <GlassCard key={step} className="overflow-hidden p-2" {...inView(i)}>
            <img src={img} alt={alt} className="h-64 w-full rounded-[1.25rem] object-cover" loading="lazy" />
            <div className="p-5">
              <h3 className="mb-1.5 font-display text-xl font-bold text-ink-900">{step}</h3>
              <p className="text-sm leading-relaxed text-ink-600">{text}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>

    {/* Why us */}
    <section id="why-us" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-20 md:px-12">
      <motion.div {...inView()} className="mx-auto mb-12 max-w-2xl text-center">
        <Eyebrow>Why this platform</Eyebrow>
        <h2 className="font-display text-3xl font-bold text-ink-900 md:text-4xl">
          Built to keep e-waste out of landfill, <span className="text-mint-600">not just off your desk</span>.
        </h2>
      </motion.div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {whyUs.map(({ title, desc }, i) => (
          <GlassCard key={title} className="relative overflow-hidden p-6 pt-7" {...inView(i)}>
            <span className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-gradient-to-r from-mint-400 to-mint-700" />
            <h4 className="mb-2 font-display text-lg font-bold text-ink-900">{title}</h4>
            <p className="text-sm leading-relaxed text-ink-600">{desc}</p>
          </GlassCard>
        ))}
      </div>
    </section>

    {/* Final CTA */}
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-8 md:px-12">
      <GlassCard hover={false} className="overflow-hidden p-2" {...inView()}>
        <div className="grid items-center lg:grid-cols-[1.1fr_1fr]">
          <div className="p-8 md:p-12">
            <Eyebrow>Get started</Eyebrow>
            <h2 className="mb-4 font-display text-3xl font-bold text-ink-900 md:text-4xl">
              Don't let yours end up in the pile.
            </h2>
            <p className="mb-8 max-w-md text-ink-600">
              Create an account and submit your first item — pickup and tracking start right away.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/register" className="btn-glass flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold">
                Create an account <ArrowRight size={16} />
              </Link>
              <Link to="/register/buyer" className="btn-glass-light flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold">
                Register as a buyer
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center rounded-[1.25rem] bg-white p-6">
            <img
              src={mountainImg}
              alt="Illustration of a towering pile of discarded electronics"
              className="h-64 w-auto object-contain md:h-80"
              loading="lazy"
            />
          </div>
        </div>
      </GlassCard>
    </section>

    <SiteFooter />
  </div>
);

export default LandingPage;
