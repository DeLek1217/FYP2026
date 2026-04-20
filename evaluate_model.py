import os
import sqlite3
import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix, roc_curve, auc
import shap

def run_model_evaluation():
    print("🚀 Initializing Model Evaluation & XAI Pipeline...")
    
    # 1. Create directory for saving charts
    output_dir = "evaluation_results"
    os.makedirs(output_dir, exist_ok=True)

    # 2. Load Models and Encoders
    try:
        model = joblib.load('aml_rf_model.pkl')
        le_industry = joblib.load('le_industry.pkl')
        le_status = joblib.load('le_status.pkl')
        print("✅ Models and Encoders loaded successfully.")
    except Exception as e:
        print(f"❌ Error loading models: {e}")
        return

    # 3. Fetch Data from SQLite
    print("📊 Fetching transaction data from SQLite...")
    conn = sqlite3.connect("banking_data.sqlite")
    query = """
        SELECT 
            t.transaction_id, c.industry, a.account_status, c.is_pep, 
            c.annual_income_myr, t.amount_myr, t.is_cross_border, 
            t.calculated_risk_score
        FROM transactions t
        JOIN accounts a ON t.account_id = a.account_id
        JOIN customers c ON a.customer_id = c.customer_id
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    # 4. Data Preprocessing (Matching the training pipeline exactly)
    print("⚙️ Preprocessing features...")
    
    # Handle unseen labels safely
    known_industries = set(le_industry.classes_)
    df['industry_encoded'] = df['industry'].apply(lambda x: le_industry.transform([x])[0] if x in known_industries else 0)
    
    known_statuses = set(le_status.classes_)
    df['status_encoded'] = df['account_status'].apply(lambda x: le_status.transform([x])[0] if x in known_statuses else 0)

    # Define Features (X) - MUST match the exact names from train_model.py!
    feature_cols = ['is_pep', 'annual_income_myr', 'amount_myr', 'is_cross_border', 'industry_encoded', 'status_encoded']
    X = df[feature_cols]

    # Define Ground Truth (y_true) for evaluation
    y_true = (df['calculated_risk_score'] > 75).astype(int)

    # 5. Generate Predictions
    print("🧠 Generating Predictions...")
    y_pred_prob = model.predict_proba(X)[:, 1]
    y_pred = (y_pred_prob > 0.5).astype(int)

    # ==========================================
    # SECTION 1: STATISTICAL METRICS
    # ==========================================
    print("\n" + "="*50)
    print("📈 CLASSIFICATION REPORT")
    print("="*50)
    print(classification_report(y_true, y_pred, target_names=["Normal (0)", "Suspicious (1)"]))

    # ==========================================
    # SECTION 2: VISUALIZATIONS (CONFUSION MATRIX & ROC)
    # ==========================================
    print("\n🎨 Generating Evaluation Charts...")
    
    # 2A. Confusion Matrix
    plt.figure(figsize=(8, 6))
    cm = confusion_matrix(y_true, y_pred)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Purples', xticklabels=["Normal", "Suspicious"], yticklabels=["Normal", "Suspicious"])
    plt.title('AML Detection Confusion Matrix')
    plt.ylabel('Actual (Ground Truth)')
    plt.xlabel('AI Predicted')
    plt.tight_layout()
    plt.savefig(f"{output_dir}/1_confusion_matrix.png", dpi=300)
    plt.close()

    # 2B. ROC Curve
    fpr, tpr, _ = roc_curve(y_true, y_pred_prob)
    roc_auc = auc(fpr, tpr)
    plt.figure(figsize=(8, 6))
    plt.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (AUC = {roc_auc:.3f})')
    plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate (Recall)')
    plt.title('Receiver Operating Characteristic (ROC)')
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(f"{output_dir}/2_roc_curve.png", dpi=300)
    plt.close()

    # ==========================================
    # SECTION 3: EXPLAINABLE AI (SHAP)
    # ==========================================
    print("🔍 Generating SHAP Explanations (This may take a moment)...")
    
    # Use TreeExplainer for Random Forest
    explainer = shap.TreeExplainer(model)
    
    # For performance on large datasets, we calculate SHAP values for a sample
    X_sample = X.sample(min(1000, len(X)), random_state=42)
    shap_values = explainer.shap_values(X_sample)
    
    # Extract SHAP values for the positive class (Suspicious)
    shap_values_pos = shap_values[:, :, 1] if len(shap_values.shape) == 3 else shap_values[1] if isinstance(shap_values, list) else shap_values

    # Prettier names for the charts ONLY (Do not rename the actual dataframe columns)
    display_feature_names = ['Is PEP', 'Annual Income (MYR)', 'Txn Amount (MYR)', 'Cross-Border', 'Industry', 'Account Status']

    # 3A. Global Interpretability (Summary Plot)
    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values_pos, X_sample, feature_names=display_feature_names, show=False)
    plt.title('SHAP Global Feature Importance', pad=20)
    plt.tight_layout()
    plt.savefig(f"{output_dir}/3_shap_summary.png", dpi=300, bbox_inches='tight')
    plt.close()

# 3B. Local Interpretability (Waterfall Plot for ONE specific transaction)
    # Find a highly suspicious transaction to explain
    suspicious_idx = np.argmax(model.predict_proba(X_sample)[:, 1])
    
    # SAFELY EXTRACT THE BASE VALUE AS A SCALAR FLOAT
    expected_val = explainer.expected_value
    if isinstance(expected_val, (list, np.ndarray)):
        base_val = float(expected_val[1]) # Get the base value for Class 1 (Suspicious)
    else:
        base_val = float(expected_val)
    
    plt.figure(figsize=(10, 6))
    explanation = shap.Explanation(values=shap_values_pos[suspicious_idx], 
                                   base_values=base_val, 
                                   data=X_sample.iloc[suspicious_idx], 
                                   feature_names=display_feature_names)
    shap.waterfall_plot(explanation, show=False)
    plt.title(f'SHAP Local Explanation (Transaction #{X_sample.index[suspicious_idx]})', pad=20)
    plt.tight_layout()
    plt.savefig(f"{output_dir}/4_shap_waterfall_local.png", dpi=300, bbox_inches='tight')
    plt.close()

    print(f"🎉 Success! All evaluation charts saved in the '{output_dir}' folder.")
    print("👉 Use these charts in your Thesis and Presentation Slides!")

if __name__ == "__main__":
    run_model_evaluation()