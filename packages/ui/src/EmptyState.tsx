import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./utils";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  body: string;
  cta?: ReactNode;
  onCtaClick?: () => void;
}

export function EmptyState({
  body,
  className,
  cta,
  icon = "◫",
  onCtaClick,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div className={cx("av-empty-state", className)} {...props}>
      <div className="av-empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="av-empty-state__title">{title}</div>
      <div className="av-empty-state__body">{body}</div>
      {cta && (
        <Button className="av-empty-state__cta" type="button" onClick={onCtaClick}>
          {cta}
        </Button>
      )}
    </div>
  );
}
