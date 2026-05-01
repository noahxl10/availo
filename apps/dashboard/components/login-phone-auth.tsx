"use client";

import { useState } from "react";

export function LoginPhoneAuth() {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  return (
    <main className="login-screen">
      <section className="login-brand-panel" aria-label="Availo introduction">
        <div className="login-brand-lockup">
          <div className="login-brand-mark" aria-hidden="true">
            A
          </div>
          <span>Availo</span>
        </div>

        <div className="login-hero-copy">
          <h1>
            Your bookings,
            <br />
            beautifully managed.
          </h1>
          <p>The operator platform for tours, rentals, classes, and experiences.</p>
        </div>

        <div className="login-proof" aria-label="Availo platform stats">
          {[
            ["340+", "Operators"],
            ["18k", "Bookings/mo"],
            ["99.9%", "Uptime"],
          ].map(([value, label]) => (
            <div className="login-proof__row" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="login-form-panel" aria-labelledby="login-heading">
        <div className="login-form-card">
          {step === "phone" ? (
            <>
              <h2 id="login-heading">Sign in</h2>
              <p className="login-subtitle">We'll send a one-time code to your phone.</p>

              <div className="login-field">
                <label htmlFor="phone-number">Phone Number</label>
                <div className="phone-input-group">
                  <div className="phone-input-prefix">🇺🇸 +1</div>
                  <input
                    id="phone-number"
                    inputMode="tel"
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="(555) 000-0000"
                    type="tel"
                    value={phone}
                  />
                </div>
              </div>

              <button className="login-primary-button" onClick={() => setStep("otp")} type="button">
                Continue →
              </button>

              <p className="login-terms">
                By continuing you agree to our <a href="#terms">Terms</a> and{" "}
                <a href="#privacy">Privacy Policy</a>
              </p>
            </>
          ) : (
            <>
              <button className="login-back-button" onClick={() => setStep("phone")} type="button">
                ← Back
              </button>
              <h2 id="login-heading">Enter your code</h2>
              <p className="login-subtitle">Sent to +1 {phone || "(555) 283-1947"}</p>

              <div className="otp-inputs" aria-label="One-time code">
                {otp.map((value, index) => (
                  <input
                    aria-label={`Digit ${index + 1}`}
                    inputMode="numeric"
                    key={index}
                    maxLength={1}
                    onChange={(event) => {
                      const next = [...otp];
                      next[index] = event.target.value;
                      setOtp(next);
                    }}
                    value={value}
                  />
                ))}
              </div>

              <button className="login-primary-button" type="button">
                Verify & Sign In
              </button>

              <p className="login-terms">
                Didn't get it? <a href="#resend">Resend code</a>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
