import { NextResponse } from "next/server";
import { isAdminCodeValid } from "@/lib/admin-auth";
import { getAllSubmissions } from "@/lib/submission-store";

function isAuthorized(request: Request): boolean {
  return isAdminCodeValid(request.headers.get("x-admin-code"));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submissions = await getAllSubmissions();
  const paidTotal = submissions
    .filter((item) => item.invoiceStatus === "paid")
    .reduce((sum, item) => sum + item.invoiceTotal, 0);
  const pendingPaymentTotal = submissions
    .filter((item) => item.invoiceStatus === "approved")
    .reduce((sum, item) => sum + item.invoiceTotal, 0);

  return NextResponse.json(
    {
      submissions,
      metrics: {
        paidTotal,
        pendingPaymentTotal,
      },
    },
    { status: 200 },
  );
}
