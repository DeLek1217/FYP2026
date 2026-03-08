import os
import tempfile
import sqlite3
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Import your AI Agents
from auditor_agent import AuditorAgent
from reader_agent import ReaderAgent

app = Flask(__name__)
# Enable CORS to allow React (running on a different port) to communicate safely
CORS(app)

# Initialize the AI Agents globally for the server
auditor_agent = AuditorAgent(db_path="banking_data.sqlite")
reader_agent = ReaderAgent()

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "success", "message": "ReguBot Flask API is running!"})

# ==========================================
# MODULE 1: READER AGENT (Upload & Extract)
# ==========================================
@app.route('/upload', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        # Save the uploaded PDF to a temporary file so PyPDFLoader can read it
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            file.save(tmp_file.name)
            tmp_path = tmp_file.name
        
        # Ingest into the vector database
        success, msg = reader_agent.ingest_pdf(tmp_path)
        
        # Clean up the temp file
        os.remove(tmp_path)
        
        if success:
            return jsonify({"status": "success", "message": msg})
        else:
            return jsonify({"error": msg}), 500

@app.route('/extract', methods=['POST'])
def extract_rule():
    data = request.get_json()
    query = data.get("query", "")
    
    if not query:
        return jsonify({"error": "No query provided"}), 400
        
    extracted_text = reader_agent.extract_rule_parameters(query)
    
    if "Error" in extracted_text or "Failed" in extracted_text:
        return jsonify({"error": extracted_text}), 500
        
    return jsonify({"status": "success", "extracted_rule": extracted_text})

# ==========================================
# MODULE 2: AUDITOR AGENT (SQL Execution)
# ==========================================
@app.route('/audit', methods=['POST'])
def run_audit():
    data = request.get_json()
    rule = data.get("rule_text", "")
    
    if not rule:
        return jsonify({"error": "No rule text provided"}), 400

    try:
        # Generate SQL using Gemini
        sql_code = auditor_agent.generate_audit_query(rule)
        
        if sql_code.startswith("Error"):
            return jsonify({"error": sql_code}), 500

        # Execute SQL against your synthetic database
        conn = sqlite3.connect("banking_data.sqlite")
        results_df = pd.read_sql_query(sql_code, conn)
        conn.close()
        
        # Convert Pandas dataframe to JSON
        records = results_df.to_dict(orient="records")

        return jsonify({
            "status": "success",
            "regulatory_rule": rule,
            "generated_sql": sql_code,
            "total_violations_detected": len(records),
            "violation_data": records 
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False, port=5000)