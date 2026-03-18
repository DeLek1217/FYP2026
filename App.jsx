import { useState, useRef, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function App() {
  // --- AUTHENTICATION STATE ---
  const [user, setUser] = useState(null)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')

  // --- STATES ---
  const [file, setFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [discoveredRules, setDiscoveredRules] = useState([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [extractedRule, setExtractedRule] = useState("")
  
  // Agentic Workflow States
  const [agentLogs, setAgentLogs] = useState([])
  const [auditStrategy, setAuditStrategy] = useState("")
  const [auditResults, setAuditResults] = useState([])
  const [activeMode, setActiveMode] = useState("") 
  const [isWorking, setIsWorking] = useState(false)
  
  // NEW: Bulk Selection State
  const [selectedRows, setSelectedRows] = useState([])

  const logEndRef = useRef(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [agentLogs])

  // --- LOGIN HANDLER ---
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    try {
      const res = await fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      })
      const data = await res.json()
      if (res.ok) setUser(data)
      else setLoginError(data.error)
    } catch (err) {
      setLoginError("Failed to connect to server.")
    }
  }

  // --- HITL REVIEW HANDLERS ---
  
  // 1. Single Action (For Manager)
  const handleReview = async (transactionId, newStatus) => {
    try {
      const res = await fetch("http://127.0.0.1:5000/review_transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transactionId, status: newStatus })
      })
      if (res.ok) {
        setAuditResults(prev => prev.map(row => 
          row.transaction_id === transactionId ? { ...row, review_status: newStatus } : row
        ))
      }
    } catch (err) {
      alert("Failed to save decision.")
    }
  }

  // 2. Bulk Action (For Analyst)
  const handleBulkAction = async (newStatus) => {
    if (selectedRows.length === 0) return;
    try {
      const res = await fetch("http://127.0.0.1:5000/bulk_review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            transaction_ids: selectedRows, 
            status: newStatus,
            username: user.name
        })
      })
      if (res.ok) {
        setAuditResults(prev => prev.map(row => 
          selectedRows.includes(row.transaction_id) ? { ...row, review_status: newStatus } : row
        ))
        setSelectedRows([]) // Clear selection after success
      }
    } catch (err) {
      alert("Failed to process bulk action.")
    }
  }

  // Checkbox Handlers
  const handleSelectRow = (id) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // Only select rows that are still "Pending"
      const pendingIds = auditResults.filter(r => r.review_status === 'Pending').map(r => r.transaction_id)
      setSelectedRows(pendingIds)
    } else {
      setSelectedRows([])
    }
  }

  // --- EXPORT TO CSV ---
  const handleDownloadCSV = () => {
    if (!auditResults || auditResults.length === 0) return;
    const headers = [
      "Transaction ID", "Date", "Customer Name", "Amount (MYR)", 
      "Risk Score", "ML Probability (%)", "Review Status"
    ];
    const csvRows = auditResults.map(r => [
      r.transaction_id, r.transaction_date, `"${r.customer_name}"`, r.amount, 
      r.calculated_risk_score, r.ml_probability, r.review_status || 'Pending'
    ].join(','));
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Audit_Report_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  // --- EXISTING WORKFLOW HANDLERS ---
  const handleFileChange = (e) => setFile(e.target.files[0])

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true); setUploadStatus(""); setDiscoveredRules([]); setExtractedRule("");
    const formData = new FormData()
    formData.append("file", file)
    try {
      const response = await fetch("http://127.0.0.1:5000/upload", { method: "POST", body: formData })
      const data = await response.json()
      if (response.ok) setUploadStatus(`✅ PDF Indexed Successfully`)
      else setUploadStatus(`❌ Error: ${data.error}`)
    } catch (err) {
      setUploadStatus("❌ Failed to connect to server.")
    }
    setIsUploading(false)
  }

  const scanDocumentForRules = async () => {
    setIsDiscovering(true); setDiscoveredRules([]); setExtractedRule("");
    try {
      const response = await fetch("http://127.0.0.1:5000/discover_rules")
      const data = await response.json()
      if (response.ok) setDiscoveredRules(data.rules || [])
      else setAgentLogs(prev => [...prev, { type: "error", text: `Scan failed: ${data.error}` }])
    } catch (err) {
      setAgentLogs(prev => [...prev, { type: "error", text: "❌ Failed to connect for rule scan." }])
    }
    setIsDiscovering(false)
  }

  const triggerAgent = async (mode) => {
    if (!extractedRule) return;
    setIsWorking(true); setActiveMode(mode); setSelectedRows([]);
    setAgentLogs([{ type: "system", text: `Initializing Agent in ${mode.toUpperCase()} mode...` }])
    setAuditStrategy(""); setAuditResults([]);
    try {
      const response = await fetch("http://127.0.0.1:5000/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_text: extractedRule, mode: mode }) 
      })
      const data = await response.json()
      if (response.ok) {
        data.thoughts.forEach((thought, index) => {
          setTimeout(() => setAgentLogs(prev => [...prev, thought]), index * 600) 
        })
        setTimeout(() => {
          setAuditStrategy(data.strategy)
          if (mode === "audit") {
            const resultsWithStatus = (data.violation_data || []).map(row => ({
                ...row, review_status: row.review_status || 'Pending'
            }));
            setAuditResults(resultsWithStatus)
          }
          setIsWorking(false)
        }, data.thoughts.length * 600)
      } else {
        setAgentLogs(prev => [...prev, { type: "error", text: data.error }])
        setIsWorking(false)
      }
    } catch (err) {
      setAgentLogs(prev => [...prev, { type: "error", text: "Connection to Agent failed." }])
      setIsWorking(false)
    }
  }

  // --- CHART DATA PROCESSING ---
  const getRiskDistribution = () => {
    let low = 0, med = 0, high = 0;
    auditResults.forEach(r => {
      if (r.calculated_risk_score < 50) low++;
      else if (r.calculated_risk_score <= 80) med++;
      else high++;
    })
    return [ { name: 'Low Risk', value: low }, { name: 'Medium Risk', value: med }, { name: 'High Risk', value: high } ]
  }
  const RISK_COLORS = ['#2ecc71', '#f1c40f', '#e74c3c'];

  const getCountryDistribution = () => {
    const counts = {};
    auditResults.forEach(r => { counts[r.beneficiary_country] = (counts[r.beneficiary_country] || 0) + 1; })
    return Object.keys(counts).map(key => ({ country: key, count: counts[key] })).sort((a,b)=> b.count - a.count).slice(0, 5);
  }

  const paneStyle = { flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }
  const cardStyle = { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #ddd', color: '#333' }

  // --- RENDER LOGIN SCREEN IF NOT AUTHENTICATED ---
  if (!user) {
    return (
      <div style={{ backgroundColor: '#ecf0f1', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Tahoma, sans-serif' }}>
        <div style={{ ...cardStyle, width: '400px', textAlign: 'center' }}>
          <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>🔐 ReguBot Secure Access</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="text" placeholder="Username (analyst or manager)" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} required />
            <input type="password" placeholder="Password (123)" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} required />
            <button type="submit" style={{ backgroundColor: '#2980b9', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Sign In</button>
          </form>
          {loginError && <p style={{ color: '#e74c3c', marginTop: '15px', fontWeight: 'bold' }}>{loginError}</p>}
        </div>
      </div>
    )
  }

  // --- MAIN APP RENDER ---
  return (
    <div style={{ backgroundColor: '#ecf0f1', minHeight: '100vh', padding: '20px', fontFamily: 'Segoe UI, Tahoma, sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1400px', margin: '0 auto 30px auto' }}>
        <h1 style={{ color: '#2c3e50', margin: 0, fontWeight: '800' }}>🤖 ReguBot: Agentic Compliance Copilot</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ backgroundColor: '#fff', padding: '8px 15px', borderRadius: '20px', border: '1px solid #bdc3c7', fontWeight: 'bold', color: '#2c3e50' }}>
            👤 {user.name} ({user.role.toUpperCase()})
          </span>
          <button onClick={() => {setUser(null); setAuditResults([]);}} style={{ backgroundColor: '#e74c3c', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Log Out
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* ================= LEFT PANE: AGENT CONTROL CENTER ================= */}
        <div style={{ ...paneStyle, flex: '0 0 35%' }}>
          
          <div style={cardStyle}>
            <h3 style={{ color: '#2980b9', marginTop: 0 }}>1. Knowledge Base</h3>
            <input type="file" accept="application/pdf" onChange={handleFileChange} style={{ marginBottom: '10px', fontSize: '0.9rem' }} />
            <button onClick={handleUpload} disabled={isUploading} style={{ backgroundColor: '#2ecc71', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', width: '100%' }}>
              {isUploading ? "Uploading..." : "Index Document"}
            </button>
          </div>

          <div style={cardStyle}>
            <h3 style={{ color: '#8e44ad', marginTop: 0 }}>2. Dynamic Rule Discovery</h3>
            <button onClick={scanDocumentForRules} disabled={!uploadStatus || isDiscovering} style={{ width: '100%', backgroundColor: '#8e44ad', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: (!uploadStatus || isDiscovering) ? 'not-allowed' : 'pointer', fontWeight: 'bold', marginBottom: '15px' }}>
              {isDiscovering ? "🤖 AI is Scanning Document..." : "📄 Auto-Scan Document for Rules"}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
              {discoveredRules.map((rule, idx) => (
                <button key={idx} onClick={() => setExtractedRule(rule.text)} style={{ backgroundColor: '#ecf0f1', color: '#2c3e50', border: '1px solid #bdc3c7', padding: '10px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', transition: '0.2s' }}>
                  <strong style={{display: 'block', color: '#2980b9', marginBottom: '4px'}}>{rule.label}</strong>
                  <span style={{color: '#7f8c8d'}}>{rule.text}</span>
                </button>
              ))}
            </div>
            <textarea value={extractedRule} onChange={(e) => setExtractedRule(e.target.value)} placeholder="Click a discovered rule above, or type manually..." style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', backgroundColor: '#fafafa', color: '#000' }} />
          </div>

          <div style={cardStyle}>
            <h3 style={{ color: '#d35400', marginTop: 0 }}>3. Agent Deployment</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => triggerAgent('advisory')} disabled={isWorking || !extractedRule} style={{ flex: 1, backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>💬 Advisory Only</button>
              <button onClick={() => triggerAgent('audit')} disabled={isWorking || !extractedRule} style={{ flex: 1, backgroundColor: '#c0392b', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🚀 Execute Audit</button>
            </div>
          </div>

          <div style={{ ...cardStyle, backgroundColor: '#1e1e1e', color: '#00ff00', fontFamily: 'monospace', height: '250px', overflowY: 'auto' }}>
            <h4 style={{ color: '#fff', marginTop: 0, borderBottom: '1px solid #444', paddingBottom: '5px' }}>Terminal: Agent Execution Log</h4>
            {agentLogs.length === 0 && <span style={{ color: '#666' }}>Awaiting instructions...</span>}
            {agentLogs.map((log, i) => (
              <div key={i} style={{ marginBottom: '5px', fontSize: '0.85rem' }}>
                <span style={{ color: log.type === 'thought' ? '#f39c12' : log.type === 'action' ? '#3498db' : '#e74c3c' }}>[{log.type.toUpperCase()}]</span> {log.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

        </div>

        {/* ================= RIGHT PANE: ANALYTICS WORKSPACE ================= */}
        <div style={{ ...paneStyle, flex: '0 0 63%' }}>
          
          {!auditStrategy && !isWorking && (
            <div style={{ ...cardStyle, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#7f8c8d' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '10px' }}>Workspace is Empty</h2>
              <p>Deploy the agent from the Left Panel to generate reports and analytics.</p>
            </div>
          )}

          {activeMode === 'audit' && auditStrategy && (
            <>
              {/* Data Table */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, color: '#c0392b' }}>Flagged Transactions ({auditResults.length})</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleDownloadCSV} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📥 Export CSV</button>
                  </div>
                </div>

                {/* BULK ACTIONS BAR (Only visible to Analyst when items are selected) */}
                {user.role === 'analyst' && selectedRows.length > 0 && (
                  <div style={{ backgroundColor: '#e8f4f8', padding: '10px', borderRadius: '4px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#2980b9' }}>{selectedRows.length} transactions selected</span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => handleBulkAction('Rejected')} style={{ backgroundColor: '#95a5a6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ Bulk Clear (False Positive)</button>
                      <button onClick={() => handleBulkAction('Escalated')} style={{ backgroundColor: '#e67e22', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>⚠️ Escalate Selected to Manager</button>
                    </div>
                  </div>
                )}

                <div style={{ overflowY: 'auto', maxHeight: '500px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#ecf0f1', zIndex: 1 }}>
                      <tr>
  
                        {/* Checkbox Header (Only for Analyst) */}
                        {user.role === 'analyst' && (
                          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #bdc3c7', width: '40px' }}>
                            <input 
                              type="checkbox" 
                              onChange={handleSelectAll}
                              checked={selectedRows.length > 0 && selectedRows.length === auditResults.filter(r => r.review_status === 'Pending').length}
                              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2980b9' }}
                            />
                            </th>
                        )}
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #bdc3c7' }}>Date & Amount</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #bdc3c7' }}>Customer Profile</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #bdc3c7' }}>AI Prediction</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #bdc3c7' }}>Review Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditResults.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee', backgroundColor: selectedRows.includes(row.transaction_id) ? '#eaf2f8' : 'white' }}>
                          
                          {/* Checkbox Column (Only for Analyst) */}
                          {user.role === 'analyst' && (
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedRows.includes(row.transaction_id)}
                                onChange={() => handleSelectRow(row.transaction_id)}
                                disabled={row.review_status !== 'Pending'}
                                style={{ width: '18px', height: '18px', cursor: row.review_status === 'Pending' ? 'pointer' : 'not-allowed', accentColor: '#2980b9' }}
                              />
                            </td>
                        )}
                          
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>{row.transaction_date}</div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#c0392b', marginTop: '4px' }}>
                              MYR {row.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>
                          
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: 'bold' }}>{row.customer_name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#34495e', marginTop: '4px' }}>Status: {row.account_status}</div>
                          </td>

                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '50px', backgroundColor: '#ecf0f1', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                                <div style={{ width: `${row.ml_probability || 0}%`, backgroundColor: (row.ml_probability || 0) > 80 ? '#c0392b' : '#f39c12', height: '100%' }}></div>
                              </div>
                              <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{row.ml_probability}%</span>
                            </div>
                          </td>

                          {/* DYNAMIC REVIEW COLUMN */}
                          <td style={{ padding: '12px' }}>
                            {row.review_status === 'Approved' ? (
                                <span style={{ color: '#27ae60', fontWeight: 'bold' }}>✅ STR Filed (Approved)</span>
                            ) : row.review_status === 'Rejected' ? (
                                <span style={{ color: '#95a5a6', fontWeight: 'bold' }}>🗑️ Cleared (False Positive)</span>
                            ) : row.review_status === 'Escalated' ? (
                                user.role === 'manager' ? (
                                  <div style={{ display: 'flex', gap: '5px' }}>
                                      <button onClick={() => handleReview(row.transaction_id, 'Approved')} style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Approve STR</button>
                                      <button onClick={() => handleReview(row.transaction_id, 'Rejected')} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Reject</button>
                                  </div>
                                ) : (
                                  <span style={{ color: '#e67e22', fontWeight: 'bold' }}>⚠️ Escalated to Manager</span>
                                )
                            ) : (
                                <span style={{ color: '#f39c12', fontWeight: 'bold', fontSize: '0.85rem' }}>⏳ Pending Triage</span>
                            )}
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
