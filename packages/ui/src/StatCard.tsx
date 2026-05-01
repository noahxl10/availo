import type { HTMLAttributes } from "react";
import { cx } from "./utils";

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  delta?: string;
  deltaDir?: "up" | "down";
  sub?: string;
}

export function StatCard({
  className,
  label,
  value,
  delta,
  deltaDir = "up",
  sub,
  ...props
}: StatCardProps) {
  return (
    <div className={cx("av-stat-card", className)} {...props}>
      <div className="av-stat-card__label">{label}</div>
      <div className="av-stat-card__value">{value}</div>
      {(delta || sub) && (
        <div className="av-stat-card__meta">
          {delta && (
            <span className={cx("av-stat-card__delta", `av-stat-card__delta--${deltaDir}`)}>
              {deltaDir === "up" ? "↑" : "↓"} {delta}
            </span>
          )}
          {sub && <span className="av-stat-card__sub">{sub}</span>}
        </div>
      )}
    </div>
  );
}
