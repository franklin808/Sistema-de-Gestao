document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabase) {
        console.error("Supabase client not found.");
        showMessageModal("Erro crítico", "A conexão com o banco de dados não pôde ser estabelecida.");
        return;
    }
    const supabase = window.supabase;

    const createOrderButton = document.getElementById('createOrderButton');
    const newOrderModal = document.getElementById('newOrderModal');
    const orderModalTitle = document.getElementById('order-modal-title');
    const newOrderForm = document.getElementById('newOrderForm');
    const ordersTableBody = document.getElementById('orders-table-body');
    const addItemButton = document.getElementById('addItemButton');
    const orderItemsContainer = document.getElementById('orderItems');
    const printOrderButton = document.getElementById('printOrderButton');
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    const clientSelect = document.getElementById('client');
    const itemsSubtotalSpan = document.getElementById('itemsSubtotal');
    const servicesTotalSpan = document.getElementById('servicesTotal');
    const orderTotalSpan = document.getElementById('orderTotal');
    const arteCheckbox = document.getElementById('arte-checkbox');
    const arteValor = document.getElementById('arte-valor');
    const clicheCheckbox = document.getElementById('cliche-checkbox');
    const clicheValor = document.getElementById('cliche-valor');
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const messageModal = document.getElementById('message-modal');
    const messageModalTitle = document.getElementById('message-modal-title');
    const messageModalText = document.getElementById('message-modal-text');
    let orderToDelete = null;
    let allClients = [];
    let allClientProducts = [];
    async function initializePage() {
        await loadClientsAndProductsForDropdown();
        await loadOrders();
        setupEventListeners();
    }
    initializePage();

    function setupEventListeners() {
        createOrderButton.addEventListener('click', () => showOrderModal());

        document.querySelectorAll('[data-close-button]').forEach(button => {
            button.addEventListener('click', () => {
                const modal = button.closest('.fixed.inset-0');
                if (modal) {
                    modal.classList.add('hidden');
                }
                if(modal && modal.id === 'newOrderModal') {
                    document.body.classList.remove('overflow-hidden');
                }
            });
        });

        addItemButton.addEventListener('click', () => addOrderItemRow());
        newOrderForm.addEventListener('submit', handleOrderFormSubmit);
        ordersTableBody.addEventListener('click', handleTableClick);
        confirmDeleteBtn.addEventListener('click', handleDeleteConfirmation);
        cancelDeleteBtn.addEventListener('click', () => confirmationModal.classList.add('hidden'));
        searchInput.addEventListener('input', loadOrders);
        statusFilter.addEventListener('change', loadOrders);
        printOrderButton.addEventListener('click', handlePrintOrder);
        clientSelect.addEventListener('change', handleClientChange);
        arteCheckbox.addEventListener('change', updateOrderTotal);
        arteValor.addEventListener('input', updateOrderTotal);
        clicheCheckbox.addEventListener('change', updateOrderTotal);
        clicheValor.addEventListener('input', updateOrderTotal);
    }

    function showMessageModal(title, message) {
        messageModalTitle.textContent = title;
        messageModalText.textContent = message;
        messageModal.classList.remove('hidden');
    }

    function closeModal() {
        newOrderModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }

    async function loadClientsAndProductsForDropdown() {
        try {
            const clientPromise = supabase.from('clientes').select('id, nome').order('nome');
            const productPromise = supabase.from('produtos_cliente').select('*');

            const [{ data: clients, error: clientError }, { data: products, error: productError }] = await Promise.all([clientPromise, productPromise]);

            if (clientError) throw clientError;
            if (productError) throw productError;

            allClients = clients;
            allClientProducts = products;
        } catch (error) {
            console.error('Erro ao carregar clientes e produtos:', error);
            showMessageModal("Erro de Carregamento", `Não foi possível carregar dados essenciais: ${error.message}`);
        }
    }

    function populateClientsDropdown(selectedClientId = '') {
        clientSelect.innerHTML = '<option value="">Selecione um cliente</option>';
        allClients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = client.nome;
            if (String(client.id) === String(selectedClientId)) option.selected = true;
            clientSelect.appendChild(option);
        });
    }

    function populateClientProductsDropdown(selectElement, clientId, selectedProductId = '') {
        const productsForClient = allClientProducts.filter(p => p.cliente_id === null || String(p.cliente_id) === String(clientId));

        selectElement.innerHTML = '<option value="">Selecione um produto</option>';

        if (!clientId) {
            selectElement.innerHTML = '<option value="">Selecione um cliente primeiro</option>';
            selectElement.disabled = true;
            return;
        }

        selectElement.disabled = false;
        if (productsForClient.length === 0) {
            selectElement.innerHTML = '<option value="">Nenhum produto cadastrado</option>';
            return;
        }

        productsForClient.sort((a, b) => {
            if (a.cliente_id && !b.cliente_id) return -1;
            if (!a.cliente_id && b.cliente_id) return 1;
            return a.nome.localeCompare(b.nome);
        });

        productsForClient.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.cliente_id ? product.nome : `${product.nome}`;
            if (String(product.id) === String(selectedProductId)) option.selected = true;
            selectElement.appendChild(option);
        });
    }

    function handleClientChange() {
        const selectedClientId = clientSelect.value;
        document.querySelectorAll('.order-item .client-product-select').forEach(select => {
            populateClientProductsDropdown(select, selectedClientId);
            const row = select.closest('tr');
            row.querySelector('[name="descricao_item"]').value = '';
            row.querySelector('[name="preco_unitario"]').value = '0.00';
            updateSubtotal(row);
        });
        updateOrderTotal();
    }

    async function loadOrders() {
        ordersTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-10"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando...</td></tr>`;
        const searchTerm = searchInput.value.toLowerCase();
        const filterStatus = statusFilter.value;

        try {
            let query = supabase.from('pedidos')
                .select(`id, numero_pedido, data_pedido, data_entrega, status, valor_total, clientes(nome)`)
                .order('numero_pedido', { ascending: false });

            if (filterStatus) query = query.eq('status', filterStatus);

            const { data: orders, error } = await query;
            if (error) throw error;

            const filteredOrders = orders.filter(order =>
                (order.clientes?.nome.toLowerCase().includes(searchTerm) || String(order.numero_pedido).toLowerCase().includes(searchTerm))
            );

            renderOrdersTable(filteredOrders);
        } catch (error) {
            console.error('Erro ao carregar pedidos:', error);
            ordersTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-red-500">Erro ao carregar pedidos.</td></tr>`;
        }
    }

    function renderOrdersTable(orders) {
        if (orders.length === 0) {
            ordersTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-500">Nenhum pedido encontrado.</td></tr>`;
            return;
        }
        ordersTableBody.innerHTML = '';
        orders.forEach(order => {
            const statusClass = `badge-${(order.status || '').replace(/ /g, '_')}`;
            const row = `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">${String(order.numero_pedido).padStart(5, '0')}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${order.clientes?.nome || 'Cliente Desconhecido'}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${new Date(order.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${order.data_entrega ? new Date(order.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${(order.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td class="px-6 py-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${formatStatusText(order.status)}</span></td>
                    <td class="px-6 py-4 text-sm">
                        <button class="text-blue-600 hover:text-blue-800 mr-3 view-edit-order-btn" title="Ver/Editar" data-id="${order.id}"><i class="fas fa-edit"></i></button>
                        <button class="text-green-600 hover:text-green-800 mr-3 copy-order-btn" title="Copiar Pedido" data-id="${order.id}"><i class="fas fa-copy"></i></button>
                        <button class="text-red-600 hover:text-red-800 delete-order-btn" title="Excluir" data-id="${order.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            ordersTableBody.innerHTML += row;
        });
    }

    function formatStatusText(status) {
        if (!status) return 'N/A';
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    function applyServicesFromDetails(details = {}) {
        arteCheckbox.checked = details.servico_arte_checked || false;
        arteValor.value = details.servico_arte_valor || '100.00';
        clicheCheckbox.checked = details.servico_cliche_checked || false;
        clicheValor.value = details.servico_cliche_valor || '350.00';
    }

    async function showOrderModal(orderId = null, copyData = null) {
        newOrderForm.reset();
        orderItemsContainer.innerHTML = '';
        document.getElementById('order-id').value = '';
        printOrderButton.classList.add('hidden');
        
        applyServicesFromDetails();

        let initialClientId = '';
        let details = {};

        if (copyData) {
            orderModalTitle.textContent = 'Criar Pedido (Cópia)';
            initialClientId = copyData.cliente_id;
            populateClientsDropdown(initialClientId);
            document.getElementById('orderDate').valueAsDate = new Date();
            document.getElementById('deliveryDate').value = copyData.data_entrega || '';
            document.getElementById('status').value = 'em_aberto';

            if (copyData.observacoes) {
                try {
                    details = JSON.parse(copyData.observacoes);
                    newOrderForm.querySelectorAll('input[id^="order_"], textarea[id="notes"]').forEach(input => {
                        const key = input.name;
                        if(details[key]) input.value = details[key];
                    });
                    applyServicesFromDetails(details);
                } catch(e) { console.error("Erro ao parsear 'observacoes' para cópia:", e)}
            }
            copyData.pedido_itens.forEach(item => addOrderItemRow(item, initialClientId));

        } else if (orderId) {
            orderModalTitle.textContent = 'Editar Pedido';
            printOrderButton.classList.remove('hidden');
            const { data: order, error } = await supabase
                .from('pedidos')
                .select('*, pedido_itens(*)')
                .eq('id', orderId)
                .single();

            if (error || !order) {
                showMessageModal("Erro", "Não foi possível carregar os dados do pedido.");
                return;
            }

            initialClientId = order.cliente_id;
            document.getElementById('order-id').value = order.id;
            populateClientsDropdown(initialClientId);
            document.getElementById('orderDate').value = order.data_pedido;
            document.getElementById('deliveryDate').value = order.data_entrega || '';
            document.getElementById('status').value = order.status;

            if (order.observacoes) {
                 try {
                    details = JSON.parse(order.observacoes);
                     newOrderForm.querySelectorAll('input[id^="order_"], textarea#notes').forEach(input => {
                        const key = input.name;
                        if(details[key]) input.value = details[key];
                    });
                    applyServicesFromDetails(details);
                } catch(e) { console.error("Erro ao parsear 'observacoes' para edição:", e)}
            }
            order.pedido_itens.forEach(item => addOrderItemRow(item, initialClientId));

        } else {
            orderModalTitle.textContent = 'Criar Novo Pedido';
            populateClientsDropdown();
            document.getElementById('orderDate').valueAsDate = new Date();
            addOrderItemRow();
        }

        updateOrderTotal();
        newOrderModal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }

    function addOrderItemRow(itemData = null, clientId = null) {
        const currentClientId = clientId || document.getElementById('client').value;
        const newRow = document.createElement('tr');
        newRow.className = 'order-item';
        newRow.innerHTML = `
            <td class="p-2 align-top">
                <input type="hidden" name="pedido_item_id" value="${itemData?.id || ''}">
                <select name="produto_cliente_id" class="border-gray-300 rounded-md shadow-sm w-full p-2 text-sm client-product-select" required></select>
            </td>
            <td class="p-2 align-top"><input type="text" name="descricao_item" class="border-gray-300 rounded-md shadow-sm w-full p-2 text-sm" placeholder="Descrição no pedido" value="${itemData?.descricao_item || ''}"></td>
            <td class="p-2 align-top"><input type="number" name="quantidade" min="1" value="${itemData?.quantidade || 1}" class="border-gray-300 rounded-md shadow-sm w-20 p-2 text-sm quantity-input" required></td>
            <td class="p-2 align-top"><input type="number" step="0.01" name="preco_unitario" value="${itemData ? parseFloat(itemData.preco_unitario).toFixed(2) : '0.00'}" class="border-gray-300 rounded-md shadow-sm w-24 p-2 text-sm price-input" required></td>
            <td class="p-2 align-top text-sm font-medium subtotal">R$ 0,00</td>
            <td class="p-2 align-top"><button type="button" class="text-red-600 hover:text-red-800 remove-item" title="Remover"><i class="fas fa-trash-alt"></i></button></td>
        `;
        orderItemsContainer.appendChild(newRow);

        const clientProductSelect = newRow.querySelector('.client-product-select');
        populateClientProductsDropdown(clientProductSelect, currentClientId, itemData?.produto_cliente_id);

        clientProductSelect.addEventListener('change', () => {
            const selectedProductId = clientProductSelect.value;
            const selectedProduct = allClientProducts.find(p => String(p.id) === selectedProductId);
            const descInput = newRow.querySelector('input[name="descricao_item"]');
            const priceInput = newRow.querySelector('input[name="preco_unitario"]');

            if(selectedProduct) {
                descInput.value = selectedProduct.nome;
                priceInput.value = selectedProduct.valor ? parseFloat(selectedProduct.valor).toFixed(2) : '0.00';
                if (selectedProduct.observacoes) {
                    try {
                        const details = JSON.parse(selectedProduct.observacoes);
                        for (const key in details) {
                             if (document.getElementById(`order_${key}`)) {
                                document.getElementById(`order_${key}`).value = details[key] || '';
                            }
                        }
                    } catch (e) {
                        console.error("Erro ao processar detalhes do produto:", e);
                    }
                }
            } else {
                descInput.value = '';
                priceInput.value = '0.00';
            }
            updateSubtotal(newRow);
            updateOrderTotal();
        });

        [...newRow.querySelectorAll('.quantity-input, .price-input')].forEach(input => {
            input.addEventListener('input', () => {
                updateSubtotal(newRow);
                updateOrderTotal();
            });
        });

        newRow.querySelector('.remove-item').addEventListener('click', () => {
            newRow.remove();
            updateOrderTotal();
        });

        updateSubtotal(newRow);
    }

    function updateSubtotal(row) {
        const qty = parseFloat(row.querySelector('.quantity-input').value) || 0;
        const price = parseFloat(row.querySelector('.price-input').value) || 0;
        const subtotal = qty * price;
        row.querySelector('.subtotal').textContent = subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function updateOrderTotal() {
        let itemsSubtotal = 0;
        document.querySelectorAll('.order-item').forEach(row => {
            const qty = parseFloat(row.querySelector('.quantity-input').value) || 0;
            const price = parseFloat(row.querySelector('.price-input').value) || 0;
            itemsSubtotal += qty * price;
        });

        let servicesTotal = 0;
        if (arteCheckbox.checked) {
            servicesTotal += parseFloat(arteValor.value) || 0;
        }
        if (clicheCheckbox.checked) {
            servicesTotal += parseFloat(clicheValor.value) || 0;
        }
        
        const finalTotal = itemsSubtotal + servicesTotal;

 
        itemsSubtotalSpan.textContent = itemsSubtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        servicesTotalSpan.textContent = servicesTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        orderTotalSpan.textContent = finalTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    async function handleTableClick(e) {
        const button = e.target.closest('button');
        if (!button) return;

        const orderId = button.dataset.id;
        if (!orderId) return;

        if (button.classList.contains('view-edit-order-btn')) {
            await showOrderModal(orderId);
        } else if (button.classList.contains('delete-order-btn')) {
            orderToDelete = orderId;
            confirmationMessage.textContent = 'Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.';
            confirmationModal.classList.remove('hidden');
        } else if (button.classList.contains('copy-order-btn')) {
            const { data: order, error } = await supabase.from('pedidos').select('*, pedido_itens(*)').eq('id', orderId).single();
            if (error || !order) {
                showMessageModal("Erro", "Pedido não encontrado para cópia.");
                return;
            }
            await showOrderModal(null, order);
        }
    }

    async function handleOrderFormSubmit(e) {
        e.preventDefault();

        const orderId = document.getElementById('order-id').value;
        const cliente_id = document.getElementById('client').value;

        if (!cliente_id) {
            showMessageModal("Validação", "Por favor, selecione um cliente.");
            return;
        }

        const printDetails = {};
        newOrderForm.querySelectorAll('input[id^="order_"], textarea#notes').forEach(input => {
            const key = input.name;
            printDetails[key] = input.value;
        });
        
        printDetails.servico_arte_checked = arteCheckbox.checked;
        printDetails.servico_arte_valor = arteValor.value;
        printDetails.servico_cliche_checked = clicheCheckbox.checked;
        printDetails.servico_cliche_valor = clicheValor.value;

        const orderData = {
            cliente_id: cliente_id,
            data_pedido: document.getElementById('orderDate').value,
            data_entrega: document.getElementById('deliveryDate').value || null,
            status: document.getElementById('status').value,
            valor_total: parseFloat(orderTotalSpan.textContent.replace('R$', '').replace(/\./g, '').replace(',', '.')),
            observacoes: JSON.stringify(printDetails)
        };

        const items = Array.from(document.querySelectorAll('.order-item')).map(row => {
            const itemId = row.querySelector('[name=pedido_item_id]').value;
            const itemPayload = {
                produto_cliente_id: row.querySelector('[name=produto_cliente_id]').value,
                descricao_item: row.querySelector('[name=descricao_item]').value,
                quantidade: parseInt(row.querySelector('[name=quantidade]').value, 10) || 1,
                preco_unitario: parseFloat(row.querySelector('[name=preco_unitario]').value) || 0
            };
            if (itemId) {
                itemPayload.id = itemId;
            }
            return itemPayload;
        });

        if (items.length === 0 || items.some(item => !item.produto_cliente_id)) {
            showMessageModal("Validação", "Adicione pelo menos um item e selecione um produto para cada um.");
            return;
        }

        try {
            const { data: savedOrder, error: orderError } = await supabase.from('pedidos')
                .upsert(orderId ? { id: orderId, ...orderData } : orderData)
                .select()
                .single();

            if (orderError) throw orderError;

            const itemsToSave = items.map(item => ({...item, pedido_id: savedOrder.id}));
            const { error: itemsError } = await supabase.from('pedido_itens').upsert(itemsToSave, { onConflict: 'id' });
            if (itemsError) throw itemsError;

            showMessageModal("Sucesso", "Pedido salvo com sucesso!");
            closeModal();
            await loadOrders();

        } catch (error) {
             showMessageModal("Erro ao Salvar", `Ocorreu um erro: ${error.message}`);
        }
    }

    async function handleDeleteConfirmation() {
        if (!orderToDelete) return;
        try {
            await supabase.from('pedido_itens').delete().eq('pedido_id', orderToDelete);
            await supabase.from('pedidos').delete().eq('id', orderToDelete);
            showMessageModal("Sucesso", "Pedido excluído com sucesso!");
            await loadOrders();
        } catch (error) {
            showMessageModal("Erro", `Não foi possível excluir o pedido: ${error.message}`);
        } finally {
            confirmationModal.classList.add('hidden');
            orderToDelete = null;
        }
    }
    
    async function handlePrintOrder() {
        const orderId = document.getElementById('order-id').value;
        if (!orderId) {
            showMessageModal("Erro", "Nenhum pedido selecionado para impressão.");
            return;
        }

        try {
            const { data: order, error: orderError } = await supabase
                .from('pedidos')
                .select(`
                    id, numero_pedido, data_pedido, data_entrega, observacoes,
                    clientes (nome),
                    pedido_itens (descricao_item, quantidade, produtos_cliente (nome, observacoes))
                `)
                .eq('id', orderId)
                .single();

            if (orderError) throw orderError;
            if (!order) {
                showMessageModal("Erro", "Pedido não encontrado para impressão.");
                return;
            }

            const basePrintData = {
                data: new Date(order.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR'),
                dataEntrega: order.data_entrega ? new Date(order.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A',
                cliente: order.clientes?.nome || 'N/A',
                pedido: order.id.toString().substring(0, 8).toUpperCase(),
            };

            if (order.observacoes) {
                try {
                    const parsedOrderDetails = JSON.parse(order.observacoes);
                    Object.assign(basePrintData, parsedOrderDetails);
                } catch (e) {
                    console.warn("JSON de observações do pedido inválido:", e);
                }
            }

            const printQueue = (order.pedido_itens || []).map(item => {
                const itemPrintData = { ...basePrintData };
                if (item.produtos_cliente && item.produtos_cliente.observacoes) {
                    try {
                        const parsedProductDetails = JSON.parse(item.produtos_cliente.observacoes);
                        Object.assign(itemPrintData, parsedProductDetails);
                    } catch (e) {
                        console.warn(`JSON de observações do produto ID ${item.produtos_cliente?.id || 'desconhecido'} inválido:`, e);
                    }
                }

                const itemDescription = item.descricao_item || item.produtos_cliente?.nome || 'Descrição indisponível';
                const existingProdObs = itemPrintData.prod_obs || '';
                itemPrintData.prod_obs = `${itemDescription}\n${existingProdObs}`.trim();
                itemPrintData.acab_qtde_etq = item.quantidade.toString();

                return itemPrintData;
            });
            
            if (printQueue.length === 0) {
                 printQueue.push(basePrintData);
            }

            localStorage.setItem('printOrderData', JSON.stringify(printQueue));
            window.open('/admin/scripts/impressao.html', '_blank');

        } catch (error) {
            console.error('Erro ao preparar pedido para impressão:', error);
            showMessageModal("Erro de Impressão", `Não foi possível preparar o pedido para impressão: ${error.message}`);
        }
    }
});
