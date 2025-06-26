document.addEventListener('DOMContentLoaded', async () => {
    // Verificação inicial do cliente Supabase
    if (!window.supabase) {
        console.error("Supabase client not found.");
        // Exibe erro em todos os KPIs se o cliente Supabase não for encontrado
        document.querySelectorAll('[id^="kpi-"]').forEach(el => el.textContent = 'Erro');
        return;
    }
    const supabase = window.supabase;

    // Seletores dos elementos do DOM (ATUALIZADO)
    const kpiFaturamento = document.getElementById('kpi-faturamento');
    const kpiPedidosAberto = document.getElementById('kpi-pedidos-aberto');
    const kpiPedidosConcluidos = document.getElementById('kpi-pedidos-concluidos');
    const kpiAguardandoFaturamento = document.getElementById('kpi-aguardando-faturamento');
    const kpiPagamentoAtrasado = document.getElementById('kpi-pagamento-atrasado'); // Adicionado seletor
    const kpiArtesPendentes = document.getElementById('kpi-artes-pendentes');
    const kpiClichesPendentes = document.getElementById('kpi-cliches-pendentes');
    const kpiEstoqueBaixo = document.getElementById('kpi-estoque-baixo');
    const welcomeMessage = document.getElementById('welcomeMessage');

    /**
     * Carrega todos os Indicadores Chave de Performance (KPIs).
     */
    async function loadKPIs() {
        const today = new Date();
        const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
        const currentYear = today.getFullYear().toString();
        const firstDayOfMonth = `${currentYear}-${currentMonth}-01`;
        const todayISO = today.toISOString().split('T')[0]; // Data de hoje para comparação

        // --- Faturamento do Mês (Pedidos Concluídos e Pagos) ---
        try {
            const { data, error } = await supabase
                .from('pedidos')
                .select('valor_total')
                .gte('data_pedido', firstDayOfMonth)
                .eq('status', 'concluido')
                .eq('status_faturamento', 'pago');
            if (error) throw error;
            const totalFaturamento = data.reduce((sum, order) => sum + parseFloat(order.valor_total || 0), 0);
            kpiFaturamento.textContent = totalFaturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } catch (error) {
            console.error('Error fetching Faturamento do Mês:', error);
            kpiFaturamento.textContent = 'Erro';
        }

        // --- Pedidos em Aberto ---
        try {
            const { count, error } = await supabase
                .from('pedidos')
                .select('id', { count: 'exact' })
                .eq('status', 'em_aberto');
            if (error) throw error;
            kpiPedidosAberto.textContent = count;
        } catch (error) {
            console.error('Error fetching Pedidos em Aberto:', error);
            kpiPedidosAberto.textContent = 'Erro';
        }

        // --- Pedidos Concluídos no Mês ---
        try {
            const { count, error } = await supabase
                .from('pedidos')
                .select('id', { count: 'exact' })
                .gte('data_pedido', firstDayOfMonth)
                .eq('status', 'concluido');
            if (error) throw error;
            kpiPedidosConcluidos.textContent = count;
        } catch (error) {
            console.error('Error fetching Pedidos Concluídos no Mês:', error);
            kpiPedidosConcluidos.textContent = 'Erro';
        }
        
        // --- NOVO: Lógica para Pagamentos Atrasados ---
        // Conta pedidos não pagos, não cancelados e com data de vencimento anterior a hoje.
        try {
            const { count, error } = await supabase
                .from('pedidos')
                .select('id', { count: 'exact' })
                .eq('status_faturamento', 'nao_pago')
                .neq('status', 'cancelado')
                .lt('data_vencimento_faturamento', todayISO);
            if (error) throw error;
            kpiPagamentoAtrasado.textContent = count;
        } catch (error) {
            console.error('Error fetching Pagamentos Atrasados:', error);
            kpiPagamentoAtrasado.textContent = 'Erro';
        }

        // --- ATUALIZADO: Lógica para Aguardando Faturamento ---
        // Conta pedidos não pagos, não cancelados e que NÃO estão atrasados (vencimento hoje, no futuro ou sem vencimento definido).
        try {
            const { count, error } = await supabase
                .from('pedidos')
                .select('id', { count: 'exact' })
                .eq('status_faturamento', 'nao_pago')
                .neq('status', 'cancelado')
                .or(`data_vencimento_faturamento.gte.${todayISO},data_vencimento_faturamento.is.null`);
            if (error) throw error;
            kpiAguardandoFaturamento.textContent = count;
        } catch (error) {
            console.error('Error fetching Pedidos Aguardando Faturamento:', error);
            kpiAguardandoFaturamento.textContent = 'Erro';
        }

        // --- Artes Pendentes ---
        try {
            const { count, error } = await supabase
                .from('produtos_cliente')
                .select('id', { count: 'exact' })
                .in('status_arte', ['em_aberto', 'em_producao']);
            if (error) throw error;
            kpiArtesPendentes.textContent = count;
        } catch (error) {
            console.error('Error fetching Artes Pendentes:', error);
            kpiArtesPendentes.textContent = 'Erro';
        }
        
        // --- Clichês Pendentes ---
        try {
            const { count, error } = await supabase
                .from('produtos_cliente')
                .select('id', { count: 'exact' })
                .in('status_cliche', ['em_aberto', 'em_producao']);
            if (error) throw error;
            kpiClichesPendentes.textContent = count;
        } catch (error) {
            console.error('Error fetching Clichês Pendentes:', error);
            kpiClichesPendentes.textContent = 'Erro';
        }

        // --- Itens com Estoque Baixo ---
        try {
            const { data: stockItems, error } = await supabase
                .from('itens_estoque')
                .select('quantidade_atual, nivel_minimo');
            if (error) throw error;
            const lowStockCount = stockItems.filter(item => parseFloat(item.quantidade_atual) < parseFloat(item.nivel_minimo)).length;
            kpiEstoqueBaixo.textContent = lowStockCount;
        } catch (error)
        {
            console.error('Error fetching Itens em Estoque Baixo:', error);
            kpiEstoqueBaixo.textContent = 'Erro';
        }
    }

    /**
     * Carrega a lista de pedidos recentes para a tabela do dashboard.
     */
    async function loadRecentOrders() {
        const tabelaPedidosRecentes = document.getElementById('tabela-pedidos-recentes');
        if (!tabelaPedidosRecentes) return;
        tabelaPedidosRecentes.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Carregando...</td></tr>';

        try {
            const { data: orders, error } = await supabase
                .from('pedidos')
                .select(`id, numero_pedido, data_pedido, valor_total, status, status_faturamento, clientes (nome)`)
                .order('data_pedido', { ascending: false })
                .limit(5);
            if (error) throw error;

            if (orders.length === 0) {
                tabelaPedidosRecentes.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Nenhum pedido recente.</td></tr>';
                return;
            }

            tabelaPedidosRecentes.innerHTML = '';
            orders.forEach(order => {
                const statusFaturamentoText = formatStatusText(order.status_faturamento);
                const statusFaturamentoClass = `px-2 py-1 text-xs font-semibold rounded-full badge-${order.status_faturamento || 'nao_pago'}`;

                tabelaPedidosRecentes.innerHTML += `
                    <tr class="border-b border-gray-200 hover:bg-gray-50">
                        <td class="px-4 py-2 text-sm text-gray-900">${String(order.numero_pedido).padStart(5, '0')}</td>
                        <td class="px-4 py-2 text-sm text-gray-900">${order.clientes?.nome || 'N/A'}</td>
                        <td class="px-4 py-2 text-sm text-gray-900">${(order.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td class="px-4 py-2 text-sm"><span class="px-2 py-1 text-xs font-semibold rounded-full badge-${order.status}">${formatStatusText(order.status)}</span></td>
                        <td class="px-4 py-2 text-sm"><span class="${statusFaturamentoClass}">${statusFaturamentoText}</span></td>
                    </tr>`;
            });
        } catch (error) {
            console.error('Error loading recent orders:', error);
            tabelaPedidosRecentes.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Erro ao carregar.</td></tr>`;
        }
    }

    /**
     * Formata o texto de status para exibição.
     * @param {string} status - O status do pedido ou faturamento.
     * @returns {string} - O status formatado.
     */
    function formatStatusText(status) {
        if (!status) return 'N/A';
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Carrega e renderiza o gráfico de faturamento.
     */
    async function loadRevenueChart() {
        const ctx = document.getElementById('graficoFaturamento');
        if (!ctx) return;

        try {
            const months = [];
            const revenueData = [];
            const today = new Date();

            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                months.push(d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }));

                const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
                const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];

                const { data, error } = await supabase
                    .from('pedidos')
                    .select('valor_total')
                    .gte('data_pedido', firstDay)
                    .lte('data_pedido', lastDay)
                    .eq('status', 'concluido')
                    .eq('status_faturamento', 'pago');
                if (error) throw error;
                
                const totalMonthRevenue = data.reduce((sum, order) => sum + (order.valor_total || 0), 0);
                revenueData.push(totalMonthRevenue);
            }

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Faturamento (R$)',
                        data: revenueData,
                        borderColor: '#8B5CF6',
                        backgroundColor: 'rgba(139, 92, 246, 0.2)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `R$ ${context.parsed.y.toFixed(2).replace('.', ',')}`
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Error loading revenue chart:', error);
            ctx.parentElement.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar o gráfico.</p>';
        }
    }

    // --- Inicialização ---
    const { data: { user } } = await supabase.auth.getUser();
    welcomeMessage.textContent = user ? `Bem-vindo de volta, ${user.email.split('@')[0]}!` : `Bem-vindo de volta!`;
    
    // Carrega todos os dados do dashboard
    loadKPIs();
    loadRecentOrders();
    loadRevenueChart();
});