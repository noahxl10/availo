import { forwardRef, useId } from "react";
import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "./utils";

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  labelProps?: LabelHTMLAttributes<HTMLLabelElement>;
}

export function Field({
  children,
  className,
  error,
  hint,
  htmlFor,
  label,
  labelProps,
  ...props
}: FieldProps) {
  return (
    <div className={cx("av-field", className)} {...props}>
      {label && (
        <label {...labelProps} className={cx("av-field__label", labelProps?.className)} htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <div className="av-field__message av-field__message--error">{error}</div>
      ) : hint ? (
        <div className="av-field__message">{hint}</div>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cx("av-input", invalid && "av-input--invalid", className)}
      aria-invalid={ariaInvalid ?? invalid}
      {...props}
    />
  ),
);

Input.displayName = "Input";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <select
      ref={ref}
      className={cx("av-input", "av-select", invalid && "av-input--invalid", className)}
      aria-invalid={ariaInvalid ?? invalid}
      {...props}
    />
  ),
);

Select.displayName = "Select";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cx("av-input", "av-textarea", invalid && "av-input--invalid", className)}
      aria-invalid={ariaInvalid ?? invalid}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";

export interface FieldInputProps extends InputProps {
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
}

export const FieldInput = forwardRef<HTMLInputElement, FieldInputProps>(
  ({ fieldClassName, hint, error, id, label, invalid, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <Field
        {...(fieldClassName ? { className: fieldClassName } : {})}
        {...(hint ? { hint } : {})}
        {...(error ? { error } : {})}
        label={label}
        htmlFor={inputId}
      >
        <Input ref={ref} id={inputId} invalid={invalid || Boolean(error)} {...props} />
      </Field>
    );
  },
);

FieldInput.displayName = "FieldInput";

export interface FieldSelectProps extends SelectProps {
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
}

export const FieldSelect = forwardRef<HTMLSelectElement, FieldSelectProps>(
  ({ fieldClassName, hint, error, id, label, invalid, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <Field
        {...(fieldClassName ? { className: fieldClassName } : {})}
        {...(hint ? { hint } : {})}
        {...(error ? { error } : {})}
        label={label}
        htmlFor={selectId}
      >
        <Select ref={ref} id={selectId} invalid={invalid || Boolean(error)} {...props} />
      </Field>
    );
  },
);

FieldSelect.displayName = "FieldSelect";

export interface FieldTextareaProps extends TextareaProps {
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
}

export const FieldTextarea = forwardRef<HTMLTextAreaElement, FieldTextareaProps>(
  ({ fieldClassName, hint, error, id, label, invalid, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;

    return (
      <Field
        {...(fieldClassName ? { className: fieldClassName } : {})}
        {...(hint ? { hint } : {})}
        {...(error ? { error } : {})}
        label={label}
        htmlFor={textareaId}
      >
        <Textarea ref={ref} id={textareaId} invalid={invalid || Boolean(error)} {...props} />
      </Field>
    );
  },
);

FieldTextarea.displayName = "FieldTextarea";
