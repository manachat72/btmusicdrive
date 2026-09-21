import json

products = json.load(open('products.json', encoding='utf-8'))
name_to_sku = {p['name'].strip(): p['sku'] for p in products}

with open('lazada_input.csv', 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

out_rows = []
results = []
correct_skus = []
updated_count = 0

for line in lines:
    if not line.strip():
        out_rows.append(line)
        continue
    parts = line.split(',')
    prod_id = parts[0].strip()
    
    if len(parts) >= 12 and prod_id.isdigit() and len(prod_id) >= 5:
        name = parts[2].strip()
        current_sku = parts[11].strip()
        
        target_sku = name_to_sku.get(name)
        if not target_sku:
            for p in products:
                if name in p['name'] or p['name'] in name:
                    target_sku = p['sku']
                    break
                    
        if target_sku:
            if current_sku != target_sku:
                results.append((name, current_sku, target_sku))
                parts[11] = target_sku
                updated_count += 1
            else:
                correct_skus.append((name, current_sku))
        else:
            results.append((name, current_sku, 'NOT_FOUND'))
            
    out_rows.append(','.join(parts))

with open('lazada_updated.csv', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out_rows))

with open('sku_report.txt', 'w', encoding='utf-8') as f:
    f.write('UPDATED:\n')
    for r in results:
        if r[2] == 'NOT_FOUND':
            f.write(f'[X] {r[0]} => NOT FOUND IN products.json\n')
        else:
            f.write(f'[!] {r[0]} => Changed from {r[1]} to {r[2]}\n')
    
    f.write('\nCORRECT:\n')
    for c in correct_skus:
        f.write(f'[OK] {c[0]} => {c[1]}\n')

import pandas as pd
try:
    df = pd.read_csv('lazada_updated.csv', skiprows=4)
    df.to_excel('lazada_updated.xlsx', index=False)
except Exception as e:
    print('pandas failed:', e)
