import * as lark from "@larksuiteoapi/node-sdk";
import type { CreatorSubmission } from "@/lib/submission-store";

type FeishuFieldValue =
  | string
  | number
  | boolean
  | string[]
  | { text: string; link: string };

type FeishuFields = Record<string, FeishuFieldValue>;

export type FeishuSyncResult = {
  recordId: string;
  action: "created" | "updated";
};

const silentLogger: lark.Logger = {
  error: () => undefined,
  warn: () => undefined,
  info: () => undefined,
  debug: () => undefined,
  trace: () => undefined,
};

function getFeishuConfig() {
  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  const appToken = process.env.FEISHU_BASE_TOKEN?.trim();
  const tableId = process.env.FEISHU_TABLE_ID?.trim();

  const missing = [
    ["FEISHU_APP_ID", appId],
    ["FEISHU_APP_SECRET", appSecret],
    ["FEISHU_BASE_TOKEN", appToken],
    ["FEISHU_TABLE_ID", tableId],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing Feishu configuration: ${missing.join(", ")}`);
  }

  return {
    appId: appId as string,
    appSecret: appSecret as string,
    appToken: appToken as string,
    tableId: tableId as string,
  };
}

function normalizeRecipientType(value: string): string {
  return value.toUpperCase() === "BUSINESS" ? "公司" : "个人";
}

function normalizePlatform(value: string): string {
  const platform = value.trim().toLowerCase();
  const knownPlatforms: Record<string, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    facebook: "Facebook",
    x: "X",
    twitter: "X",
    twitch: "Twitch",
  };
  return knownPlatforms[platform] ?? "其他";
}

function toUrlField(url: string): { text: string; link: string } {
  return { text: url, link: url };
}

export function buildFeishuInvoiceFields(submission: CreatorSubmission): FeishuFields {
  const platforms = Array.from(
    new Set(submission.videos.map((video) => normalizePlatform(video.platform))),
  );
  const fields: FeishuFields = {
    "Invoice ID": submission.id,
    "Invoice Number": submission.invoiceNumber,
    Name: submission.fullName,
    Email: submission.creatorEmail,
    "公司 / 工作室": submission.companyName,
    收款人类型: normalizeRecipientType(submission.recipientType),
    "所在国家 / 地区": submission.country,
    银行名称: submission.bankName,
    "银行｜所在国家 / 地区": submission.bankCountry,
    "Routing Number": submission.routingNumber,
    "SWIFT / BIC": submission.swiftCode,
    "账户号码 / IBAN": submission.accountNumber,
    "法定国家 / 地区": submission.legalCountry,
    地址第一行: submission.addressLine1,
    地址第二行: submission.addressLine2,
    城市: submission.city,
    "州 / 省 / 地区": submission.state,
    邮政编码: submission.postalCode,
    "💲支付金额": submission.invoiceTotal,
    币种: "USD",
    链接数量: submission.videos.length,
    平台: platforms,
    "合作｜链接已验证":
      submission.videos.length > 0 && submission.videos.every((video) => video.verified),
  };

  submission.videos.slice(0, 3).forEach((video, index) => {
    fields[`内容链接 ${index + 1}`] = toUrlField(video.url);
  });

  return fields;
}

function assertFeishuSuccess(
  response: { code?: number; msg?: string },
  operation: string,
): void {
  if (response.code !== undefined && response.code !== 0) {
    throw new Error(`${operation} failed (${response.code}): ${response.msg ?? "Unknown error"}`);
  }
}

export async function upsertApprovedInvoiceToFeishu(
  submission: CreatorSubmission,
): Promise<FeishuSyncResult> {
  const config = getFeishuConfig();
  const client = new lark.Client({
    appId: config.appId,
    appSecret: config.appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
    loggerLevel: lark.LoggerLevel.fatal,
    logger: silentLogger,
  });
  const path = {
    app_token: config.appToken,
    table_id: config.tableId,
  };

  const fields = buildFeishuInvoiceFields(submission);
  const existingRecordId = submission.feishuRecordId;

  try {
    if (existingRecordId) {
      const updateResponse = await client.bitable.appTableRecord.update({
        path: { ...path, record_id: existingRecordId },
        data: { fields },
      });
      assertFeishuSuccess(updateResponse, "Feishu record update");
      return { recordId: existingRecordId, action: "updated" };
    }

    const createResponse = await client.bitable.appTableRecord.create({
      path,
      data: { fields },
    });
    assertFeishuSuccess(createResponse, "Feishu record creation");

    const recordId = createResponse.data?.record?.record_id;
    if (!recordId) {
      throw new Error("Feishu record creation returned no record ID.");
    }

    return { recordId, action: "created" };
  } catch (error) {
    const apiError = error as {
      response?: { data?: { code?: number; msg?: string } };
      message?: string;
    };
    const code = apiError.response?.data?.code;
    const message = apiError.response?.data?.msg ?? apiError.message ?? "Unknown error";
    throw new Error(`Feishu sync failed${code ? ` (${code})` : ""}: ${message}`);
  }
}
