/* eslint-disable no-unused-vars */
import React from 'react';
import { motion } from 'framer-motion';

/**
 * Reusable "liquid glass" surface: frosted, blurred, animated sheen
 * (via the .glass class in theme.css) plus a Framer Motion hover lift.
 * Pass any Tailwind classes via `className` for padding/layout.
 */
export const GlassCard = ({ children, className = '', hover = true, as: Tag = 'div', ...rest }) => {
  const MotionTag = motion[Tag] || motion.div;
  return (
    <MotionTag
      className={`glass rounded-3xl ${className}`}
      whileHover={hover ? { y: -6, scale: 1.015, boxShadow: '0 24px 50px -14px rgba(5,150,105,0.3)' } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
};

export default GlassCard;
