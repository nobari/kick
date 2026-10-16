export const MEASUREMENT_ID = "G-6EC7YHKCG9";
export const CONSENT_KEY = "kick.analytics-consent.v1";
export const CONSENT_AGE = 180 * 86400 * 1000;
export const PUBLIC_PAGES: Record<string, string> = {
  "/": "Kick — Team coordination in Slack",
  "/get-started": "Kick — Getting started",
  "/privacy": "Kick — Privacy policy",
  "/support": "Kick — Support",
  "/terms": "Kick — Terms",
};
export type Choice = "accepted" | "rejected" | "unknown";

export function readChoice(raw: string | null, now = Date.now()): Choice {
  try {
    const value = JSON.parse(raw || "null");
    if (value?.version === 1 && ["accepted", "rejected"].includes(value.choice) &&
      Number.isFinite(value.at) && value.at <= now && now - value.at < CONSENT_AGE) return value.choice;
  } catch { /* Invalid or unavailable storage means no consent. */ }
  return "unknown";
}

export function pageParameters(origin: string, pathname: string) {
  if (origin !== "https://kick.bozmoz.com" || !Object.hasOwn(PUBLIC_PAGES, pathname)) return null;
  return { page_location: origin + pathname, page_title: PUBLIC_PAGES[pathname], page_referrer: "" };
}

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  "ga-disable-G-6EC7YHKCG9"?: boolean;
};
const denied = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
let initialized = false;
let lastPath: string | null = null;

export function stopAnalytics() {
  const w = window as AnalyticsWindow;
  w["ga-disable-G-6EC7YHKCG9"] = true;
  w.gtag?.("consent", "update", denied);
  lastPath = null;
  // These are the only cookies this integration creates; leave Slack security cookies alone.
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=")[0];
    if (name !== "_ga" && name !== "_ga_6EC7YHKCG9") continue;
    for (const domain of ["", "; Domain=kick.bozmoz.com", "; Domain=.kick.bozmoz.com"]) {
      document.cookie = `${name}=; Max-Age=0; Path=/; Secure; SameSite=Lax${domain}`;
    }
  }
}

export function trackPage(pathname: string) {
  const params = pageParameters(window.location.origin, pathname);
  if (!params) { stopAnalytics(); return; }
  const w = window as AnalyticsWindow;
  w["ga-disable-G-6EC7YHKCG9"] = false;
  if (!initialized) {
    initialized = true;
    w.dataLayer = w.dataLayer || [];
    // Google's gtag queue expects an Arguments object, not a rest-parameter array.
    // eslint-disable-next-line prefer-rest-params
    w.gtag = function () { w.dataLayer!.push(arguments); };
    w.gtag("consent", "default", denied);
    w.gtag("consent", "update", { ...denied, analytics_storage: "granted" });
    w.gtag("js", new Date());
    w.gtag("config", MEASUREMENT_ID, {
      ...params, send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, cookie_domain: "kick.bozmoz.com",
      cookie_expires: 90 * 86400, cookie_update: false, cookie_flags: "SameSite=Lax;Secure",
    });
    const script = document.createElement("script");
    script.id = "kick-google-analytics";
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
  } else {
    w.gtag?.("consent", "update", { ...denied, analytics_storage: "granted" });
    w.gtag?.("set", params);
  }
  if (lastPath !== pathname) {
    w.gtag?.("event", "page_view", { ...params, send_to: MEASUREMENT_ID });
    lastPath = pathname;
  }
}

export function trackInstallClick() {
  const w = window as AnalyticsWindow;
  const params = pageParameters(w.location.origin, w.location.pathname);
  if (params && initialized && !w["ga-disable-G-6EC7YHKCG9"]) {
    w.gtag?.("event", "slack_install_click", { ...params, send_to: MEASUREMENT_ID, transport_type: "beacon" });
  }
}
