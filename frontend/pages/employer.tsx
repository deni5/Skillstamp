import React, { useState } from 'react';
import Head from 'next/head';

const CANDIDATES = [
  { name: 'Alex K.', role: 'Web3 Analyst', level: 2, stamps: 4, rep: 340, tags: ['defi','tokenomics','research'], match: 98, available: true },
  { name: 'Maria S.', role: 'DeFi Researcher', level: 3, stamps: 6, rep: 510, tags: ['defi','on-chain','dao'], match: 91, available: true },
  { name: 'Ivan P.', role: 'Blockchain Dev', level: 2, stamps: 5, rep: 420, tags: ['solana','rust','smart-contract'], match: 87, available: false },
  { name: 'Olena B.', role: 'Protocol Analyst', level: 1, stamps: 3, rep: 210, tags: ['research','tokenomics'], match: 74, available: true },
];

const TASKS = [
  { id: 't1', title: 'DeFi Research Report Q2', status: 'open',      reward: '500 USDC', deadline: '2025-05-01', applicants: 4, assigned: null },
  { id: 't2', title: 'Tokenomics Audit v2',     status: 'in_progress', reward: '300 USDC', deadline: '2025-04-22', applicants: 1, assigned: 'Alex K.' },
  { id: 't3', title: 'Protocol Landscape',      status: 'completed',   reward: '450 USDC', deadline: '2025-04-10', applicants: 0, assigned: 'Maria S.' },
];

