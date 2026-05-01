import type { HTMLAttributes } from "react";
import { cx } from "./utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  interactive?: boolean;
  padded?: boolean;
}

export function Card({
  className,
  disabled,
  interactive,
  padded = true,
  tabIndex,
  ...props
}: CardProps) {
  return (
    <div
      className={cx(
        "av-card",
        padded && "av-card--padded",
        interactive && "av-card--interactive",
        disabled && "av-card--disabled",
        className,
      )}
      aria-disabled={disabled || undefined}
      tabIndex={interactive && !disabled ? (tabIndex ?? 0) : tabIndex}
      {...props}
    />
  );
}
