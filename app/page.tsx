"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createInvoicePdfBlob, getInvoiceFileName } from "@/lib/invoice-pdf";

type FormStep = "country" | "links" | "details" | "preview";

type InvoiceFormData = {
  country: string;
  fullName: string;
  creatorEmail: string;
  companyName: string;
  recipientType: "PERSON" | "BUSINESS" | "";
  bankName: string;
  bankCountry: string;
  routingNumber: string;
  swiftCode: string;
  accountNumber: string;
  legalCountry: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
};

type LinkCheckStatus = "idle" | "checking" | "valid" | "invalid" | "unavailable";

type LinkCheckItem = {
  status: LinkCheckStatus;
  platform: string;
};

const t0Countries = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Japan",
  "South Korea",
  "Singapore",
  "United Arab Emirates",
];

const allCountries = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Chile",
  "China (Mainland)",
  "Hong Kong SAR, China",
  "Macao SAR, China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Cote d'Ivoire",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan, China",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

const orderedCountryOptions = [
  ...t0Countries,
  ...allCountries
    .filter((country) => !t0Countries.includes(country))
    .sort((a, b) => a.localeCompare(b)),
];

const countryLookup = new Map(
  orderedCountryOptions.map((country) => [country.toLowerCase(), country]),
);

function normalizeCountryInput(rawValue: string): string {
  const value = rawValue.trim();
  if (!value) {
    return "";
  }

  const exactMatch = countryLookup.get(value.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }

  const startsWithMatch = orderedCountryOptions.find((country) =>
    country.toLowerCase().startsWith(value.toLowerCase()),
  );
  if (startsWithMatch) {
    return startsWithMatch;
  }

  const includesMatch = orderedCountryOptions.find((country) =>
    country.toLowerCase().includes(value.toLowerCase()),
  );
  return includesMatch ?? "";
}

const linkPlatforms = [
  "YouTube",
  "TikTok",
  "Instagram",
  "X",
  "Facebook",
  "Vimeo",
  "Twitch",
  "Other",
];

const usStateOptions = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

const initialFormData: InvoiceFormData = {
  country: "",
  fullName: "",
  creatorEmail: "",
  companyName: "",
  recipientType: "",
  bankName: "",
  bankCountry: "United States",
  routingNumber: "",
  swiftCode: "",
  accountNumber: "",
  legalCountry: "United States",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
};

function labelForKey(key: keyof InvoiceFormData): string {
  const map: Partial<Record<keyof InvoiceFormData, string>> = {
    fullName: "Full Name",
    creatorEmail: "Email",
    companyName: "Company / Studio Name",
    recipientType: "Recipient Type",
    bankName: "Bank",
    bankCountry: "Bank Country / Territory",
    routingNumber: "Routing Number",
    swiftCode: "SWIFT / BIC",
    accountNumber: "Account Number",
    legalCountry: "Country / Territory",
    addressLine1: "Address Line 1",
    city: "City",
    state: "State",
    postalCode: "Postal / ZIP Code",
  };

  return map[key] ?? key;
}

