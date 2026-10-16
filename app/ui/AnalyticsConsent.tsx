"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_KEY, readChoice, pageParameters, stopAnalytics, trackPage, trackInstallClick, type Choice } from "./analytics";
import styles from "./analytics.module.css";

let memoryChoice: string | null = null;
let memoryOnly = false;
const changeEvent = "kick-analytics-consent";
function snapshot(): Choice | "server" {
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return "rejected";
  if (memoryOnly) return readChoice(memoryChoice);
  try { return readChoice(localStorage.getItem(CONSENT_KEY)); }
  catch { return readChoice(memoryChoice); }
}
function subscribe(update: () => void) {
  window.addEventListener(changeEvent, update);
  window.addEventListener("storage", update);
  window.addEventListener("focus", update);
  const timer = window.setInterval(update, 60_000);
  return () => {
    window.removeEventListener(changeEvent, update);
    window.removeEventListener("storage", update);
    window.removeEventListener("focus", update);
    window.clearInterval(timer);
  };
}
const serverSnapshot = () => "server" as const;

export default function AnalyticsConsent() {
  const pathname = usePathname() ?? "";
  const choice = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [editing, setEditing] = useState(false);
  const isPublic = choice !== "server" && !!pageParameters(window.location.origin, pathname);

  useEffect(() => {
    if (!isPublic || choice !== "accepted") { stopAnalytics(); return; }
    trackPage(pathname);
    const click = (event: MouseEvent) => {
      if (snapshot() !== "accepted" || !(event.target instanceof Element)) return;
      const link = event.target.closest("a");
      if (link && new URL(link.href).origin === window.location.origin && new URL(link.href).pathname === "/api/slack/install") trackInstallClick();
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [choice, isPublic, pathname]);

  function save(next: "accepted" | "rejected") {
    if (next === "rejected") stopAnalytics();
    memoryChoice = JSON.stringify({ version: 1, choice: next, at: Date.now() });
    try { localStorage.setItem(CONSENT_KEY, memoryChoice); memoryOnly = false; }
    catch { memoryOnly = true; }
    window.dispatchEvent(new Event(changeEvent));
    setEditing(false);
  }

  if (!isPublic) return null;
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
  return <div className={styles.root}>
    <button type="button" className={styles.preferences} onClick={() => setEditing(!editing)} aria-expanded={editing || choice === "unknown"} aria-controls="analytics-preferences">Cookie preferences</button>
    {editing || choice === "unknown" ? <section id="analytics-preferences" className={styles.panel} aria-labelledby="analytics-heading">
      <h2 id="analytics-heading">Help us improve Kick?</h2>
      <p>With your permission, Google Analytics measures visits to our public pages and clicks on Add to Slack. It does not receive your Slack messages or team records. Essential installation cookies always work. <a href="/privacy#website-analytics">Privacy details</a></p>
      {gpc ? <p>Your browser’s Global Privacy Control is enabled. Analytics stays off.</p> : null}
      <div className={styles.actions}>
        <button type="button" onClick={() => save("rejected")}>Reject analytics</button>
        <button type="button" disabled={!!gpc} onClick={() => save("accepted")}>Allow analytics</button>
        {choice !== "unknown" ? <button type="button" onClick={() => setEditing(false)}>Close</button> : null}
      </div>
    </section> : null}
  </div>;
}
