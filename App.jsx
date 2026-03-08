import { useState, useRef, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function App() {
  const [file, setFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState("")
  const [query, setQuery] = useState("") 
  const [extractedRule, setExtractedRule] = useState("")
  
  // Agentic States
  const [agentLogs, setAgentLogs] = useState([])
  const [auditStrategy, setAuditStrategy] = useState("")
  const [auditResults, setAuditResults] = useState([])
  const [activeMode, setActiveMode] = useState("") // 'advisory' or 'audit'
  
  const [isUploading, setIsUploading] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isWorking, setIsWorking] = useState(false)

  const logEndRef = useRef(null)

  // Auto-scroll the Agent Terminal
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [agentLogs])

  const suggestedQueries = [
    { label: "High-Value Thresholds", text: "What is the exact rule and threshold amount for high-value transactions?" },
    { label: "Sanctioned Countries", text: "What are the rules regarding transactions to sanctioned beneficiary countries like KP or IR?" },
    { label: "Source of Funds", text: "What is the specific requirement for transactions where the source of funds is unknown?" }
  ];

  const handleFileChange = (e) => setFile(e.target.files[0])

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true); setUploadStatus("")
    const formData = new FormData()
    formData.append("file", file)
    try {
      const response = await fetch("http://127.0.0.1:5000/upload", { method: "POST", body: formData })
      const data = await response.json()
      if (response.ok) setUploadStatus(`✅ PDF Indexed Successfully`)
    } catch (err) {
      setUploadStatus("❌ Failed to connect.")
    }
    setIsUploading(false)
  }

  const executeQuickExtract = async (queryText) => {
    setIsExtracting(true); setQuery(queryText); setExtractedRule("Agent is reading document...")
    try {
      const response = await fetch("http://127.0.0.1:5000/extract", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: queryText })
      })
      const data = await response.json()
      if (response.ok) setExtractedRule(data.extracted_rule)
    } catch (err) {
      setExtractedRule("Error extracting rule.")
    }
    setIsExtracting(false)
  }

  // THE AGENTIC WORKFLOW TRIGGER
  const triggerAgent = async (mode) => {
    if (!extractedRule) return;
    setIsWorking(true)
    setActiveMode(mode)
    setAgentLogs([{ type: "system", text: `Initializing Agent in ${mode.toUpperCase()} mode...` }])
    setAuditStrategy("")
    setAuditResults([])
    
    try {
      const response = await fetch("http://127.0.0.1:5000/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_text: extractedRule, mode: mode }) 
      })
      const data = await response.json()
      
      if (response.ok) {
        // Render thoughts one by one for cool matrix effect (simulated delay)
        data.thoughts.forEach((thought, index) => {
          setTimeout(() => {
            setAgentLogs(prev => [...prev, thought])
          }, index * 600) // 600ms delay per log
        })

        // Wait for logs to finish before showing final results
        setTimeout(() => {
          setAuditStrategy(data.strategy)
          if (mode === "audit") {
            setAuditResults(data.violation_data || [])
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
      if (r.risk_score < 50) low++;
      else if (r.risk_score <= 80) med++;
      else high++;
    })
    return [
      { name: 'Low Risk', value: low },
      { name: 'Medium Risk', value: med },
      { name: 'High Risk', value: high }
    ]
  }
  const RISK_COLORS = ['#2ecc71', '#f1c40f', '#e74c3c'];

  const getCountryDistribution = () => {
    const counts = {};
    auditResults.forEach(r => {
      counts[r.beneficiary_country] = (counts[r.beneficiary_country] || 0) + 1;
    })
    return Object.keys(counts).map(key => ({ country: key, count: counts[key] })).sort((a,b)=> b.count - a.count).slice(0, 5); // Top 5
  }

  // --- STYLES ---
  const paneStyle = { flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }
  const cardStyle = { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #ddd', color: '#333' }

  return (
    <div style={{ backgroundColor: '#ecf0f1', minHeight: '100vh', padding: '20px', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
      <h1 style={{ color: '#2c3e50', textAlign: 'center', marginBottom: '30px', fontWeight: '800' }}>
        🤖 ReguBot: Agentic Compliance Copilot
      </h1>

      <div style={{ display: 'flex', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* ================= LEFT PANE: AGENT CONTROL CENTER ================= */}
        <div style={{ ...paneStyle, flex: '0 0 35%' }}>
          
          <div style={cardStyle}>
            <h3 style={{ color: '#2980b9', marginTop: 0 }}>1. Knowledge Base</h3>
            <input type="file" accept="application/pdf" onChange={handleFileChange} style={{ marginBottom: '10px', fontSize: '0.9rem' }} />
            <button onClick={handleUpload} disabled={isUploading} style={{ backgroundColor: '#2ecc71', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', width: '100%' }}>
              {isUploading ? "Uploading..." : "Index Document"}
            </button>
            {uploadStatus && <div style={{ color: '#27ae60', fontSize: '0.85rem', marginTop: '10px', fontWeight: 'bold' }}>{uploadStatus}</div>}
          </div>

          <div style={cardStyle}>
            <h3 style={{ color: '#8e44ad', marginTop: 0 }}>2. Rule Discovery</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
              {suggestedQueries.map((q, idx) => (
                <button key={idx} onClick={() => executeQuickExtract(q.text)} disabled={!uploadStatus || isExtracting}
                  style={{ backgroundColor: '#ecf0f1', color: '#2c3e50', border: '1px solid #bdc3c7', padding: '8px', borderRadius: '4px', cursor: (!uploadStatus || isExtracting) ? 'not-allowed' : 'pointer', textAlign: 'left', fontSize: '0.85rem', transition: '0.2s' }}>
                  🔍 {q.label}
                </button>
              ))}
            </div>
            <textarea value={extractedRule} onChange={(e) => setExtractedRule(e.target.value)} placeholder="Extracted rule will appear here..."
              style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', backgroundColor: '#fafafa', color: '#000' }} />
          </div>

          <div style={cardStyle}>
            <h3 style={{ color: '#d35400', marginTop: 0 }}>3. Agent Deployment</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => triggerAgent('advisory')} disabled={isWorking || !extractedRule}
                style={{ flex: 1, backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                💬 Advisory Only
              </button>
              <button onClick={() => triggerAgent('audit')} disabled={isWorking || !extractedRule}
                style={{ flex: 1, backgroundColor: '#c0392b', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                🚀 Execute Audit
              </button>
            </div>
          </div>

          {/* AGENT TERMINAL LOG */}
          <div style={{ ...cardStyle, backgroundColor: '#1e1e1e', color: '#00ff00', fontFamily: 'monospace', height: '250px', overflowY: 'auto' }}>
            <h4 style={{ color: '#fff', marginTop: 0, borderBottom: '1px solid #444', paddingBottom: '5px' }}>Terminal: Agent Execution Log</h4>
            {agentLogs.length === 0 && <span style={{ color: '#666' }}>Awaiting instructions...</span>}
            {agentLogs.map((log, i) => (
              <div key={i} style={{ marginBottom: '5px', fontSize: '0.85rem' }}>
                <span style={{ color: log.type === 'thought' ? '#f39c12' : log.type === 'action' ? '#3498db' : '#e74c3c' }}>
                  [{log.type.toUpperCase()}]
                </span> {log.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

        </div>

        {/* ================= RIGHT PANE: ANALYTICS WORKSPACE ================= */}
        <div style={{ ...paneStyle, flex: '0 0 63%' }}>
          
          {/* Welcome / Empty State */}
          {!auditStrategy && !isWorking && (
            <div style={{ ...cardStyle, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#7f8c8d' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '10px' }}>Workspace is Empty</h2>
              <p>Deploy the agent from the Left Panel to generate reports and analytics.</p>
            </div>
          )}

          {/* Advisory Report Card */}
          {auditStrategy && (
            <div style={{ ...cardStyle, borderLeft: '5px solid #3498db' }}>
              <h3 style={{ color: '#2c3e50', marginTop: 0 }}>📄 Compliance Strategy Report</h3>
              <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: '#34495e' }}>{auditStrategy}</p>
              {activeMode === 'advisory' && (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fef9e7', color: '#d35400', borderRadius: '4px', fontWeight: 'bold' }}>
                  ℹ️ This is an Advisory Report. No database queries were executed. To scan real transactions, click "Execute Audit".
                </div>
              )}
            </div>
          )}

          {/* Data Dashboards (Only show if Audit Mode) */}
          {activeMode === 'audit' && auditStrategy && (
            <>
              <div style={{ display: 'flex', gap: '20px', height: '250px' }}>
                {/* Donut Chart */}
                <div style={{ ...cardStyle, flex: 1 }}>
                  <h4 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>Risk Distribution</h4>
                  <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                      <Pie data={getRiskDistribution()} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {getRiskDistribution().map((entry, index) => <Cell key={`cell-${index}`} fill={RISK_COLORS[index % RISK_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Bar Chart */}
                <div style={{ ...cardStyle, flex: 1 }}>
                  <h4 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>Top Flagged Countries</h4>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={getCountryDistribution()}>
                      <XAxis dataKey="country" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8e44ad" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Data Table */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, color: '#c0392b' }}>Flagged Transactions ({auditResults.length})</h3>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#ecf0f1' }}>
                      <tr>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Customer</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Amount (MYR)</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Country</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditResults.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '10px' }}>{row.transaction_date}</td>
                          <td style={{ padding: '10px' }}>{row.customer_name}</td>
                          <td style={{ padding: '10px' }}>{row.transaction_type}</td>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{row.amount}</td>
                          <td style={{ padding: '10px' }}>{row.beneficiary_country}</td>
                          <td style={{ padding: '10px', color: row.risk_score > 80 ? '#c0392b' : '#333', fontWeight: row.risk_score > 80 ? 'bold' : 'normal' }}>
                            {row.risk_score}
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
