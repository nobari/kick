import styles from "./home.module.css";
export default function WorkMotion() {
  return <div className={styles.motion}>
    <div className={styles.motionHeading}><p>Small actions.<br/><strong>Shared momentum.</strong></p><label><input type="checkbox" aria-controls="work-sequence"/> Pause animation</label></div>
    <div id="work-sequence" className={styles.sequence} aria-label="Illustrative sequence: share an update, assign an action, review team progress">
      <div className={styles.motionStep}><svg viewBox="0 0 72 72" aria-hidden="true"><rect x="8" y="10" width="56" height="45" rx="10" fill="#dbe6ff"/><path d="m22 55-3 10 18-10" fill="#dbe6ff"/><path d="M21 25h30M21 36h20" fill="none" stroke="#2448ad" strokeWidth="4" strokeLinecap="round"/></svg><span>Share an update</span><small>“The release is ready.”</small></div>
      <div className={styles.motionLink} aria-hidden="true"><i/></div>
      <div className={styles.motionStep}><svg viewBox="0 0 72 72" aria-hidden="true"><rect x="10" y="10" width="52" height="52" rx="12" fill="#ffd8c2"/><path className={styles.drawCheck} pathLength="1" d="m22 36 10 10 19-22" fill="none" stroke="#a83b10" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg><span>Own the next step</span><small>Prepare the team demo</small></div>
      <div className={styles.motionLink} aria-hidden="true"><i/></div>
      <div className={styles.motionStep}><svg viewBox="0 0 72 72" aria-hidden="true"><rect x="8" y="8" width="56" height="56" rx="12" fill="#d9efdf"/><path className={styles.drawReport} pathLength="1" d="M22 51V37m14 14V28m14 23V19" fill="none" stroke="#286044" strokeWidth="7" strokeLinecap="round"/></svg><span>See the progress</span><small>Preview, then share a report</small></div>
    </div>
  </div>;
}
