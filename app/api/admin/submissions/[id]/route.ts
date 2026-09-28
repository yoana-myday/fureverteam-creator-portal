import { NextResponse } from "next/server";
import { isAdminCodeValid } from "@/lib/admin-auth";
import { upsertApprovedInvoiceToFeishu } from "@/lib/feishu-sync";
import {
  getSubmissionById,
  updateSubmissionStatus,
  type InvoiceStatus,
} from "@/lib/submission-store";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  return isAdminCodeValid(request.headers.get("x-admin-code"));
}

type UpdateBody = {
  status?: InvoiceStatus;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as UpdateBody;
  if (!body.status || !["pending", "approved", "declined", "paid"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const { id } = await params;
  let feishuSync = null;

  if (body.status === "approved") {
    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    try {
      feishuSync = await upsertApprovedInvoiceToFeishu(submission);
    } catch (error) {
      console.error("Failed to sync approved invoice to Feishu.", error);
      return NextResponse.json(
        {
          error:
            "Feishu sync failed, so this invoice was not approved. Please try again.",
        },
        { status: 502 },
      );
    }
  }

  const updated = await updateSubmissionStatus(id, body.status, {
    feishuRecordId: feishuSync?.recordId,
  });
  if (!updated) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, submission: updated, feishuSync },
    { status: 200 },
  );
}
