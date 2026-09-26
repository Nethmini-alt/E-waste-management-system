import React from 'react';
import { Check } from 'lucide-react';
import { INVENTORY_STATUS_LABELS, type InventoryStatus } from '../processingEnums';

// Position of each status along the happy path. The three terminal outcomes share the last slot.
const STEP_INDEX: Record<InventoryStatus, number> = {
  Received: 0,
  Sorting: 1,
  Dismantling: 2,
  Classified: 3,
  ReadyForSale: 4,
  ExportOnly: 4,
  OnHold: 4,
};

const isOutcome = (s: InventoryStatus) => STEP_INDEX[s] === 4;

interface StatusStepperProps {
  status: InventoryStatus;
}

/** Read-only progress strip: Received → Sorting → Dismantling → Classified → outcome. */
export const StatusStepper: React.FC<StatusStepperProps> = ({ status }) => {
  const current = STEP_INDEX[status];
  const steps: { key: string; label: string }[] = [
    { key: 'Received', label: 'Received' },
    { key: 'Sorting', label: 'Sorting' },
    { key: 'Dismantling', label: 'Dismantling' },
    { key: 'Classified', label: 'Classified' },
    { key: 'Outcome', label: isOutcome(status) ? INVENTORY_STATUS_LABELS[status] : 'Outcome' },
  ];

  return (
    <ol className="flex items-center" aria-label="Processing progress">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const bad = active && status === 'OnHold';
        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition',
                  bad
                    ? 'bg-red-600 text-white shadow-md shadow-red-500/30'
                    : done
                      ? 'bg-mint-600 text-white'
                      : active
                        ? 'bg-mint-600 text-white ring-4 ring-mint-200'
                        : 'bg-ink-100 text-ink-600',
                ].join(' ')}
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
              <span className={`whitespace-nowrap text-[10px] font-mono uppercase tracking-wide ${active ? 'font-bold text-ink-900' : 'text-ink-600'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && <span className={`mx-1 mb-4 h-0.5 flex-1 rounded ${i < current ? 'bg-mint-600' : 'bg-ink-100'}`} />}
          </li>
        );
      })}
    </ol>
  );
};

export default StatusStepper;
