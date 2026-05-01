import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "disabled";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", disabled, ...props }, ref) => {
    const isDisabled = disabled || variant === "disabled";

    return (
      <button
        ref={ref}
        className={cx("av-button", `av-button--${variant}`, className)}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
