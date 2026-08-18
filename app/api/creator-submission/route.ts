import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { addSubmission, CreatorSubmission, VideoSubmissionItem } from "@/lib/submission-store";
import { nextInvoiceNumber } from "@/lib/invoice-sequence";

type SubmissionBody = {
  country?: string;
  fullName?: string;
  creatorEmail?: string;
  companyName?: string;
  recipientType?: string;
  bankName?: string;
  bankCountry?: string;
  routingNumber?: string;
  swiftCode?: string;
  accountNumber?: string;
  accountType?: string;
  legalCountry?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  videoItems?: Array<{
    url?: string;
    platform?: string;
    campaignTag?: string;
    amount?: number;
    verified?: boolean;
  }>;
};

function formatSubmissionText(data: SubmissionBody): string {
  return [
    "New Creator Invoice Submission",
    "----------------------------------------",
    `Country: ${data.country ?? "-"}`,
    `Full Name: ${data.fullName ?? "-"}`,
    `Company/Studio: ${data.companyName ?? "-"}`,
    `Email: ${data.creatorEmail ?? "-"}`,
    `Recipient Type: ${data.recipientType ?? "-"}`,
    `Bank: ${data.bankName ?? "-"}`,
    `Bank Country: ${data.bankCountry ?? "-"}`,
    `Routing Number: ${data.routingNumber ?? "-"}`,
    `SWIFT / BIC: ${data.swiftCode ?? "-"}`,
    `Account Number: ${data.accountNumber ?? "-"}`,
    `Legal Country: ${data.legalCountry ?? "-"}`,
    `Address Line 1: ${data.addressLine1 ?? "-"}`,
    `Address Line 2: ${data.addressLine2 ?? "-"}`,
    `City: ${data.city ?? "-"}`,
    `State: ${data.state ?? "-"}`,
    `Postal / ZIP Code: ${data.postalCode ?? "-"}`,
    ...(data.videoItems && data.videoItems.length > 0
      ? data.videoItems.map(
          (item, idx) =>
            `Video ${idx + 1}: ${item.url ?? "-"} | Platform: ${item.platform ?? "-"} | Campaign: ${
              item.campaignTag ?? "-"
            } | Amount: $${item.amount ?? 0}`,
        )
      : ["Video Links: -"]),
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmissionBody;

    const isUnitedStatesBank = body.bankCountry === "United States";
    const isUnitedStatesAddress = body.legalCountry === "United States";
    if (
      !body.fullName ||
      !body.creatorEmail ||
      !body.bankName ||
      !body.bankCountry ||
      !body.accountNumber ||
      !body.addressLine1 ||
      !body.city ||
      !body.postalCode ||
      !body.videoItems ||
      body.videoItems.length === 0
    ) {
      return NextResponse.json({ error: "Missing required submission data." }, { status: 400 });
    }
    if (isUnitedStatesBank && !body.routingNumber) {
      return NextResponse.json({ error: "Missing required submission data." }, { status: 400 });
    }
    if (!isUnitedStatesBank && !body.swiftCode) {
      return NextResponse.json({ error: "Missing required submission data." }, { status: 400 });
    }
    if (isUnitedStatesAddress && !body.state) {
      return NextResponse.json({ error: "Missing required submission data." }, { status: 400 });
    }

    const normalizedVideos: VideoSubmissionItem[] = body.videoItems
      .filter((item) => item.url)
      .map((item, index) => ({
        id: `video-${Date.now()}-${index}`,
        url: String(item.url),
        platform: item.platform || "Other",
        campaignTag: item.campaignTag || "",
        amount: Number(item.amount || 0),
        verified: Boolean(item.verified),
        approved: false,
      }));

    const invoiceTotal = normalizedVideos.reduce((sum, item) => sum + item.amount, 0);
    const generatedInvoiceMeta =
      body.invoiceNumber && body.invoiceDate ? null : await nextInvoiceNumber(new Date());
    const submissionRecord: CreatorSubmission = {
      id: `sub-${Date.now()}`,
      createdAt: new Date().toISOString(),
      country: body.country ?? "",
      fullName: body.fullName ?? "",
      creatorEmail: body.creatorEmail ?? "",
      companyName: body.companyName ?? "",
      recipientType: body.recipientType ?? "",
      bankName: body.bankName ?? "",
      bankCountry: body.bankCountry ?? "",
      routingNumber: body.routingNumber ?? "",
      swiftCode: body.swiftCode ?? "",
      accountNumber: body.accountNumber ?? "",
      accountType: body.accountType ?? "",
      legalCountry: body.legalCountry ?? "",
      addressLine1: body.addressLine1 ?? "",
      addressLine2: body.addressLine2 ?? "",
      city: body.city ?? "",
      state: body.state ?? "",
      postalCode: body.postalCode ?? "",
      invoiceNumber: body.invoiceNumber ?? generatedInvoiceMeta?.invoiceNumber ?? "",
      invoiceDate: body.invoiceDate ?? generatedInvoiceMeta?.dateText ?? "",
      invoiceStatus: "pending",
      videos: normalizedVideos,
      invoiceTotal,
    };

    try {
      await addSubmission(submissionRecord);
    } catch (dbError) {
      console.error("Failed to persist submission:", dbError);
      throw dbError;
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPortRaw = process.env.SMTP_PORT ?? "587";
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const ownerEmail = process.env.OWNER_EMAIL ?? "paid-growth@lollapaloozalab.com";

    // Mail notifications are optional. Submission should still succeed even when SMTP is unavailable.
    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json(
        {
          ok: true,
          queuedForApproval: true,
          emailSent: false,
          warning: "SMTP not configured; submission saved without email notification.",
        },
        { status: 200 },
      );
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

    try {
      await transporter.sendMail({
        from: `FureverTeam Creator Portal <${fromEmail}>`,
        to: ownerEmail,
        subject: `Creator Submission - ${body.fullName}`,
        text: formatSubmissionText(body),
        replyTo: body.creatorEmail,
      });
    } catch (mailError) {
      console.error("Submission email notification failed:", mailError);
      return NextResponse.json(
        {
          ok: true,
          queuedForApproval: true,
          emailSent: false,
          warning: "Email send failed; submission is still saved for approval.",
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        queuedForApproval: true,
        emailSent: true,
        submissionId: submissionRecord.id,
        invoiceNumber: submissionRecord.invoiceNumber,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("creator-submission route failed:", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
