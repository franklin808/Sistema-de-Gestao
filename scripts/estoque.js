document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabase) {
        console.error("Cliente Supabase não encontrado.");
        alert("Erro crítico: A conexão com o banco de dados não pôde ser estabelecida.");
        return;
    }
    loadStockItems();
    setupEventListeners();
});

let itemToDelete = { id: null, type: null };
let allStockItems = [];

function setupEventListeners() {

    document.querySelectorAll('[data-close-button]').forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.fixed.inset-0');
            if (modal) modal.classList.add('hidden');
        });
    });

    document.getElementById('add-product-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('product-modal');
        const form = document.getElementById('product-form');
        document.getElementById('product-modal-title').textContent = 'Adicionar Produto Base';
        form.reset();
        modal.classList.remove('hidden');
    });

    document.getElementById('add-item-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('item-modal');
        const form = document.getElementById('item-form');
        document.getElementById('item-modal-title').textContent = 'Adicionar Variação de Item';
        form.reset();
        populateProductsDropdown();
        modal.classList.remove('hidden');
    });

    document.getElementById('manage-products-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('manage-products-modal');
        loadManageProducts();
        modal.classList.remove('hidden');
    });
    document.getElementById('transform-btn')?.addEventListener('click', openTransformationModal);
    document.getElementById('product-form')?.addEventListener('submit', handleProductFormSubmit);
    document.getElementById('item-form')?.addEventListener('submit', handleItemFormSubmit);
    document.getElementById('transformation-form')?.addEventListener('submit', handleTransformationFormSubmit);
    document.getElementById('stock-table-body')?.addEventListener('click', handleStockTableClick);
    document.getElementById('manage-products-table-body')?.addEventListener('click', handleManageProductsTableClick);
    document.getElementById('transform_from_item_id')?.addEventListener('change', handleFromItemChange);
    document.getElementById('cancel-delete-btn')?.addEventListener('click', () => {
    document.getElementById('confirmation-modal').classList.add('hidden');
    itemToDelete = { id: null, type: null };
    });
    document.getElementById('confirm-delete-btn')?.addEventListener('click', handleDeleteConfirmation);
}

async function loadStockItems() {
    const stockTableBody = document.getElementById('stock-table-body');
    if (!stockTableBody) return;
    stockTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando estoque...</td></tr>`;

    try {
        const { data: items, error } = await window.supabase
            .from('itens_estoque')
            .select(`id, produto_id, dimensoes_ou_variacao, quantidade_atual, nivel_minimo, unidade_medida, categoria, valor, produtos (nome, descricao)`)
            .order('id', { ascending: true });

        if (error) throw error;
        allStockItems = items;

        if (items.length === 0) {
            stockTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-500">Nenhum item encontrado no estoque. <br><small>Use o botão "Adicionar Variação" para começar.</small></td></tr>`;
            return;
        }

        stockTableBody.innerHTML = '';
        items.forEach(item => {
            const isLowStock = item.quantidade_atual <= item.nivel_minimo;
            const statusClass = isLowStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
            const statusText = isLowStock ? 'NÍVEL BAIXO' : 'OK';
            const itemName = item.produtos ? `${item.produtos.nome} (${item.dimensoes_ou_variacao})` : `Produto não encontrado (${item.dimensoes_ou_variacao})`;
            const itemValue = item.valor ? `R$ ${parseFloat(item.valor).toFixed(2)}` : 'N/A';
            const itemDescription = item.produtos?.descricao || 'N/A';

            stockTableBody.innerHTML += `
                <tr class="hover:bg-gray-50" data-item-id="${item.id}">
                    <td class="px-6 py-4"><div class="text-sm font-medium text-gray-900">${itemName}</div></td>
                    <td class="px-6 py-4 text-sm text-gray-500">${item.categoria || 'N/A'}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${itemDescription}</td>
                    <td class="px-6 py-4 text-sm font-semibold ${isLowStock ? 'text-red-600' : 'text-gray-900'}">${item.quantidade_atual} ${item.unidade_medida || ''}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${item.nivel_minimo} ${item.unidade_medida || ''}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${itemValue}</td>
                    <td class="px-6 py-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span></td>
                    <td class="px-6 py-4 text-right text-sm font-medium">
                        <button class="text-blue-600 hover:text-blue-800 mr-3 edit-item-btn" title="Editar" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                        <button class="text-red-600 hover:text-red-800 delete-item-btn" title="Excluir" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        });
    } catch (error) {
        console.error('Erro ao carregar itens do estoque:', error);
        stockTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-red-500"><b>Erro ao carregar dados.</b><br><span class="text-sm text-gray-600">Verifique as permissões (RLS) e o console para detalhes.</span></td></tr>`;
    }
}

