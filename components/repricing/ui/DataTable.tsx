import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  label: string;
  format?: (value: unknown, row: T) => ReactNode;
  align?: "left" | "right";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T>({ columns, data, onRowClick, className }: DataTableProps<T>) {
  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      <Table>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-muted">
            {columns.map((column) => (
              <TableHead
                key={String(column.key)}
                className={cn(
                  "px-4 py-3 text-xs font-semibold text-muted-foreground",
                  column.align === "right" ? "text-right" : "text-left",
                )}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow
              key={rowIndex}
              className={cn(
                "text-sm text-foreground",
                onRowClick ? "cursor-pointer" : "",
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => {
                const value = (row as Record<string, unknown>)[String(column.key)];
                return (
                  <TableCell
                    key={String(column.key)}
                    className={cn(
                      "px-4 py-3",
                      column.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {column.format ? column.format(value, row) : (value as ReactNode)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export type { Column, DataTableProps };
