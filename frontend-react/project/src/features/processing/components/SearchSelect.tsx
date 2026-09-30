import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { inputClass } from './ui';

export interface SearchOption {
  value: string;
  label: string;
  /** Shown in smaller text next to the label (e.g. a vehicle type). */
  hint?: string;
}

interface SearchSelectProps {
  id?: string;
  value: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
}

// Words that start with what was typed come first, then any other match.
const rank = (label: string, q: string): number => {
  const l = label.toLowerCase();
  if (l.startsWith(q)) return 0;
  if (l.split(/[\s\-/]+/).some((w) => w.startsWith(q))) return 1;
  return l.includes(q) ? 2 : -1;
};

/**
 * Type-ahead picker: nothing is listed until the user types, then the matching names appear.
 * Only a value from the list can be chosen.
 */
export const SearchSelect: React.FC<SearchSelectProps> = ({
  id,
  value,
  options,
  onChange,
  placeholder = 'Start typing…',
  disabled = false,
  emptyText = 'No matches',
}) => {
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? null;
  const [text, setText] = useState(selected?.label ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const clearedByTyping = useRef(false);

  // Keep the box in step when the value is changed from outside (reset, pre-selection), but not
  // when typing itself just cleared the previous choice.
  useEffect(() => {
    if (clearedByTyping.current) {
      clearedByTyping.current = false;
      return;
    }
    setText(selected?.label ?? '');
  }, [value, selected?.label]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setText(selected?.label ?? '');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [selected?.label]);

  const q = text.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q || (selected && text === selected.label)) return [];
    return options
      .map((o) => ({ o, r: rank(o.label, q) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r || a.o.label.localeCompare(b.o.label))
      .slice(0, 12)
      .map((x) => x.o);
  }, [options, q, text, selected]);

  const choose = (o: SearchOption) => {
    onChange(o.value);
    setText(o.label);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open && q.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
          if (value) {
            clearedByTyping.current = true;
            onChange('');
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={`${inputClass} pr-9`}
      />
      {value && !disabled ? (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => {
            onChange('');
            setText('');
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-600 hover:text-ink-900"
        >
          <X size={14} />
        </button>
      ) : (
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-600" />
      )}

      {open && q.length > 0 && !(selected && text === selected.label) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-mint-100 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3.5 py-2 text-sm text-ink-600">{emptyText}</li>
          ) : (
            matches.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3.5 py-2 text-sm ${i === active ? 'bg-mint-50 text-ink-900' : 'text-ink-800'}`}
              >
                <span className="font-medium">{o.label}</span>
                {o.hint && <span className="ml-2 text-xs text-ink-600">{o.hint}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchSelect;
