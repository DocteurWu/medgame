import os
import re

pages = ['auscultation.html', 'auscultation-pcg.html']
missing_count = 0

for page in pages:
    print(f"=== Vérification des liens et assets pour {page} ===")
    with open(page, encoding='utf-8') as f:
        html = f.read()
    
    links = re.findall(r'(?:src|href)=["\']([^"\']+)["\']', html)
    for link in links:
        if link.startswith('http') or link.startswith('#') or link.startswith('data:'):
            continue
        clean_path = link.split('?')[0]
        if os.path.exists(clean_path):
            print(f"  [OK] {clean_path}")
        else:
            print(f"  [ERREUR 404] {clean_path}")
            missing_count += 1

print(f"\nTotal assets manquants : {missing_count}")
if missing_count > 0:
    exit(1)
