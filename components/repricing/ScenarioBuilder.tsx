"use client";

import { useMemo, useState } from "react";
import { aggregateLTM, computeScenario, PRODUCTS, type Scenario } from "@/lib/repricing/scenario";
import { formatBPS, formatCurrency, formatPercent } from "@/lib/repricing/formatters";
import type { MonthlySummary } from "@/lib/repricing/types";

interface ScenarioBuilderProps {
  data: MonthlySummary[];
  targetBps: number | null;
}

type ScenarioKey = "current" | "scenarioA" | "scenarioB" | "scenarioC" | "counter";

const EMPTY_SCENARIO: Scenario = {
  marginPct: 0,
  txnFee: 0,
  p1: "None",
  p2: "None",
  p3: "None",
};

const DEFAULT_SCENARIOS: Record<Exclude<ScenarioKey, "current">, Scenario> = {
  scenarioA: {
    marginPct: 10,
    txnFee: 0,
    p1: "Gross Billing 0.07%",
    p2: "Non-PCI (Standard $69.95)",
    p3: "Account Updater $1 per",
  },
  scenarioB: {
    marginPct: 25,
    txnFee: 0,
    p1: "Gross Billing 0.07%",
    p2: "None",
    p3: "None",
  },
  scenarioC: {
    marginPct: -10,
    txnFee: 0,
    p1: "Gross Billing 0.07%",
    p2: "Non-PCI (Mid $59.95)",
    p3: "Account Updater $1 per",
  },
  counter: EMPTY_SCENARIO,
};

const COLUMNS: Array<{ key: ScenarioKey; label: string }> = [
  { key: "current", label: "Current" },
  { key: "scenarioA", label: "Scenario A" },
  { key: "scenarioB", label: "Scenario B" },
  { key: "scenarioC", label: "Scenario C" },
  { key: "counter", label: "Counter" },
];

function approvalClass(approval: string): string {
  if (approval === "VP APPROVAL") return "bg-red-100 text-red-700";
  if (approval === "MGR APPROVAL") return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
}

function signClass(value: number): string {
  if (value > 0) return "text-green-600";
  if (value < 0) return "text-red-600";
  return "text-text-primary";
}

export function ScenarioBuilder({ data, targetBps }: ScenarioBuilderProps) {
  const [scenarios, setScenarios] = useState(DEFAULT_SCENARIOS);
  const ltm = useMemo(() => aggregateLTM(data, 12), [data]);

  const results = useMemo(() => {
    return {
      current: computeScenario(EMPTY_SCENARIO, ltm),
      scenarioA: computeScenario(scenarios.scenarioA, ltm),
      scenarioB: computeScenario(scenarios.scenarioB, ltm),
      scenarioC: computeScenario(scenarios.scenarioC, ltm),
      counter: computeScenario(scenarios.counter, ltm),
    };
  }, [ltm, scenarios]);

  const setScenarioValue = <K extends Exclude<ScenarioKey, "current">>(
    key: K,
    field: keyof Scenario,
    value: string | number,
  ) => {
    setScenarios((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-[#1A1A2E]">Scenario Builder</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-card bg-[#F8FAFC]">
              <th className="p-3 text-left font-semibold text-text-primary">Metric</th>
              {COLUMNS.map((column) => (
                <th key={column.key} className="p-3 text-right font-semibold text-text-primary">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">Margin Adjustment (%)</td>
              <td className="p-3 text-right text-text-secondary">-</td>
              {(["scenarioA", "scenarioB", "scenarioC", "counter"] as const).map((key) => (
                <td key={key} className="p-3 text-right">
                  <input
                    type="number"
                    value={scenarios[key].marginPct}
                    onChange={(event) =>
                      setScenarioValue(key, "marginPct", Number(event.target.value || 0))
                    }
                    className="w-24 rounded border border-border-card px-2 py-1 text-right"
                  />
                </td>
              ))}
            </tr>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">Per-Txn Fee ($)</td>
              <td className="p-3 text-right text-text-secondary">-</td>
              {(["scenarioA", "scenarioB", "scenarioC", "counter"] as const).map((key) => (
                <td key={key} className="p-3 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={scenarios[key].txnFee}
                    onChange={(event) =>
                      setScenarioValue(key, "txnFee", Number(event.target.value || 0))
                    }
                    className="w-24 rounded border border-border-card px-2 py-1 text-right"
                  />
                </td>
              ))}
            </tr>
            {(["p1", "p2", "p3"] as const).map((slot, index) => (
              <tr key={slot} className="border-b border-border-card">
                <td className="p-3 font-medium text-text-primary">{`Product ${index + 1}`}</td>
                <td className="p-3 text-right text-text-secondary">None</td>
                {(["scenarioA", "scenarioB", "scenarioC", "counter"] as const).map((key) => (
                  <td key={key} className="p-3 text-right">
                    <select
                      value={scenarios[key][slot]}
                      onChange={(event) => setScenarioValue(key, slot, event.target.value)}
                      className="w-full rounded border border-border-card px-2 py-1 text-xs"
                    >
                      {PRODUCTS.map((product) => (
                        <option key={product.name} value={product.name}>
                          {product.label}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}

            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">New Effective Rate</td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="p-3 text-right">
                  {formatPercent(results[column.key].newAllInER)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">BPS Change</td>
              {COLUMNS.map((column) => (
                <td key={column.key} className={`p-3 text-right ${signClass(results[column.key].bpsChange)}`}>
                  {formatBPS(results[column.key].bpsChange)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">FS Revenue from Markup ($)</td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="p-3 text-right">
                  {formatCurrency(results[column.key].mkRev)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">FS Revenue from Per-Txn ($)</td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="p-3 text-right">
                  {formatCurrency(results[column.key].txRev)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">Total Product Revenue</td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="p-3 text-right">
                  {formatCurrency(results[column.key].prodRev)}
                </td>
              ))}
            </tr>
            <tr className="border-y-2 border-[#D1D5DB] bg-[#F8FAFC]">
              <td className="p-3 font-semibold text-text-primary">TOTAL FS REVENUE</td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="p-3 text-right font-semibold">
                  {formatCurrency(results[column.key].totRev)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">Revenue Change ($)</td>
              {COLUMNS.map((column) => (
                <td key={column.key} className={`p-3 text-right ${signClass(results[column.key].chg)}`}>
                  {formatCurrency(results[column.key].chg)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">Revenue Change (%)</td>
              {COLUMNS.map((column) => (
                <td
                  key={column.key}
                  className={`p-3 text-right ${signClass(results[column.key].revChangePct)}`}
                >
                  {formatPercent(results[column.key].revChangePct)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">Margin Compression</td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="p-3 text-right">
                  {formatPercent(results[column.key].comp)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">Target Net Rev BPS</td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="p-3 text-right">
                  {formatBPS(targetBps ?? 0)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">New Net Rev BPS</td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="p-3 text-right">
                  {formatBPS(results[column.key].newNrBps)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border-card">
              <td className="p-3 font-medium text-text-primary">Gap to Target</td>
              {COLUMNS.map((column) => {
                const gap = results[column.key].newNrBps - (targetBps ?? 0);
                return (
                  <td key={column.key} className={`p-3 text-right ${signClass(gap)}`}>
                    {formatBPS(gap)}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="p-3 font-medium text-text-primary">APPROVAL</td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="p-3 text-right">
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${approvalClass(results[column.key].approval)}`}>
                    {results[column.key].approval}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
