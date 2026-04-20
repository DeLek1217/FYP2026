import { useState, useRef, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import LoginScreen from './LoginScreen.jsx'
import regubotLogo from './assets/regubotLogo.png'


function App() {
  // --- AUTHENTICATION STATE ---
  const [user, setUser] = useState(null)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')

  // --- THEME & RESPONSIVE STATE ---
  const [themeMode, setThemeMode] = useState('system')
  const [isSystemDark, setIsSystemDark] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsSystemDark(mediaQuery.matches)
    const handler = (e) => setIsSystemDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const activeTheme = themeMode === 'system' ? (isSystemDark ? 'dark' : 'light') : themeMode

  const colors = {
    light: {
      bg: '#ecf0f1', text: '#2c3e50', subText: '#7f8c8d', cardBg: '#ffffff',
      cardBorder: '#dddddd', inputBg: '#fafafa', inputBorder: '#cccccc',
      tableHeader: '#f8f9fa', tableRowHover: '#f4f9fd', tableBorder: '#eeeeee',
      danger: '#c0392b', success: '#27ae60', warning: '#f39c12', primary: '#2980b9', secondary: '#8e44ad', badgeBg: '#f3e5f5'
    },
    dark: {
      bg: '#121212', text: '#ecf0f1', subText: '#bdc3c7', cardBg: '#1e1e1e',
      cardBorder: '#333333', inputBg: '#2a2a2a', inputBorder: '#444444',
      tableHeader: '#252525', tableRowHover: '#2a3b4c', tableBorder: '#333333',
      danger: '#e74c3c', success: '#2ecc71', warning: '#f1c40f', primary: '#3498db', secondary: '#9b59b6', badgeBg: '#3a1f42'
    }
  }
  const theme = colors[activeTheme]

  // --- GENERAL STATES ---
  const [file, setFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  
  // --- MULTI-RULE DISCOVERY STATES ---
  const [discoveredRules, setDiscoveredRules] = useState([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [selectedRuleIndices, setSelectedRuleIndices] = useState([])
  const [combinedRuleText, setCombinedRuleText] = useState("")
  
  // --- AGENTIC WORKFLOW STATES ---
  const [agentLogs, setAgentLogs] = useState([])
  const [auditStrategy, setAuditStrategy] = useState("")
  const [auditResults, setAuditResults] = useState([])
  const [isWorking, setIsWorking] = useState(false)
  
  // --- HITL & SENIOR REPORT STATES ---
  const [selectedRows, setSelectedRows] = useState([])
  const [activeTab, setActiveTab] = useState('audit')
  const [tableFilter, setTableFilter] = useState('all') // NEW: 'all' or 'escalated'
  const [generatedReport, setGeneratedReport] = useState("")
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  const logEndRef = useRef(null)
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [agentLogs])

  // --- LOGIN HANDLER ---
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    try {
      const res = await fetch("http://127.0.0.1:5000/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(loginForm)
      })
      const data = await res.json()
      if (res.ok) { 
        setUser(data); 
        setActiveTab('audit'); 
        setTableFilter('all'); // Reset filter on login
      } 
      else { setLoginError(data.error) }
    } catch (err) { setLoginError("Failed to connect to server.") }
  }

  // --- RULE DISCOVERY MULTI-SELECT LOGIC ---
  const handleToggleRule = (idx) => {
    const updatedSelection = selectedRuleIndices.includes(idx)
      ? selectedRuleIndices.filter(i => i !== idx)
      : [...selectedRuleIndices, idx]
    setSelectedRuleIndices(updatedSelection)
    updateCombinedText(updatedSelection)
  }

  const handleSelectAllRules = () => {
    if (selectedRuleIndices.length === discoveredRules.length) {
      setSelectedRuleIndices([])
      setCombinedRuleText("")
    } else {
      const allIndices = discoveredRules.map((_, i) => i)
      setSelectedRuleIndices(allIndices)
      updateCombinedText(allIndices)
    }
  }

  const updateCombinedText = (indices) => {
    if (indices.length === 0) {
      setCombinedRuleText("")
      return
    }
    const combined = indices.map(i => `- ${discoveredRules[i].text}`).join("\n")
    setCombinedRuleText(`Please audit the database for the following rules:\n${combined}`)
  }

  // --- HITL REVIEW HANDLERS ---
  const handleReview = async (transactionId, newStatus) => {
    try {
      const res = await fetch("http://127.0.0.1:5000/review_transaction", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transactionId, status: newStatus })
      })
      if (res.ok) setAuditResults(prev => prev.map(row => row.transaction_id === transactionId ? { ...row, review_status: newStatus } : row))
    } catch (err) { alert("Failed to save decision.") }
  }

  const handleBulkAction = async (newStatus) => {
    if (selectedRows.length === 0) return;
    try {
      const res = await fetch("http://127.0.0.1:5000/bulk_review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_ids: selectedRows, status: newStatus, username: user.name })
      })
      if (res.ok) {
        setAuditResults(prev => prev.map(row => selectedRows.includes(row.transaction_id) ? { ...row, review_status: newStatus } : row))
        setSelectedRows([]) 
      }
    } catch (err) { alert("Failed to process bulk action.") }
  }

  // NEW: Dynamic Table Filtering
  const displayedResults = tableFilter === 'escalated' 
    ? auditResults.filter(r => r.review_status === 'Escalated') 
    : auditResults;

  const handleSelectRow = (id) => {
    if (!id) return;
    setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])
  }
  
  const handleSelectAllRows = (e) => {
    if (e.target.checked) {
      const selectableIds = displayedResults
        .filter(r => user.role === 'senior' ? (r.review_status === 'Pending' || r.review_status === 'Escalated') : r.review_status === 'Pending')
        .filter(r => r.transaction_id)
        .map(r => r.transaction_id)
      setSelectedRows(selectableIds)
    } else { setSelectedRows([]) }
  }

  // --- PIPELINE HANDLERS ---
  const handleFileChange = (e) => setFile(e.target.files[0])

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true); setUploadStatus(""); setDiscoveredRules([]); 
    setSelectedRuleIndices([]); setCombinedRuleText("");
    const formData = new FormData(); formData.append("file", file);
    try {
      const response = await fetch("http://127.0.0.1:5000/upload", { method: "POST", body: formData })
      const data = await response.json()
      if (response.ok) setUploadStatus(`✅ PDF Indexed Successfully`)
      else setUploadStatus(`❌ Error: ${data.error}`)
    } catch (err) { setUploadStatus("❌ Failed to connect to server.") }
    setIsUploading(false)
  }

  const scanDocumentForRules = async () => {
    setIsDiscovering(true); setDiscoveredRules([]); setSelectedRuleIndices([]); setCombinedRuleText("");
    try {
      const response = await fetch("http://127.0.0.1:5000/discover_rules")
      const data = await response.json()
      if (response.ok) setDiscoveredRules(data.rules || [])
      else setAgentLogs(prev => [...prev, { type: "error", text: `Scan failed: ${data.error}` }])
    } catch (err) { setAgentLogs(prev => [...prev, { type: "error", text: "❌ Failed to connect for rule scan." }]) }
    setIsDiscovering(false)
  }

  const triggerAgent = async () => {
    if (!combinedRuleText) return;
    setIsWorking(true); setSelectedRows([]); setActiveTab('audit'); setTableFilter('all');
    setAgentLogs([{ type: "system", text: `Initializing Autonomous AI Auditor...` }])
    setAuditStrategy(""); setAuditResults([]); setGeneratedReport("");
    
    try {
      const response = await fetch("http://127.0.0.1:5000/audit", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rule_text: combinedRuleText }) 
      })
      const data = await response.json()
      if (response.ok) {
        data.thoughts.forEach((thought, index) => { setTimeout(() => setAgentLogs(prev => [...prev, thought]), index * 600) })
        setTimeout(() => {
          setAuditStrategy(data.strategy)
          const resultsWithStatus = (data.violation_data || []).map(row => ({ ...row, review_status: row.review_status || 'Pending' }))
          setAuditResults(resultsWithStatus)
          setIsWorking(false)
        }, data.thoughts.length * 600)
      } else {
        setAgentLogs(prev => [...prev, { type: "error", text: data.error }]); setIsWorking(false)
      }
    } catch (err) { setAgentLogs(prev => [...prev, { type: "error", text: "Connection to Agent failed." }]); setIsWorking(false) }
  }

  // --- REPORT GENERATION ---
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true)
    setGeneratedReport("AI is analyzing escalated transactions and drafting the executive summary...")
    try {
      const res = await fetch("http://127.0.0.1:5000/generate_report", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactions: auditResults })
      })
      const data = await res.json()
      if (res.ok) setGeneratedReport(data.report)
      else setGeneratedReport(`Error generating report: ${data.error}`)
    } catch (err) { setGeneratedReport("Failed to connect to AI engine for report generation.") }
    setIsGeneratingReport(false)
  }

  const handleDownloadReport = () => {
    const blob = new Blob([generatedReport], { type: 'text/plain;charset=utf-8;' })
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `STR_Executive_Report_${new Date().toISOString().slice(0,10)}.txt`; link.click();
  }

  const handleDownloadCSV = () => {
    if (!auditResults || auditResults.length === 0) return;
    const headers = [ "Transaction ID", "Date", "Customer Name", "Amount (MYR)", "Violation Reason", "Risk Score", "ML Probability (%)", "Review Status" ]
    const csvRows = displayedResults.map(r => [
      r.transaction_id || 'N/A', r.transaction_date, `"${r.customer_name}"`, r.amount, `"${r.violation_reason || 'Unknown Rule'}"`, r.risk_score, r.ml_probability, r.review_status || 'Pending'
    ].join(','))
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `Audit_Data_${new Date().toISOString().slice(0,10)}.csv`; link.click();
  }

  // --- CHART DATA PROCESSING ---
  const getRiskDistribution = () => {
    let low = 0, med = 0, high = 0;
    displayedResults.forEach(r => { if (r.risk_score < 50) low++; else if (r.risk_score <= 80) med++; else high++; })
    return [ { name: 'Low Risk', value: low }, { name: 'Medium Risk', value: med }, { name: 'High Risk', value: high } ]
  }
  const RISK_COLORS = [theme.success, theme.warning, theme.danger]

  const getCountryDistribution = () => {
    const counts = {};
    displayedResults.forEach(r => { counts[r.beneficiary_country] = (counts[r.beneficiary_country] || 0) + 1; })
    return Object.keys(counts).map(key => ({ country: key, count: counts[key] })).sort((a,b)=> b.count - a.count).slice(0, 5)
  }

  const cardStyle = { backgroundColor: theme.cardBg, padding: '20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: `1px solid ${theme.cardBorder}`, color: theme.text }

  // NEW: REUSABLE INFO TOOLTIP COMPONENT
  const InfoIcon = ({ text }) => (
    <span title={text} style={{ cursor: 'help', marginLeft: '6px', fontSize: '0.75rem', backgroundColor: theme.primary, color: 'white', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
      ?
    </span>
  );

  // ================= RENDER LOGIN SCREEN =================
  if (!user) {
    return (
      <LoginScreen 
        handleLogin={handleLogin}
        loginError={loginError}
        loginForm={loginForm}
        setLoginForm={setLoginForm}
      />
    )
  }

  // ================= MAIN APP RENDER =================
  return (
    <div style={{ backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', padding: '20px', fontFamily: 'Segoe UI, Tahoma, sans-serif', transition: 'background-color 0.3s' }}>
      
      {/* INJECT RESPONSIVE CSS GRID */}
      <style>{`
        .app-container { max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
        .grid-layout { display: grid; grid-template-columns: 350px 1fr; gap: 20px; align-items: start; }
        .left-pane { display: flex; flex-direction: column; gap: 20px; }
        .right-pane { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
        @media (max-width: 1024px) {
          .grid-layout { grid-template-columns: 1fr; }
        }
        select:focus, input:focus, textarea:focus { outline: 2px solid ${theme.primary}; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${theme.cardBg}; }
        ::-webkit-scrollbar-thumb { background: ${theme.inputBorder}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${theme.subText}; }
      `}</style>

      <div className="app-container">
        
        {/* HEADER & SETTINGS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src={regubotLogo} alt="ReguBot Logo" style={{ height: '80px', objectFit: 'contain' }} />
            <h1 style={{ color: theme.text, margin: 0, fontWeight: '800', fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}>
              ReguBot: Agentic Compliance
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>  
            <select value={themeMode} onChange={(e) => setThemeMode(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: `1px solid ${theme.cardBorder}`, backgroundColor: theme.cardBg, color: theme.text, cursor: 'pointer', fontWeight: 'bold' }}>
              <option value="system">🖥️ System Theme</option>
              <option value="light">☀️ Light Mode</option>
              <option value="dark">🌙 Dark Mode</option>
            </select>

            <span style={{ backgroundColor: theme.cardBg, padding: '8px 15px', borderRadius: '20px', border: `1px solid ${theme.cardBorder}`, fontWeight: 'bold', color: theme.text, fontSize: '0.9rem' }}>
              👤 {user.name} ({user.role.toUpperCase()})
            </span>
            <button onClick={() => {setUser(null);}} style={{ backgroundColor: theme.danger, color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>
              Log Out
            </button>
          </div>
        </div>

        <div className="grid-layout">
          
          {/* ================= LEFT PANE ================= */}
          <div className="left-pane">
            
            <div style={{...cardStyle, padding: '20px'}}>
              <h3 style={{ color: theme.primary, marginTop: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}><span>1.</span> Knowledge Base</h3>
              <input type="file" accept="application/pdf" onChange={handleFileChange} style={{ marginBottom: '15px', fontSize: '0.85rem', width: '100%', color: theme.text }} />
              <button onClick={handleUpload} disabled={isUploading} style={{ backgroundColor: theme.success, color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: 'bold', fontSize: '1rem' }}>
                {isUploading ? "Uploading..." : "Index Document"}
              </button>
              {uploadStatus && <div style={{ color: uploadStatus.includes('❌') ? theme.danger : theme.success, fontSize: '0.85rem', marginTop: '10px', fontWeight: 'bold' }}>{uploadStatus}</div>}
            </div>

            <div style={{...cardStyle, padding: '20px'}}>
              <h3 style={{ color: theme.secondary, marginTop: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                <span><span>2.</span> Rule Discovery</span>
                {discoveredRules.length > 0 && <span style={{ backgroundColor: theme.secondary, color: 'white', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>{discoveredRules.length} Found</span>}
              </h3>
              
              <button onClick={scanDocumentForRules} disabled={!uploadStatus || isDiscovering} style={{ width: '100%', backgroundColor: theme.secondary, color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: (!uploadStatus || isDiscovering) ? 'not-allowed' : 'pointer', fontWeight: 'bold', marginBottom: '15px', fontSize: '1rem' }}>
                {isDiscovering ? "Scanning PDF..." : "Auto-Scan Document"}
              </button>

              {discoveredRules.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: `1px solid ${theme.cardBorder}` }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: theme.subText }}>Select Rules to Audit:</span>
                    <button onClick={handleSelectAllRules} style={{ background: 'none', border: 'none', color: theme.primary, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                      {selectedRuleIndices.length === discoveredRules.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
                    {discoveredRules.map((rule, idx) => (
                      <label key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px', backgroundColor: selectedRuleIndices.includes(idx) ? theme.tableRowHover : theme.cardBg, border: `1px solid ${selectedRuleIndices.includes(idx) ? theme.primary : theme.cardBorder}`, borderRadius: '4px', cursor: 'pointer', transition: '0.2s' }}>
                        <input type="checkbox" checked={selectedRuleIndices.includes(idx)} onChange={() => handleToggleRule(idx)} style={{ marginTop: '3px', cursor: 'pointer' }} />
                        <div style={{ fontSize: '0.85rem', color: theme.text }}>
                          <strong style={{ display: 'block', color: theme.text, marginBottom: '2px' }}>{rule.label}</strong>
                          <span style={{ color: theme.subText, fontSize: '0.75rem' }}>{rule.text}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <textarea 
                value={combinedRuleText} onChange={(e) => setCombinedRuleText(e.target.value)} 
                placeholder="Combined rules will appear here for the AI to process..." 
                style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '4px', border: `1px solid ${theme.inputBorder}`, boxSizing: 'border-box', backgroundColor: theme.inputBg, color: theme.text, fontSize: '0.85rem', resize: 'vertical' }} 
              />
            </div>

            <div style={{...cardStyle, padding: '20px'}}>
              <h3 style={{ color: '#d35400', marginTop: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}><span>3.</span> Execution</h3>
              <button onClick={triggerAgent} disabled={isWorking || !combinedRuleText} style={{ width: '100%', backgroundColor: theme.danger, color: 'white', border: 'none', padding: '12px', borderRadius: '4px', cursor: (isWorking || !combinedRuleText) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '1.05rem', transition: '0.2s' }}>
                {isWorking ? "⏳ Agent is Analyzing..." : "🚀 Run AI Auditor"}
              </button>
            </div>

            <div style={{ ...cardStyle, backgroundColor: '#0d0d0d', color: '#00ff00', fontFamily: 'monospace', height: '220px', overflowY: 'auto', padding: '15px', border: '1px solid #333' }}>
              <h4 style={{ color: '#fff', marginTop: 0, borderBottom: '1px solid #444', paddingBottom: '5px', fontSize: '0.9rem' }}>Terminal Output</h4>
              {agentLogs.length === 0 && <span style={{ color: '#666', fontSize: '0.8rem' }}>Standby for execution...</span>}
              {agentLogs.map((log, i) => (
                <div key={i} style={{ marginBottom: '6px', fontSize: '0.75rem', lineHeight: '1.4' }}>
                  <span style={{ color: log.type === 'thought' ? theme.warning : log.type === 'action' ? theme.primary : theme.danger, fontWeight: 'bold' }}>[{log.type.toUpperCase()}]</span> {log.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

          </div>

          {/* ================= RIGHT PANE ================= */}
          <div className="right-pane">
            
            {user.role === 'senior' && auditResults.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '5px' }}>
                <button onClick={() => setActiveTab('audit')} style={{ flex: '1 1 auto', padding: '12px', fontWeight: 'bold', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'audit' ? theme.primary : theme.cardBorder, color: activeTab === 'audit' ? 'white' : theme.text, transition: '0.3s' }}>
                  🔍 Compliance Audit Workspace
                </button>
                <button onClick={() => setActiveTab('report')} style={{ flex: '1 1 auto', padding: '12px', fontWeight: 'bold', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'report' ? theme.secondary : theme.cardBorder, color: activeTab === 'report' ? 'white' : theme.text, transition: '0.3s' }}>
                  📑 Generate Executive STR Report
                </button>
              </div>
            )}

            {!auditStrategy && !isWorking && (
              <div style={{ ...cardStyle, minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: theme.subText }}>
                <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '10px', textAlign: 'center' }}>Workspace is Empty</h2>
                <p style={{fontSize: '1rem', textAlign: 'center'}}>Select rules from the Knowledge Base to generate insights.</p>
              </div>
            )}

            {auditStrategy && activeTab === 'audit' && (
              <div style={{ ...cardStyle, borderLeft: `4px solid ${theme.primary}`, padding: '20px' }}>
                <h3 style={{ color: theme.text, marginTop: 0, fontSize: '1.2rem' }}>📄 AI Compliance Strategy</h3>
                <p style={{ fontSize: '1rem', lineHeight: '1.6', color: theme.subText, margin: 0, whiteSpace: 'pre-wrap' }}>{auditStrategy}</p>
              </div>
            )}

            {activeTab === 'audit' && auditResults.length > 0 && (
              <>
                {/* CHARTS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                  <div style={{ ...cardStyle, height: '300px', padding: '15px' }}>
                    <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', fontSize: '1rem', color: theme.text }}>Risk Distribution</h4>
                    <ResponsiveContainer width="100%" height="90%">
                      <PieChart>
                        <Pie data={getRiskDistribution()} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {getRiskDistribution().map((entry, index) => <Cell key={`cell-${index}`} fill={RISK_COLORS[index % RISK_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: theme.text}} />
                        <Legend wrapperStyle={{fontSize: '0.85rem', color: theme.text}} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div style={{ ...cardStyle, height: '300px', padding: '15px' }}>
                    <h4 style={{ margin: '0 0 10px 0', textAlign: 'center', fontSize: '1rem', color: theme.text }}>Top Flagged Jurisdictions</h4>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={getCountryDistribution()}>
                        <XAxis dataKey="country" tick={{fontSize: 12, fill: theme.text}} />
                        <YAxis tick={{fontSize: 12, fill: theme.text}} />
                        <Tooltip contentStyle={{backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: theme.text}} />
                        <Bar dataKey="count" fill={theme.secondary} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* DATA TABLE */}
                <div style={{...cardStyle, padding: '0', overflow: 'hidden'}}>
                  
                  <div style={{ padding: '15px 20px', backgroundColor: theme.tableHeader, borderBottom: `1px solid ${theme.tableBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <h3 style={{ margin: 0, color: theme.danger, fontSize: '1.2rem' }}>Flagged Transactions Ledger ({displayedResults.length})</h3>
                      
                      {/* SENIOR FILTER TAB */}
                      {user.role === 'senior' && (
                        <div style={{ display: 'flex', gap: '5px', backgroundColor: theme.cardBg, padding: '4px', borderRadius: '6px', border: `1px solid ${theme.cardBorder}` }}>
                          <button onClick={() => {setTableFilter('all'); setSelectedRows([]);}} style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: tableFilter === 'all' ? theme.primary : 'transparent', color: tableFilter === 'all' ? 'white' : theme.subText }}>All Items</button>
                          <button onClick={() => {setTableFilter('escalated'); setSelectedRows([]);}} style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: tableFilter === 'escalated' ? theme.warning : 'transparent', color: tableFilter === 'escalated' ? '#000' : theme.subText }}>Escalated Only</button>
                        </div>
                      )}
                    </div>
                    <button onClick={handleDownloadCSV} style={{ backgroundColor: theme.success, color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>📥 Export CSV</button>
                  </div>

                  {/* DYNAMIC BULK ACTIONS BAR */}
                  {(user.role === 'junior' || user.role === 'senior') && selectedRows.length > 0 && (
                    <div style={{ backgroundColor: theme.tableRowHover, padding: '12px 20px', borderBottom: `1px solid ${theme.tableBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <span style={{ fontWeight: 'bold', color: theme.primary, fontSize: '0.95rem' }}>{selectedRows.length} items selected</span>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button onClick={() => handleBulkAction('Rejected')} style={{ backgroundColor: theme.subText, color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>🗑️ Clear (False Positive)</button>
                        
                        {user.role === 'junior' ? (
                          <button onClick={() => handleBulkAction('Escalated')} style={{ backgroundColor: theme.warning, color: '#000', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>⚠️ Escalate to Senior</button>
                        ) : (
                          <button onClick={() => handleBulkAction('Approved')} style={{ backgroundColor: theme.success, color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>✅ Approve STR (File)</button>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
                    <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: theme.tableHeader, zIndex: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <tr>
                          {(user.role === 'junior' || user.role === 'senior') && (
                            <th style={{ padding: '15px', textAlign: 'center', width: '50px', borderBottom: `2px solid ${theme.tableBorder}` }}>
                              <input type="checkbox" onChange={handleSelectAllRows} checked={selectedRows.length > 0 && selectedRows.length === displayedResults.filter(r => user.role === 'senior' ? (r.review_status === 'Pending' || r.review_status === 'Escalated') : r.review_status === 'Pending').length} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                            </th>
                          )}
                          <th style={{ padding: '15px', textAlign: 'left', color: theme.subText, borderBottom: `2px solid ${theme.tableBorder}` }}>
                            Transaction Details
                            <InfoIcon text="Shows raw transaction metadata and rules violated. Look out for large amounts or high-risk routing destinations." />
                          </th>
                          <th style={{ padding: '15px', textAlign: 'left', color: theme.subText, borderBottom: `2px solid ${theme.tableBorder}` }}>
                            Entity Profile
                            <InfoIcon text="Customer KYC data. 'Dormant' accounts moving funds or 'PEP' (Politically Exposed Persons) require strict monitoring." />
                          </th>
                          <th style={{ padding: '15px', textAlign: 'left', color: theme.subText, borderBottom: `2px solid ${theme.tableBorder}` }}>
                            Risk Analytics
                            <InfoIcon text="SOP TO ESCALATE: Base Risk > 80 OR ML Prediction > 50%. Base Risk is drawn from compliance rules. ML is the AI's probability assessment." />
                          </th>
                          <th style={{ padding: '15px', textAlign: 'left', color: theme.subText, borderBottom: `2px solid ${theme.tableBorder}` }}>
                            Compliance Action
                            <InfoIcon text="Workflow state. Juniors handle 'Pending' triage. Seniors review 'Escalated' items to make the final STR filing decision." />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedResults.map((row, i) => {
                          const isCheckboxDisabled = user.role === 'junior' 
                            ? row.review_status !== 'Pending' 
                            : (row.review_status === 'Approved' || row.review_status === 'Rejected');

                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${theme.tableBorder}`, backgroundColor: selectedRows.includes(row.transaction_id) ? theme.tableRowHover : 'transparent', transition: '0.2s' }}>
                              
                              {(user.role === 'junior' || user.role === 'senior') && (
                                <td style={{ padding: '15px', textAlign: 'center' }}>
                                  <input type="checkbox" checked={selectedRows.includes(row.transaction_id)} onChange={() => handleSelectRow(row.transaction_id)} disabled={isCheckboxDisabled} style={{ cursor: isCheckboxDisabled ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }} />
                                </td>
                              )}
                              
                              <td style={{ padding: '15px' }}>
                                <div style={{ fontSize: '0.8rem', color: theme.subText, fontFamily: 'monospace' }}>ID: {row.transaction_id?.split('-')[0] || 'N/A'}...</div>
                                <div style={{ fontWeight: 'bold', color: theme.text, marginTop: '4px' }}>{row.transaction_date}</div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: theme.danger, marginTop: '4px' }}>MYR {row.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div style={{ fontSize: '0.8rem', color: theme.subText, marginTop: '4px' }}>Route: <span style={{fontWeight: 'bold', color: theme.text}}>{row.beneficiary_country}</span> {row.is_cross_border === 1 && <span style={{color:theme.secondary, fontWeight:'bold'}}>(Cross-Border)</span>}</div>
                                
                                {row.violation_reason && (
                                  <div style={{ marginTop: '8px' }}>
                                    <span style={{ display: 'inline-block', backgroundColor: theme.badgeBg, color: theme.secondary, padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', border: `1px solid ${theme.secondary}` }}>
                                      🚨 {row.violation_reason}
                                    </span>
                                  </div>
                                )}
                              </td>
                              
                              <td style={{ padding: '15px' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: theme.text }}>{row.customer_name}</div>
                                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ backgroundColor: theme.tableHeader, color: theme.text, padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', border: `1px solid ${theme.tableBorder}` }}>{row.industry}</span>
                                  {row.is_pep === 1 && <span style={{ backgroundColor: theme.danger, color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>PEP</span>}
                                  {row.account_status === 'Dormant' && <span style={{ backgroundColor: theme.warning, color: '#000', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Dormant</span>}
                                </div>
                              </td>

                              <td style={{ padding: '15px' }}>
                                <div style={{ marginBottom: '8px' }}>
                                  <span style={{ fontSize: '0.85rem', color: theme.subText }}>Base Risk: </span>
                                  <span style={{ fontWeight: 'bold', color: row.risk_score > 80 ? theme.danger : theme.warning, fontSize: '0.95rem' }}>{row.risk_score}/100</span>
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: theme.subText, marginBottom: '4px' }}>
                                    <span>ML Prediction</span>
                                    <span style={{fontWeight:'bold', color: theme.text}}>{row.ml_probability}%</span>
                                  </div>
                                  <div style={{ width: '120px', backgroundColor: theme.tableBorder, borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                                    <div style={{ width: `${row.ml_probability || 0}%`, backgroundColor: (row.ml_probability || 0) > 80 ? theme.danger : theme.warning, height: '100%' }}></div>
                                  </div>
                                </div>
                              </td>

                              <td style={{ padding: '15px' }}>
                                {row.review_status === 'Approved' ? ( <span style={{ color: theme.success, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>✅ STR Filed</span>
                                ) : row.review_status === 'Rejected' ? ( <span style={{ color: theme.subText, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>🗑️ Cleared</span>
                                ) : row.review_status === 'Escalated' ? (
                                    user.role === 'senior' ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          <button onClick={() => handleReview(row.transaction_id, 'Approved')} style={{ backgroundColor: theme.success, color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Approve STR</button>
                                          <button onClick={() => handleReview(row.transaction_id, 'Rejected')} style={{ backgroundColor: theme.danger, color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Reject</button>
                                      </div>
                                    ) : ( <span style={{ color: theme.warning, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>⚠️ Escalated</span> )
                                ) : ( <span style={{ color: theme.warning, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>⏳ Pending Triage</span> )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* VIEW 2: SENIOR REPORT VIEW */}
            {activeTab === 'report' && (
               <div style={{ ...cardStyle, height: '100%', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
                 <h3 style={{ margin: '0 0 10px 0', color: theme.secondary, fontSize: '1.4rem' }}>📑 Automated Suspicious Transaction Report (NLG)</h3>
                 <p style={{ color: theme.subText, fontSize: '1rem', marginBottom: '20px' }}>
                   Generate a formal regulatory report utilizing Natural Language Generation based on currently Escalated and Approved transactions.
                 </p>
                 
                 <button onClick={handleGenerateReport} disabled={isGeneratingReport} style={{ width: '100%', padding: '15px', backgroundColor: theme.secondary, color: 'white', border: 'none', borderRadius: '6px', cursor: isGeneratingReport ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '20px', transition: '0.2s' }}>
                   {isGeneratingReport ? "⏳ AI is Drafting Report..." : "✍️ Generate AI Report Summary"}
                 </button>

                 <textarea value={generatedReport} onChange={(e) => setGeneratedReport(e.target.value)} placeholder="The AI-generated report will appear here. You can manually edit the content before downloading..." style={{ flex: 1, width: '100%', minHeight: '400px', padding: '20px', borderRadius: '6px', border: `1px solid ${theme.inputBorder}`, boxSizing: 'border-box', backgroundColor: theme.inputBg, color: theme.text, fontFamily: 'Arial, sans-serif', fontSize: '1rem', lineHeight: '1.6', resize: 'vertical' }} />

                 {generatedReport && !isGeneratingReport && (
                   <button onClick={handleDownloadReport} style={{ marginTop: '20px', width: '100%', padding: '15px', backgroundColor: theme.success, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', transition: '0.2s' }}>
                     📥 Download Final STR (.txt)
                   </button>
                 )}
               </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

export default App
