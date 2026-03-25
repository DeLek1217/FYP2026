import sqlite3
import pandas as pd
import random
from faker import Faker
from datetime import datetime, timedelta

fake = Faker()

def generate_enterprise_db(num_cust=800, num_acc=1200, num_txn=5000):
    print("Architecting Enterprise 3-Tier Banking Database...")
    
    # --- 1. CUSTOMERS TABLE (KYC Data) ---
    customers = []
    industries = ['Technology', 'Real Estate', 'Retail', 'Unemployed', 'Student', 'Politics', 'Import/Export']
    nationalities = ['MY', 'SG', 'US', 'GB', 'CN', 'KP', 'IR', 'RU', 'AE']
    
    for _ in range(num_cust):
        customers.append({
            "customer_id": fake.unique.random_int(min=100000, max=999999),
            "full_name": fake.name(),
            "dob": fake.date_of_birth(minimum_age=18, maximum_age=80).strftime("%Y-%m-%d"),
            "nationality": random.choice(nationalities),
            "industry": random.choice(industries),
            "annual_income_myr": round(random.uniform(12000, 500000), 2),
            "is_pep": 1 if random.random() < 0.05 else 0, # 5% are Politically Exposed
            "kyc_risk_rating": random.choice(['Low', 'Medium', 'High'])
        })
    df_customers = pd.DataFrame(customers)

    # --- 2. ACCOUNTS TABLE ---
    accounts = []
    acc_types = ['Personal Savings', 'Current Account', 'Corporate Checking', 'Crypto Wallet']
    
    for _ in range(num_acc):
        cust = random.choice(customers)
        status = random.choices(['Active', 'Dormant', 'Frozen'], weights=[0.8, 0.15, 0.05])[0]
        
        accounts.append({
            "account_id": fake.unique.random_int(min=10000000, max=99999999),
            "customer_id": cust['customer_id'],
            "account_type": random.choice(acc_types),
            "date_opened": fake.date_between(start_date='-10y', end_date='-1m').strftime("%Y-%m-%d"),
            "current_balance_myr": round(random.uniform(0, 1000000), 2),
            "account_status": status
        })
    df_accounts = pd.DataFrame(accounts)

    # --- 3. TRANSACTIONS TABLE ---
    transactions = []
    
    # Added DEPOSIT and WITHDRAWAL to match PDF rules
    txn_types = ['WIRE_TRANSFER', 'CASH_DEPOSIT', 'P2P_TRANSFER', 'SWIFT_CROSS_BORDER', 'DEPOSIT', 'WITHDRAWAL']
    fund_sources = ['Salary', 'Business Revenue', 'Investment', 'Unknown', 'Gift']
    
    for _ in range(num_txn):
        acc = random.choice(accounts)
        # Find matching customer to build realistic risk scenarios
        cust = next(c for c in customers if c['customer_id'] == acc['customer_id'])
        
        amount = round(random.uniform(50.0, 250000.0), 2)
        is_cross_border = 1 if random.random() < 0.2 else 0
        dest_country = random.choice(nationalities) if is_cross_border else 'MY'
        t_type = random.choice(txn_types) if not is_cross_border else 'SWIFT_CROSS_BORDER'
        
        # Inject realistic Source of Funds
        source = random.choice(fund_sources)
        # Deliberately inject 'Unknown' source for some WITHDRAWALs to test PDF Rule 4.0
        if t_type == 'WITHDRAWAL' and random.random() < 0.15:
            source = 'Unknown'
            
        # --- Advanced ML Anomaly Injection ---
        risk_score = 10
        # Scenario A: High-risk jurisdiction
        if dest_country in ['KP', 'IR', 'RU']: risk_score += 40
        # Scenario B: Dormant account suddenly active with high amount
        if acc['account_status'] == 'Dormant' and amount > 20000: risk_score += 45
        # Scenario C: Student/Unemployed dealing with massive cross-border funds
        if cust['industry'] in ['Student', 'Unemployed'] and amount > 50000: risk_score += 50
        # Scenario D: PEP making large transfers
        if cust['is_pep'] == 1 and amount > 100000: risk_score += 35
        # Scenario E: High Value Deposit (Matches Rule 2.0)
        if t_type == 'DEPOSIT' and amount > 50000: risk_score += 30
        # Scenario F: Unknown Source Withdrawal (Matches Rule 4.0)
        if t_type == 'WITHDRAWAL' and source == 'Unknown' and amount > 20000: risk_score += 40
        
        transactions.append({
            "transaction_id": fake.uuid4(),
            "account_id": acc['account_id'],
            "timestamp": fake.date_time_between(start_date='-90d', end_date='now').strftime("%Y-%m-%d %H:%M:%S"),
            "transaction_type": t_type,
            "amount_myr": amount,
            "beneficiary_country": dest_country,
            "is_cross_border": is_cross_border,
            "source_of_funds": source, 
            "calculated_risk_score": min(risk_score, 100)
        })
    df_transactions = pd.DataFrame(transactions)

    # --- Save to SQLite ---
    conn = sqlite3.connect("banking_data.sqlite")
    df_customers.to_sql("customers", conn, if_exists="replace", index=False)
    df_accounts.to_sql("accounts", conn, if_exists="replace", index=False)
    df_transactions.to_sql("transactions", conn, if_exists="replace", index=False)
    conn.close()
    
    print("\n✅ Database Successfully Architected: 'banking_data.sqlite'")
    print(f"📊 Customers: {len(df_customers)} | Accounts: {len(df_accounts)} | Transactions: {len(df_transactions)}")
    print("🔥 The environment is now ready for Agentic JOIN queries (Includes 'source_of_funds').")

if __name__ == "__main__":
    generate_enterprise_db()
