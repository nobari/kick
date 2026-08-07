import { ImageResponse } from "next/og";

export const alt = "Kick Bot — Better team rituals for Slack";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fffdf8", color: "#15162a", padding: "72px 86px", fontFamily: "Arial, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 520, height: 520, borderRadius: 999, background: "#f36b2b", right: -190, top: -210, opacity: .15 }}/>
      <div style={{ display: "flex", flexDirection: "column", width: 760 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontWeight: 800 }}><div style={{ width: 54, height: 54, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 27, background: "#f36b2b", color: "white", fontSize: 28 }}>K</div>Kick Bot</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 58, fontSize: 66, lineHeight: 1.05, fontWeight: 800, letterSpacing: -3 }}><span>Better team rituals.</span><span style={{ color: "#f36b2b" }}>Built for Slack.</span></div>
        <div style={{ marginTop: 32, color: "#55586f", fontSize: 25 }}>Async standups · Kudos · Team rewards · Fair picks</div>
      </div>
      <div style={{ width: 220, height: 270, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 36, background: "#171a2d", boxShadow: "0 25px 60px rgba(21,22,42,.22)", transform: "rotate(4deg)" }}><div style={{ width: 116, height: 116, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 58, background: "#f36b2b", color: "white", fontSize: 64, fontWeight: 900 }}>K</div></div>
    </div>,
    size,
  );
}
