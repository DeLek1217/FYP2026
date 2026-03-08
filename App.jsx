import { useState } from 'react'

function App() {
  // Module 1 States
  const [file, setFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState("")
  const [query, setQuery] = useState("What is the threshold amount for high-risk transactions?")
  const [extractedRule, setExtractedRule] = useState("")
  const [isExtracting, setIsExtracting] = useState(false)

  // Module 2 States
  const [auditResult, setAuditResult] = useState(null)
  const [isAuditing, setIsAuditing] = useState(false)

  // --- MODULE 1 ACTIONS ---
  const handleFileUpload = async () => {
    if (!file) {
      alert("Please select a PDF file first.");
      return;
    }
    setUploadStatus("Uploading and indexing PDF...");
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:5000/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.status === "success") {
        setUploadStatus(`✅ Success: ${data.message}`);
      } else {
        setUploadStatus(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setUploadStatus("❌ Failed to connect to server.");
    }
  }

  const handleExtractRule = async () => {
    setIsExtracting(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setExtractedRule(data.extracted_rule);
      } else {
        alert("Extraction failed: " + data.error);
      }
    } catch (err) {
      alert("Failed to connect to server.");
    }
    setIsExtracting(false);
  }

  // --- MODULE 2 ACTIONS ---
  const handleRunAudit = async () => {
    if (!extractedRule) {
      alert("Please extract a rule first or type one in manually.");
      return;
    }
    setIsAuditing(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_text: extractedRule }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setAuditResult(data);
      } else {
        alert("Audit failed: " + data.error);
      }
    } catch (err) {
      alert("Failed to connect to server.");
    }
    setIsAuditing(false);
  }

  return (
    <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#2c3e50' }}>🤖 ReguBot: Compliance Auditor</h1>

      {/* MODULE 1: PDF INGESTION */}
      <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #dee2e6' }}>
        <h2 style={{ marginTop: 0 }}>📂 Module 1: Policy Reader</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />
          <button onClick={handleFileUpload} style={btnStyle}>Upload PDF</button>
          <p style={{ fontSize: '14px', color: 'gray' }}>{uploadStatus}</p>
        </div>

        <div style={{ marginTop: '20px' }}>
          <label style={{ fontWeight: 'bold' }}>Ask the AI to find a rule:</label>
          <input 
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            style={{ width: '100%', padding: '10px', marginTop: '5px', marginBottom: '10px', boxSizing: 'border-box' }}
          />
          <button onClick={handleExtractRule} disabled={isExtracting} style={btnStyle}>
            {isExtracting ? "Extracting..." : "Extract Rule"}
          </button>
        </div>
      </div>

      {/* MODULE 2: AUDIT ENGINE */}
      <div style={{ background: '#eef2f5', padding: '20px', borderRadius: '8px', border: '1px solid #cdd5df' }}>
        <h2 style={{ marginTop: 0 }}>⚡ Module 2: Database Audit</h2>
        
        <label style={{ fontWeight: 'bold' }}>Regulatory Rule to Audit (Editable):</label>
        <textarea 
          value={extractedRule} 
          onChange={(e) => setExtractedRule(e.target.value)} 
          rows="3"
          placeholder="Upload a PDF and extract a rule, or type your own rule here..."
          style={{ width: '100%', padding: '10px', marginTop: '5px', marginBottom: '15px', boxSizing: 'border-box' }}
        />
        
        <button onClick={handleRunAudit} disabled={isAuditing} style={{...btnStyle, background: '#e74c3c'}}>
          {isAuditing ? "Generating SQL & Auditing..." : "Run AI Audit"}
        </button>

        {/* RESULTS DISPLAY */}
        {auditResult && (
          <div style={{ marginTop: '30px' }}>
            <h3 style={{ color: '#27ae60' }}>✅ Generated SQL:</h3>
            <pre style={{ background: '#2c3e50', color: '#ecf0f1', padding: '15px', borderRadius: '5px', overflowX: 'auto' }}>
              {auditResult.generated_sql}
            </pre>
            
            <h3 style={{ color: '#c0392b' }}>🚨 Violations Found: {auditResult.total_violations_detected}</h3>
            
            {auditResult.violation_data && auditResult.violation_data.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', background: '#fff' }}>
                  <thead>
                    <tr style={{ background: '#bdc3c7', textAlign: 'left' }}>
                      <th style={thTdStyle}>Txn ID</th>
                      <th style={thTdStyle}>Type</th>
                      <th style={thTdStyle}>Amount</th>
                      <th style={thTdStyle}>Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditResult.violation_data.map((row, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={thTdStyle}>{row.transaction_id.substring(0,8)}...</td>
                        <td style={thTdStyle}>{row.transaction_type}</td>
                        <td style={thTdStyle}>{row.amount}</td>
                        <td style={thTdStyle}>{row.beneficiary_country}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Simple styles for the UI components
const btnStyle = { padding: '10px 15px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const thTdStyle = { padding: '12px', border: '1px solid #ddd' };

export default App