async function loadManageProducts() {
    const tableBody = document.getElementById('manage-products-table-body');
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-4"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';
    
    const { data: products, error } = await window.supabase.from('produtos').select('*').order('nome');

    if (error) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-red-500">Erro ao carregar produtos.</td></tr>';
        return;
    }

    if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-4">Nenhum produto base cadastrado.</td></tr>';
        return;
    }
    
    tableBody.innerHTML = '';
    products.forEach(product => {
        tableBody.innerHTML += `
            <tr data-product-id="${product.id}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${product.nome}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.categoria || 'N/A'}</td>
                <td class="px-6 py-4 text-right text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-800 mr-3 edit-product-btn" title="Editar Produto" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800 delete-product-btn" title="Excluir Produto" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}


async function populateProductsDropdown() {
    const productSelect = document.getElementById('item_product_id');
    productSelect.innerHTML = '<option value="">Carregando produtos...</option>';

    const { data: products, error } = await window.supabase.from('produtos').select('id, nome').order('nome', { ascending: true });

    if (error || !products) {
        productSelect.innerHTML = '<option value="">Erro ao carregar produtos</option>';
        return;
    }

    if (products.length === 0) {
         productSelect.innerHTML = '<option value="">Nenhum produto base cadastrado</option>';
         return;
    }

    productSelect.innerHTML = '<option value="">-- Selecione um Produto --</option>';
    products.forEach(product => {
        productSelect.innerHTML += `<option value="${product.id}">${product.nome}</option>`;
    });
}

function handleStockTableClick(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const id = target.dataset.id;
    if (target.classList.contains('edit-item-btn')) {
        openEditItemModal(id);
    }
    if (target.classList.contains('delete-item-btn')) {
        openDeleteConfirmation(id, 'item');
    }
}

function handleManageProductsTableClick(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const id = target.dataset.id;
    if (target.classList.contains('edit-product-btn')) {
        openEditProductModal(id);
    }
    if (target.classList.contains('delete-product-btn')) {
        openDeleteConfirmation(id, 'product');
    }
}

async function handleProductFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('product_id');

    const productData = {
        nome: formData.get('product_name'),
        categoria: formData.get('product_category'),
        descricao: formData.get('product_description')
    };

    let error;
    if (id) {
        const { error: updateError } = await window.supabase.from('produtos').update(productData).eq('id', id);
        error = updateError;
    } else {
        const { error: insertError } = await window.supabase.from('produtos').insert([productData]);
        error = insertError;
    }

    if (error) {
        alert(`Erro ao salvar o produto: ${error.message}`);
    } else {
        alert('Produto base salvo com sucesso!');
        document.getElementById('product-modal').classList.add('hidden');
        loadManageProducts();
        loadStockItems();
    }
}

async function handleItemFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('item_id');

    const itemData = {
        produto_id: formData.get('item_product_id'),
        dimensoes_ou_variacao: formData.get('item_variation'),
        codigo: formData.get('item_code'),
        quantidade_atual: formData.get('item_quantity'),
        nivel_minimo: formData.get('item_min_level'),
        unidade_medida: formData.get('item_unit'),
        valor: parseFloat(formData.get('item_value')) || 0
    };

    const { data: product } = await window.supabase
        .from('produtos')
        .select('categoria')
        .eq('id', itemData.produto_id)
        .single();
        
    if(product) itemData.categoria = product.categoria || 'N/A';

    let error;
    if (id) {
        const { error: updateError } = await window.supabase.from('itens_estoque').update(itemData).eq('id', id);
        error = updateError;
    } else {
        const { error: insertError } = await window.supabase.from('itens_estoque').insert([itemData]);
        error = insertError;
    }

    if(error) {
        alert(`Erro ao salvar item no estoque: ${error.message}`);
    } else {
        alert('Item salvo no estoque com sucesso!');
        document.getElementById('item-modal').classList.add('hidden');
        loadStockItems();
    }
}

function openTransformationModal() {
    const modal = document.getElementById('transformation-modal');
    const form = document.getElementById('transformation-form');
    const fromSelect = document.getElementById('transform_from_item_id');
    const fromStockInfo = document.getElementById('from-item-stock-info');
    
    form.reset();
    fromStockInfo.textContent = '';
    const toSelect = document.getElementById('transform_to_item_id');
    const fromQuantityInput = document.getElementById('transform_from_quantity');
    const toQuantityInput = document.getElementById('transform_quantity');

    toSelect.innerHTML = '<option value="">-- Selecione o item de origem primeiro --</option>';
    toSelect.disabled = true;
    toSelect.classList.add('bg-gray-100');
    fromQuantityInput.disabled = true;
    fromQuantityInput.classList.add('bg-gray-100');
    toQuantityInput.disabled = true;
    toQuantityInput.classList.add('bg-gray-100');
    
    fromSelect.innerHTML = '<option value="">Carregando itens...</option>';
    if (allStockItems.length === 0) {
        fromSelect.innerHTML = '<option value="">Nenhum item no estoque</option>';
        return;
    }

    fromSelect.innerHTML = '<option value="">-- Selecione o item a ser transformado --</option>';
    allStockItems.forEach(item => {
        if(item.produtos && item.produtos.nome) {
            const itemName = `${item.produtos.nome} (${item.dimensoes_ou_variacao})`;
            fromSelect.innerHTML += `<option value="${item.id}">${itemName}</option>`;
        }
    });
    
    modal.classList.remove('hidden');
}

function handleFromItemChange(e) {
    const fromIdStr = e.target.value;
    
    const toSelect = document.getElementById('transform_to_item_id');
    const fromQuantityInput = document.getElementById('transform_from_quantity');
    const toQuantityInput = document.getElementById('transform_quantity');
    const fromStockInfo = document.getElementById('from-item-stock-info');
    toSelect.innerHTML = '<option value="">-- Selecione o item de origem primeiro --</option>';
    toSelect.disabled = true;
    toSelect.classList.add('bg-gray-100');
    fromQuantityInput.value = '';
    fromQuantityInput.disabled = true;
    fromQuantityInput.classList.add('bg-gray-100');
    toQuantityInput.value = '';
    toQuantityInput.disabled = true;
    toQuantityInput.classList.add('bg-gray-100');
    fromStockInfo.textContent = '';
    if (!fromIdStr) return;
    const selectedItem = allStockItems.find(item => String(item.id) === fromIdStr);
    
    if (!selectedItem) {
        console.error("Item de origem não encontrado. ID:", fromIdStr);
        return;
    }

    fromStockInfo.textContent = `Estoque atual: ${selectedItem.quantidade_atual}`;
    fromQuantityInput.max = selectedItem.quantidade_atual;
    const compatibleItems = allStockItems.filter(item =>
        item.produto_id === selectedItem.produto_id && String(item.id) !== String(selectedItem.id)
    );
    if (compatibleItems.length > 0) {
        toSelect.innerHTML = '<option value="">-- Selecione um item de destino --</option>';
        compatibleItems.forEach(item => {
            const itemName = `${item.produtos.nome} (${item.dimensoes_ou_variacao})`;
            toSelect.innerHTML += `<option value="${item.id}">${itemName}</option>`;
        });
        
        toSelect.disabled = false;
        toSelect.classList.remove('bg-gray-100');
        fromQuantityInput.disabled = false;
        fromQuantityInput.classList.remove('bg-gray-100');
        toQuantityInput.disabled = false;
        toQuantityInput.classList.remove('bg-gray-100');
    } else {
        toSelect.innerHTML = '<option value="">Nenhum destino compatível</option>';
    }
}
async function handleTransformationFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const fromId = formData.get('transform_from_item_id');
    const toId = formData.get('transform_to_item_id');
    const fromQuantity = parseFloat(formData.get('transform_from_quantity')); 
    const toQuantity = parseFloat(formData.get('transform_quantity'));       

    if (!fromId || !toId || !fromQuantity || !toQuantity) {
        alert('Por favor, preencha todos os campos, incluindo ambas as quantidades.');
        return;
    }
    
    if (fromId === toId) {
        alert('O item de origem e destino não podem ser os mesmos.');
        return;
    }
    
    if (fromQuantity <= 0 || toQuantity <= 0) {
        alert('As quantidades devem ser maiores que zero.');
        return;
    }

    try {
        const fromItem = allStockItems.find(i => String(i.id) === fromId);
        const toItem = allStockItems.find(i => String(i.id) === toId);

        if (!fromItem || !toItem) {
            alert('Um ou ambos os itens não foram encontrados. A operação foi cancelada.');
            return;
        }

        if (fromQuantity > fromItem.quantidade_atual) {
            alert(`A quantidade a diminuir (${fromQuantity}) é maior que o estoque atual do item de origem (${fromItem.quantidade_atual}).`);
            return;
        }

        const newFromQuantity = fromItem.quantidade_atual - fromQuantity;
        const newToQuantity = toItem.quantidade_atual + toQuantity;
        const [fromUpdateResult, toUpdateResult] = await Promise.all([
            window.supabase.from('itens_estoque').update({ quantidade_atual: newFromQuantity }).eq('id', fromId),
            window.supabase.from('itens_estoque').update({ quantidade_atual: newToQuantity }).eq('id', toId)
        ]);
        
        if (fromUpdateResult.error || toUpdateResult.error) {
           throw fromUpdateResult.error || toUpdateResult.error;
        }

        alert('Transformação realizada com sucesso!');
        document.getElementById('transformation-modal').classList.add('hidden');
        loadStockItems();

    } catch (error) {
        alert(`Erro ao realizar a transformação: ${error.message}`);
        console.error(error);
    }
}

async function openEditProductModal(id) {
    const { data: product, error } = await window.supabase.from('produtos').select('*').eq('id', id).single();
    if (error || !product) {
        alert('Erro ao buscar dados do produto.');
        return;
    }

    const modal = document.getElementById('product-modal');
    document.getElementById('product-modal-title').textContent = 'Editar Produto Base';
    document.getElementById('product_id').value = product.id;
    document.getElementById('product_name').value = product.nome;
    document.getElementById('product_category').value = product.categoria;
    document.getElementById('product_description').value = product.descricao;
    
    modal.classList.remove('hidden');
}

async function openEditItemModal(id) {
    const { data: item, error } = await window.supabase.from('itens_estoque').select('*').eq('id', id).single();
    if (error || !item) {
        alert('Erro ao buscar dados do item.');
        return;
    }

    const modal = document.getElementById('item-modal');
    await populateProductsDropdown();
    
    document.getElementById('item-modal-title').textContent = 'Editar Item do Estoque';
    document.getElementById('item_id').value = item.id;
    document.getElementById('item_product_id').value = item.produto_id;
    document.getElementById('item_variation').value = item.dimensoes_ou_variacao;
    document.getElementById('item_quantity').value = item.quantidade_atual;
    document.getElementById('item_min_level').value = item.nivel_minimo;
    document.getElementById('item_unit').value = item.unidade_medida;
    document.getElementById('item_code').value = item.codigo;
    document.getElementById('item_value').value = item.valor;
    
    modal.classList.remove('hidden');
}

function openDeleteConfirmation(id, type) {
    itemToDelete = { id, type };
    const message = type === 'item' 
        ? 'Você tem certeza que deseja excluir este item do estoque? Esta ação não pode ser desfeita.'
        : 'Você tem certeza que deseja excluir este produto base? Todos os itens de estoque associados a ele ficarão sem um produto vinculado.';
    
    document.getElementById('confirmation-message').textContent = message;
    document.getElementById('confirmation-modal').classList.remove('hidden');
}

async function handleDeleteConfirmation() {
    if (!itemToDelete.id || !itemToDelete.type) return;

    const table = itemToDelete.type === 'item' ? 'itens_estoque' : 'produtos';
    const { error } = await window.supabase.from(table).delete().eq('id', itemToDelete.id);

    if (error) {
        alert(`Erro ao excluir: ${error.message}`);
    } else {
        alert('Item excluído com sucesso!');
        if (itemToDelete.type === 'item') {
            loadStockItems();
        } else {
            loadManageProducts();
            loadStockItems();
        }
    }

    document.getElementById('confirmation-modal').classList.add('hidden');
    itemToDelete = { id: null, type: null };
}
