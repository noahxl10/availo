import type { HTMLAttributes } from "react";
import { cx } from "./utils";

export type BadgeStatus = "confirmed" | "pending" | "cancelled" | "draft" | "active" | "full";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: BadgeStatus;
}

export function Badge({ children, className, status, ...props }: BadgeProps) {
  return (
    <span className={cx("av-badge", `av-badge--${status}`, className)} {...props}>
      {children ?? status}
    </span>
  );
}
