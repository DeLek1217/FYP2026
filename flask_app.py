import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import pandas as pd
import joblib
from reader_agent import ReaderAgent
from auditor_agent import AuditorAgent

app = Flask(__name__)
CORS(app)

# --- 1. INITIALIZE AGENTS ---
reader_agent = ReaderAgent()
auditor_agent = AuditorAgent()

# --- 2. LOAD MLOPS MODELS ---
print("Loading ML Models into API...")
try:
    ml_model = joblib.load('aml_rf_model.pkl')
    le_industry = joblib.load('le_industry.pkl')
    le_status = joblib.load('le_status.pkl')
    print("✅ ML Risk Predictor Online")
except Exception as e:
    print(f"⚠️ Failed to load ML models. Ensure train_model.py was executed. Error: {e}")
    ml_model = None

# --- 3. MOCK DATABASE FOR AUTHENTICATION ---
# Updated to match the Junior/Senior L1/L2 workflow
MOCK_USERS = {
    "junior": {"name": "Alice (Junior Analyst)", "role": "junior", "password": "123"},
    "senior": {"name": "Bob (Senior Manager)", "role": "senior", "password": "123"}
}

# ==========================================
# AUTHENTICATION & HITL ROUTES
# ==========================================

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get("username", "").lower()
    password = data.get("password", "")
    
    user = MOCK_USERS.get(username)
    if user and user["password"] == password:
        # Never send the password back to the client
        return jsonify({"name": user["name"], "role": user["role"]})
    
    return jsonify({"error": "Invalid username or password"}), 401

@app.route('/review_transaction', methods=['POST'])
def review_transaction():
    """Mock endpoint to handle single transaction reviews by Seniors."""
    data = request.get_json()
    # In a production environment, you would run an UPDATE SQL query here
    return jsonify({"status": "success", "message": "Transaction review saved."})

@app.route('/bulk_review', methods=['POST'])
def bulk_review():
    """Mock endpoint to handle bulk actions by Juniors and Seniors."""
    data = request.get_json()
    return jsonify({"status": "success", "message": f"Processed {len(data.get('transaction_ids', []))} transactions."})

# ==========================================
# AGENTIC WORKFLOW & DATA PIPELINE ROUTES
# ==========================================

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    file_path = f"temp_{file.filename}"
    file.save(file_path)
    
    success, msg = reader_agent.ingest_pdf(file_path)
    if success:
        return jsonify({"message": msg})
    return jsonify({"error": msg}), 500

@app.route('/discover_rules', methods=['GET'])
def discover_rules():
    result = reader_agent.auto_discover_rules()
    if "error" in result:
        return jsonify({"error": result["error"]}), 500
    return jsonify(result)

@app.route('/extract', methods=['POST'])
def extract_rule():
    data = request.get_json()
    query = data.get("query", "")
    if not query:
        return jsonify({"error": "No query provided"}), 400
    extracted_text = reader_agent.extract_rule_parameters(query)
    if extracted_text.startswith("Error") or "Failed" in extracted_text:
        return jsonify({"error": extracted_text}), 500
    return jsonify({"extracted_rule": extracted_text})

@app.route('/audit', methods=['POST'])
def run_audit():
    data = request.get_json()
    rule = data.get("rule_text", "")
    
    if not rule:
        return jsonify({"error": "No rule text provided"}), 400

    try:
        # 1. Run the Agent (It decides autonomously if SQL is needed)
        agent_result = auditor_agent.run_agentic_workflow(rule)
        
        if "error" in agent_result:
            return jsonify({"error": agent_result["error"]}), 500

        sql_code = agent_result.get("sql_code", "")
        records = []

        # 2. Only execute DB and ML if SQL was generated
        if sql_code:
            conn = sqlite3.connect("banking_data.sqlite")
            results_df = pd.read_sql_query(sql_code, conn)
            conn.close()
            
            records = results_df.to_dict(orient="records")

            # 3. MLOps: Predict probabilities
            if ml_model is not None and len(records) > 0:
                agent_result["thoughts"].append({"type": "action", "text": f"Running ML Pipeline on {len(records)} records..."})
                for row in records:
                    try:
                        ind_enc = le_industry.transform([row.get('industry', 'Unknown')])[0] if row.get('industry') in le_industry.classes_ else 0
                        stat_enc = le_status.transform([row.get('account_status', 'Active')])[0] if row.get('account_status') in le_status.classes_ else 0
                        
                        features = [[
                            row.get('is_pep', 0),
                            row.get('annual_income_myr', 50000),
                            row.get('amount', 0),
                            row.get('is_cross_border', 0),
                            ind_enc,
                            stat_enc
                        ]]
                        
                        prob = ml_model.predict_proba(features)[0][1] 
                        row['ml_probability'] = round(prob * 100, 2)
                    except Exception as e:
                        row['ml_probability'] = 0.0 
                        
        return jsonify({
            "status": "success",
            "strategy": agent_result["strategy"],
            "thoughts": agent_result["thoughts"], 
            "generated_sql": sql_code,
            "total_violations_detected": len(records),
            "violation_data": records 
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==========================================
# NLG (NATURAL LANGUAGE GENERATION) ROUTE
# ==========================================

@app.route('/generate_report', methods=['POST'])
def generate_report():
    data = request.get_json()
    transactions = data.get("transactions", [])
    
    if not transactions:
        return jsonify({"error": "No transactions provided for reporting."}), 400

    # Filter transactions that require regulatory reporting
    critical_txns = [t for t in transactions if t.get('review_status') in ['Escalated', 'Approved']]
    
    if not critical_txns:
        return jsonify({"report": "No escalated or approved transactions require reporting at this time. All items are either pending triage or cleared as false positives."})

    # Prompt the LLM to generate a formal executive summary
    prompt = f"""
    You are a Chief Compliance Officer at a major FinTech institution.
    Write a formal Suspicious Transaction Report (STR) Executive Summary based on the following flagged transactions:
    
    {critical_txns}

    Format Requirement:
    1. Title: STR EXECUTIVE SUMMARY
    2. Overview: Total number of critical transactions and summary of rules broken.
    3. Key Risk Indicators: Mention any ML Probability scores > 80%, Cross-Border routing, or PEP involvement.
    4. Analyst & Manager Action: State that these items have been escalated and approved for regulatory submission.
    5. Conclusion/Next Steps.
    
    Keep the tone strictly professional, legal, and objective. Do not use markdown formatting like ** or ##, use standard plain text formatting suitable for a .txt file.
    """
    
    try:
        response = auditor_agent.llm.invoke(prompt).content
        return jsonify({"report": response.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
