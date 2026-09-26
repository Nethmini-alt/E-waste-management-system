import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds the standard inner padding. Turn off for cards that hold edge-to-edge tables. */
  padded?: boolean;
  /** Lifts slightly on hover — for cards that are clickable. */
  interactive?: boolean;
}

/**
 * Frosted "liquid glass" surface (the .glass class from theme.css). Deliberately static:
 * the Processing screens are data-heavy, so hover motion is opt-in.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  padded = true,
  interactive = false,
  className = '',
  children,
  ...rest
}) => (
  <div
    className={[
      'glass rounded-3xl',
      padded ? 'p-5' : '',
      interactive ? 'transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer' : '',
      className,
    ].join(' ')}
    {...rest}
  >
    {children}
  </div>
);

export default GlassCard;
