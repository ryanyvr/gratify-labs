import type { ReactNode } from "react";
import clsx from "clsx";

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
}

export function DataTable<T>({ columns, data, onRowClick }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E5E7EB] bg-white">
      <table className="min-w-full">
        <thead className="bg-[#F9FAFB]">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={clsx(
                  "px-4 py-3 text-[13px] font-semibold text-[#6B7280]",
                  column.align === "right" ? "text-right" : "text-left",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={clsx(
                "border-b border-[#E5E7EB] text-sm text-[#1A1A2E]",
                onRowClick ? "cursor-pointer hover:bg-[#F9FAFB]" : "",
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => {
                const value = (row as Record<string, unknown>)[String(column.key)];
                return (
                  <td
                    key={String(column.key)}
                    className={clsx(
                      "px-4 py-3",
                      column.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {column.format ? column.format(value, row) : (value as ReactNode)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { Column, DataTableProps };
