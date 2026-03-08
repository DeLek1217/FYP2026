import sqlite3
import pandas as pd
import random
from faker import Faker

fake = Faker()

def calculate_risk_score(amount, country, source_of_funds):
    """
    A deterministic AML risk scoring engine based on FATF guidelines.
    """
    score = 10  # Base risk score for any transaction
    
    # 1. Jurisdictional Risk (Sanctioned or High-Risk Countries)
    if country in ['KP', 'IR']:  # North Korea, Iran
        score += 65
    elif country in ['CN', 'ID']: # Medium-High volume corridors
        score += 15
        
    # 2. Transaction Value Risk
    if amount >= 50000:
        score += 35
    elif amount >= 25000:
        score += 15
        
    # 3. Source of Funds Risk
    if source_of_funds == 'Unknown':
        score += 40
    elif source_of_funds == 'Investment':
        score += 10
        
    # Cap the maximum score at 100
    return min(score, 100)

def generate_synthetic_data(num_records=2000):
    print(f"Generating {num_records} synthetic banking records with realistic risk profiles...")
    data = []
    
    transaction_types = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT']
    countries = ['MY', 'SG', 'US', 'GB', 'CN', 'ID', 'KP', 'IR']
    
    for _ in range(num_records):
        txn_type = random.choice(transaction_types)
        country = random.choice(countries)
        
        # Create some "high value" transactions for testing thresholds
        if random.random() < 0.1: 
            amount = round(random.uniform(25000.0, 100000.0), 2)
        else:
            amount = round(random.uniform(10.0, 24999.0), 2)

        # Determine source of funds logically
        source = "Salary" if amount < 25000 else random.choice(["Salary", "Investment", "Unknown"])

        # Calculate the dynamic risk score
        risk_score = calculate_risk_score(amount, country, source)

        record = {
            "transaction_id": fake.uuid4(),
            "transaction_date": fake.date_time_between(start_date='-6m', end_date='now').strftime("%Y-%m-%d"),
            "customer_name": fake.name(),
            "customer_id": fake.random_int(min=1000, max=9999),
            "transaction_type": txn_type,
            "amount": amount,
            "currency": "MYR",
            "beneficiary_country": country,
            "source_of_funds": source,
            "risk_score": risk_score
        }
        data.append(record)

    return pd.DataFrame(data)

if __name__ == "__main__":
    try:
        df = generate_synthetic_data(2000)
        conn = sqlite3.connect("banking_data.sqlite")
        df.to_sql("transaction_ledger", conn, if_exists="replace", index=False)
        conn.close()
        
        print("\n✅ SUCCESS: 'banking_data.sqlite' created!")
        print("✅ Table name: 'transaction_ledger'")
        print(f"✅ Records inserted: {len(df)}")
        print(f"📊 High-Risk Transactions (>80): {len(df[df['risk_score'] > 80])}")
        
    except Exception as e:
        print(f"❌ Error during generation: {str(e)}")
