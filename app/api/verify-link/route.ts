import { NextResponse } from "next/server";

type VerifyRequest = {
  url?: string;
};

type VerificationStatus = "valid" | "invalid" | "unavailable";

type EasyKolVideoData = {
  platform?: string;
  videoId?: string;
  authorId?: string | null;
  authorName?: string | null;
  publishedAt?: string | null;
};

type EasyKolVideoResponse = {
  statusCode?: number;
  error?: string | null;
  message?: string;
  data?: EasyKolVideoData | null;
};

function detectPlatform(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube";
  if (host.includes("tiktok.com")) return "TikTok";
  if (host.includes("instagram.com")) return "Instagram";
  if (host.includes("twitter.com") || host.includes("x.com")) return "X";
  if (host.includes("facebook.com") || host.includes("fb.watch")) return "Facebook";
  if (host.includes("vimeo.com")) return "Vimeo";
  if (host.includes("twitch.tv")) return "Twitch";
  return "Other";
}

function getCanonicalUrl(parsed: URL, platform: string): string {
  const clone = new URL(parsed.toString());
  clone.hash = "";

  if (platform === "TikTok") {
    // TikTok query params often trigger anti-bot interstitials.
    clone.search = "";
  }

  if (platform === "YouTube" && clone.hostname.includes("youtube.com")) {
    const watchId = clone.searchParams.get("v");
    if (watchId) {
      return `https://www.youtube.com/watch?v=${watchId}`;
    }
  }

  if (platform === "Instagram") {
    // Normalize /reels/{id} to /reel/{id} for oEmbed compatibility.
    if (clone.pathname.startsWith("/reels/")) {
      clone.pathname = clone.pathname.replace(/^\/reels\//, "/reel/");
    }
    clone.search = "";
  }

  return clone.toString();
}

function getInstagramMediaId(parsed: URL): string | null {
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (!["p", "reel", "reels", "tv"].includes(parts[0] ?? "")) {
    return null;
  }
  return parts[1] || null;
}

async function verifyInstagramWithEasyKol(
  canonicalUrl: string,
): Promise<{
  status: VerificationStatus;
  authorName?: string;
  message?: string;
}> {
  const apiKey = process.env.EASYKOL_API_KEY?.trim();
  const apiEmail = process.env.EASYKOL_API_EMAIL?.trim();
  const apiBaseUrl =
    process.env.EASYKOL_API_BASE_URL?.trim() || "https://talent-marketing-api.aiwaifu.top";

  if (!apiKey || !apiEmail) {
    return {
      status: "unavailable",
      message: "Instagram verification is not fully configured.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(canonicalUrl);
  } catch {
    return { status: "invalid" };
  }

  const expectedMediaId = getInstagramMediaId(parsed);
  if (!expectedMediaId) {
    return { status: "invalid" };
  }

  try {
    const endpoint = new URL("/external/v1/video", apiBaseUrl);
    endpoint.searchParams.set("url", canonicalUrl);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "ek-api-key": apiKey,
        "ek-api-email": apiEmail,
      },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });

    let payload: EasyKolVideoResponse | null = null;
    try {
      payload = (await response.json()) as EasyKolVideoResponse;
    } catch {
      // A non-JSON response is a provider failure, not proof that a creator link is invalid.
    }

    if (response.ok && payload?.statusCode === 1000 && payload.data) {
      const returnedPlatform = payload.data.platform?.toUpperCase();
      const returnedMediaId = payload.data.videoId;
      const matchesInstagram = returnedPlatform === "INSTAGRAM";
      const matchesMedia = returnedMediaId === expectedMediaId;

      if (!matchesInstagram || !matchesMedia) {
        return { status: "invalid" };
      }

      return {
        status: "valid",
        authorName: payload.data.authorName || undefined,
      };
    }

    const providerMessage = `${payload?.error ?? ""} ${payload?.message ?? ""}`.toLowerCase();
    const explicitlyInvalid =
      response.status === 404 ||
      /not found|invalid (url|link)|unsupported (url|link)|video.*not found/.test(providerMessage);

    if (explicitlyInvalid) {
      return { status: "invalid" };
    }

    return {
      status: "unavailable",
      message: "Instagram verification is temporarily unavailable. Please try again.",
    };
  } catch {
    return {
      status: "unavailable",
      message: "Instagram verification is temporarily unavailable. Please try again.",
    };
  }
}

async function verifyWithOEmbed(platform: string, canonicalUrl: string): Promise<boolean | null> {
  let endpoints: string[] = [];
  if (platform === "TikTok") {
    endpoints = [`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`];
  } else if (platform === "YouTube") {
    endpoints = [`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`];
  } else if (platform === "Vimeo") {
    endpoints = [`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(canonicalUrl)}`];
  } else if (platform === "Instagram") {
    endpoints = [
      `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(canonicalUrl)}`,
      `https://www.instagram.com/oembed/?url=${encodeURIComponent(canonicalUrl)}`,
    ];
  } else {
    return null;
  }

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "application/json,text/plain,*/*",
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("json")) {
        continue;
      }

      const payload = (await response.json()) as {
        title?: string;
        author_name?: string;
        provider_name?: string;
        html?: string;
      };

      if (payload.title || payload.author_name || payload.provider_name || payload.html) {
        return true;
      }
    } catch {
      // Try the next endpoint.
    }
  }

  return false;
}

function isPageLikelyPublic(html: string): boolean {
  const content = html.toLowerCase();

  const invalidMarkers = [
    "video unavailable",
    "this video is private",
    "this account is private",
    "not available",
    "page not found",
    "content unavailable",
    "sorry, this page isn't available",
    "404",
  ];

  if (invalidMarkers.some((marker) => content.includes(marker))) {
    return false;
  }

  const validMarkers = [
    'property="og:title"',
    'property="og:video"',
    'property="og:url"',
    "application/ld+json",
  ];

  return validMarkers.some((marker) => content.includes(marker));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyRequest;
    const rawUrl = body.url?.trim();
    if (!rawUrl) {
      return NextResponse.json({ ok: false, platform: "Other" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return NextResponse.json({ ok: false, platform: "Other" }, { status: 400 });
    }

    const platform = detectPlatform(parsed.hostname);
    const canonicalUrl = getCanonicalUrl(parsed, platform);

    if (platform === "Instagram") {
      const easyKolCheck = await verifyInstagramWithEasyKol(canonicalUrl);
      return NextResponse.json(
        {
          ok: easyKolCheck.status === "valid",
          status: easyKolCheck.status,
          platform,
          authorName: easyKolCheck.authorName,
          message: easyKolCheck.message,
        },
        { status: 200 },
      );
    }

    const oEmbedCheck = await verifyWithOEmbed(platform, canonicalUrl);
    if (oEmbedCheck !== null) {
      return NextResponse.json(
        { ok: oEmbedCheck, status: oEmbedCheck ? "valid" : "invalid", platform },
        { status: 200 },
      );
    }

    const response = await fetch(canonicalUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ ok: false, platform }, { status: 200 });
    }

    const html = await response.text();
    const ok = isPageLikelyPublic(html);

    return NextResponse.json(
      { ok, status: ok ? "valid" : "invalid", platform },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        platform: "Other",
        message: "Link verification is temporarily unavailable. Please try again.",
      },
      { status: 200 },
    );
  }
}
