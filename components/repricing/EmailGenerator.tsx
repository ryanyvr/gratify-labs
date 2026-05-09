"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/repricing/formatters";
import type { LTMAggregation, Scenario, ScenarioResult } from "@/lib/repricing/scenario";

interface NamedScenario extends Scenario {
  name: string;
}

interface EmailGeneratorProps {
  scenarios: NamedScenario[];
  results: Array<{ name: string; result: ScenarioResult }>;
  ltm: LTMAggregation;
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(3)}%`;
}

export function EmailGenerator({ scenarios, results, ltm }: EmailGeneratorProps) {
  const selectable = scenarios.filter((scenario) => scenario.name !== "Current");
  const [selectedScenarioName, setSelectedScenarioName] = useState(selectable[0]?.name ?? "Scenario A");
  const [copied, setCopied] = useState(false);

  const selectedScenario = scenarios.find((scenario) => scenario.name === selectedScenarioName);
  const currentResult = results.find((entry) => entry.name === "Current")?.result;
  const selectedResult = results.find((entry) => entry.name === selectedScenarioName)?.result;

  const emailText = useMemo(() => {
    if (!selectedScenario || !selectedResult || !currentResult) {
      return "";
    }

    const products = [selectedScenario.p1, selectedScenario.p2, selectedScenario.p3].filter(
      (product) => product !== "None",
    );

    const productsLine =
      products.length > 0 ? `  New Products Added: ${products.join("; ")}\n\n` : "\n";

    return `Hi [Merchant Contact],

Thank you for your business and talking with me today. Below is your current pricing and the new pricing we discussed.

CURRENT PRICING
  Effective Rate: ${formatRate(currentResult.newAllInER)}
  LTM Processing Volume: ${formatCurrency(ltm.vol)}

NEW PRICING
  New Effective Rate: ${formatRate(selectedResult.newAllInER)}
${productsLine}Please let me know if you have any questions or would like to discuss.

Best regards,
[Your Name]`;
  }, [currentResult, ltm.vol, selectedResult, selectedScenario]);

  const onCopy = async () => {
    await navigator.clipboard.writeText(emailText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#1A1A2E]">Draft Email</h3>
        <select
          value={selectedScenarioName}
          onChange={(event) => setSelectedScenarioName(event.target.value)}
          className="rounded border border-border-card px-2 py-1 text-sm"
        >
          {selectable.map((scenario) => (
            <option key={scenario.name} value={scenario.name}>
              {scenario.name}
            </option>
          ))}
        </select>
      </div>
      <pre className="whitespace-pre-wrap rounded-md bg-[#F8FAFC] p-4 text-sm text-text-primary">
        {emailText}
      </pre>
      <div className="mt-3 flex items-center justify-end gap-3">
        {copied ? <p className="text-xs text-green-600">Copied to clipboard</p> : null}
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md bg-[#0171FF] px-3 py-2 text-sm font-medium text-white hover:bg-[#005ed6]"
        >
          Copy to Clipboard
        </button>
      </div>
    </div>
  );
}
