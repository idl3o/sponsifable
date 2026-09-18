import { INTRODUCTORY_RATE } from '../domain/benchmarks';
import { hasResults } from '../domain/pricing';
import type { DealTerms, UsageRights } from '../domain/types';
import { useStore } from '../store/useStore';
import { NumberField, SelectField } from './ui/Primitives';

/**
 * The controls for the commercial terms, in one place.
 *
 * The rate card sets the creator's own terms; the offer evaluator sets the
 * ones a sponsor has asked for. They are the same fields with the same hints,
 * and a copy of them in each view would drift.
 */

const USAGE_OPTIONS: Array<{ value: UsageRights; label: string }> = [
  { value: 'organic-only', label: 'Organic only, my channel' },
  { value: 'whitelisting-30', label: 'Paid whitelisting, 30 days' },
  { value: 'whitelisting-90', label: 'Paid whitelisting, 90 days' },
  { value: 'full-buyout', label: 'Full buyout, anywhere, forever' },
];

const EXCLUSIVITY_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
];

/** The deal terms and the action that changes them, which every terms field needs. */
export interface TermsProps {
  terms: DealTerms;
  setTerms: (patch: Partial<DealTerms>) => void;
}

/** Usage rights, and the sponsor's declared paid spend when there is paid usage. */
export function UsageFields({ terms, setTerms }: TermsProps) {
  return (
    <>
      <SelectField
        label="Usage rights"
        value={terms.usageRights}
        options={USAGE_OPTIONS}
        onChange={(usageRights) => setTerms({ usageRights })}
        hint="If the sponsor can run paid spend behind your face, they are buying media, not a post. Paid usage is priced per 30 days, with a minimum however small your audience."
      />
      {terms.usageRights !== 'organic-only' && (
        <NumberField
          label="Sponsor's declared paid spend, GBP"
          value={terms.declaredSpend}
          onChange={(declaredSpend) => setTerms({ declaredSpend: Math.max(0, declaredSpend) })}
          step={500}
          hint="Ask what they plan to spend behind the asset. If they say, the fee scales with it; if not, leave it at nought."
        />
      )}
    </>
  );
}

/** The introductory rate, offered once and withdrawn by the first result on record. */
export function IntroductoryField({ terms, setTerms }: TermsProps) {
  const proven = useStore((s) => hasResults(s.profile));
  return (
    <SelectField
      label="Introductory rate"
      value={terms.introductory && !proven ? 'on' : 'off'}
      options={[
        { value: 'off', label: 'Standard rates' },
        { value: 'on', label: 'Introductory, until my first result' },
      ]}
      onChange={(value) => setTerms({ introductory: value === 'on' })}
      hint={
        proven
          ? 'You have a result on record, so the introductory rate no longer applies.'
          : `Once, knowingly: ${Math.round((1 - INTRODUCTORY_RATE.factor) * 100)}% off in exchange for permission to publish the results. Your first result is worth more than the fee.`
      }
    />
  );
}

/** Exclusivity, revisions, turnaround and volume. */
export function ScheduleFields({ terms, setTerms }: TermsProps) {
  return (
    <>
      <SelectField
        label="Category exclusivity"
        value={String(terms.exclusivityDays)}
        options={EXCLUSIVITY_OPTIONS}
        onChange={(value) => setTerms({ exclusivityDays: Number(value) as DealTerms['exclusivityDays'] })}
        hint="Every day you cannot take a competitor's money has a price."
      />
      <SelectField
        label="Revisions included"
        value={String(terms.revisions)}
        options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}` }))}
        onChange={(value) => setTerms({ revisions: Number(value) })}
      />
      <SelectField
        label="Turnaround"
        value={terms.rush ? 'rush' : 'normal'}
        options={[
          { value: 'normal', label: 'Standard schedule' },
          { value: 'rush', label: 'Rush, inside two weeks' },
        ]}
        onChange={(value) => setTerms({ rush: value === 'rush' })}
      />
      <SelectField
        label="Assets bought together"
        value={String(terms.bundleSize)}
        options={[1, 2, 3, 4, 6].map((n) => ({ value: String(n), label: `${n}` }))}
        onChange={(value) => setTerms({ bundleSize: Number(value) })}
        hint="Volume earns a discount, and a discount you offer is worth more than one you concede."
      />
    </>
  );
}
