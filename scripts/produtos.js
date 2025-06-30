document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabase) {
        console.error("Supabase client not found.");
        alert("Erro crítico: A conexão com o banco de dados não pôde ser estabelecida.");
        return;
    }
    const supabase = window.supabase;
    const addProductBtn = document.getElementById('add-product-btn');
    const productModal = document.getElementById('product-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const productForm = document.getElementById('product-form');
    const productsTableBody = document.getElementById('products-table-body');
    const modalTitle = document.getElementById('modal-title');
    const productIdInput = document.getElementById('product-id');
    const clientSelect = document.getElementById('cliente_id');
    const searchInput = document.getElementById('search-input');
    const imageUrlInput = document.getElementById('imagem_arte_url');
    const artPreview = document.getElementById('arte-preview');
    const artUploadInput = document.getElementById('arte_upload');

    let allProducts = [];

    /**
     * Formata o texto do status para exibição (ex: 'em_aberto' -> 'Em Aberto').
     * @param {string} status - O status vindo do banco.
     * @returns {string} O status formatado.
     */
    function formatStatusText(status) {
        if (!status) return 'Em Aberto'; // Padrão
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Converte URLs do Google Drive para um formato que pode ser embarcado.
     * @param {string} url
     * @returns {string}
     */
    function convertToEmbeddableUrl(url) {
        if (!url) return 'https://placehold.co/150x100/e2e8f0/adb5bd?text=Sem+Arte';

        const gdriveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
        const match = url.match(gdriveRegex);

        if (match && match[1]) {
            const fileId = match[1];
            return `https://drive.google.com/uc?export=view&id=${fileId}`;
        }
        return url;
    }

    /**
     * Carrega a lista de clientes para preencher o dropdown no modal.
     */
    async function loadClientsForDropdown() {
        const { data: clients, error } = await supabase
            .from('clientes')
            .select('id, nome')
            .order('nome', { ascending: true });

        if (error) {
            console.error('Erro ao carregar clientes:', error);
            clientSelect.innerHTML = '<option value="">Erro ao carregar clientes</option>';
            return;
        }

        const selectedValue = clientSelect.value;
        clientSelect.innerHTML = '<option value="">-- Selecione um Cliente --</option>';
        clients.forEach(client => {
            clientSelect.innerHTML += `<option value="${client.id}">${client.nome}</option>`;
        });
        clientSelect.value = selectedValue;
    }

    /**
     * Renderiza a tabela de produtos com os dados fornecidos.
     * @param {Array} products - A lista de produtos a ser renderizada.
     */
    function renderProductsTable(products) {
        productsTableBody.innerHTML = ''; 

        if (products.length === 0) {
            // Colspan atualizado para 6 colunas
            productsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-500">Nenhum produto encontrado.</td></tr>`;
            return;
        }

        products.forEach(product => {
            const clientName = product.clientes ? product.clientes.nome : 'Cliente não especificado';
            let description = 'Nenhuma descrição';
             if (product.observacoes) {
                try {
                    const details = JSON.parse(product.observacoes);
                    description = details.prod_obs || 'Sem observações';
                } catch (e) {
                    description = 'Observação inválida';
                }
            }

            // Define um valor padrão caso os status sejam nulos
            const statusArte = product.status_arte || 'em_aberto';
            const statusCliche = product.status_cliche || 'em_aberto';

            productsTableBody.innerHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${product.nome}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${clientName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full badge-${statusArte}">
                            ${formatStatusText(statusArte)}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                         <span class="px-2 py-1 text-xs font-semibold rounded-full badge-${statusCliche}">
                            ${formatStatusText(statusCliche)}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 truncate" title="${description}">${description}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button class="text-blue-600 hover:text-blue-800 mr-3 edit-btn" title="Editar" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                        <button class="text-red-600 hover:text-red-800 delete-btn" title="Excluir" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    /**
     * Carrega todos os produtos do banco de dados e os renderiza na tabela.
     */
    async function loadProducts() {
        // Colspan atualizado para 6 colunas
        productsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-10"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando...</td></tr>`;
        const { data, error } = await supabase.from('produtos_cliente').select(`*, clientes (nome)`).order('nome', { ascending: true });

        if (error) {
            console.error("Erro ao carregar produtos:", error);
            productsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-red-500">Erro ao carregar produtos.</td></tr>`;
            return;
        }

        allProducts = data;
        renderProductsTable(allProducts);
    }

    /**
     * Exibe o modal para adicionar ou editar um produto.
     * @param {Object|null} product - O objeto do produto para edição, ou null para adicionar.
     */
    async function showProductModal(product = null) {
        productForm.reset();
        await loadClientsForDropdown(); 

        if (product) {
            modalTitle.textContent = 'Editar Produto';
            productIdInput.value = product.id;
            clientSelect.value = product.cliente_id;
            document.getElementById('nome_produto').value = product.nome;
            document.getElementById('valor_produto').value = product.valor ? parseFloat(product.valor).toFixed(2) : '0.00';
            
            // Preenche os novos campos de status
            document.getElementById('status_arte').value = product.status_arte || 'em_aberto';
            document.getElementById('status_cliche').value = product.status_cliche || 'em_aberto';

            const savedUrl = product.imagem_arte_url || '';
            imageUrlInput.value = savedUrl;
            artPreview.src = convertToEmbeddableUrl(savedUrl);
            artUploadInput.value = '';

            if (product.observacoes) {
                try {
                    const details = JSON.parse(product.observacoes);
                    for (const key in details) {
                        if (document.getElementById(key)) {
                            document.getElementById(key).value = details[key];
                        }
                    }
                } catch(e) { console.error("Erro ao parsear 'observacoes':", e); }
            }
        } else {
            modalTitle.textContent = 'Adicionar Novo Produto';
            productIdInput.value = '';
            imageUrlInput.value = '';
            artUploadInput.value = '';
            artPreview.src = convertToEmbeddableUrl('');
            // Define o valor padrão para os status ao adicionar novo produto
            document.getElementById('status_arte').value = 'em_aberto';
            document.getElementById('status_cliche').value = 'em_aberto';
        }

        productModal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }

    /**
     * Fecha o modal de produto.
     */
    function closeModal() {
        productModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }

    /**
     * Lida com o envio do formulário, salvando o produto (novo ou editado).
     * @param {Event} e - O evento de submit do formulário.
     */
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Salvando...';

        const formData = new FormData(productForm);
        const productId = formData.get('product-id');
        const fileToUpload = artUploadInput.files[0];
        let finalImageUrl = imageUrlInput.value;

        if (fileToUpload) {
            const clienteId = formData.get('cliente_id') || 'geral';
            const productName = formData.get('nome_produto').replace(/[^a-zA-Z0-9]/g, '_') || 'produto';
            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${clienteId}-${productName}-${Date.now()}.${fileExt}`;
            const bucketName = 'artes-produtos';
            const filePath = `public/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from(bucketName)
                .upload(filePath, fileToUpload);

            if (uploadError) {
                alert(`Erro no upload da imagem: ${uploadError.message}`);
                console.error("Upload Error:", uploadError);
                submitButton.disabled = false;
                submitButton.textContent = 'Salvar Produto';
                return;
            }
            
            const { data: publicUrlData } = supabase
                .storage
                .from(bucketName)
                .getPublicUrl(uploadData.path);
                
            finalImageUrl = publicUrlData.publicUrl;
        }

        const details = {
            mp_tipo: formData.get('mp_tipo'), mp_descricao: formData.get('mp_descricao'), mp_corte: formData.get('mp_corte'),
            prod_largura: formData.get('prod_largura'), prod_altura: formData.get('prod_altura'), prod_carreiras: formData.get('prod_carreiras'),
            prod_serrilha: formData.get('prod_serrilha'), prod_verniz: formData.get('prod_verniz'), prod_cor: formData.get('prod_cor'),
            prod_aplicacao: formData.get('prod_aplicacao'), prod_obs: formData.get('prod_obs'),
            acab_qtde_etq: formData.get('acab_qtde_etq'), acab_metragem: formData.get('acab_metragem'), acab_tubete: formData.get('acab_tubete'),
            acab_embalagem: formData.get('acab_embalagem'),
            info_impressao: formData.get('info_impressao')
        };
        
        const clientIdValue = formData.get('cliente_id');
        const productData = {
            cliente_id: clientIdValue ? clientIdValue : null, 
            nome: formData.get('nome_produto'),
            valor: parseFloat(formData.get('valor_produto')) || 0,
            imagem_arte_url: finalImageUrl,
            observacoes: JSON.stringify(details),
            // Adiciona os novos campos de status ao objeto de dados
            status_arte: formData.get('status_arte'),
            status_cliche: formData.get('status_cliche')
        };

        let error;
        if (productId) {
            ({ error } = await supabase.from('produtos_cliente').update(productData).eq('id', productId));
        } else {
            ({ error } = await supabase.from('produtos_cliente').insert([productData]));
        }
        
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Produto';

        if (error) {
            alert(`Erro ao salvar produto: ${error.message}`);
        } else {
            alert('Produto salvo com sucesso!');
            closeModal();
            loadProducts();
        }
    }

    /**
     * Lida com cliques na tabela (editar, excluir).
     * @param {Event} e - O evento de clique.
     */
    async function handleTableClick(e) {
        const target = e.target.closest('button');
        if (!target) return;

        const id = target.dataset.id;
        
        if (target.classList.contains('delete-btn')) {
            if (window.confirm('Tem certeza que deseja excluir este produto? Esta ação é irreversível.')) {
                const { error } = await supabase.from('produtos_cliente').delete().eq('id', id);
                if (error) {
                    alert(`Erro ao excluir produto: ${error.message}`);
                } else {
                    alert('Produto excluído com sucesso.');
                    loadProducts(); 
                }
            }
        }

        if (target.classList.contains('edit-btn')) {
            const product = allProducts.find(p => p.id.toString() === id);
            if (product) {
                await showProductModal(product);
            } else {
                alert('Produto não encontrado. Tente recarregar a página.');
            }
        }
    }

    /**
     * Filtra os produtos exibidos na tabela com base no termo de busca.
     */
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredProducts = allProducts.filter(p => (
            p.nome.toLowerCase().includes(searchTerm) || 
            (p.clientes && p.clientes.nome.toLowerCase().includes(searchTerm))
        ));
        renderProductsTable(filteredProducts);
    }

    // Adiciona os event listeners
    addProductBtn.addEventListener('click', () => showProductModal(null));
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    productForm.addEventListener('submit', handleFormSubmit);
    productsTableBody.addEventListener('click', handleTableClick);
    searchInput.addEventListener('input', handleSearch);

    artUploadInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                artPreview.src = event.target.result;
            }
            reader.readAsDataURL(e.target.files[0]);
        }
    });

    // Carrega os produtos iniciais
    loadProducts();
});
