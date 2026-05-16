"use client";

import { useMemo, useState, type ReactNode } from "react";

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
  sortValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  className?: string;
}

function getCellValue<T>(row: T, column: Column<T>): unknown {
  return (row as Record<string, unknown>)[String(column.key)];
}

function getSortValue<T>(row: T, column: Column<T>): string | number {
  if (column.sortValue) {
    return column.sortValue(row);
  }
  const value = getCellValue(row, column);
  if (typeof value === "number") {
    return value;
  }
  return String(value ?? "");
}

export function DataTable<T>({ columns, data, onRowClick, className }: DataTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortCol) {
      return data;
    }

    const column = columns.find((col) => String(col.key) === sortCol);
    if (!column) {
      return data;
    }

    return [...data].sort((a, b) => {
      const av = getSortValue(a, column);
      const bv = getSortValue(b, column);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [columns, data, sortCol, sortDir]);

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      <Table>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-muted">
            {columns.map((column) => (
              <TableHead
                key={String(column.key)}
                className={cn(
                  "cursor-pointer select-none whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                  column.align === "right" ? "text-right" : "text-left",
                )}
                onClick={() => {
                  const key = String(column.key);
                  if (sortCol === key) {
                    setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
                  } else {
                    setSortCol(key);
                    setSortDir("asc");
                  }
                }}
              >
                {column.label}
                <span
                  className={cn(
                    "ml-1 text-[10px] opacity-40",
                    sortCol === String(column.key) && "text-primary opacity-100",
                  )}
                >
                  {sortCol === String(column.key) && sortDir === "asc" ? "▲" : "▼"}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, rowIndex) => (
            <TableRow
              key={rowIndex}
              className={cn(
                "text-sm text-foreground transition-colors",
                onRowClick ? "cursor-pointer hover:bg-primary/5" : "",
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => {
                const value = getCellValue(row, column);
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
