import sqlite3
import pandas as pd
import random
from faker import Faker

fake = Faker()

def generate_synthetic_data(num_records=2000):
    print(f"Generating {num_records} synthetic banking records...")
    data = []
    
    # Define realistic banking categories
    transaction_types = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT']
    countries = ['MY', 'SG', 'US', 'GB', 'CN', 'ID', 'KP', 'IR'] # Includes High Risk (KP, IR)
    
    for _ in range(num_records):
        txn_type = random.choice(transaction_types)
        
        # Logic: Create some "high value" transactions for testing thresholds
        if random.random() < 0.1: # 10% chance of high amount
            amount = round(random.uniform(25000.0, 100000.0), 2)
        else:
            amount = round(random.uniform(10.0, 24999.0), 2)

        record = {
            "transaction_id": fake.uuid4(),
            "transaction_date": fake.date_time_between(start_date='-6m', end_date='now').strftime("%Y-%m-%d"),
            "customer_name": fake.name(),
            "customer_id": fake.random_int(min=1000, max=9999),
            "transaction_type": txn_type,
            "amount": amount,
            "currency": "MYR",
            "beneficiary_country": random.choice(countries),
            "source_of_funds": "Salary" if amount < 25000 else random.choice(["Salary", "Investment", "Unknown"]),
            "risk_score": random.randint(1, 100)
        }
        data.append(record)

    return pd.DataFrame(data)

if __name__ == "__main__":
    # Generate and save to SQLite
    df = generate_synthetic_data()
    conn = sqlite3.connect("banking_data.sqlite")
    df.to_sql("transaction_ledger", conn, if_exists="replace", index=False)
    conn.close()
    print("SUCCESS: 'banking_data.sqlite' created with table 'transaction_ledger'.")