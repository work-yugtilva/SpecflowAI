"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { posthog } from "@/lib/posthog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  firstName: string;
  lastName: string;
  jobTitle: string;
  workExperience: string;
  companyName: string;
  companyType: string;
}

interface FormErrors {
  firstName?: string;
  jobTitle?: string;
  companyType?: string;
  workExperience?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY_TYPES = ["Startup", "Enterprise", "Agency", "Freelancer", "Other"];

const INITIAL_FORM: FormData = {
  firstName: "",
  lastName: "",
  jobTitle: "",
  workExperience: "",
  companyName: "",
  companyType: "",
};

// ─── FormField ────────────────────────────────────────────────────────────────

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[13px] font-medium"
        style={{ color: "#6B6B6B" }}
      >
        {label}
        {required && (
          <span className="ml-0.5" style={{ color: "#E8561B" }}>*</span>
        )}
      </label>
      {children}
      {error && (
        <p className="text-[11.5px]" style={{ color: "#EF4444" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Onboarding Page ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Validity check for enabling the CTA
  const isValid = Boolean(
    form.firstName.trim() &&
      form.jobTitle.trim() &&
      form.companyType &&
      (form.workExperience === "" ||
        (Number(form.workExperience) >= 0 && Number(form.workExperience) <= 50))
  );

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (attempted) validate({ ...form, [field]: value });
  }

  function validate(data: FormData): boolean {
    const errs: FormErrors = {};
    if (!data.firstName.trim()) errs.firstName = "First name is required.";
    if (!data.jobTitle.trim()) errs.jobTitle = "Job title is required.";
    if (!data.companyType) errs.companyType = "Please select a company type.";
    if (
      data.workExperience !== "" &&
      (Number(data.workExperience) < 0 || Number(data.workExperience) > 50)
    ) {
      errs.workExperience = "Must be between 0 and 50.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    setAttempted(true);
    if (!validate(form)) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase.from("user_profiles").upsert({
          user_id: user.id,
          first_name: form.firstName,
          last_name: form.lastName,
          job_title: form.jobTitle,
          company_name: form.companyName,
          company_type: form.companyType,
          work_experience: form.workExperience !== "" ? Number(form.workExperience) : null,
          onboarding_completed_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (profileError) console.error("Failed to save onboarding profile:", profileError);
      }
      posthog.capture("onboarding_completed");
    } catch (e) {
      console.error("Onboarding profile save error:", e);
      setSubmitting(false);
    }
    window.location.href = "/dashboard";
  }

  // Shared input style (no icon prefix offset)
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.875rem",
    background: "#FFFFFF",
    border: "1.5px solid #E4DDD4",
    borderRadius: 10,
    fontSize: "0.9375rem",
    color: "#0D0D0D",
    outline: "none",
    fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  };

  function focusStyle(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = "#E8561B";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,86,27,0.12)";
  }
  function blurStyle(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = "#E4DDD4";
    e.currentTarget.style.boxShadow = "none";
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      {/* Wordmark */}
      <a
        href="/"
        className="mb-8 flex items-center gap-2 select-none"
        style={{ textDecoration: "none" }}
      >
        <div className="relative overflow-hidden rounded-md flex-shrink-0" style={{ width: 28, height: 28 }}>
          <Image src="/logo.jpeg" alt="SpecFlow" fill className="object-cover" priority />
        </div>
        <span
          style={{
            fontSize: "1.375rem",
            fontWeight: 600,
            color: "#0D0D0D",
            letterSpacing: "-0.025em",
            fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
          }}
        >
          SpecFlow
        </span>
      </a>

      {/* Card */}
      <div
        className="fade-up w-full"
        style={{
          maxWidth: 500,
          background: "#FFFFFF",
          border: "1px solid #E4DDD4",
          borderRadius: 20,
          boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
          padding: "2rem 2rem",
        }}
      >
        {/* Progress badge */}
        <div className="flex items-center gap-2 mb-5">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={{
              background: "rgba(232,86,27,0.08)",
              border: "1px solid rgba(232,86,27,0.2)",
              color: "#E8561B",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#E8561B" }}
            />
            Account setup
          </div>
        </div>

        {/* Heading */}
        <h1
          className="font-display"
          style={{
            fontSize: "1.625rem",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            color: "#0D0D0D",
            lineHeight: 1.2,
            marginBottom: "0.375rem",
          }}
        >
          Tell us about you.
        </h1>
        <p
          className="text-[13.5px] mb-7"
          style={{ color: "#6B6B6B", lineHeight: 1.6 }}
        >
          This helps tailor your workspace and AI outputs.
        </p>

        {/* Form */}
        <div className="flex flex-col gap-4">
          {/* Row 1: First Name + Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First Name" required error={errors.firstName}>
              <input
                type="text"
                autoFocus
                placeholder="Yug"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </FormField>
            <FormField label="Last Name">
              <input
                type="text"
                placeholder="Sharma"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </FormField>
          </div>

          {/* Row 2: Job Title */}
          <FormField label="Job Title" required error={errors.jobTitle}>
            <input
              type="text"
              placeholder="Product Manager"
              value={form.jobTitle}
              onChange={(e) => update("jobTitle", e.target.value)}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </FormField>

          {/* Row 3: Work Experience + Company Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Experience (years)" error={errors.workExperience}>
              <input
                type="number"
                placeholder="3"
                min={0}
                max={50}
                value={form.workExperience}
                onChange={(e) => update("workExperience", e.target.value)}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </FormField>
            <FormField label="Company Name">
              <input
                type="text"
                placeholder="Acme Inc."
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </FormField>
          </div>

          {/* Row 4: Company Type */}
          <FormField label="Company Type" required error={errors.companyType}>
            <div className="flex flex-wrap gap-2 mt-0.5">
              {COMPANY_TYPES.map((type) => {
                const active = form.companyType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => update("companyType", type)}
                    style={{
                      padding: "0.45rem 0.9rem",
                      borderRadius: 8,
                      fontSize: "13px",
                      fontWeight: active ? 500 : 400,
                      fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                      background: active ? "rgba(232,86,27,0.10)" : "#FFFFFF",
                      border: active
                        ? "1.5px solid #E8561B"
                        : "1.5px solid #E4DDD4",
                      color: active ? "#0D0D0D" : "#6B6B6B",
                      cursor: "pointer",
                      transition:
                        "background 150ms ease, border-color 150ms ease, color 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "rgba(0,0,0,0.03)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "#FFFFFF";
                      }
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </FormField>

          {/* CTA */}
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="btn-dark w-full mt-2"
            style={{
              opacity: isValid && !submitting ? 1 : 0.38,
              cursor: isValid && !submitting ? "pointer" : "not-allowed",
              transition: "opacity 200ms ease",
              fontSize: "0.9375rem",
              padding: "0.75rem 1.5rem",
            }}
          >
            {submitting ? "Setting up..." : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
