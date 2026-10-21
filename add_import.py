filepath = r'C:\Users\user\Documents\Restaurante-PDV\front-end\src\pages\Dashboard.jsx'

with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

old_import = "import { AuthContext } from '../context/AuthContextDefinition.jsx';"
new_import = "import { AuthContext } from '../context/AuthContextDefinition.jsx';\nimport NoveltiesModal from '../components/NoveltiesModal.jsx';"

if old_import in content:
    content = content.replace(old_import, new_import)
    with open(filepath, 'w', encoding='utf-8', errors='replace') as f:
        f.write(content)
    print('Import added successfully')
else:
    print('Import pattern not found - showing first 200 chars')
    print(repr(old_import[:50]))