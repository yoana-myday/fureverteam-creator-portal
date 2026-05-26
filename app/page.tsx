"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import jsPDF from "jspdf";

type FormStep = "country" | "details" | "preview";
type CountryCode = "US" | "UK" | "CN" | "OTHER";

type InvoiceFormData = {
  country: CountryCode | "";
  fullName: string;
  creatorEmail: string;
  billingAddress: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  serviceDescription: string;
  currency: string;
  amount: string;
  payoutMethod: string;
  payoutAccount: string;
  taxNumber: string;
  companyName: string;
};

const countryOptions: Array<{ value: CountryCode; label: string }> = [
  { value: "US", label: "United States" },
  { value: "UK", label: "United Kingdom" },
  { value: "CN", label: "China" },
  { value: "OTHER", label: "Other" },
];

const taxLabelMap: Record<CountryCode, string> = {
  US: "Tax ID / EIN",
  UK: "UTR / VAT Number",
  CN: "Taxpayer Identification Number",
  OTHER: "Tax Number",
};

const currencyMap: Record<CountryCode, string> = {
  US: "USD",
  UK: "GBP",
  CN: "CNY",
  OTHER: "USD",
};

const todayISO = new Date().toISOString().slice(0, 10);

const initialFormData: InvoiceFormData = {
  country: "",
  fullName: "",
  creatorEmail: "",
  billingAddress: "",
  invoiceNumber: "",
  invoiceDate: todayISO,
  dueDate: "",
  serviceDescription: "",
  currency: "USD",
  amount: "",
  payoutMethod: "",
  payoutAccount: "",
  taxNumber: "",
  companyName: "",
};

function labelForKey(key: keyof InvoiceFormData): string {
  const map: Partial<Record<keyof InvoiceFormData, string>> = {
    fullName: "Full Name",
    creatorEmail: "Email",
    billingAddress: "Billing Address",
    invoiceNumber: "Invoice Number",
    invoiceDate: "Invoice Date",
    dueDate: "Due Date",
    serviceDescription: "Service Description",
    currency: "Currency",
    amount: "Amount",
    payoutMethod: "Payout Method",
    payoutAccount: "Payout Account",
    taxNumber: "Tax Number",
    companyName: "Company / Studio Name",
  };

  return map[key] ?? key;
}

