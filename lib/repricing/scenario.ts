import type { MonthlySummary } from "./types";

export const PRODUCTS = [
  { name: "None", label: "None", type: "$M" as const, rate: 0, est: 0 },
  {
    name: "Gross Billing 0.07%",
    label: "Gross Billing 0.07%",
    type: "%V" as const,
    rate: 0.0007,
    est: 0,
  },
  {
    name: "Non-PCI (Standard $69.95)",
    label: "Non-PCI (Standard $69.95)",
    type: "$M" as const,
    rate: 69.95,
    est: 0,
  },
  {
    name: "Non-PCI (Mid $59.95)",
    label: "Non-PCI (Mid $59.95)",
    type: "$M" as const,
    rate: 59.95,
    est: 0,
  },
  {
    name: "Non-PCI (Low $59.00)",
    label: "Non-PCI (Low $59.00)",
    type: "$M" as const,
    rate: 59.0,
    est: 0,
  },
  {
    name: "Account Updater $1 per",
    label: "Account Updater $1 per",
    type: "$U" as const,
    rate: 1,
    est: 50,
  },
] as const;

export const MAX_COMP = 0.1;
export const MIN_MK_BPS = 8;
export const MIN_NR_BPS = 5;

export interface Scenario {
  marginPct: number;
  txnFee: number;
  p1: string;
  p2: string;
  p3: string;
}

export interface LTMAggregation {
  txns: number;
  vol: number;
  fees: number;
  ic: number;
  mf: number;
  nw: number;
  nr: number;
  markup: number;
  fs: number;
  fsBps: number;
  allInER: number;
  nrBps: number;
}

export interface ScenarioResult {
  bpsAdj: number;
  newBps: number;
  bpsChange: number;
  mkRev: number;
  txRev: number;
  prodRev: number;
  totRev: number;
  chg: number;
  revChangePct: number;
  comp: number;
  newNrBps: number;
  newAllInER: number;
  approval: "VP APPROVAL" | "MGR APPROVAL" | "OK (guardrails)" | "OK";
}

export function aggregateLTM(months: MonthlySummary[], period: number): LTMAggregation {
  const sorted = [...months].sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  const scoped = period === 0 ? sorted : sorted.slice(-period);

  const txns = scoped.reduce((acc, row) => acc + row.txn_count, 0);
  const vol = scoped.reduce((acc, row) => acc + row.volume, 0);
  const fees = scoped.reduce((acc, row) => acc + row.total_fees, 0);
  const ic = scoped.reduce((acc, row) => acc + row.interchange, 0);
  const mf = scoped.reduce((acc, row) => acc + row.monthly_fees, 0);
  const nw = scoped.reduce((acc, row) => acc + row.network_costs, 0);
  const nr = scoped.reduce((acc, row) => acc + row.net_revenue, 0);
  const markup = scoped.reduce((acc, row) => acc + row.markup, 0);

  const fs = markup + mf;
  const fsBps = vol > 0 ? (fs / vol) * 10000 : 0;
  const allInER = vol > 0 ? (fees + mf) / vol : 0;
  const nrBps = vol > 0 ? (nr / vol) * 10000 : 0;

  return { txns, vol, fees, ic, mf, nw, nr, markup, fs, fsBps, allInER, nrBps };
}

export function getProdRev(productName: string, volume: number): number {
  const product = PRODUCTS.find((entry) => entry.name === productName);
  if (!product) {
    return 0;
  }

  if (product.type === "%V") {
    return product.rate * volume;
  }

  if (product.type === "$U") {
    return product.rate * product.est * 12;
  }

  return product.rate * 12;
}

export function computeScenario(sc: Scenario, ltm: LTMAggregation): ScenarioResult {
  const curBps = ltm.fsBps;
  const curRev = ltm.fs;
  const bpsAdj = curBps * (sc.marginPct / 100);
  const newBps = curBps + bpsAdj;
  const mkRev = (newBps / 10000) * ltm.vol;
  const txRev = sc.txnFee * ltm.txns;
  const prodRev = getProdRev(sc.p1, ltm.vol) + getProdRev(sc.p2, ltm.vol) + getProdRev(sc.p3, ltm.vol);
  const totRev = mkRev + txRev + prodRev;
  const chg = totRev - curRev;
  const comp = curRev > 0 ? Math.max(0, (curRev - (mkRev + txRev)) / curRev) : 0;
  const newNrBps = ltm.vol > 0 ? ((ltm.nr + chg) / ltm.vol) * 10000 : 0;
  const newAllInER = ltm.vol > 0 ? (ltm.fees + ltm.mf + chg) / ltm.vol : 0;

  let approval: ScenarioResult["approval"] = "OK";
  if (newBps < MIN_MK_BPS || newNrBps < MIN_NR_BPS) {
    approval = "VP APPROVAL";
  } else if (comp > MAX_COMP) {
    approval = "MGR APPROVAL";
  } else if (chg < 0) {
    approval = "OK (guardrails)";
  }

  return {
    bpsAdj,
    newBps,
    bpsChange: newBps - curBps,
    mkRev,
    txRev,
    prodRev,
    totRev,
    chg,
    revChangePct: curRev > 0 ? chg / curRev : 0,
    comp,
    newNrBps,
    newAllInER,
    approval,
  };
}
