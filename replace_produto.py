filepath = r'C:\Users\user\Documents\Restaurante-PDV\front-end\src\pages\ContasReceber.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_select = '''<Label className="novo-pedido-field">Produto<select value={novoPedidoForm.produtoId} onChange={event => setNovoPedidoForm({ ...novoPedidoForm, produtoId: event.target.value })}><option value="">Selecione um produto</option>{produtos.map(produto => <option key={produto._id} value={produto._id}>{produto.nome}</option>)}</select></Label>'''

new_select = '''<Label className="novo-pedido-field">Produto<SearchableSelect label='Produto' options={produtos.map(p => ({ label: p.nome, value: p._id }))} value={novoPedidoForm.produtoId} onChange={(val) => setNovoPedidoForm({ ...novoPedidoForm, produtoId: val })} placeholder='Buscar produto' /></Label>'''

if old_select in content:
    content = content.replace(old_select, new_select)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Substitution successful')
else:
    print('Old string not found - showing first 200 chars of old pattern')
    print(repr(old_select[:200]))