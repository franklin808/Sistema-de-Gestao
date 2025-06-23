document.addEventListener('DOMContentLoaded', () => {
    const supabase = window.supabase;
    const addClientBtn = document.getElementById('add-client-btn');
    const clientModal = document.getElementById('client-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const clientForm = document.getElementById('client-form');
    const clientsTableBody = document.getElementById('clients-table-body');
    const modalTitle = document.getElementById('modal-title');
    const clientIdInput = document.getElementById('client-id');
    async function loadClients() {
        const { data: clients, error } = await supabase
            .from('clientes')
            .select('*')
            .order('nome', { ascending: true });

        if (error) {
            console.error('Erro ao carregar clientes:', error);
            alert('Não foi possível carregar os clientes.');
            return;
        }

        clientsTableBody.innerHTML = '';

        if (clients.length === 0) {
            clientsTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4 text-gray-500">
                        Nenhum cliente encontrado. Clique em "Adicionar Novo Cliente" para começar.
                    </td>
                </tr>
            `;
            return;
        }

        clients.forEach(client => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${client.nome}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">${client.cnpj_cpf || 'N/A'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">${client.email || 'N/A'}</div>
                    <div class="text-sm text-gray-500">${client.telefone || 'N/A'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-800 mr-3 edit-btn" title="Editar" data-id="${client.id}"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800 delete-btn" title="Excluir" data-id="${client.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
            clientsTableBody.appendChild(tr);
        });
    }

    /**
      @param {object | null} client
     */
    
    async function showClientModal(client = null) {
        clientForm.reset();

        if (client) {
            modalTitle.textContent = 'Editar Cliente';
            clientIdInput.value = client.id;
            document.getElementById('nome').value = client.nome;
            document.getElementById('cnpj_cpf').value = client.cnpj_cpf;
            document.getElementById('email').value = client.email;
            document.getElementById('telefone').value = client.telefone;
        } else {
            modalTitle.textContent = 'Adicionar Novo Cliente';
            clientIdInput.value = '';
        }

        clientModal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }

    function closeModal() {
        clientModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const clientData = {
            nome: document.getElementById('nome').value,
            cnpj_cpf: document.getElementById('cnpj_cpf').value,
            email: document.getElementById('email').value,
            telefone: document.getElementById('telefone').value,
        };

        const clientId = clientIdInput.value;
        let error;

        if (clientId) {
            const { error: updateError } = await supabase
                .from('clientes')
                .update(clientData)
                .eq('id', clientId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('clientes')
                .insert([clientData]);
            error = insertError;
        }

        if (error) {
            console.error('Erro ao salvar cliente:', error);
            alert(`Erro ao salvar: ${error.message}`);
        } else {
            alert('Cliente salvo com sucesso!');
            closeModal();
            loadClients();
        }
    }

    async function handleTableClick(e) {
        const button = e.target.closest('button');

        if (!button || !button.dataset.id) {
            return;
        }

        const clientId = button.dataset.id;
        if (button.classList.contains('delete-btn')) {
            const userConfirmed = confirm('Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.');

            if (userConfirmed) {
                const { error } = await supabase.from('clientes').delete().eq('id', clientId);

                if (error) {
                    console.error('Erro ao excluir cliente:', error);
                    alert(`Não foi possível excluir o cliente: ${error.message}`);
                } else {
                    alert('Cliente excluído com sucesso.');
                    loadClients();
                }
            }
        }
        if (button.classList.contains('edit-btn')) {
            const { data: client, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', clientId)
                .single();

            if (error) {
                console.error('Erro ao buscar cliente para edição:', error);
                alert('Não foi possível carregar os dados do cliente.');
                return;
            }

            if (client) {
                showClientModal(client);
            }
        }
    }

    if (addClientBtn) {
        addClientBtn.addEventListener('click', () => showClientModal(null));
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (clientForm) {
        clientForm.addEventListener('submit', handleFormSubmit);
    }
    if (clientsTableBody) {
        clientsTableBody.addEventListener('click', handleTableClick);
    }

    loadClients();
});
