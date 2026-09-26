import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { CLASSIFICATION_CATEGORY_LABELS, isClassificationCategory } from '../processingEnums';

const STYLES: Record<string, string> = {
  Reusable: 'bg-mint-100 text-mint-800',
  LocalRecyclable: 'bg-teal-100 text-teal-800',
  Hazardous: 'bg-red-100 text-red-800',
  ExportOnly: 'bg-violet-100 text-violet-800',
};

interface CategoryBadgeProps {
  /** The classification category as the API returns it; null/undefined means not yet classified. */
  category: string | null | undefined;
  className?: string;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, className = '' }) => {
  if (!category) {
    return (
      <span className={`inline-flex items-center rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600 ${className}`}>
        Unclassified
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        STYLES[category] ?? 'bg-ink-100 text-ink-800'
      } ${className}`}
    >
      {category === 'Hazardous' && <ShieldAlert size={12} />}
      {isClassificationCategory(category) ? CLASSIFICATION_CATEGORY_LABELS[category] : category}
    </span>
  );
};

export default CategoryBadge;
