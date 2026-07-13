import type { FilterFieldDefinition, FilterGroup } from '@/components/filter/index.ts';

/** Widened record contract checked against the literal fixture below. */
type DealRecordShape = {
  id: number;
  name: string;
  dealValue: number | null;
  active: boolean | null;
  stage: string | null;
  closeDate: string | null; // YYYY-MM-DD
  lastEmailed: string | null; // YYYY-MM-DD
};

const DEAL_RECORDS = [
  {
    id: 1,
    name: 'Acme Corp renewal',
    dealValue: 42000,
    active: true,
    stage: 'Negotiation',
    closeDate: '2026-07-24',
    lastEmailed: '2026-07-08',
  },
  {
    id: 2,
    name: 'Maria Vega pilot',
    dealValue: 8500,
    active: true,
    stage: 'Demo scheduled',
    closeDate: '2026-08-02',
    lastEmailed: '2026-07-09',
  },
  {
    id: 3,
    name: 'Northwind expansion',
    dealValue: 125000,
    active: true,
    stage: 'Contacted',
    closeDate: '2026-09-15',
    lastEmailed: '2026-06-28',
  },
  {
    id: 4,
    name: 'Momentum Labs intro',
    dealValue: null,
    active: true,
    stage: 'Lead',
    closeDate: null,
    lastEmailed: null,
  },
  {
    id: 5,
    name: 'Globex onboarding',
    dealValue: 18000,
    active: false,
    stage: 'Closed won',
    closeDate: '2026-05-30',
    lastEmailed: '2026-05-28',
  },
  {
    id: 6,
    name: 'Initech migration',
    dealValue: 64000,
    active: false,
    stage: 'Closed lost',
    closeDate: '2026-04-12',
    lastEmailed: '2026-04-10',
  },
  {
    id: 7,
    name: 'Stark Industries POC',
    dealValue: 250000,
    active: true,
    stage: 'Negotiation',
    closeDate: '2026-07-31',
    lastEmailed: '2026-07-10',
  },
  {
    id: 8,
    name: 'Wayne Enterprises audit',
    dealValue: 96000,
    active: true,
    stage: 'Contacted',
    closeDate: '2026-10-01',
    lastEmailed: '2026-07-01',
  },
  {
    id: 9,
    name: 'Marigold Bakery starter',
    dealValue: 1200,
    active: true,
    stage: 'Lead',
    closeDate: null,
    lastEmailed: '2026-07-05',
  },
  {
    id: 10,
    name: 'Umbrella Health trial',
    dealValue: 30500,
    active: null,
    stage: 'Demo scheduled',
    closeDate: '2026-08-20',
    lastEmailed: '2026-07-07',
  },
  {
    id: 11,
    name: 'Monsters Inc supply',
    dealValue: 7800,
    active: true,
    stage: null,
    closeDate: '2026-08-11',
    lastEmailed: '2026-07-02',
  },
  {
    id: 12,
    name: 'Sirius Cybernetics deal',
    dealValue: 54000,
    active: false,
    stage: 'Closed lost',
    closeDate: '2026-03-05',
    lastEmailed: null,
  },
] as const satisfies readonly DealRecordShape[];

type PipelineStage = NonNullable<(typeof DEAL_RECORDS)[number]['stage']>;

export type Deal = Omit<DealRecordShape, 'stage'> & {
  stage: PipelineStage | null;
};

/** Mutable copy of the checked readonly fixture. */
export const DEALS: Deal[] = [...DEAL_RECORDS];

const STAGES = [
  'Lead',
  'Contacted',
  'Demo scheduled',
  'Negotiation',
  'Closed won',
  'Closed lost',
] as const satisfies readonly PipelineStage[];

// `satisfies` rejects extras; this defaulted constraint rejects omissions.
type CompleteStageOrder<Missing extends never = Exclude<PipelineStage, (typeof STAGES)[number]>> =
  Missing;
declare const _completeStageOrder: CompleteStageOrder;

export const DEAL_FILTER_FIELDS = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'dealValue', label: 'Deal value', type: 'number' },
  { key: 'active', label: 'Active', type: 'boolean' },
  { key: 'stage', label: 'Stage', type: 'enum', options: STAGES },
  { key: 'closeDate', label: 'Close date', type: 'date' },
  { key: 'lastEmailed', label: 'Last emailed', type: 'date' },
] as const satisfies readonly FilterFieldDefinition[];

export const INITIAL_FILTERS: FilterGroup = {
  combinator: 'and',
  conditions: [
    {
      fieldKey: 'active',
      type: 'boolean',
      operator: 'equals',
      value: true,
    },
  ],
};
