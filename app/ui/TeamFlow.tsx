/** An original editorial illustration, not a reproduction of Slack's interface. */
export default function TeamFlow() {
  return <figure className="team-flow">
    <label className="flow-motion-control"><input type="checkbox" aria-controls="team-flow-art" /> Pause animation</label>
    <div className="flow-art" id="team-flow-art">
      <svg viewBox="0 0 540 470" role="img" aria-labelledby="flow-title flow-description">
        <title id="flow-title">A small update. A clear next step.</title>
        <desc id="flow-description">An illustrative team workflow: share a check-in, assign a task, and bring progress together in a team report.</desc>
        <circle cx="276" cy="230" r="206" fill="#e9edf4" />
        <path d="M125 140C40 270 425 130 416 320S145 427 110 355" fill="none" stroke="#a9b4c6" strokeWidth="2" strokeDasharray="6 8" />
        <path className="flow-signal" d="M125 140C40 270 425 130 416 320S145 427 110 355" pathLength="100" fill="none" stroke="#d74c12" strokeWidth="5" strokeLinecap="round" aria-hidden="true" />
        <g transform="translate(38 32)">
          <rect width="314" height="134" rx="18" fill="#fff" />
          <circle cx="34" cy="34" r="16" fill="#ffdecb" />
          <path className="flow-check flow-check-update" pathLength="1" d="m27 34 5 5 9-10" fill="none" stroke="#ad3d0c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="62" y="40" className="flow-label">Daily check-in</text>
          <text x="24" y="78" className="flow-title">Ready for the next release.</text>
          <text x="24" y="106" className="flow-muted">One update. Everyone in the loop.</text>
        </g>
        <g transform="translate(164 190)">
          <rect width="338" height="128" rx="18" fill="#18223a" />
          <text x="24" y="33" className="flow-label" fill="#bfcce3">CHANNEL TO-DO</text>
          <rect x="24" y="52" width="22" height="22" rx="6" fill="#f36b2b" />
          <path className="flow-check flow-check-task" pathLength="1" d="m29 63 4 4 8-9" fill="none" stroke="#18223a" strokeWidth="2.5" strokeLinecap="round" />
          <text x="59" y="69" className="flow-title" fill="white">Prepare the team demo</text>
          <text x="24" y="102" className="flow-muted" fill="#c7d2e5">Assigned · Due Friday</text>
        </g>
        <g transform="translate(38 340)">
          <rect width="306" height="102" rx="18" fill="#d9efe4" />
          <text x="22" y="33" className="flow-label">The week, together</text>
          <text x="22" y="61" className="flow-muted">Progress you can act on.</text>
          <path className="flow-report" pathLength="1" d="M23 80h47m10 0h79m10 0h38" stroke="#297453" strokeWidth="6" strokeLinecap="round" />
        </g>
        <g transform="translate(389 48)" fill="none" stroke="#d74c12" strokeWidth="3" strokeLinecap="round">
          <path d="m0 30 12-17 14 12 22-25m-13 0h13v13" />
        </g>
      </svg>
    </div>
    <figcaption>Check in → complete a task → see team progress.<span>Illustrative workflow.</span></figcaption>
  </figure>;
}
