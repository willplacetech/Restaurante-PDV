filepath = r'C:\Users\user\Documents\Restaurante-PDV\front-end\src\pages\ContasReceber.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the Cliente select with SearchableSelect
old_select = """<label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Cliente</label>
          <select value={clienteFiltro} onChange={e => setClienteFiltro(e.target.value)} style={{
            width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: 10
          }}>
            <option value="">Todos os clientes</option>
            {clientes.map(c => <option key={c._id} value={c._id}>{c.nome}</option>)}
          </select>"""

new_select = """<label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Cliente</label>
          <SearchableSelect label='Cliente' options={clientes.map(c => ({ label: c.nome, value: c._id }))} value={clienteFiltro} onChange={(val) => setClienteFiltro(val)} placeholder='Buscar cliente' />"""

if old_select in content:
    content = content.replace(old_select, new_select)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Substitution successful")
else:
    print("Old string not found - attempting pattern match")
    # Try a more flexible pattern
    import re
    pattern = r'<label style=\{[^}]*\}display: [^\']*block[^\']*marginBottom[^\']*4[^\']*\}>Cliente</label>\s*<select value=\{clienteFiltro\} onChange=\{e => setClienteFiltro\(e\.target\.value\)\} style=\{[^}]*\}\>\s*<option value=\"\"[^\"]*Todos os clientes[^\"]*\>\s*\{clientes\.map\(c => <option key=\{c\._id\} value=\{c._id\}\>\{c\.nome\}<\/option\>\)\s*<\/select>'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        print("Pattern matched, would replace")
    else:
        print("No pattern match either")