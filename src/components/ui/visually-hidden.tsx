// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * VisuallyHidden component
 * Hides content visually but keeps it accessible to screen readers
 */
export const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0",
      "clip-[rect(0,0,0,0)]",
      className
    )}
    {...props}
  />
));
VisuallyHidden.displayName = "VisuallyHidden";
