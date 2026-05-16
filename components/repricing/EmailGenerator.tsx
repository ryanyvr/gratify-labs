"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>Draft Email</CardTitle>
        <Select value={selectedScenarioName} onValueChange={setSelectedScenarioName}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {selectable.map((scenario) => (
              <SelectItem key={scenario.name} value={scenario.name}>
                {scenario.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm text-text-primary">
          {emailText}
        </pre>
        <div className="flex justify-end">
          <Button type="button" onClick={onCopy}>
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
