import sqlite3
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import joblib

def train_aml_model():
    print("🚀 启动 MLOps Pipeline: 训练 AML 风险预测模型...")

    # 1. 提取数据 (Data Ingestion)
    conn = sqlite3.connect("banking_data.sqlite")
    # 把之前的三张表 JOIN 起来，作为我们训练的数据集
    query = """
    SELECT 
        c.industry, c.is_pep, c.annual_income_myr, 
        a.account_status, 
        t.amount_myr, t.is_cross_border, t.calculated_risk_score
    FROM transactions t
    JOIN accounts a ON t.account_id = a.account_id
    JOIN customers c ON a.customer_id = c.customer_id
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    # 2. 数据预处理与特征工程 (Feature Engineering)
    # 假设如果原本的 calculated_risk_score > 75，我们就把它标记为 "Suspicious" (1)，否则为 "Normal" (0)
    # 我们要让模型学会预测这个 Target！
    df['Target'] = (df['calculated_risk_score'] > 75).astype(int)

    # 把文字 (Categorical) 变成数字，ML 模型才看得懂
    le_industry = LabelEncoder()
    df['industry_encoded'] = le_industry.fit_transform(df['industry'])
    
    le_status = LabelEncoder()
    df['status_encoded'] = le_status.fit_transform(df['account_status'])

    # 选定 Features (X) 和 Target (y)
    X = df[['is_pep', 'annual_income_myr', 'amount_myr', 'is_cross_border', 'industry_encoded', 'status_encoded']]
    y = df['Target']

    # 3. 切分训练集和测试集
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 4. model.fit (核心！训练随机森林模型)
    print("🧠 正在执行 model.fit()...")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # 5. model.predict (测试模型准确度)
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"✅ 模型训练完成！准确率 (Accuracy): {acc * 100:.2f}%")
    print("\n📊 详细分类报告:\n", classification_report(y_test, y_pred))

    # 6. MLOps: 保存模型和 Encoders，以便 Flask Backend 使用
    print("📦 正在把模型打包成 .pkl 文件 (Model Registry)...")
    joblib.dump(model, 'aml_rf_model.pkl')
    joblib.dump(le_industry, 'le_industry.pkl')
    joblib.dump(le_status, 'le_status.pkl')
    print("🎉 MLOps Pipeline 成功完成！模型已部署就绪。")

if __name__ == "__main__":
    train_aml_model()
