import { PDFDocument, StandardFonts } from "pdf-lib";

export type InvoicePdfVideo = {
  platform: string;
  amount: number;
};

export type InvoicePdfInput = {
  invoiceNumber: string;
  invoiceDate: string;
  fullName: string;
  creatorEmail: string;
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
  videos: InvoicePdfVideo[];
};

export function getInvoiceFileName(fullName: string, invoiceNumber?: string): string {
  const safeName = (fullName || "creator")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "creator";
  const safeInvoiceNumber = invoiceNumber?.replace(/[^a-zA-Z0-9-]+/g, "-") || "invoice";
  return `${safeInvoiceNumber}-${safeName}.pdf`;
}

export async function createInvoicePdfBlob(input: InvoicePdfInput): Promise<Blob> {
  const lineItems = input.videos.filter(
    (item) => item.platform.trim().length > 0 && Number.isFinite(item.amount) && item.amount > 0,
  );
  const primaryAmount = lineItems[0]?.amount ?? 0;
  const noteAmount = lineItems.slice(1).reduce((sum, item) => sum + item.amount, 0);
  const totalAmount = primaryAmount + noteAmount;

  const platformCountMap = lineItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.platform] = (acc[item.platform] || 0) + 1;
    return acc;
  }, {});
  const detailLines = Object.entries(platformCountMap)
    .map(
      ([platform, count]) =>
        `${count === 1 ? "One" : String(count)} ${platform} Video${count > 1 ? "s" : ""}`,
    )
    .slice(0, 4);

  const isUnitedStatesBank = input.bankCountry === "United States";
  const paymentBankLines = isUnitedStatesBank
    ? [
        `Bank: ${input.bankName || "-"}`,
        `Routing Number: ${input.routingNumber || "-"}`,
        `Account Number: ${input.accountNumber || "-"}`,
      ]
    : [
        `Bank: ${input.bankName || "-"}`,
        `SWIFT / BIC: ${input.swiftCode || "-"}`,
        `Account Number / IBAN: ${input.accountNumber || "-"}`,
      ];
  const paymentAddressLines = [
    input.addressLine1 || "-",
    input.addressLine2 || "",
    `${input.city || "-"}, ${input.state || "-"} ${input.postalCode || "-"}`,
    input.legalCountry || "-",
  ].filter((line) => line.trim().length > 0);

  const templateResponse = await fetch("/invoice-editable-template.pdf");
  if (!templateResponse.ok) {
    throw new Error("Failed to load invoice template.");
  }

  const pdfDoc = await PDFDocument.load(await templateResponse.arrayBuffer());
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const setText = (fieldName: string, value: string, fontSize = 10) => {
    try {
      const field = form.getTextField(fieldName);
      field.setText(value);
      field.setFontSize(fontSize);
    } catch {
      // Some historic templates do not contain every optional field.
    }
  };

  setText("date", input.invoiceDate, 10);
  setText("invoice number", input.invoiceNumber, 10);
  setText("creator name", input.fullName || "-", 10);
  setText("creator email address", input.creatorEmail || "-", 10);
  setText("payment information", "", 10);
  setText("first", detailLines[0] || "", 10);
  setText("second", detailLines[1] || "", 10);
  setText("Third", detailLines[2] || "", 10);
  setText("forth", detailLines[3] || "", 10);
  setText("video amount", primaryAmount > 0 ? primaryAmount.toFixed(2) : "", 10);
  setText("note amount", noteAmount > 0 ? noteAmount.toFixed(2) : "", 10);
  setText("total amount", totalAmount > 0 ? totalAmount.toFixed(2) : "0.00", 10);
  setText("note", "", 10);

  try {
    const paymentField = form.getTextField("payment information");
    const fieldWithWidgets = paymentField as unknown as {
      acroField: {
        getWidgets: () => Array<{
          getRectangle: () => { x: number; y: number; width: number; height: number };
        }>;
      };
    };
    const widgets = fieldWithWidgets.acroField.getWidgets();
    if (widgets.length >= 2) {
      const page = pdfDoc.getPages()[0];
      const [rectA, rectB] = widgets.map((widget) => widget.getRectangle());
      const addressRect = rectA.y > rectB.y ? rectA : rectB;
      const paymentRect = rectA.y > rectB.y ? rectB : rectA;

      const drawLines = (
        lines: string[],
        rect: { x: number; y: number; width: number; height: number },
      ) => {
        const fontSize = 10;
        const lineHeight = 11;
        lines.forEach((line, index) => {
          const y = rect.y + rect.height - fontSize - index * lineHeight;
          if (y >= rect.y) {
            page.drawText(line, { x: rect.x, y, size: fontSize, font });
          }
        });
      };

      drawLines(paymentAddressLines, addressRect);
      drawLines(paymentBankLines, paymentRect);
    }
  } catch {
    // The text fields above remain a usable fallback.
  }

  form.updateFieldAppearances(font);
  form.flatten();

  const bytes = await pdfDoc.save();
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([arrayBuffer], { type: "application/pdf" });
}
