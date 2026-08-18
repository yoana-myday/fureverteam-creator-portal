import { NextResponse } from "next/server";
import { isAdminCodeValid } from "@/lib/admin-auth";
import { updateSubmissionStatus, type InvoiceStatus } from "@/lib/submission-store";

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
  const updated = await updateSubmissionStatus(id, body.status);
  if (!updated) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, submission: updated }, { status: 200 });
}
