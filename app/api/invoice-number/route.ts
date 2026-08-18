import { NextResponse } from "next/server";
import { nextInvoiceNumber } from "@/lib/invoice-sequence";

export async function GET() {
  try {
    const { invoiceNumber, dateText } = await nextInvoiceNumber(new Date());
    return NextResponse.json(
      {
        invoiceNumber,
        dateText,
      },
      { status: 200 },
    );
  } catch {
    const now = new Date();
    const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    const dateText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    const fallbackSerial = String(now.getTime()).slice(-2).padStart(2, "0");
    return NextResponse.json(
      {
        invoiceNumber: `INV-${dateStamp}-${fallbackSerial}`,
        dateText,
      },
      { status: 200 },
    );
  }
}
