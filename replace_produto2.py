filepath = r'C:\Users\user\Documents\Restaurante-PDV\front-end\src\pages\ContasReceber.jsx'

with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

old_select = '''Produto<select value={novoPedidoForm.produtoId} onChange={event => setNovoPedidoForm({ ...novoPedidoForm, produtoId: event.target.value })}><option value="">Selecione um produto</option>{produtos.map(produto => <option key={produto._id} value={produto._id}>{produto.nome}</option>)}</select>'''

new_select = '''Produto<SearchableSelect label='Produto' options={produtos.map(p => ({ label: p.nome, value: p._id }))} value={novoPedidoForm.produtoId} onChange={(val) => setNovoPedidoForm({ ...novoPedidoForm, produtoId: val })} placeholder='Buscar produto' />'''

if old_select in content:
    content = content.replace(old_select, new_select)
    with open(filepath, 'w', encoding='utf-8', errors='replace') as f:
        f.write(content)
    print('Produto select substitution successful')
else:
    print('Old string not found')
    idx = content.find('Produto<select value={novoPedidoForm.produtoId')
    if idx > 0:
        print('Found at index', idx)
        print(repr(content[idx:idx+100]))