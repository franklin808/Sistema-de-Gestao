document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabase) {
        console.error("Supabase client not found.");
        showMessageModal("Erro crítico", "A conexão com o banco de dados não pôde ser estabelecida.");
        return;
    }
    const supabase = window.supabase;

    // --- ELEMENTOS DO DOM ---
    const ordersTableBody = document.getElementById('orders-table-body');
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    const paymentStatusFilter = document.getElementById('payment-status-filter');
    const createOrderButton = document.getElementById('createOrderButton');

    // --- MODAL DE CRIAÇÃO/EDIÇÃO ---
    const newOrderModal = document.getElementById('newOrderModal');
    const orderModalTitle = document.getElementById('order-modal-title');
    const newOrderForm = document.getElementById('newOrderForm');
    const orderItemsContainer = document.getElementById('orderItems');
    const addItemButton = document.getElementById('addItemButton');
    const clientSelect = document.getElementById('client');
    const printDetailsSection = document.getElementById('print-details-section');
    const printOrderButton = document.getElementById('printOrderButton');
    
    // --- TOTAIS E SERVIÇOS ---
    const itemsSubtotalSpan = document.getElementById('itemsSubtotal');
    const servicesTotalSpan = document.getElementById('servicesTotal');
    const orderTotalSpan = document.getElementById('orderTotal');
    const arteCheckbox = document.getElementById('arte-checkbox');
    const arteValor = document.getElementById('arte-valor');
    const clicheCheckbox = document.getElementById('cliche-checkbox');
    const clicheValor = document.getElementById('cliche-valor');

    // --- FATURAMENTO ---
    const tipoPagamentoSelect = document.getElementById('tipo_pagamento');
    const dataVencimentoContainer = document.getElementById('data-vencimento-container');
    const dataVencimentoInput = document.getElementById('data_vencimento_faturamento');
    const statusFaturamentoSelect = document.getElementById('status_faturamento');

    // --- MODAIS DE CONFIRMAÇÃO/MENSAGEM ---
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const messageModal = document.getElementById('message-modal');
    const messageModalTitle = document.getElementById('message-modal-title');
    const messageModalText = document.getElementById('message-modal-text');

    let orderToDelete = null;
    let allClients = [];
    let allClientProducts = [];

    // --- INICIALIZAÇÃO ---
    async function initializePage() {
        await Promise.all([
            loadClientsAndProductsForDropdown(),
            checkAndMarkOverdueOrders()
        ]);
        await loadOrders();
        setupEventListeners();
    }
    initializePage();

    // --- CONFIGURAÇÃO DOS EVENT LISTENERS ---
    function setupEventListeners() {
        createOrderButton.addEventListener('click', () => showOrderModal());
        document.querySelectorAll('[data-close-button]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                button.closest('.fixed.inset-0')?.classList.add('hidden');
                document.body.classList.remove('overflow-hidden');
            });
        });

        newOrderForm.addEventListener('submit', handleOrderFormSubmit);
        addItemButton.addEventListener('click', () => addOrderItemRow());
        
        orderItemsContainer.addEventListener('click', handleItemInteraction);
        printDetailsSection.addEventListener('input', handleDetailsFormInput);

        ordersTableBody.addEventListener('click', handleTableClick);
        confirmDeleteBtn.addEventListener('click', handleDeleteConfirmation);
        cancelDeleteBtn.addEventListener('click', () => confirmationModal.classList.add('hidden'));

        searchInput.addEventListener('input', loadOrders);
        statusFilter.addEventListener('change', loadOrders);
        paymentStatusFilter.addEventListener('change', loadOrders);
        
        printOrderButton.addEventListener('click', handlePrintOrderInModal);
        clientSelect.addEventListener('change', handleClientChange);
        arteCheckbox.addEventListener('change', updateOrderTotal);
        arteValor.addEventListener('input', updateOrderTotal);
        clicheCheckbox.addEventListener('change', updateOrderTotal);
        clicheValor.addEventListener('input', updateOrderTotal);
        tipoPagamentoSelect.addEventListener('change', toggleVencimentoField);
    }
    
    // --- LÓGICA DO MODAL ---
    function handleItemInteraction(e) {
        const row = e.target.closest('.order-item');
        if (!row) {
             if (e.target.closest('.remove-item')) {
                const rowToRemove = e.target.closest('.order-item');
                const wasActive = rowToRemove.classList.contains('active');
                rowToRemove.remove();
                updateOrderTotal();
                if(wasActive) {
                    const firstRow = orderItemsContainer.querySelector('.order-item');
                    if(firstRow) setActiveItemRow(firstRow);
                    else clearDetailsForm();
                }
            }
            return;
        }
        setActiveItemRow(row);
    }

    function setActiveItemRow(rowToActivate) {
        orderItemsContainer.querySelectorAll('.order-item.active').forEach(activeRow => {
            if(activeRow !== rowToActivate) activeRow.classList.remove('active');
        });
        rowToActivate.classList.add('active');
        populateDetailsForm(rowToActivate);
    }

    function populateDetailsForm(row) {
        const detailsJson = row.querySelector('.item-details-json').value;
        const details = JSON.parse(detailsJson || '{}');
        printDetailsSection.querySelectorAll('input[id^="order_"], textarea[id^="order_"]').forEach(input => {
            const key = input.name;
            input.value = details[key] || '';
        });
    }
    
    function clearDetailsForm() {
         printDetailsSection.querySelectorAll('input[id^="order_"], textarea[id^="order_"]').forEach(input => {
            input.value = '';
        });
    }

    function handleDetailsFormInput() {
        const activeRow = orderItemsContainer.querySelector('.order-item.active');
        if (!activeRow) return;

        const details = {};
        printDetailsSection.querySelectorAll('input[id^="order_"], textarea[id^="order_"]').forEach(input => {
            if (input.name) {
                details[input.name] = input.value;
            }
        });
        
        activeRow.querySelector('.item-details-json').value = JSON.stringify(details);
    }
    
    // --- CARREGAMENTO DE DADOS ---
    async function loadOrders() {
        ordersTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando...</td></tr>`;
        const searchTerm = searchInput.value.toLowerCase();
        const filterStatus = statusFilter.value;
        const filterPaymentStatus = paymentStatusFilter.value;

        try {
            // CORREÇÃO: Removidas as colunas individuais de serviço e 'obs_gerais'. Adicionada a coluna 'observacoes'.
            let query = supabase.from('pedidos')
                .select(`id, numero_pedido, data_pedido, data_entrega, status, status_faturamento, tipo_pagamento, data_vencimento_faturamento, valor_total, observacoes, clientes(nome)`)
                .order('numero_pedido', { ascending: false });

            if (filterStatus) {
                query = query.eq('status', filterStatus);
            }

            const { data: orders, error } = await query;
            if (error) throw error;

            let filteredOrders = orders.filter(order => {
                const clientName = order.clientes?.nome || '';
                const orderNumber = String(order.numero_pedido);
                const matchesSearch = searchTerm ? clientName.toLowerCase().includes(searchTerm) || orderNumber.toLowerCase().includes(searchTerm) : true;
                if (!matchesSearch) return false;

                if (filterPaymentStatus) {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    const dataVencimento = order.data_vencimento_faturamento ? new Date(order.data_vencimento_faturamento + 'T00:00:00') : null;
                    const isAtrasado = order.status_faturamento !== 'pago' && order.tipo_pagamento === 'a_prazo' && dataVencimento && dataVencimento < hoje;
                    if (filterPaymentStatus === 'pago' && order.status_faturamento !== 'pago') return false;
                    if (filterPaymentStatus === 'atrasado' && !isAtrasado) return false;
                    if (filterPaymentStatus === 'nao_pago' && (order.status_faturamento === 'pago' || isAtrasado)) return false;
                }
                return true;
            });
            renderOrdersTable(filteredOrders);
        } catch (error) {
            console.error('Erro ao carregar pedidos:', error);
            ordersTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-red-500">Erro ao carregar pedidos. Verifique o console para mais detalhes.</td></tr>`;
        }
    }
    
    // --- RENDERIZAÇÃO ---
    function renderOrdersTable(orders) {
        if (!orders || orders.length === 0) {
            ordersTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-gray-500">Nenhum pedido encontrado.</td></tr>`;
            return;
        }

        let tableHtml = '';
        orders.forEach(order => {
            const statusClass = `badge-${(order.status || '').replace(/ /g, '_')}`;
            const { statusFaturamentoTexto, statusFaturamentoClasse } = getStatusFaturamentoDinamico(order);
            
            tableHtml += `
                <tr class="order-row hover:bg-gray-100 cursor-pointer transition-colors duration-200" data-order-id="${order.id}">
                    <td class="px-6 py-4 text-sm font-medium">${String(order.numero_pedido).padStart(5, '0')}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${order.clientes?.nome || 'Cliente Desconhecido'}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${formatDate(order.data_pedido)}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${formatDate(order.data_entrega)}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${formatCurrency(order.valor_total)}</td>
                    <td class="px-6 py-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${formatStatusText(order.status)}</span></td>
                    <td class="px-6 py-4"><span class="px-2 py-1 text-xs font-semibold rounded-full ${statusFaturamentoClasse}">${statusFaturamentoTexto}</span></td>
                    <td class="px-6 py-4 text-sm text-center whitespace-nowrap actions-cell">
                        <button class="text-blue-600 hover:text-blue-800 mr-2 edit-order-btn" title="Editar" data-id="${order.id}"><i class="fas fa-edit"></i></button>
                        <button class="text-green-600 hover:text-green-800 mr-2 copy-order-btn" title="Copiar Pedido" data-id="${order.id}"><i class="fas fa-copy"></i></button>
                        <button class="text-indigo-600 hover:text-indigo-800 mr-2 print-row-btn" title="Imprimir" data-id="${order.id}"><i class="fas fa-print"></i></button>
                        <button class="text-red-600 hover:text-red-800 delete-order-btn" title="Excluir" data-id="${order.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
                <tr class="details-row hidden" data-details-for="${order.id}">
                    <td colspan="8">
                        <div class="details-content p-4">
                            <div class="text-center py-5"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando detalhes...</div>
                        </div>
                    </td>
                </tr>
            `;
        });
        ordersTableBody.innerHTML = tableHtml;
    }
    
    // --- LÓGICA DAS MODAIS DE EDIÇÃO ---
    async function showOrderModal(orderId = null, copyData = null) {
        newOrderForm.reset();
        orderItemsContainer.innerHTML = '';
        document.getElementById('order-id').value = '';
        printOrderButton.classList.add('hidden');
        clearDetailsForm();
        applyServicesFromDetails();

        if (copyData) {
            orderModalTitle.textContent = 'Criar Novo Pedido (Cópia)';
            const initialClientId = copyData.cliente_id;
            populateClientsDropdown(initialClientId);
            document.getElementById('orderDate').valueAsDate = new Date();
            document.getElementById('deliveryDate').value = copyData.data_entrega || '';
            document.getElementById('status').value = 'em_aberto';
            tipoPagamentoSelect.value = copyData.tipo_pagamento || 'a_vista';
            statusFaturamentoSelect.value = 'nao_pago';
            
            const details = JSON.parse(copyData.observacoes || '{}');
            document.getElementById('notes').value = details.obs_gerais || '';
            applyServicesFromDetails(details);
            
            copyData.pedido_itens.forEach(item => addOrderItemRow(item, initialClientId, true));
        } else if (orderId) {
            orderModalTitle.textContent = 'Editar Pedido';
            printOrderButton.classList.remove('hidden');
            const { data: order, error } = await supabase
                .from('pedidos').select('*, pedido_itens(*)')
                .eq('id', orderId).single();
            if (error || !order) {
                showMessageModal("Erro", "Não foi possível carregar os dados do pedido.");
                return;
            }
            document.getElementById('order-id').value = order.id;
            populateClientsDropdown(order.cliente_id);
            document.getElementById('orderDate').value = order.data_pedido;
            document.getElementById('deliveryDate').value = order.data_entrega || '';
            document.getElementById('status').value = order.status;
            tipoPagamentoSelect.value = order.tipo_pagamento || 'a_vista';
            statusFaturamentoSelect.value = order.status_faturamento || 'nao_pago';
            dataVencimentoInput.value = order.data_vencimento_faturamento || '';
            
            // CORREÇÃO: Lê os detalhes do campo 'observacoes'
            const details = JSON.parse(order.observacoes || '{}');
            document.getElementById('notes').value = details.obs_gerais || '';
            applyServicesFromDetails(details);

            order.pedido_itens.forEach(item => addOrderItemRow(item, order.cliente_id));

        } else {
            orderModalTitle.textContent = 'Criar Novo Pedido';
            populateClientsDropdown();
            document.getElementById('orderDate').valueAsDate = new Date();
            tipoPagamentoSelect.value = 'a_vista';
            statusFaturamentoSelect.value = 'nao_pago';
            addOrderItemRow();
        }

        const firstRow = orderItemsContainer.querySelector('.order-item');
        if (firstRow) {
            setActiveItemRow(firstRow);
        }

        toggleVencimentoField();
        updateOrderTotal();
        newOrderModal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }

    // --- SUBMISSÃO E AÇÕES ---
    async function handleOrderFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(newOrderForm);
        const orderId = formData.get('order_id');
        const cliente_id = formData.get('cliente_id');

        if (!cliente_id) {
            showMessageModal("Validação", "Por favor, selecione um cliente.");
            return;
        }
        
        // CORREÇÃO: Agrupa observações e serviços em um único objeto JSON
        const observacoesDetails = {
            obs_gerais: formData.get('obs_gerais'),
            servico_arte_checked: arteCheckbox.checked,
            servico_arte_valor: arteValor.value,
            servico_cliche_checked: clicheCheckbox.checked,
            servico_cliche_valor: clicheValor.value,
        };
        
        const orderData = {
            cliente_id,
            data_pedido: formData.get('data_pedido'),
            data_entrega: formData.get('data_entrega') || null,
            status: formData.get('status'),
            valor_total: parseFloat(orderTotalSpan.textContent.replace('R$', '').replace(/\./g, '').replace(',', '.')),
            observacoes: JSON.stringify(observacoesDetails), // Salva o objeto JSON na coluna 'observacoes'
            tipo_pagamento: formData.get('tipo_pagamento'),
            status_faturamento: formData.get('status_faturamento'),
            data_vencimento_faturamento: formData.get('tipo_pagamento') === 'a_prazo' ? formData.get('data_vencimento_faturamento') : null,
        };

