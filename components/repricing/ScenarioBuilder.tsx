"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBPS, formatCurrency, formatPercent } from "@/lib/repricing/formatters";
import { PRODUCTS, type Scenario, type ScenarioResult } from "@/lib/repricing/scenario";
import { cn } from "@/lib/utils";

interface ScenarioBuilderProps {
  targetBps: number | null;
  scenarios: Record<EditableScenarioKey, Scenario>;
  results: Record<ScenarioKey, ScenarioResult>;
  onScenarioChange: (key: EditableScenarioKey, field: keyof Scenario, value: string | number) => void;
}

type ScenarioKey = "current" | "scenarioA" | "scenarioB" | "scenarioC" | "counter";
type EditableScenarioKey = Exclude<ScenarioKey, "current">;

const COLUMNS: Array<{ key: ScenarioKey; label: string }> = [
  { key: "current", label: "Current" },
  { key: "scenarioA", label: "Scenario A" },
  { key: "scenarioB", label: "Scenario B" },
  { key: "scenarioC", label: "Scenario C" },
  { key: "counter", label: "Counter" },
];

const EDITABLE_KEYS = ["scenarioA", "scenarioB", "scenarioC", "counter"] as const;

function approvalVariant(approval: string): "success" | "warning" | "danger" {
  if (approval === "VP APPROVAL") return "danger";
  if (approval === "MGR APPROVAL") return "warning";
  return "success";
}

function signClass(value: number): string {
  if (value > 0) return "text-green-600";
  if (value < 0) return "text-red-600";
  return "text-text-primary";
}

function ProductSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRODUCTS.map((product) => (
          <SelectItem key={product.name} value={product.name}>
            {product.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ScenarioBuilder({ targetBps, scenarios, results, onScenarioChange }: ScenarioBuilderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow className="hover:bg-muted">
                <TableHead className="p-3 text-left font-semibold text-text-primary">Metric</TableHead>
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column.key}
                    className="p-3 text-right font-semibold text-text-primary"
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">Margin Adjustment (%)</TableCell>
                <TableCell className="p-3 text-right text-text-secondary">-</TableCell>
                {EDITABLE_KEYS.map((key) => (
                  <TableCell key={key} className="p-3 text-right">
                    <Input
                      type="number"
                      className="ml-auto w-24 text-right"
                      value={scenarios[key].marginPct}
                      onChange={(event) =>
                        onScenarioChange(key, "marginPct", Number(event.target.value || 0))
                      }
                    />
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">Per-Txn Fee ($)</TableCell>
                <TableCell className="p-3 text-right text-text-secondary">-</TableCell>
                {EDITABLE_KEYS.map((key) => (
                  <TableCell key={key} className="p-3 text-right">
                    <Input
                      type="number"
                      step="0.01"
                      className="ml-auto w-24 text-right"
                      value={scenarios[key].txnFee}
                      onChange={(event) =>
                        onScenarioChange(key, "txnFee", Number(event.target.value || 0))
                      }
                    />
                  </TableCell>
                ))}
              </TableRow>
              {(["p1", "p2", "p3"] as const).map((slot, index) => (
                <TableRow key={slot}>
                  <TableCell className="p-3 font-medium text-text-primary">{`Product ${index + 1}`}</TableCell>
                  <TableCell className="p-3 text-right text-text-secondary">None</TableCell>
                  {EDITABLE_KEYS.map((key) => (
                    <TableCell key={key} className="p-3 text-right">
                      <ProductSelect
                        value={scenarios[key][slot]}
                        onValueChange={(value) => onScenarioChange(key, slot, value)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">New Effective Rate</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} className="p-3 text-right">
                    {formatPercent(results[column.key].newAllInER)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">BPS Change</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn("p-3 text-right", signClass(results[column.key].bpsChange))}
                  >
                    {formatBPS(results[column.key].bpsChange)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">FS Revenue from Markup ($)</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} className="p-3 text-right">
                    {formatCurrency(results[column.key].mkRev)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">FS Revenue from Per-Txn ($)</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} className="p-3 text-right">
                    {formatCurrency(results[column.key].txRev)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">Total Product Revenue</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} className="p-3 text-right">
                    {formatCurrency(results[column.key].prodRev)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="border-y-2 border-border bg-muted hover:bg-muted">
                <TableCell className="p-3 font-semibold text-text-primary">TOTAL FS REVENUE</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} className="p-3 text-right font-semibold">
                    {formatCurrency(results[column.key].totRev)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">Revenue Change ($)</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn("p-3 text-right", signClass(results[column.key].chg))}
                  >
                    {formatCurrency(results[column.key].chg)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">Revenue Change (%)</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn("p-3 text-right", signClass(results[column.key].revChangePct))}
                  >
                    {formatPercent(results[column.key].revChangePct)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">Margin Compression</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} className="p-3 text-right">
                    {formatPercent(results[column.key].comp)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">Target Net Rev BPS</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} className="p-3 text-right">
                    {formatBPS(targetBps ?? 0)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">New Net Rev BPS</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} className="p-3 text-right">
                    {formatBPS(results[column.key].newNrBps)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">Gap to Target</TableCell>
                {COLUMNS.map((column) => {
                  const gap = results[column.key].newNrBps - (targetBps ?? 0);
                  return (
                    <TableCell key={column.key} className={cn("p-3 text-right", signClass(gap))}>
                      {formatBPS(gap)}
                    </TableCell>
                  );
                })}
              </TableRow>
              <TableRow>
                <TableCell className="p-3 font-medium text-text-primary">APPROVAL</TableCell>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key} className="p-3 text-right">
                    <Badge variant={approvalVariant(results[column.key].approval)}>
                      {results[column.key].approval}
                    </Badge>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
