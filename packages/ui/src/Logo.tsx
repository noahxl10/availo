import type { HTMLAttributes } from "react";
import { cx } from "./utils";

export interface LogoProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md", ...props }: LogoProps) {
  return (
    <div className={cx("av-logo", `av-logo--${size}`, className)} aria-hidden="true" {...props}>
      A
    </div>
  );
}

export interface BrandLockupProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function BrandLockup({ className, size = "md", ...props }: BrandLockupProps) {
  return (
    <div className={cx("av-brand-lockup", `av-brand-lockup--${size}`, className)} {...props}>
      <Logo size={size} />
      <span className="av-brand-lockup__wordmark">Availo</span>
    </div>
  );
}
