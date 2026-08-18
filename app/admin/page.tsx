"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CreatorSubmission, InvoiceStatus } from "@/lib/submission-store";

type AdminResponse = {
  submissions: CreatorSubmission[];
  metrics: {
    paidTotal: number;
    pendingPaymentTotal: number;
  };
};

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function AdminPage() {
  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<AdminResponse | null>(null);

  const fetchData = async (adminCode: string): Promise<boolean> => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/submissions", {
        headers: { "x-admin-code": adminCode },
      });
      if (response.status === 401) {
        setError("Verification code is incorrect.");
        return false;
      }
      if (!response.ok) {
        throw new Error("Failed to load dashboard");
      }
      const payload = (await response.json()) as AdminResponse;
      setData(payload);
      return true;
    } catch {
      setError("Failed to load admin data.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unlock = async () => {
    const authorized = await fetchData(code);
    setAuthed(authorized);
  };

  const updateStatus = async (id: string, status: InvoiceStatus) => {
    if (!authed) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-code": code,
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error("Update failed");
      }
      await fetchData(code);
    } catch {
      setError("Failed to update invoice status.");
      setLoading(false);
    }
  };

  const groups = useMemo(() => {
    const submissions = data?.submissions ?? [];
    return {
      pending: submissions.filter((item) => item.invoiceStatus === "pending"),
      approved: submissions.filter((item) => item.invoiceStatus === "approved"),
      paid: submissions.filter((item) => item.invoiceStatus === "paid"),
    };
  }, [data]);

  if (!authed) {
    return (
      <main className="landing-wrapper">
        <section className="admin-gate">
          <h1 className="portal-title">FureverTeam Dashboard Access</h1>
          <p className="landing-subtitle">Enter verification code to continue.</p>
          <input
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Verification code"
          />
          <button type="button" onClick={() => void unlock()}>
            Enter Dashboard
          </button>
          {error && <p className="error-text">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-wrapper">
      <header className="admin-header">
        <h1 className="portal-title">FureverTeam Finance Dashboard</h1>
        <div className="actions">
          <Link href="/" className="secondary-btn">
            Check creator page
          </Link>
          <button type="button" className="admin-primary-btn" onClick={() => void fetchData(code)}>
            Refresh
          </button>
        </div>
      </header>

      <section className="admin-metric-grid">
        <article className="metric-card">
          <h3>Total Spend (Paid)</h3>
          <p>{formatMoney(data?.metrics.paidTotal ?? 0)}</p>
        </article>
        <article className="metric-card">
          <h3>Pending Payment</h3>
          <p>{formatMoney(data?.metrics.pendingPaymentTotal ?? 0)}</p>
        </article>
      </section>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="helper-text">Syncing...</p>}

      <section className="admin-section">
        <h2>Pending Approval Invoices</h2>
        {groups.pending.length === 0 ? (
          <p className="helper-text">No pending invoices.</p>
        ) : (
          groups.pending.map((item) => (
            <article key={item.id} className="submission-card">
              <div className="submission-top">
                <div>
                  <strong>{item.fullName}</strong> <span>({item.creatorEmail})</span>
                </div>
                <div>{formatMoney(item.invoiceTotal)}</div>
              </div>
              <ul className="video-list">
                {item.videos.map((video) => (
                  <li key={video.id}>
                    <span>{video.platform}</span>
                    <span>{video.campaignTag || "-"}</span>
                    <span>{formatMoney(video.amount)}</span>
                    <span>{video.url}</span>
                  </li>
                ))}
              </ul>
              <div className="actions">
                <button type="button" onClick={() => void updateStatus(item.id, "approved")}>
                  Approve Invoice
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="admin-section">
        <h2>Approved (Waiting Payment)</h2>
        {groups.approved.length === 0 ? (
          <p className="helper-text">No approved invoices waiting payment.</p>
        ) : (
          groups.approved.map((item) => (
            <article key={item.id} className="submission-card">
              <div className="submission-top">
                <div>
                  <strong>{item.fullName}</strong> <span>({item.creatorEmail})</span>
                </div>
                <div>{formatMoney(item.invoiceTotal)}</div>
              </div>
              <ul className="video-list">
                {item.videos.map((video) => (
                  <li key={video.id}>
                    <span>{video.platform}</span>
                    <span>{video.campaignTag || "-"}</span>
                    <span>{formatMoney(video.amount)}</span>
                    <span>{video.approved ? "Approved" : "Pending"}</span>
                  </li>
                ))}
              </ul>
              <div className="actions">
                <button type="button" onClick={() => void updateStatus(item.id, "paid")}>
                  Mark Payment Success
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="admin-section">
        <h2>Paid Invoices</h2>
        {groups.paid.length === 0 ? (
          <p className="helper-text">No paid invoices yet.</p>
        ) : (
          groups.paid.map((item) => (
            <article key={item.id} className="submission-card">
              <div className="submission-top">
                <div>
                  <strong>{item.fullName}</strong> <span>({item.creatorEmail})</span>
                </div>
                <div>{formatMoney(item.invoiceTotal)}</div>
              </div>
              <ul className="video-list">
                {item.videos.map((video) => (
                  <li key={video.id}>
                    <span>{video.platform}</span>
                    <span>{video.campaignTag || "-"}</span>
                    <span>{formatMoney(video.amount)}</span>
                    <span>Paid</span>
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