const itemsToUpdate = [];
        const itemsToInsert = [];
        const currentItemIdsInForm = [];

        const itemRows = document.querySelectorAll('.order-item');
        if (itemRows.length === 0) {
            showMessageModal("Validação", "Adicione pelo menos um item ao pedido.");
            return;
        }

        for (const row of itemRows) {
            const itemId = row.querySelector('[name=pedido_item_id]').value;
            const produto_cliente_id = row.querySelector('[name=produto_cliente_id]').value;

            if (!produto_cliente_id) {
                showMessageModal("Validação", "Selecione um produto para todos os itens do pedido.");
                return;
            }

            const itemPayload = {
                produto_cliente_id,
                descricao_item: row.querySelector('[name=descricao_item]').value,
                quantidade: parseInt(row.querySelector('[name=quantidade]').value, 10) || 1,
                preco_unitario: parseFloat(row.querySelector('[name=preco_unitario]').value) || 0,
                detalhes_impressao: JSON.parse(row.querySelector('.item-details-json').value || '{}')
            };

            if (itemId) {
                itemPayload.id = itemId;
                itemsToUpdate.push(itemPayload);
                currentItemIdsInForm.push(itemId);
            } else {
                // Este é um item novo, vai para a lista de inserção
                itemsToInsert.push(itemPayload);
            }
        }

        try {
            // Salva ou atualiza o pedido principal
            const { data: savedOrder, error: orderError } = await supabase.from('pedidos')
                .upsert(orderId ? { id: orderId, ...orderData } : orderData)
                .select().single();
            if (orderError) throw orderError;
            
            const savedOrderId = savedOrder.id;

            // Se for uma edição, verifica se algum item foi removido
            if (orderId) {
                const { data: originalItems } = await supabase.from('pedido_itens').select('id').eq('pedido_id', orderId);
                if (originalItems) {
                    const originalItemIds = originalItems.map(i => i.id.toString());
                    const itemsToDelete = originalItemIds.filter(id => !currentItemIdsInForm.includes(id));
                    if (itemsToDelete.length > 0) {
                        const { error: deleteError } = await supabase.from('pedido_itens').delete().in('id', itemsToDelete);
                        if (deleteError) throw deleteError;
                    }
                }
            }

            // Atualiza os itens que já existiam
            if (itemsToUpdate.length > 0) {
                const updates = itemsToUpdate.map(item => ({ ...item, pedido_id: savedOrderId }));
                const { error: updateError } = await supabase.from('pedido_itens').upsert(updates);
                if (updateError) throw updateError;
            }

            // Insere os novos itens
            if (itemsToInsert.length > 0) {
                const inserts = itemsToInsert.map(item => ({ ...item, pedido_id: savedOrderId }));
                const { error: insertError } = await supabase.from('pedido_itens').insert(inserts);
                if (insertError) throw insertError;
            }
            // FIM DA SEÇÃO CORRIGIDA

            showMessageModal("Sucesso", "Pedido salvo com sucesso!");
            newOrderModal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
            await loadOrders();
        } catch (error) {
             showMessageModal("Erro ao Salvar", `Ocorreu um erro: ${error.message}`);
        }
    }
    
    // --- LÓGICA DA TABELA PRINCIPAL ---
    async function handleTableClick(e) {
        const actionButton = e.target.closest('.actions-cell button');
        if (actionButton) {
            e.stopPropagation();
            const orderId = actionButton.dataset.id;
            
            if (actionButton.classList.contains('edit-order-btn')) {
                await showOrderModal(orderId);
            } else if (actionButton.classList.contains('delete-order-btn')) {
                orderToDelete = orderId;
                document.getElementById('confirmation-message').textContent = 'Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.';
                confirmationModal.classList.remove('hidden');
            } else if (actionButton.classList.contains('copy-order-btn')) {
                // O select de cópia agora vai pegar a coluna 'observacoes' automaticamente
                const { data: order, error } = await supabase.from('pedidos').select('*, pedido_itens(*)').eq('id', orderId).single();
                if (error || !order) { showMessageModal("Erro", "Pedido não encontrado para cópia."); return; }
                const orderToCopy = JSON.parse(JSON.stringify(order));
                orderToCopy.pedido_itens.forEach(item => { delete item.id; delete item.pedido_id; });
                await showOrderModal(null, orderToCopy);
            } else if (actionButton.classList.contains('print-row-btn')) {
                await printOrder(orderId);
            }
            return;
        }

        const row = e.target.closest('tr.order-row');
        if (row) {
            const orderId = row.dataset.orderId;
            const detailsRow = ordersTableBody.querySelector(`tr[data-details-for="${orderId}"]`);
            
            document.querySelectorAll('.details-row:not(.hidden)').forEach(openRow => {
                if (openRow !== detailsRow) {
                    openRow.classList.add('hidden');
                    openRow.previousElementSibling.classList.remove('expanded');
                }
            });

            detailsRow.classList.toggle('hidden');
            row.classList.toggle('expanded');

            const isNowOpen = !detailsRow.classList.contains('hidden');
            const isLoaded = detailsRow.dataset.loaded === 'true';

            if (isNowOpen && !isLoaded) {
                const detailsContent = detailsRow.querySelector('.details-content');
                await loadAndRenderDetails(orderId, detailsContent);
                detailsRow.dataset.loaded = 'true';
            }
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

    async function loadAndRenderDetails(orderId, container) {
        const { data: order, error } = await supabase
            .from('pedidos')
            .select('*, clientes(nome), pedido_itens(*, produtos_cliente(nome, imagem_arte_url))')
            .eq('id', orderId)
            .single();
    
        if (error || !order) {
            container.innerHTML = `<div class="text-red-500 p-4">Erro ao carregar detalhes do pedido.</div>`;
            return;
        }
    
        let itemsHtml = '';
        order.pedido_itens.forEach(item => {
            const subtotal = (item.quantidade || 0) * (item.preco_unitario || 0);
            const printDetails = item.detalhes_impressao || {};
            const detailLabels = { mp_tipo: "MP: Tipo", mp_descricao: "MP: Descrição", mp_corte: "MP: Corte", prod_largura: "Prod: Largura", prod_altura: "Prod: Altura", prod_carreiras: "Prod: Carreiras", prod_serrilha: "Prod: Serrilha", prod_verniz: "Prod: Verniz", prod_cor: "Prod: Cor", prod_aplicacao: "Prod: Aplicação", prod_obs: "Prod: Observações", acab_qtde_etq: "Acab: Qtd. Etq.", acab_metragem: "Acab: Metragem", acab_tubete: "Acab: Tubete", acab_embalagem: "Acab: Embalagem" };
            
            let itemDetailsHtml = Object.entries(detailLabels)
                .map(([key, label]) => printDetails[key] ? `<div class="break-inside-avoid"><strong class="text-gray-600 text-xs uppercase">${label}:</strong><p class="text-sm">${printDetails[key]}</p></div>` : '')
                .join('');
    
            itemsHtml += `
                <div class="p-4 border rounded-lg mb-4 break-inside-avoid shadow-sm">
                    <div class="flex flex-col sm:flex-row gap-4">
                         <img src="${convertToEmbeddableUrl(item.produtos_cliente?.imagem_arte_url)}" alt="Arte do produto" class="w-24 h-24 object-contain rounded border self-start">
                         <div class="flex-grow">
                             <h5 class="font-bold text-md">${item.descricao_item || item.produtos_cliente?.nome || 'Item sem descrição'}</h5>
                             <p class="text-sm text-gray-600">
                                Qtd: ${item.quantidade} | 
                                Preço Unit.: ${formatCurrency(item.preco_unitario)} | 
                                <strong class="text-gray-800">Subtotal: ${formatCurrency(subtotal)}</strong>
                             </p>
                             <div class="mt-3 pt-3 border-t">
                                 <h6 class="text-sm font-semibold mb-2">Detalhes de Impressão do Item:</h6>
                                 <div class="columns-2 md:columns-3 gap-x-4">
                                     ${itemDetailsHtml || '<p class="col-span-full text-gray-500">Nenhum detalhe de impressão para este item.</p>'}
                                 </div>
                             </div>
                         </div>
                    </div>
                </div>
            `;
        });
        
        // CORREÇÃO: Lê as observações gerais do objeto JSON 'observacoes'
        const orderDetails = JSON.parse(order.observacoes || '{}');
        const generalObs = orderDetails.obs_gerais || 'Nenhuma observação geral.';
    
        const detailsContent = `
            <div class="space-y-6">
                 <div>
                    <h3 class="text-xl font-bold">Detalhes do Pedido <span class="text-purple-500">#${String(order.numero_pedido).padStart(5, '0')}</span></h3>
                </div>
                <section>
                    <h4 class="text-lg font-semibold mb-2">Itens e Detalhes de Impressão</h4>
                    ${itemsHtml || '<p class="text-gray-500">Este pedido não contém itens.</p>'}
                </section>
                <section>
                    <h4 class="text-lg font-semibold mb-2">Observações Gerais do Pedido</h4>
                    <div class="p-4 border rounded-lg min-h-[50px]">
                        <p class="text-sm whitespace-pre-wrap">${generalObs}</p>
                    </div>
                </section>
            </div>
        `;
    
        container.innerHTML = detailsContent;
    }


    // --- FUNÇÕES AUXILIARES ---
    function formatCurrency(value) { return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function formatDate(dateString) { if (!dateString) return ''; return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR'); }
    function formatStatusText(status) { if (!status) return 'N/A'; return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }
    function showMessageModal(title, message) { messageModalTitle.textContent = title; messageModalText.textContent = message; messageModal.classList.remove('hidden'); }
    async function loadClientsAndProductsForDropdown() { try { const [{ data: clients }, { data: products }] = await Promise.all([supabase.from('clientes').select('id, nome').order('nome'), supabase.from('produtos_cliente').select('*, imagem_arte_url, observacoes')]); allClients = clients; allClientProducts = products; } catch (error) { showMessageModal("Erro de Carregamento", `Não foi possível carregar dados essenciais: ${error.message}`); } }
    function populateClientsDropdown(selectedClientId = '') { clientSelect.innerHTML = '<option value="">Selecione um cliente</option>'; allClients.forEach(client => { clientSelect.innerHTML += `<option value="${client.id}" ${String(client.id) === String(selectedClientId) ? 'selected' : ''}>${client.nome}</option>`; }); }
    
    // CORREÇÃO: A função agora espera o objeto de detalhes que vem da coluna 'observacoes'
    function applyServicesFromDetails(details = {}) { 
        arteCheckbox.checked = details.servico_arte_checked || false; 
        arteValor.value = details.servico_arte_valor || '100.00'; 
        clicheCheckbox.checked = details.servico_cliche_checked || false; 
        clicheValor.value = details.servico_cliche_valor || '350.00'; 
    }
    
    function addOrderItemRow(itemData = null, clientId = null, isCopy = false) {
        const currentClientId = clientId || document.getElementById('client').value;
        const newRow = document.createElement('tr');
        newRow.className = 'order-item';
        const itemId = itemData && !isCopy ? itemData.id : '';
        const detailsString = JSON.stringify(itemData?.detalhes_impressao || {});

        newRow.innerHTML = `
            <td class="p-2 align-top"><img src="https://placehold.co/80x80/e2e8f0/adb5bd?text=N/A" alt="Arte" class="w-20 h-20 object-contain rounded border product-art-preview"></td>
            <td class="p-2 align-top">
                <input type="hidden" name="pedido_item_id" value="${itemId}">
                <input type="hidden" class="item-details-json" value='${detailsString}'>
                <select name="produto_cliente_id" class="border-gray-300 rounded-md shadow-sm w-full p-2 text-sm client-product-select" required></select>
            </td>
            <td class="p-2 align-top"><input type="text" name="descricao_item" class="border-gray-300 rounded-md shadow-sm w-full p-2 text-sm" placeholder="Descrição no pedido" value="${itemData?.descricao_item || ''}"></td>
            <td class="p-2 align-top"><input type="number" name="quantidade" min="1" value="${itemData?.quantidade || 1}" class="border-gray-300 rounded-md shadow-sm w-20 p-2 text-sm quantity-input" required></td>
            <td class="p-2 align-top"><input type="number" step="0.01" name="preco_unitario" value="${itemData ? parseFloat(itemData.preco_unitario || 0).toFixed(2) : '0.00'}" class="border-gray-300 rounded-md shadow-sm w-24 p-2 text-sm price-input" required></td>
            <td class="p-2 align-top text-sm font-medium subtotal">R$ 0,00</td>
            <td class="p-2 align-top"><button type="button" class="text-red-600 hover:text-red-800 remove-item" title="Remover"><i class="fas fa-trash-alt"></i></button></td>
        `;
        orderItemsContainer.appendChild(newRow);
        
        const productSelect = newRow.querySelector('.client-product-select');
        populateClientProductsDropdown(productSelect, currentClientId, itemData?.produto_cliente_id);
        
        if (itemData?.produto_cliente_id) {
            const product = allClientProducts.find(p => String(p.id) === String(itemData.produto_cliente_id));
            if (product) newRow.querySelector('.product-art-preview').src = convertToEmbeddableUrl(product.imagem_arte_url);
        }

        productSelect.addEventListener('change', () => handleProductSelection(productSelect));
        newRow.addEventListener('input', e => { if (e.target.matches('.quantity-input, .price-input')) { updateSubtotal(newRow); updateOrderTotal(); } });
        
        updateSubtotal(newRow);
    }
    
    function handleProductSelection(selectElement) {
        const selectedProduct = allClientProducts.find(p => String(p.id) === selectElement.value);
        const row = selectElement.closest('tr');
        
        row.querySelector('[name=descricao_item]').value = selectedProduct?.nome || '';
        row.querySelector('[name=preco_unitario]').value = selectedProduct?.valor ? parseFloat(selectedProduct.valor).toFixed(2) : '0.00';
        row.querySelector('.product-art-preview').src = convertToEmbeddableUrl(selectedProduct?.imagem_arte_url);
        
        let productDetails = {};
        if (selectedProduct?.observacoes) {
            try { productDetails = JSON.parse(selectedProduct.observacoes); } 
            catch (e) { console.error("Erro ao processar detalhes do produto:", e); }
        }
        
        row.querySelector('.item-details-json').value = JSON.stringify(productDetails);
        
        setActiveItemRow(row);
        
        updateSubtotal(row);
        updateOrderTotal();
    }

    function updateSubtotal(row) { const qty = parseFloat(row.querySelector('.quantity-input').value) || 0; const price = parseFloat(row.querySelector('.price-input').value) || 0; row.querySelector('.subtotal').textContent = formatCurrency(qty * price); }
    function updateOrderTotal() { let itemsSubtotal = 0; document.querySelectorAll('.order-item').forEach(row => { const qty = parseFloat(row.querySelector('.quantity-input').value) || 0; const price = parseFloat(row.querySelector('.price-input').value) || 0; itemsSubtotal += qty * price; }); let servicesTotal = (arteCheckbox.checked ? parseFloat(arteValor.value) || 0 : 0) + (clicheCheckbox.checked ? parseFloat(clicheValor.value) || 0 : 0); itemsSubtotalSpan.textContent = formatCurrency(itemsSubtotal); servicesTotalSpan.textContent = formatCurrency(servicesTotal); orderTotalSpan.textContent = formatCurrency(itemsSubtotal + servicesTotal); }
    function convertToEmbeddableUrl(url) { if (!url) return 'https://placehold.co/80x80/e2e8f0/adb5bd?text=N/A'; const match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/); return match ? `https://drive.google.com/uc?export=view&id=${match[1]}` : url; }
    function populateClientProductsDropdown(select, clientId, selectedProductId = '') { const products = allClientProducts.filter(p => p.cliente_id === null || String(p.cliente_id) === String(clientId)); select.innerHTML = '<option value="">Selecione...</option>'; if (!clientId) { select.disabled = true; return; } select.disabled = false; products.sort((a,b) => (a.nome || '').localeCompare(b.nome || '')).forEach(p => { select.innerHTML += `<option value="${p.id}" ${String(p.id) === String(selectedProductId) ? 'selected' : ''}>${p.nome}</option>`; }); }
    function handleClientChange() { document.querySelectorAll('.order-item').forEach(row => { const select = row.querySelector('.client-product-select'); populateClientProductsDropdown(select, clientSelect.value); row.querySelector('[name=descricao_item]').value = ''; row.querySelector('[name=preco_unitario]').value = '0.00'; row.querySelector('.product-art-preview').src = convertToEmbeddableUrl(''); updateSubtotal(row); }); updateOrderTotal(); clearDetailsForm(); }
    
    async function handlePrintOrderInModal() {
        const orderId = document.getElementById('order-id').value;
        if(orderId) {
            await printOrder(orderId);
        } else {
            showMessageModal("Aviso", "Salve o pedido antes de imprimir. As informações de impressão dos itens ainda não foram salvas.");
        }
    }
    
    async function printOrder(orderId) {
        try {
            const { data: order, error } = await supabase
                .from('pedidos')
                .select('*, clientes(nome), pedido_itens(*, produtos_cliente(imagem_arte_url))')
                .eq('id', orderId)
                .single();
    
            if (error || !order) throw new Error("Não foi possível carregar os dados do pedido para impressão.");
            if (!order.pedido_itens || order.pedido_itens.length === 0) {
                showMessageModal("Aviso", "Este pedido não possui itens para imprimir.");
                return;
            }
    
            const printQueue = [];
            const orderDetails = JSON.parse(order.observacoes || '{}');

            for (const item of order.pedido_itens) {
                const itemPrintDetails = item.detalhes_impressao || {};
                const dataForItem = {
                    data: formatDate(order.data_pedido) || '',
                    dataEntrega: formatDate(order.data_entrega) || '',
                    cliente: order.clientes?.nome || 'N/A',
                    pedido: String(order.numero_pedido).padStart(5, '0'),
                    ...itemPrintDetails,
                    obs_gerais: orderDetails.obs_gerais || '',
                    imagem_arte: convertToEmbeddableUrl(item.produtos_cliente?.imagem_arte_url) || ''
                };
                printQueue.push(dataForItem);
            }
    
            localStorage.setItem('printOrderData', JSON.stringify(printQueue));
            
            const printWindow = window.open('scripts/impressao.html', '_blank');
            if (!printWindow) {
                showMessageModal("Erro de Pop-up", "Não foi possível abrir a janela de impressão. Verifique se seu navegador está bloqueando pop-ups.");
            }
    
        } catch (error) {
            console.error("Erro na função printOrder:", error);
            showMessageModal("Erro de Impressão", error.message);
        }
    }

    async function checkAndMarkOverdueOrders() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        try {
            const { data: ordersToCheck, error } = await supabase
                .from('pedidos')
                .select('id, data_entrega, status')
                .not('status', 'in', '("concluido", "cancelado", "entrega_atrasada")');

            if (error) throw error;

            const idsToUpdate = ordersToCheck
                .filter(order => order.data_entrega && new Date(order.data_entrega + 'T00:00:00') < hoje)
                .map(order => order.id);

            if (idsToUpdate.length > 0) {
                const { error: updateError } = await supabase
                    .from('pedidos')
                    .update({ status: 'entrega_atrasada' })
                    .in('id', idsToUpdate);
                if (updateError) throw updateError;
            }
        } catch (err) {
            console.error('Erro ao verificar pedidos atrasados:', err);
        }
    }

    function getStatusFaturamentoDinamico(order) {
        if (order.status_faturamento === 'pago') {
             return { statusFaturamentoTexto: 'Pago', statusFaturamentoClasse: 'badge-pago' };
        }
        if (order.tipo_pagamento === 'a_prazo' && order.data_vencimento_faturamento) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0); 
            const dataVencimento = new Date(order.data_vencimento_faturamento + 'T00:00:00');
            if (dataVencimento < hoje) {
                return { statusFaturamentoTexto: 'Atrasado', statusFaturamentoClasse: 'badge-atrasado' };
            }
            return { statusFaturamentoTexto: `Vence em ${formatDate(order.data_vencimento_faturamento)}`, statusFaturamentoClasse: 'badge-a_vencer' };
        }
        return { statusFaturamentoTexto: 'Não Pago', statusFaturamentoClasse: 'badge-nao_pago' };
    }

    function toggleVencimentoField() {
        dataVencimentoContainer.classList.toggle('hidden', tipoPagamentoSelect.value !== 'a_prazo');
        if (tipoPagamentoSelect.value !== 'a_prazo') {
            dataVencimentoInput.value = '';
        }
    }
});
