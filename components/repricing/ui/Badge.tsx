import clsx from "clsx";

interface BadgeProps {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "info";
}

const variantClasses: Record<BadgeProps["variant"], string> = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

export function Badge({ label, variant }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
      )}
    >
      {label}
    </span>
  );
}