export default function Home() {
  const [step, setStep] = useState<FormStep>("country");
  const [formData, setFormData] = useState<InvoiceFormData>(initialFormData);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const requiredFields: Array<keyof InvoiceFormData> = useMemo(
    () => [
      "fullName",
      "creatorEmail",
      "billingAddress",
      "invoiceNumber",
      "invoiceDate",
      "serviceDescription",
      "currency",
      "amount",
      "payoutMethod",
      "payoutAccount",
    ],
    [],
  );

  const taxLabel = formData.country ? taxLabelMap[formData.country] : "Tax Number";

  const updateField = (key: keyof InvoiceFormData, value: string) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const pickCountry = (country: CountryCode) => {
    setFormData((previous) => ({
      ...previous,
      country,
      currency: currencyMap[country],
      taxNumber: "",
    }));
    setError("");
  };

  const continueToDetails = () => {
    if (!formData.country) {
      setError("Please select your country first.");
      return;
    }

    setError("");
    setStep("details");
  };

  const validateBeforePreview = () => {
    const missing = requiredFields.filter((field) => !formData[field]?.trim());
    if (missing.length > 0) {
      const labels = missing.map(labelForKey).join(", ");
      setError(`Please complete required fields: ${labels}.`);
      return false;
    }

    setError("");
    return true;
  };

  const submitForPreview = (event: FormEvent) => {
    event.preventDefault();
    if (!validateBeforePreview()) {
      return;
    }

    setStep("preview");
  };

  const buildPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("FureverTeam Creator Invoice", 20, 20);

    doc.setFontSize(11);
    const lines = [
      `Creator: ${formData.fullName}`,
      `Company/Studio: ${formData.companyName || "-"}`,
      `Country: ${
        countryOptions.find((item) => item.value === formData.country)?.label ?? "-"
      }`,
      `${taxLabel}: ${formData.taxNumber || "-"}`,
      `Email: ${formData.creatorEmail}`,
      `Billing Address: ${formData.billingAddress}`,
      `Invoice Number: ${formData.invoiceNumber}`,
      `Invoice Date: ${formData.invoiceDate}`,
      `Due Date: ${formData.dueDate || "-"}`,
      `Service Description: ${formData.serviceDescription}`,
      `Amount: ${formData.currency} ${formData.amount}`,
      `Payout Method: ${formData.payoutMethod}`,
      `Payout Account: ${formData.payoutAccount}`,
    ];

    let y = 34;
    lines.forEach((line) => {
      const split = doc.splitTextToSize(line, 170);
      doc.text(split, 20, y);
      y += split.length * 7;
    });

    doc.save(`invoice-${formData.invoiceNumber || "draft"}.pdf`);
  };

  const generateInvoice = async () => {
    setIsGenerating(true);
    setNotice("");
    setError("");

    try {
      buildPdf();

      const response = await fetch("/api/creator-submission", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Background sync failed.");
      }

      setNotice("Invoice PDF generated successfully.");
    } catch {
      setNotice("Invoice PDF generated successfully.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="portal-wrapper">
      <section className="portal-card">
        <Image
          src="/fureverteam-logo.png"
          alt="FureverTeam Creator Portal logo"
          width={380}
          height={260}
          className="portal-logo"
          priority
        />

        <h1>FureverTeam Creator Portal</h1>
        <p className="portal-subtitle">
          Fill in your invoice details, review, then generate your PDF.
        </p>

        <div className="step-indicator">
          <span className={step === "country" ? "active-step" : ""}>1. Country</span>
          <span className={step === "details" ? "active-step" : ""}>2. Details</span>
          <span className={step === "preview" ? "active-step" : ""}>3. Preview</span>
        </div>

        {step === "country" && (
          <div className="country-step">
            <label htmlFor="country">Select your country</label>
            <select
              id="country"
              value={formData.country}
              onChange={(event) => pickCountry(event.target.value as CountryCode)}
            >
              <option value="">-- Please choose --</option>
              {countryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={continueToDetails}>
              Continue
            </button>
          </div>
        )}

        {step === "details" && (
          <form className="invoice-form" onSubmit={submitForPreview}>
            <label>
              Full Name *
              <input
                value={formData.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                required
              />
            </label>

            <label>
              Company / Studio Name
              <input
                value={formData.companyName}
                onChange={(event) => updateField("companyName", event.target.value)}
              />
            </label>

            <label>
              Email *
              <input
                type="email"
                value={formData.creatorEmail}
                onChange={(event) => updateField("creatorEmail", event.target.value)}
                required
              />
            </label>

            <label>
              Billing Address *
              <textarea
                value={formData.billingAddress}
                onChange={(event) => updateField("billingAddress", event.target.value)}
                rows={3}
                required
              />
            </label>

            <label>
              {taxLabel}
              <input
                value={formData.taxNumber}
                onChange={(event) => updateField("taxNumber", event.target.value)}
              />
            </label>

            <label>
              Invoice Number *
              <input
                value={formData.invoiceNumber}
                onChange={(event) => updateField("invoiceNumber", event.target.value)}
                required
              />
            </label>

            <div className="row-2">
              <label>
                Invoice Date *
                <input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(event) => updateField("invoiceDate", event.target.value)}
                  required
                />
              </label>

              <label>
                Due Date
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(event) => updateField("dueDate", event.target.value)}
                />
              </label>
            </div>

            <label>
              Service Description *
              <textarea
                value={formData.serviceDescription}
                onChange={(event) => updateField("serviceDescription", event.target.value)}
                rows={3}
                required
              />
            </label>

            <div className="row-2">
              <label>
                Currency *
                <input
                  value={formData.currency}
                  onChange={(event) => updateField("currency", event.target.value)}
                  required
                />
              </label>

              <label>
                Amount *
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(event) => updateField("amount", event.target.value)}
                  required
                />
              </label>
            </div>

            <label>
              Payout Method *
              <input
                value={formData.payoutMethod}
                onChange={(event) => updateField("payoutMethod", event.target.value)}
                placeholder="Bank Transfer / PayPal / Wise"
                required
              />
            </label>

            <label>
              Payout Account *
              <input
                value={formData.payoutAccount}
                onChange={(event) => updateField("payoutAccount", event.target.value)}
                placeholder="Bank account or payout email"
                required
              />
            </label>

            <div className="actions">
              <button type="button" className="secondary-btn" onClick={() => setStep("country")}>
                Back
              </button>
              <button type="submit">Preview Invoice</button>
            </div>
          </form>
        )}

        {step === "preview" && (
          <div className="preview-box">
            <h2>Invoice Preview</h2>
            <ul>
              <li>
                <strong>Country:</strong>{" "}
                {countryOptions.find((item) => item.value === formData.country)?.label}
              </li>
              <li>
                <strong>Creator:</strong> {formData.fullName}
              </li>
              <li>
                <strong>Company/Studio:</strong> {formData.companyName || "-"}
              </li>
              <li>
                <strong>Email:</strong> {formData.creatorEmail}
              </li>
              <li>
                <strong>Invoice Number:</strong> {formData.invoiceNumber}
              </li>
              <li>
                <strong>Invoice Date:</strong> {formData.invoiceDate}
              </li>
              <li>
                <strong>Due Date:</strong> {formData.dueDate || "-"}
              </li>
              <li>
                <strong>Service:</strong> {formData.serviceDescription}
              </li>
              <li>
                <strong>Amount:</strong> {formData.currency} {formData.amount}
              </li>
              <li>
                <strong>Payout:</strong> {formData.payoutMethod} ({formData.payoutAccount})
              </li>
              <li>
                <strong>{taxLabel}:</strong> {formData.taxNumber || "-"}
              </li>
            </ul>

            <div className="actions">
              <button type="button" className="secondary-btn" onClick={() => setStep("details")}>
                Edit Details
              </button>
              <button type="button" onClick={generateInvoice} disabled={isGenerating}>
                {isGenerating ? "Generating..." : "Generate Invoice"}
              </button>
            </div>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        {notice && <p className="notice-text">{notice}</p>}
      </section>
    </main>
  );
}
