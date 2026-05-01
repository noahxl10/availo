"use client";

import { useState } from "react";
import { Button, Input, Select } from "@availo/ui";

type FieldConfig = {
  label: string;
  options?: string[];
  placeholder?: string;
  type?: string;
  value?: string;
};

type StepContent = {
  fields: FieldConfig[];
  isEmbed?: boolean;
  title: string;
};

const steps = ["Business", "Experience", "Widget"];

const stepContent: StepContent[] = [
  {
    title: "Tell us about your business",
    fields: [
      { label: "Business Name", placeholder: "Ocean Tours Co.", value: "Ocean Tours Co." },
      {
        label: "Business Type",
        options: ["Tour Operator", "Rental Shop", "Fitness Studio", "Event Venue", "Other"],
      },
      { label: "Location", placeholder: "Santa Cruz, CA", value: "Santa Cruz, CA" },
      { label: "Website (optional)", placeholder: "https://yoursite.com" },
    ],
  },
  {
    title: "Add your first experience",
    fields: [
      { label: "Experience Name", placeholder: "Morning Kayak Tour", value: "Morning Kayak Tour" },
      { label: "Duration", options: ["30 min", "1 hour", "2 hours", "4 hours", "Full Day", "Custom"] },
      { label: "Price per guest", placeholder: "$0.00", value: "$65.00" },
      { label: "Max guests", placeholder: "12", value: "8" },
    ],
  },
  {
    title: "Set up your booking widget",
    fields: [],
    isEmbed: true,
  },
];

export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const current = stepContent[step] ?? stepContent[0]!;

  return (
    <main className="onboarding-screen">
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="onboarding-header">
          <div className="onboarding-brand">
            <div className="onboarding-brand__mark" aria-hidden="true">
              A
            </div>
            <span>Availo</span>
          </div>

          <div className="onboarding-progress" aria-label="Onboarding progress">
            {steps.map((label, index) => (
              <div className="onboarding-progress__group" key={label}>
                <div className="onboarding-step" data-complete={index < step} data-current={index === step}>
                  {index < step ? "✓" : index + 1}
                </div>
                <div className="onboarding-step__label" data-complete={index < step} data-current={index === step}>
                  {label}
                </div>
                {index < steps.length - 1 && (
                  <div className="onboarding-progress__line" data-complete={index < step} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>

          <h1 id="onboarding-title">{current.title}</h1>
        </div>

        <div className="onboarding-content">
          {current.isEmbed ? (
            <div className="onboarding-embed">
              <p>Copy this snippet and paste it where you want the booking widget to appear.</p>
              <pre>
                <code>
                  {'<script src="https://cdn.availo.io/widget.js"\n'}
                  {'  data-key="ak_live_oce_2a9f3b"\n'}
                  {'  data-listing="kayak-morning-tour"\n'}
                  {"></script>"}
                </code>
              </pre>
              <Button className="onboarding-copy-button" type="button" variant="ghost">
                Copy Snippet
              </Button>
            </div>
          ) : (
            current.fields.map((field) => (
              <label className="onboarding-field" key={field.label}>
                <span>{field.label}</span>
                {field.options ? (
                  <Select className="onboarding-control" defaultValue={field.options[0]}>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    className="onboarding-control"
                    defaultValue={field.value}
                    placeholder={field.placeholder}
                    type={field.type ?? "text"}
                  />
                )}
              </label>
            ))
          )}

          <div className="onboarding-actions">
            {step > 0 && (
              <Button className="onboarding-back-button" onClick={() => setStep((value) => value - 1)} type="button" variant="secondary">
                Back
              </Button>
            )}
            <Button
              className="onboarding-next-button"
              onClick={() => {
                if (step < steps.length - 1) setStep((value) => value + 1);
              }}
              type="button"
            >
              {step < steps.length - 1 ? "Continue →" : "Go to Dashboard →"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
