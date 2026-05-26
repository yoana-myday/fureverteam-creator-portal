import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type SubmissionBody = {
  country?: string;
  fullName?: string;
  creatorEmail?: string;
  billingAddress?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  serviceDescription?: string;
  currency?: string;
  amount?: string;
  payoutMethod?: string;
  payoutAccount?: string;
  taxNumber?: string;
  companyName?: string;
};

function formatSubmissionText(data: SubmissionBody): string {
  return [
    "New Creator Invoice Submission",
    "----------------------------------------",
    `Country: ${data.country ?? "-"}`,
    `Full Name: ${data.fullName ?? "-"}`,
    `Company/Studio: ${data.companyName ?? "-"}`,
    `Email: ${data.creatorEmail ?? "-"}`,
    `Billing Address: ${data.billingAddress ?? "-"}`,
    `Invoice Number: ${data.invoiceNumber ?? "-"}`,
    `Invoice Date: ${data.invoiceDate ?? "-"}`,
    `Due Date: ${data.dueDate ?? "-"}`,
    `Service Description: ${data.serviceDescription ?? "-"}`,
    `Amount: ${(data.currency ?? "-") + " " + (data.amount ?? "-")}`,
    `Payout Method: ${data.payoutMethod ?? "-"}`,
    `Payout Account: ${data.payoutAccount ?? "-"}`,
    `Tax Number: ${data.taxNumber ?? "-"}`,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmissionBody;

    if (!body.fullName || !body.creatorEmail || !body.invoiceNumber || !body.amount) {
      return NextResponse.json({ error: "Missing required submission data." }, { status: 400 });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPortRaw = process.env.SMTP_PORT ?? "587";
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const ownerEmail = process.env.OWNER_EMAIL;

    if (!smtpHost || !smtpUser || !smtpPass || !ownerEmail) {
      return NextResponse.json({ error: "Mail server is not configured." }, { status: 500 });
    }

    const smtpPort = Number(smtpPortRaw);
    const secure = smtpPort === 465;
    const fromEmail = process.env.FROM_EMAIL ?? smtpUser;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `FureverTeam Creator Portal <${fromEmail}>`,
      to: ownerEmail,
      subject: `Invoice ${body.invoiceNumber} - ${body.fullName}`,
      text: formatSubmissionText(body),
      replyTo: body.creatorEmail,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
