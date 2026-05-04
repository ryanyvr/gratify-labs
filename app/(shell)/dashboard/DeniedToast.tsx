"use client";

import { useEffect, useState } from "react";

type DeniedToastProps = {
  show: boolean;
};

export default function DeniedToast({ show }: DeniedToastProps) {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsVisible(false);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="rounded-md border border-amber-400/40 bg-amber-100/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-100"
      role="status"
    >
      You don&apos;t have access to that feature.
    </div>
  );
}
