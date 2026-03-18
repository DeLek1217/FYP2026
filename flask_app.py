from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import pandas as pd
import joblib  # 👈 MLOps 必须的库
from reader_agent import ReaderAgent
from auditor_agent import AuditorAgent

app = Flask(__name__)
CORS(app)

# --- NEW: Database Auto-Upgrader for HITL ---
def upgrade_db_for_hitl():
    print("Checking database schema for HITL columns...")
    conn = sqlite3.connect("banking_data.sqlite")
    cursor = conn.cursor()
    try:
        # Add new columns if they don't exist yet
        cursor.execute("ALTER TABLE transactions ADD COLUMN review_status TEXT DEFAULT 'Pending'")
        cursor.execute("ALTER TABLE transactions ADD COLUMN reviewer_notes TEXT")
        print("✅ HITL columns added to database.")
    except Exception as e:
        # If it throws an error, the columns already exist, which is fine!
        pass 
    conn.commit()
    conn.close()

upgrade_db_for_hitl()

# --- NEW: Authentication Endpoint ---
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # Hardcoded credentials for FYP demonstration
    if username == 'analyst' and password == '123':
        return jsonify({"role": "analyst", "name": "L1 Compliance Analyst"})
    elif username == 'manager' and password == '123':
        return jsonify({"role": "manager", "name": "L2 Review Manager"})
    
    return jsonify({"error": "Invalid credentials"}), 401

# --- NEW: HITL Decision Endpoint ---
@app.route('/review_transaction', methods=['POST'])
def review_transaction():
    data = request.json
    txn_id = data.get('transaction_id')
    status = data.get('status') # 'Approved' or 'Rejected'
    
    if not txn_id or not status:
        return jsonify({"error": "Missing data"}), 400

    try:
        conn = sqlite3.connect("banking_data.sqlite")
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE transactions SET review_status = ? WHERE transaction_id = ?", 
            (status, txn_id)
        )
        conn.commit()
        conn.close()
        return jsonify({"message": f"Transaction {txn_id} marked as {status}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- NEW: Bulk Action Endpoint for Analyst Triage ---
@app.route('/bulk_review', methods=['POST'])
def bulk_review():
    data = request.json
    txn_ids = data.get('transaction_ids', [])
    status = data.get('status') # 'Escalated' or 'Rejected'
    username = data.get('username')

    if not txn_ids or not status:
        return jsonify({"error": "Missing data"}), 400

    try:
        conn = sqlite3.connect("banking_data.sqlite")
        cursor = conn.cursor()
        
        # Create a dynamic query based on how many checkboxes were selected
        placeholders = ','.join(['?'] * len(txn_ids))
        audit_note = f"Action by {username}"
        
        # Update all selected rows in one single database query
        cursor.execute(
            f"UPDATE transactions SET review_status = ?, reviewer_notes = ? WHERE transaction_id IN ({placeholders})", 
            [status, audit_note] + txn_ids
        )
        conn.commit()
        conn.close()
        return jsonify({"message": f"{len(txn_ids)} transactions updated to {status}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
        

# 1. 初始化 Agents
reader_agent = ReaderAgent()
auditor_agent = AuditorAgent()

# 2. 部署 Machine Learning 模型 (MLOps)
print("Loading ML Models into API...")
try:
    ml_model = joblib.load('aml_rf_model.pkl')
    le_industry = joblib.load('le_industry.pkl')
    le_status = joblib.load('le_status.pkl')
    print("✅ ML Risk Predictor Online")
except Exception as e:
    print(f"⚠️ 无法加载 ML 模型，请确认是否运行过 train_model.py. Error: {e}")
    ml_model = None

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
    mode = data.get("mode", "audit")
    
    if not rule:
        return jsonify({"error": "No rule text provided"}), 400

    try:
        agent_result = auditor_agent.run_agentic_workflow(rule, mode=mode)
        
        if "error" in agent_result:
            return jsonify({"error": agent_result["error"]}), 500

        if mode == "advisory":
            return jsonify({
                "status": "success",
                "mode": "advisory",
                "strategy": agent_result["strategy"],
                "thoughts": agent_result["thoughts"]
            })

        sql_code = agent_result["sql_code"]
        
        conn = sqlite3.connect("banking_data.sqlite")
        results_df = pd.read_sql_query(sql_code, conn)
        conn.close()
        
        records = results_df.to_dict(orient="records")

        # --- 🚀 MLOPS 核心：模型预测 ---
        if ml_model is not None and len(records) > 0:
            agent_result["thoughts"].append({"type": "action", "text": f"Running ML Predictive Model on {len(records)} transactions..."})
            for row in records:
                try:
                    # 转换 categorical 数据
                    ind_enc = le_industry.transform([row.get('industry', 'Unknown')])[0] if row.get('industry') in le_industry.classes_ else 0
                    stat_enc = le_status.transform([row.get('account_status', 'Active')])[0] if row.get('account_status') in le_status.classes_ else 0
                    
                    # 组装 Feature Array (必须和 train_model.py 的顺序一模一样)
                    # ['is_pep', 'annual_income_myr', 'amount_myr', 'is_cross_border', 'industry_encoded', 'status_encoded']
                    features = [[
                        row.get('is_pep', 0),
                        row.get('annual_income_myr', 50000),
                        row.get('amount', 0),
                        row.get('is_cross_border', 0),
                        ind_enc,
                        stat_enc
                    ]]
                    
                    # 算出 洗钱概率 (Probability)
                    prob = ml_model.predict_proba(features)[0][1] 
                    row['ml_probability'] = round(prob * 100, 2)  # 转成 %
                    
                except Exception as e:
                    row['ml_probability'] = 0.0 # 预测失败的 fallback
                    print(f"ML Prediction Error on row: {e}")

        return jsonify({
            "status": "success",
            "mode": "audit",
            "strategy": agent_result["strategy"],
            "thoughts": agent_result["thoughts"], 
            "generated_sql": sql_code,
            "total_violations_detected": len(records),
            "violation_data": records 
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
