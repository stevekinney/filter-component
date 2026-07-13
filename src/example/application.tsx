import { useEffect, useRef, useState } from 'react';
import { Filter } from '@/components/filter/index.ts';
import type {
  FilterFieldDefinition,
  FilterGroup,
} from '@/components/filter/index.ts';
import { applyFilters } from '@/example/apply-filters.ts';
import {
  DEAL_FILTER_FIELDS,
  DEALS,
  INITIAL_FILTERS,
} from '@/example/records.ts';
import type { Deal } from '@/example/records.ts';
import '@/components/filter/filter-component.css';
import '@/example/example.css';

type LogEntry = {
  id: number;
  text: string;
  tone: 'neutral' | 'success';
};

/**
 * Test hooks: `?invalid` seeds a condition referencing a missing field,
 * `?narrowBoolean` limits Active to equality, and `?longLabel` injects an
 * unbroken field label. They let browser suites exercise injected-schema
 * behavior without adding demo-only controls.
 */
function initialFilterGroup(): FilterGroup {
  const hasInvalidFlag =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('invalid');
  if (!hasInvalidFlag) return INITIAL_FILTERS;
  return {
    ...INITIAL_FILTERS,
    conditions: [
      ...INITIAL_FILTERS.conditions,
      {
        fieldKey: 'owner',
        type: 'string',
        operator: 'contains',
        value: 'acme',
      },
    ],
  };
}

function exampleFilterFields(): readonly FilterFieldDefinition[] {
  const parameters = new URLSearchParams(window.location.search);
  const hasNarrowBooleanFlag = parameters.has('narrowBoolean');
  const hasLongLabelFlag = parameters.has('longLabel');
  if (!hasNarrowBooleanFlag && !hasLongLabelFlag) return DEAL_FILTER_FIELDS;
  return DEAL_FILTER_FIELDS.map((field) => {
    if (hasNarrowBooleanFlag && field.type === 'boolean') {
      return { ...field, operators: ['equals'] as const };
    }
    if (hasLongLabelFlag && field.key === 'name') {
      return {
        ...field,
        label: 'CustomerRelationshipLifecycleQualificationStatusWithoutBreaks',
      };
    }
    return field;
  });
}

/** "N of M deals" once results have arrived. */
function ResultCount({ filteredDeals }: { filteredDeals: Deal[] | null }) {
  if (!filteredDeals) return null;
  return (
    <span className="example-count">
      <strong>{filteredDeals.length}</strong> of <strong>{DEALS.length}</strong>{' '}
      deals
    </span>
  );
}

/** Pipeline-stage → color tone, echoing a colored CRM pipeline. */
const STAGE_TONES = {
  Lead: 'lead',
  Contacted: 'contacted',
  'Demo scheduled': 'demo',
  Negotiation: 'negotiation',
  'Closed won': 'won',
  'Closed lost': 'lost',
} satisfies Record<NonNullable<Deal['stage']>, string>;

function StageBadge({ stage }: { stage: Deal['stage'] }) {
  if (!stage) return <span className="example-muted">—</span>;
  return (
    <span className="example-stage" data-tone={STAGE_TONES[stage]}>
      {stage}
    </span>
  );
}

function ActiveCell({ active }: { active: boolean | null }) {
  if (active === null) return <span className="example-muted">—</span>;
  return (
    <span className="example-bool" data-active={active}>
      <span aria-hidden="true" className="example-bool-dot" />
      {String(active)}
    </span>
  );
}

/** The filtered results table; nothing renders until the first apply lands. */
function DealsTable({ filteredDeals }: { filteredDeals: Deal[] | null }) {
  if (!filteredDeals) return null;
  return (
    <div className="example-card">
      <table className="example-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Deal value</th>
            <th>Active</th>
            <th>Stage</th>
            <th>Close date</th>
            <th>Last emailed</th>
          </tr>
        </thead>
        <tbody>
          {filteredDeals.map((deal) => (
            <tr key={deal.id}>
              <td className="example-name">{deal.name}</td>
              <td>
                {deal.dealValue === null ? (
                  <span className="example-muted">—</span>
                ) : (
                  `$${deal.dealValue.toLocaleString()}`
                )}
              </td>
              <td>
                <ActiveCell active={deal.active} />
              </td>
              <td>
                <StageBadge stage={deal.stage} />
              </td>
              <td>
                {deal.closeDate ?? <span className="example-muted">—</span>}
              </td>
              <td>
                {deal.lastEmailed ?? <span className="example-muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The demo parent. It injects `fields` and `onChange` into the filter
 * component and owns everything the component deliberately doesn't: applying
 * a filter group to an in-memory array and rendering the results. Applying
 * is synchronous here; a real parent's async apply, its loading and stale
 * handling, and its use of the `onChange` AbortController are demonstrated in
 * `src/example/parent-contract.test.tsx`.
 */
function Application() {
  const [disabled, setDisabled] = useState(false);
  const [filteredDeals, setFilteredDeals] = useState<Deal[] | null>(null);
  const [currentFilters, setCurrentFilters] =
    useState<FilterGroup>(INITIAL_FILTERS);
  const [eventLog, setEventLog] = useState<LogEntry[]>([]);

  const logIdRef = useRef(0);

  const logEvent = (text: string, tone: LogEntry['tone'] = 'neutral') => {
    const stamp = new Date().toTimeString().slice(0, 8);
    setEventLog((entries) =>
      [
        { id: ++logIdRef.current, text: `${stamp}  ${text}`, tone },
        ...entries,
      ].slice(0, 12),
    );
  };

  const applyGroup = (filters: FilterGroup) => {
    const next = applyFilters(DEALS, filters);
    setFilteredDeals(next);
    logEvent(`applied → ${next.length} deals`, 'success');
  };

  const handleFiltersChange = (filters: FilterGroup) => {
    setCurrentFilters(filters);
    // Count leaf conditions — an and-group under an or root is one payload
    // member but several filters as the user sees them.
    const count = filters.conditions.reduce(
      (total, member) =>
        total + ('combinator' in member ? member.conditions.length : 1),
      0,
    );
    logEvent(
      `onChange(${count} ${count === 1 ? 'filter' : 'filters'}, ${filters.combinator.toUpperCase()})`,
    );
    applyGroup(filters);
  };

  // The component stays silent about `initialFilters`, so the parent applies
  // its own seed once on mount.
  const hasAppliedInitialFiltersRef = useRef(false);
  useEffect(() => {
    if (hasAppliedInitialFiltersRef.current) return;
    hasAppliedInitialFiltersRef.current = true;
    applyGroup(INITIAL_FILTERS);
  });

  return (
    <main className="example">
      <header className="example-header">
        <h1>Filter</h1>
      </header>

      <Filter
        fields={exampleFilterFields()}
        disabled={disabled}
        initialFilters={initialFilterGroup()}
        onChange={handleFiltersChange}
      />

      <div className="example-status">
        <label>
          <input
            type="checkbox"
            checked={disabled}
            onChange={(event) => setDisabled(event.target.checked)}
          />
          Disabled
        </label>
        <ResultCount filteredDeals={filteredDeals} />
      </div>

      <DealsTable filteredDeals={filteredDeals} />

      <section aria-label="Example harness" className="example-harness">
        <div className="example-panes">
          <div>
            <h2>Current state</h2>
            <pre>{JSON.stringify(currentFilters, null, 2)}</pre>
          </div>
          <div>
            <h2>Event log</h2>
            <ul className="example-log">
              {eventLog.map((entry) => (
                <li key={entry.id} className={`is-${entry.tone}`}>
                  {entry.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Application;
