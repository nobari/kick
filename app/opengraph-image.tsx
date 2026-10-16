import { ImageResponse } from "next/og";

export const alt = "Kick — Good teamwork. Less chasing. Plans, people and progress in Slack.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width:"100%", height:"100%", background:"#eef3fb", color:"#172137", padding:70, display:"flex", justifyContent:"space-between", fontFamily:"Arial, sans-serif" }}>
      <div style={{ display:"flex", flexDirection:"column", width:710 }}>
        <div style={{ fontSize:32, fontWeight:700, display:"flex" }}>Kick / for teams in Slack</div>
        <div style={{ display:"flex", flexDirection:"column", fontWeight:700, fontSize:76, lineHeight:1.15, marginTop:60 }}><span>Good teamwork.</span><span style={{ color:"#2448ad" }}>Less chasing.</span></div>
        <div style={{ fontSize:25, marginTop:35, display:"flex" }}>Plans, people, and progress. Together.</div>
        <div style={{ fontSize:21, marginTop:25, color:"#505d70", display:"flex" }}>14 published commands · Free core workflows</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", gap:24, width:230 }}>
        {["Check in", "Take action", "See progress"].map((label,index) => <div key={label} style={{ display:"flex", padding:28, borderRadius:18, background:index===1?"#f36b2b":"#2448ad", color:index===1?"#172137":"white", fontSize:26, fontWeight:700 }}>{label}</div>)}
      </div>
    </div>, size,
  );
}