export default function EmployerDashboard() {
  const [activeTab, setActiveTab] = useState<'candidates'|'tasks'|'post'>('candidates');
  const [filterTag, setFilterTag] = useState('');

  const filtered = filterTag
    ? CANDIDATES.filter(c => c.tags.some(t => t.includes(filterTag)))
    : CANDIDATES;

  return (
    <>
      <Head>
        <title>Employer Dashboard · Skillstamp</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');
          :root {
            --beige:#F5F2EC;--beige2:#EDE9E1;--black:#1A1A18;
            --gray:#5A5A55;--border:#C8C4BA;--white:#FFFFFF;
            --serif:'DM Serif Display',Georgia,serif;
            --sans:'DM Sans',system-ui,sans-serif;
            --mono:'DM Mono',monospace;
          }
          body { background:var(--beige);color:var(--black);font-family:var(--sans);font-weight:300; }
          .layout { display:grid;grid-template-columns:240px 1fr;min-height:100vh; }
          .sidebar {
            border-right:1px dashed var(--border);padding:24px;
            display:flex;flex-direction:column;gap:20px;
            position:sticky;top:0;height:100vh;overflow-y:auto;
          }
          .logo { display:flex;align-items:center;gap:10px; }
          .logo-mark {
            width:34px;height:34px;border:2px solid var(--black);border-radius:6px;
            display:flex;align-items:center;justify-content:center;position:relative;
          }
          .logo-mark::after { content:'';position:absolute;inset:3px;border:1px dashed var(--black);border-radius:3px; }
          .logo-mark span { font-family:var(--serif);font-size:12px;position:relative;z-index:1; }
          .logo-name { font-weight:500;font-size:14px; }
          .employer-badge {
            border:1px dashed var(--border);border-radius:8px;padding:14px;
          }
          .eb-name { font-weight:500;font-size:14px;margin-bottom:2px; }
          .eb-type { font-size:11px;color:var(--gray);font-family:var(--mono); }
          .eb-rep {
            margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);
            font-size:11px;color:var(--gray);
          }
          .stats-row { display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px; }
          .stat-card { border:1px dashed var(--border);border-radius:6px;padding:12px;text-align:center; }
          .stat-num { font-family:var(--serif);font-size:24px; }
          .stat-lbl { font-size:10px;color:var(--gray);font-family:var(--mono); }
          .nav { display:flex;flex-direction:column;gap:2px; }
          .nav-item {
            display:flex;align-items:center;gap:10px;
            padding:10px 12px;border-radius:6px;cursor:pointer;
            font-size:13px;border:none;background:transparent;
            color:var(--black);width:100%;text-align:left;transition:background 0.15s;
          }
          .nav-item:hover { background:var(--beige2); }
          .nav-item.active { background:var(--black);color:var(--beige); }
          .main { padding:32px 40px; }
          .main-title { font-family:var(--serif);font-size:32px;margin-bottom:4px; }
          .main-sub { font-size:13px;color:var(--gray);margin-bottom:28px; }
          .filter-row { display:flex;gap:8px;margin-bottom:20px; }
          .filter-input {
            padding:8px 14px;border:1px dashed var(--border);border-radius:6px;
            font-family:var(--sans);font-size:13px;background:var(--white);
            color:var(--black);outline:none;flex:1;max-width:280px;
          }
          .tag-btn {
            padding:6px 14px;border:1px dashed var(--border);border-radius:5px;
            font-family:var(--mono);font-size:11px;cursor:pointer;background:transparent;
            transition:background 0.15s;
          }
          .tag-btn:hover,.tag-btn.active { background:var(--black);color:var(--beige);border-color:var(--black); }
          .candidates-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px; }
          .candidate-card {
            background:var(--white);border:1px dashed var(--border);border-radius:10px;
            padding:20px;transition:border-color 0.2s;
          }
          .candidate-card:hover { border-color:var(--black); }
          .cc-top { display:flex;align-items:center;gap:12px;margin-bottom:14px; }
          .cc-avatar {
            width:40px;height:40px;border-radius:50%;
            background:var(--black);color:var(--beige);
            display:flex;align-items:center;justify-content:center;
            font-family:var(--serif);font-size:16px;
          }
          .cc-name { font-weight:500;font-size:14px; }
          .cc-role { font-size:11px;color:var(--gray);font-family:var(--mono); }
          .cc-stats { display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px; }
          .cc-stat { text-align:center;font-family:var(--mono); }
          .cc-stat-num { font-size:16px;font-weight:500; }
          .cc-stat-lbl { font-size:9px;color:var(--gray); }
          .cc-tags { display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px; }
          .tag { font-family:var(--mono);font-size:10px;color:var(--gray);border:1px dashed var(--border);border-radius:3px;padding:2px 8px; }
          .cc-match { font-family:var(--mono);font-size:11px;color:var(--gray);margin-bottom:10px; }
          .cc-actions { display:flex;gap:8px; }
          .btn {
            padding:7px 14px;border:1px solid var(--black);border-radius:5px;
            font-size:12px;background:transparent;cursor:pointer;font-family:var(--sans);
            transition:background 0.2s,color 0.2s;
          }
          .btn:hover { background:var(--black);color:var(--beige); }
          .btn-primary { background:var(--black);color:var(--beige); }
          .btn-primary:hover { background:#333; }
          .available-dot { width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:5px; }
          .dot-green { background:#22c55e; }
          .dot-gray { background:var(--border); }
          .tasks-table { width:100%;border-collapse:collapse; }
          .tasks-table th {
            font-size:10px;color:var(--gray);font-family:var(--mono);
            letter-spacing:0.08em;text-align:left;padding:8px 12px;
            border-bottom:1px dashed var(--border);
          }
          .tasks-table td { padding:14px 12px;border-bottom:1px dashed var(--border);font-size:13px; }
          .tasks-table tr:last-child td { border-bottom:none; }
          .status-badge {
            display:inline-flex;align-items:center;gap:5px;
            font-family:var(--mono);font-size:10px;padding:3px 10px;border-radius:3px;
          }
          .s-open { background:#e0f2fe;color:#0369a1; }
          .s-prog { background:#fef9c3;color:#854d0e; }
          .s-done { background:#dcfce7;color:#15803d; }
          .form-field { margin-bottom:16px; }
          .form-label { font-size:12px;color:var(--gray);font-family:var(--mono);letter-spacing:0.06em;margin-bottom:6px;display:block; }
          .form-input {
            width:100%;padding:10px 14px;border:1px dashed var(--border);border-radius:6px;
            font-family:var(--sans);font-size:14px;background:var(--white);color:var(--black);outline:none;
          }
          .form-input:focus { border-color:var(--black); }
          textarea.form-input { min-height:100px;resize:vertical; }
          .form-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
          .divider { border:none;border-top:1px dashed var(--border);margin:24px 0; }
        `}</style>
      </Head>

      <div className="layout">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-mark"><span>ss</span></div>
            <span className="logo-name">Skillstamp</span>
          </div>
          <div className="employer-badge">
            <div className="eb-name">DeFiLab</div>
            <div className="eb-type">Verified Employer · Academic</div>
            <div className="eb-rep">Reputation: 94/100 · 3 tasks completed</div>
          </div>
          <div className="stats-row">
            {[{n:'3',l:'active tasks'},{n:'12',l:'candidates'},{n:'2',l:'hired'}].map(s=>(
              <div className="stat-card" key={s.l}>
                <div className="stat-num">{s.n}</div>
                <div className="stat-lbl">{s.l}</div>
              </div>
            ))}
          </div>
          <nav className="nav">
            {([
              {id:'candidates',icon:'○',label:'Candidates'},
              {id:'tasks',     icon:'△',label:'My tasks'},
              {id:'post',      icon:'◈',label:'Post task'},
            ] as const).map(item=>(
              <button key={item.id} className={`nav-item ${activeTab===item.id?'active':''}`} onClick={()=>setActiveTab(item.id)}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="main">

          {activeTab==='candidates' && <>
            <div className="main-title">Verified candidates</div>
            <div className="main-sub">Filtered by your required SBT tags · ranked by match score</div>
            <div className="filter-row">
              <input className="filter-input" placeholder="Filter by skill tag..." value={filterTag} onChange={e=>setFilterTag(e.target.value)} />
              {['defi','solana','dao','research'].map(t=>(
                <button key={t} className={`tag-btn ${filterTag===t?'active':''}`} onClick={()=>setFilterTag(filterTag===t?'':t)}>{t}</button>
              ))}
            </div>
            <div className="candidates-grid">
              {filtered.map((c,i)=>(
                <div className="candidate-card" key={i}>
                  <div className="cc-top">
                    <div className="cc-avatar">{c.name[0]}</div>
                    <div>
                      <div className="cc-name">
                        <span className={`available-dot ${c.available?'dot-green':'dot-gray'}`} />
                        {c.name}
                      </div>
                      <div className="cc-role">{c.role}</div>
                    </div>
                  </div>
                  <div className="cc-stats">
                    <div className="cc-stat"><div className="cc-stat-num">{c.stamps}</div><div className="cc-stat-lbl">stamps</div></div>
                    <div className="cc-stat"><div className="cc-stat-num">{c.rep}</div><div className="cc-stat-lbl">rep</div></div>
                    <div className="cc-stat"><div className="cc-stat-num">L{c.level}</div><div className="cc-stat-lbl">level</div></div>
                  </div>
                  <div className="cc-tags">{c.tags.map(t=><span className="tag" key={t}>{t}</span>)}</div>
                  <div className="cc-match">match: {c.match}%</div>
                  <div className="cc-actions">
                    <button className="btn btn-primary">Assign task</button>
                    <button className="btn">View profile</button>
                  </div>
                </div>
              ))}
            </div>
          </>}

          {activeTab==='tasks' && <>
            <div className="main-title">My tasks</div>
            <div className="main-sub">All published tasks and their status</div>
            <table className="tasks-table">
              <thead>
                <tr><th>Task</th><th>Status</th><th>Reward</th><th>Deadline</th><th>Assigned to</th><th></th></tr>
              </thead>
              <tbody>
                {TASKS.map(t=>(
                  <tr key={t.id}>
                    <td style={{fontWeight:500}}>{t.title}</td>
                    <td>
                      <span className={`status-badge ${t.status==='open'?'s-open':t.status==='in_progress'?'s-prog':'s-done'}`}>
                        {t.status==='open'?'open':t.status==='in_progress'?'in progress':'completed'}
                      </span>
                    </td>
                    <td style={{fontFamily:'var(--mono)',fontSize:12}}>{t.reward}</td>
                    <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--gray)'}}>{t.deadline}</td>
                    <td style={{fontSize:12}}>{t.assigned||'—'}</td>
                    <td><button className="btn" style={{fontSize:11,padding:'5px 12px'}}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>}

          {activeTab==='post' && <>
            <div className="main-title">Post a task</div>
            <div className="main-sub">Payment held in smart contract escrow until completion</div>
            <div className="form-field">
              <label className="form-label">TASK TITLE</label>
              <input className="form-input" placeholder="e.g. DeFi Research Report Q2 2025" />
            </div>
            <div className="form-field">
              <label className="form-label">DESCRIPTION</label>
              <textarea className="form-input" placeholder="Describe the task, deliverables, and expectations..." />
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">REWARD (USDC)</label>
                <input className="form-input" type="number" placeholder="500" />
              </div>
              <div className="form-field">
                <label className="form-label">DEADLINE</label>
                <input className="form-input" type="date" />
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">REQUIRED SBT TAGS (comma separated)</label>
              <input className="form-input" placeholder="defi, tokenomics, research" />
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">MIN DAO LEVEL</label>
                <input className="form-input" type="number" min="0" max="5" placeholder="1" />
              </div>
              <div className="form-field">
                <label className="form-label">TASK TYPE</label>
                <input className="form-input" placeholder="Research / Development / Design" />
              </div>
            </div>
            <hr className="divider" />
            <div style={{fontSize:12,color:'var(--gray)',marginBottom:16,fontFamily:'var(--mono)'}}>
              · 5% platform fee deducted on release · Auto-release after 7 days if no response · Dispute resolution via Skillstamp multisig
            </div>
            <button className="btn btn-primary" style={{padding:'12px 28px',fontSize:14}}>
              Deposit & publish task →
            </button>
          </>}

        </main>
      </div>
    </>
  );
}
