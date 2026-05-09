"use client";

import { useMemo, useState } from "react";
import { EmailGenerator } from "@/components/repricing/EmailGenerator";
import { ScenarioBuilder } from "@/components/repricing/ScenarioBuilder";
import { aggregateLTM, computeScenario, type Scenario } from "@/lib/repricing/scenario";
import type { MonthlySummary } from "@/lib/repricing/types";

interface ScenarioWorkbenchProps {
  data: MonthlySummary[];
  targetBps: number | null;
}

type EditableScenarioKey = "scenarioA" | "scenarioB" | "scenarioC" | "counter";

const EMPTY_SCENARIO: Scenario = {
  marginPct: 0,
  txnFee: 0,
  p1: "None",
  p2: "None",
  p3: "None",
};

const DEFAULT_SCENARIOS: Record<EditableScenarioKey, Scenario> = {
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

export function ScenarioWorkbench({ data, targetBps }: ScenarioWorkbenchProps) {
  const [scenarios, setScenarios] = useState(DEFAULT_SCENARIOS);
  const ltm = useMemo(() => aggregateLTM(data, 12), [data]);

  const results = useMemo(
    () => ({
      current: computeScenario(EMPTY_SCENARIO, ltm),
      scenarioA: computeScenario(scenarios.scenarioA, ltm),
      scenarioB: computeScenario(scenarios.scenarioB, ltm),
      scenarioC: computeScenario(scenarios.scenarioC, ltm),
      counter: computeScenario(scenarios.counter, ltm),
    }),
    [ltm, scenarios],
  );

  const namedScenarios = [
    { name: "Current", ...EMPTY_SCENARIO },
    { name: "Scenario A", ...scenarios.scenarioA },
    { name: "Scenario B", ...scenarios.scenarioB },
    { name: "Scenario C", ...scenarios.scenarioC },
    { name: "Counter", ...scenarios.counter },
  ];

  const namedResults = [
    { name: "Current", result: results.current },
    { name: "Scenario A", result: results.scenarioA },
    { name: "Scenario B", result: results.scenarioB },
    { name: "Scenario C", result: results.scenarioC },
    { name: "Counter", result: results.counter },
  ];

  const onScenarioChange = (key: EditableScenarioKey, field: keyof Scenario, value: string | number) => {
    setScenarios((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  return (
    <div className="space-y-5">
      <ScenarioBuilder
        targetBps={targetBps}
        scenarios={scenarios}
        results={results}
        onScenarioChange={onScenarioChange}
      />
      <EmailGenerator scenarios={namedScenarios} results={namedResults} ltm={ltm} />
    </div>
  );
}