export default function Home() {
  const [entryMode, setEntryMode] = useState<"select" | "creator">("select");
  const [step, setStep] = useState<FormStep>("country");
  const [formData, setFormData] = useState<InvoiceFormData>(initialFormData);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState<boolean>(false);
  const [isPreparingPreviewPdf, setIsPreparingPreviewPdf] = useState<boolean>(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string>("");
  const [invoiceMeta, setInvoiceMeta] = useState<{ invoiceNumber: string; invoiceDate: string } | null>(
    null,
  );
  const [countryQuery, setCountryQuery] = useState<string>("");
  const [bankCountryQuery, setBankCountryQuery] = useState<string>("United States");
  const [legalCountryQuery, setLegalCountryQuery] = useState<string>("United States");
  const [cooperationCount, setCooperationCount] = useState<number>(1);
  const [videoLinks, setVideoLinks] = useState<string[]>([""]);
  const [videoAmounts, setVideoAmounts] = useState<string[]>([""]);
  const [linkChecks, setLinkChecks] = useState<LinkCheckItem[]>([{ status: "idle", platform: "" }]);

  const isUnitedStatesBankCountry = formData.bankCountry === "United States";
  const isUnitedStatesAddressCountry = formData.legalCountry === "United States";

  const updateField = (key: keyof InvoiceFormData, value: string) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const commitCountryField = (field: "country" | "bankCountry" | "legalCountry", inputValue: string) => {
    const normalized = normalizeCountryInput(inputValue);
    updateField(field, normalized);

    if (field === "country") {
      setCountryQuery(normalized || inputValue);
    } else if (field === "bankCountry") {
      setBankCountryQuery(normalized || inputValue);
    } else {
      setLegalCountryQuery(normalized || inputValue);
    }

    return normalized;
  };

  const continueToDetails = () => {
    const normalizedCountry = commitCountryField("country", countryQuery);
    if (!normalizedCountry) {
      setError("Please select your country first.");
      return;
    }

    if (
      !formData.legalCountry ||
      (formData.legalCountry === "United States" && legalCountryQuery === "United States")
    ) {
      updateField("legalCountry", normalizedCountry);
      setLegalCountryQuery(normalizedCountry);
    }
    if (
      !formData.bankCountry ||
      (formData.bankCountry === "United States" && bankCountryQuery === "United States")
    ) {
      updateField("bankCountry", normalizedCountry);
      setBankCountryQuery(normalizedCountry);
    }

    setError("");
    setStep("links");
  };

  const updateCooperationCount = (count: number) => {
    const safeCount = Math.min(10, Math.max(1, count));
    setCooperationCount(safeCount);
    setVideoLinks((previous) => {
      const next = [...previous];
      while (next.length < safeCount) {
        next.push("");
      }
      return next.slice(0, safeCount);
    });
    setVideoAmounts((previous) => {
      const next = [...previous];
      while (next.length < safeCount) {
        next.push("");
      }
      return next.slice(0, safeCount);
    });
    setLinkChecks((previous) => {
      const next = [...previous];
      while (next.length < safeCount) {
        next.push({ status: "idle", platform: "" });
      }
      return next.slice(0, safeCount);
    });
  };

  const updateLinkAt = (index: number, value: string) => {
    setVideoLinks((previous) => previous.map((item, idx) => (idx === index ? value : item)));
    setLinkChecks((previous) =>
      previous.map((item, idx) =>
        idx === index
          ? {
              status: "idle",
              platform: "",
            }
          : item,
      ),
    );
  };

  const updateVideoAmountAt = (index: number, value: string) => {
    setVideoAmounts((previous) => previous.map((item, idx) => (idx === index ? value : item)));
  };

  const verifySingleLink = useCallback(async (index: number) => {
    const url = videoLinks[index]?.trim();
    if (!url) {
      setLinkChecks((previous) =>
        previous.map((item, idx) =>
          idx === index ? { ...item, status: "invalid", platform: "" } : item,
        ),
      );
      return false;
    }

    setLinkChecks((previous) =>
      previous.map((item, idx) =>
        idx === index ? { ...item, status: "checking", platform: item.platform } : item,
      ),
    );

    try {
      const response = await fetch("/api/verify-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        status?: LinkCheckStatus;
        platform?: string;
      };

      const isValid = Boolean(response.ok && result.ok);
      const status: LinkCheckStatus = isValid
        ? "valid"
        : result.status === "unavailable"
          ? "unavailable"
          : "invalid";
      setLinkChecks((previous) =>
        previous.map((item, idx) =>
          idx === index
            ? {
                status,
                platform: result.platform ?? "",
              }
            : item,
        ),
      );

      return isValid;
    } catch {
      setLinkChecks((previous) =>
        previous.map((item, idx) =>
          idx === index ? { ...item, status: "unavailable", platform: "" } : item,
        ),
      );
      return false;
    }
  }, [videoLinks]);

  useEffect(() => {
    const hasAnyInput = videoLinks.slice(0, cooperationCount).some((link) => link.trim().length > 0);
    if (!hasAnyInput) {
      return;
    }

    const timer = setTimeout(() => {
      videoLinks.slice(0, cooperationCount).forEach((link, idx) => {
        if (link.trim()) {
          void verifySingleLink(idx);
        }
      });
    }, 700);

    return () => {
      clearTimeout(timer);
    };
  }, [videoLinks, cooperationCount, verifySingleLink]);

  const continueToInvoiceDetails = () => {
    if (!canSubmitLinks) {
      setError("Please wait until all links are verified.");
      return;
    }
    setError("");
    setStep("details");
  };

  const visibleLinks = videoLinks.slice(0, cooperationCount);
  const visibleAmounts = videoAmounts.slice(0, cooperationCount);
  const visibleChecks = linkChecks.slice(0, cooperationCount);
  const allLinksFilled = visibleLinks.every((link) => link.trim().length > 0);
  const allAmountsValid = visibleAmounts.every((amount) => Number(amount) > 0);
  const anyLinkChecking = visibleChecks.some((item) => item?.status === "checking");
  const allLinksVerified =
    visibleChecks.length === cooperationCount &&
    visibleChecks.every((item) => item?.status === "valid");
  const canSubmitLinks =
    allLinksFilled &&
    allAmountsValid &&
    allLinksVerified &&
    !anyLinkChecking;

  const validateBeforePreview = () => {
    const requiredFields: Array<keyof InvoiceFormData> = [
      "fullName",
      "creatorEmail",
      "recipientType",
      "bankName",
      "bankCountry",
      "accountNumber",
      "legalCountry",
      "addressLine1",
      "city",
      "postalCode",
    ];
    if (isUnitedStatesBankCountry) {
      requiredFields.push("routingNumber");
    } else {
      requiredFields.push("swiftCode");
    }
    if (isUnitedStatesAddressCountry) {
      requiredFields.push("state");
    }

    const missing = requiredFields.filter((field) => !formData[field]?.trim());
    if (missing.length > 0) {
      const labels = missing.map(labelForKey).join(", ");
      setError(`Please complete required fields: ${labels}.`);
      return false;
    }

    setError("");
    return true;
  };

  const submitForPreview = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateBeforePreview()) {
      return;
    }

    setIsPreparingPreviewPdf(true);
    setError("");

    try {
      const nextPdfUrl = await buildPdf();
      setPreviewPdfUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return nextPdfUrl;
      });
      setStep("preview");
    } catch {
      setError("Failed to generate preview PDF. Please check the form and try again.");
    } finally {
      setIsPreparingPreviewPdf(false);
    }
  };

  const goToPreviousStep = () => {
    if (step === "links") {
      setStep("country");
      return;
    }
    if (step === "details") {
      setStep("links");
      return;
    }
    if (step === "preview") {
      setPreviewPdfUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return "";
      });
      setStep("details");
    }
  };

  const formatUsd = (rawValue: string): string => {
    const amount = Number(rawValue || 0);
    return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
  };

  const downloadPdfFromUrl = (blobUrl: string) => {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = getInvoiceFileName(formData.fullName, invoiceMeta?.invoiceNumber);
    link.click();
  };

  const buildPdf = async () => {
    const invoiceMetaResponse = await fetch("/api/invoice-number", {
      method: "GET",
      cache: "no-store",
    });
    if (!invoiceMetaResponse.ok) {
      throw new Error("Failed to generate invoice number.");
    }
    const invoiceMeta = (await invoiceMetaResponse.json()) as {
      invoiceNumber?: string;
      dateText?: string;
    };
    const invoiceNo = invoiceMeta.invoiceNumber;
    const dateText = invoiceMeta.dateText;
    if (!invoiceNo || !dateText) {
      throw new Error("Invalid invoice number response.");
    }

    setInvoiceMeta({ invoiceNumber: invoiceNo, invoiceDate: dateText });

    const lineItems = videoLinks
      .slice(0, cooperationCount)
      .map((url, idx) => ({
        url: url.trim(),
        platform: linkChecks[idx]?.platform || "Other",
        amount: Number(formatUsd(videoAmounts[idx] || "0")),
      }))
      .filter((item) => item.url.length > 0 && item.amount > 0);

    const blob = await createInvoicePdfBlob({
      invoiceNumber: invoiceNo,
      invoiceDate: dateText,
      fullName: formData.fullName,
      creatorEmail: formData.creatorEmail,
      bankName: formData.bankName,
      bankCountry: formData.bankCountry,
      routingNumber: formData.routingNumber,
      swiftCode: formData.swiftCode,
      accountNumber: formData.accountNumber,
      legalCountry: formData.legalCountry,
      addressLine1: formData.addressLine1,
      addressLine2: formData.addressLine2,
      city: formData.city,
      state: formData.state,
      postalCode: formData.postalCode,
      videos: lineItems,
    });
    return URL.createObjectURL(blob);
  };

  useEffect(() => {
    return () => {
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
    };
  }, [previewPdfUrl]);

  const submitInvoice = async () => {
    setIsSubmittingInvoice(true);
    setNotice("");
    setError("");

    try {
      let pdfUrl = previewPdfUrl;
      if (!pdfUrl) {
        pdfUrl = await buildPdf();
      }
      downloadPdfFromUrl(pdfUrl);

      const response = await fetch("/api/creator-submission", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          invoiceNumber: invoiceMeta?.invoiceNumber,
          invoiceDate: invoiceMeta?.invoiceDate,
          videoItems: videoLinks.slice(0, cooperationCount).map((url, idx) => ({
            url,
            platform: linkChecks[idx]?.platform || "Other",
            campaignTag: "",
            amount: Number(videoAmounts[idx] || 0),
            verified: linkChecks[idx]?.status === "valid",
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Background sync failed.");
      }

      setNotice("Invoice submitted successfully. PDF downloaded.");
    } catch {
      setError("Invoice submission failed. PDF was downloaded. Please try submit again.");
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  if (entryMode === "select") {
    return (
      <main className="landing-wrapper">
        <section className="landing-card">
          <Image
            src="/fureverteam-logo-transparent.png"
            alt="FureverTeam Logo"
            width={420}
            height={280}
            className="landing-logo"
            priority
          />
          <h1 className="portal-title">FureverTeam Creator Portal</h1>
          <p className="landing-subtitle">Choose your entry point to continue.</p>
          <div className="landing-actions">
            <button type="button" className="landing-btn landing-btn-primary" onClick={() => setEntryMode("creator")}>
              I am creator / agency
            </button>
            <Link href="/admin" className="landing-btn landing-btn-minor">
              I am from fureverteam
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="portal-wrapper">
      <section className="portal-shell">
        <div className="top-entry-row">
          <Link href="/admin" className="landing-btn landing-btn-minor">
            I am from fureverteam
          </Link>
        </div>
        <header className="hero-card">
          <div>
            <h1 className="portal-title">FureverTeam Creator Portal</h1>
            <p className="portal-subtitle">
              Submit invoice details in minutes. Choose your country, fill your form, preview, and
              generate your invoice PDF.
            </p>
          </div>
        </header>

        <section className="content-grid">
          <aside className="info-panel">
            <h2>Quick Guide</h2>
            <ul className="guide-list">
              <li>Select country first</li>
              <li>Fill invoice details</li>
              <li>Review every field</li>
              <li>Generate and download PDF</li>
            </ul>

            <div className="status-card">
              <h3>Current Step</h3>
              <div className="step-indicator">
                <span className={step === "country" ? "active-step" : ""}>1. Country</span>
                <span className={step === "links" ? "active-step" : ""}>2. Links</span>
                <span className={step === "details" ? "active-step" : ""}>3. Details</span>
                <span className={step === "preview" ? "active-step" : ""}>4. Preview</span>
              </div>
            </div>
          </aside>

          <section className="portal-card">
            {step !== "country" && (
              <div className="step-back-row">
                <button type="button" className="secondary-btn" onClick={goToPreviousStep}>
                  ← Back to previous step
                </button>
              </div>
            )}

            {step === "country" && (
              <div className="country-step">
                <label htmlFor="country">Select your country</label>
                <input
                  id="country"
                  list="country-options"
                  value={countryQuery}
                  onChange={(event) => setCountryQuery(event.target.value)}
                  onBlur={(event) => {
                    commitCountryField("country", event.target.value);
                  }}
                  placeholder="Type country name..."
                  autoComplete="off"
                />
                <datalist id="country-options">
                  {orderedCountryOptions.map((countryName) => (
                    <option key={countryName} value={countryName} />
                  ))}
                </datalist>
                <button type="button" onClick={continueToDetails}>
                  Continue
                </button>
              </div>
            )}

            {step === "links" && (
              <div className="invoice-form">
                <label>
                  Collaboration quantity
                  <select
                    value={cooperationCount}
                    onChange={(event) => updateCooperationCount(Number(event.target.value))}
                  >
                    {Array.from({ length: 10 }, (_, idx) => idx + 1).map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="links-block">
                  {videoLinks.slice(0, cooperationCount).map((link, index) => {
                    const check = linkChecks[index] ?? { status: "idle", platform: "" };
                    const statusText =
                      check.status === "valid"
                        ? "Verified"
                        : check.status === "unavailable"
                          ? "Verification unavailable"
                          : check.status === "invalid"
                            ? "Not verified"
                            : check.status === "checking"
                              ? "Checking..."
                              : "Waiting";

                    return (
                      <div key={index} className="link-item">
                        <label>
                          Link {index + 1}
                          <input
                            value={link}
                            onChange={(event) => updateLinkAt(index, event.target.value)}
                            placeholder="Paste video link"
                            autoComplete="off"
                          />
                        </label>
                        <div className="amount-row">
                          <label>
                            Amount (USD)
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={videoAmounts[index] || ""}
                              onChange={(event) => updateVideoAmountAt(index, event.target.value)}
                              placeholder="0.00"
                            />
                          </label>
                        </div>

                        <div className="link-meta-row">
                          <span className="platform-pill">
                            {check.platform || linkPlatforms[linkPlatforms.length - 1]}
                          </span>
                          <span
                            className={`link-status ${
                              check.status === "valid"
                                ? "status-valid"
                                : check.status === "unavailable"
                                  ? "status-unavailable"
                                  : check.status === "invalid"
                                    ? "status-invalid"
                                    : check.status === "checking"
                                      ? "status-checking"
                                      : ""
                            }`}
                          >
                            {check.status === "valid" ? "✓ " : ""}
                            {statusText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="actions">
                  <button type="button" className="secondary-btn" onClick={() => setStep("country")}>
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void continueToInvoiceDetails()}
                    disabled={!canSubmitLinks}
                  >
                    Submit
                  </button>
                </div>
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
                  <span className="form-section-title">Select recipient type</span>
                  <div className="choice-grid">
                    <button
                      type="button"
                      className={`choice-card ${formData.recipientType === "PERSON" ? "choice-card-active" : ""}`}
                      onClick={() => updateField("recipientType", "PERSON")}
                    >
                      Person
                    </button>
                    <button
                      type="button"
                      className={`choice-card ${formData.recipientType === "BUSINESS" ? "choice-card-active" : ""}`}
                      onClick={() => updateField("recipientType", "BUSINESS")}
                    >
                      Business
                    </button>
                  </div>
                </label>

                <h3 className="form-section-title">Bank details</h3>

                <label>
                  Bank *
                  <input
                    value={formData.bankName}
                    onChange={(event) => updateField("bankName", event.target.value)}
                    placeholder="Bank Name"
                    required
                  />
                </label>

                <label>
                  Bank Country or Territory *
                  <input
                    list="country-options"
                    value={bankCountryQuery}
                    onChange={(event) => {
                      const value = event.target.value;
                      setBankCountryQuery(value);
                      updateField("bankCountry", normalizeCountryInput(value));
                    }}
                    onBlur={(event) => {
                      commitCountryField("bankCountry", event.target.value);
                    }}
                    placeholder="Type country name..."
                    autoComplete="off"
                    required
                  />
                </label>

                {isUnitedStatesBankCountry ? (
                  <>
                    <label>
                      Routing number *
                      <input
                        value={formData.routingNumber}
                        onChange={(event) => updateField("routingNumber", event.target.value)}
                        placeholder="Routing Number"
                        required
                      />
                    </label>
                    <p className="helper-text">
                      This information is required to send electronic payments in the U.S.
                    </p>
                  </>
                ) : (
                  <>
                    <label>
                      SWIFT / BIC *
                      <input
                        value={formData.swiftCode}
                        onChange={(event) => updateField("swiftCode", event.target.value)}
                        placeholder="SWIFT / BIC"
                        required
                      />
                    </label>
                    <p className="helper-text">
                      Use the international transfer code for your local receiving bank.
                    </p>
                  </>
                )}

                <label>
                  {isUnitedStatesBankCountry ? "Account number *" : "Account number / IBAN *"}
                  <input
                    value={formData.accountNumber}
                    onChange={(event) => updateField("accountNumber", event.target.value)}
                    placeholder={isUnitedStatesBankCountry ? "Account Number" : "Account Number / IBAN"}
                    required
                  />
                </label>
                <p className="helper-text">
                  {isUnitedStatesBankCountry
                    ? "This information is required to send domestic ACH payments."
                    : "Use your local account identifier for international receiving transfers."}
                </p>

                <h3 className="form-section-title">Legal address</h3>

                <label>
                  Country or Territory *
                  <input
                    list="country-options"
                    value={legalCountryQuery}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLegalCountryQuery(value);
                      updateField("legalCountry", normalizeCountryInput(value));
                    }}
                    onBlur={(event) => {
                      commitCountryField("legalCountry", event.target.value);
                    }}
                    placeholder="Type country name..."
                    autoComplete="off"
                    required
                  />
                </label>
                <p className="helper-text">
                  Entering your address will allow us to send you electronic payments.
                </p>

                <label>
                  Address Line 1 *
                  <input
                    value={formData.addressLine1}
                    onChange={(event) => updateField("addressLine1", event.target.value)}
                    placeholder="Recipient's Address Line 1"
                    required
                  />
                </label>

                <label>
                  Address Line 2
                  <input
                    value={formData.addressLine2}
                    onChange={(event) => updateField("addressLine2", event.target.value)}
                    placeholder="Recipient's Address Line 2"
                  />
                </label>

                <label>
                  City *
                  <input
                    value={formData.city}
                    onChange={(event) => updateField("city", event.target.value)}
                    required
                  />
                </label>

                <div className="row-2">
                  <label>
                    {isUnitedStatesAddressCountry ? "State *" : "State / Province / Region"}
                    {formData.legalCountry === "United States" ? (
                      <select
                        value={formData.state}
                        onChange={(event) => updateField("state", event.target.value)}
                        required
                      >
                        <option value="">Select a state</option>
                        {usStateOptions.map((stateOption) => (
                          <option key={stateOption.code} value={stateOption.name}>
                            {stateOption.name} ({stateOption.code})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={formData.state}
                        onChange={(event) => updateField("state", event.target.value)}
                        placeholder="State / Province / Region"
                      />
                    )}
                  </label>
                  <label>
                    Postal / ZIP Code *
                    <input
                      value={formData.postalCode}
                      onChange={(event) => updateField("postalCode", event.target.value)}
                      required
                    />
                  </label>
                </div>

                <div className="actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setStep("links")}
                  >
                    Back
                  </button>
                  <button type="submit" disabled={isPreparingPreviewPdf}>
                    {isPreparingPreviewPdf ? "Generating Preview..." : "Preview Invoice"}
                  </button>
                </div>
              </form>
            )}

            {step === "preview" && (
              <div className="preview-box">
                <h2>Invoice Preview</h2>
                <p className="helper-text">
                  Here is the final invoice layout exactly as PDF output. Review it and submit when ready.
                </p>
                <div className="pdf-preview-shell">
                  {isPreparingPreviewPdf ? (
                    <p className="helper-text">Generating preview PDF...</p>
                  ) : previewPdfUrl ? (
                    <iframe
                      title="Invoice PDF Preview"
                      src={previewPdfUrl}
                      className="pdf-preview-frame"
                    />
                  ) : (
                    <p className="helper-text">Preview PDF is not ready yet. Please click back and try again.</p>
                  )}
                </div>

                <div className="actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setStep("details")}
                  >
                    Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={submitInvoice}
                    disabled={isSubmittingInvoice || isPreparingPreviewPdf || !previewPdfUrl}
                  >
                    {isSubmittingInvoice ? "Submitting..." : "Submit Invoice"}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="error-text">{error}</p>}
            {notice && <p className="notice-text">{notice}</p>}
          </section>
        </section>

        <section className="feature-strip">
          <article>
            <h3>Country Routing</h3>
            <p>Country first, then localized tax/currency defaults.</p>
          </article>
          <article>
            <h3>Invoice Preview</h3>
            <p>Creators can check every field before final PDF generation.</p>
          </article>
          <article>
            <h3>Creator Ready</h3>
            <p>Clean flow, branded portal, and one-click invoice download.</p>
          </article>
        </section>
      </section>
    </main>
  );
}
