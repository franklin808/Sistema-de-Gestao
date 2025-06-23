document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) {
        console.error("Supabase client not found.");
        document.getElementById('kpi-faturamento').textContent = 'Erro';
        document.getElementById('kpi-pedidos-aberto').textContent = 'Erro';
        document.getElementById('kpi-pedidos-concluidos').textContent = 'Erro';
        document.getElementById('kpi-estoque-baixo').textContent = 'Erro';
        return;
    }
    const kpiFaturamento = document.getElementById('kpi-faturamento');
    const kpiPedidosAberto = document.getElementById('kpi-pedidos-aberto');
    const kpiPedidosConcluidos = document.getElementById('kpi-pedidos-concluidos');
    const kpiEstoqueBaixo = document.getElementById('kpi-estoque-baixo');
    const welcomeMessage = document.getElementById('welcomeMessage');

    async function loadKPIs() {
        const today = new Date();
        const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
        const currentYear = today.getFullYear().toString();
        const firstDayOfMonth = `${currentYear}-${currentMonth}-01`;
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        try {
            const { data, error } = await window.supabase
                .from('pedidos')
                .select('valor_total')
                .gte('data_pedido', firstDayOfMonth)
                .lte('data_pedido', lastDayOfMonth)
                .eq('status', 'concluido');

            if (error) throw error;

            const totalFaturamento = data.reduce((sum, order) => sum + parseFloat(order.valor_total || 0), 0);
            kpiFaturamento.textContent = `R$ ${totalFaturamento.toFixed(2).replace('.', ',')}`;
        } catch (error) {
            console.error('Error fetching Faturamento do Mês:', error);
            kpiFaturamento.textContent = 'Erro';
        }

        try {
            const { count, error } = await window.supabase
                .from('pedidos')
                .select('id', { count: 'exact' })
                .eq('status', 'em_aberto');

            if (error) throw error;
            kpiPedidosAberto.textContent = count;
        } catch (error) {
            console.error('Error fetching Pedidos em Aberto:', error);
            kpiPedidosAberto.textContent = 'Erro';
        }

        try {
            const { count, error } = await window.supabase
                .from('pedidos')
                .select('id', { count: 'exact' })
                .gte('data_pedido', firstDayOfMonth)
                .lte('data_pedido', lastDayOfMonth)
                .eq('status', 'concluido');

            if (error) throw error;
            kpiPedidosConcluidos.textContent = count;
        } catch (error) {
            console.error('Error fetching Pedidos Concluídos no Mês:', error);
            kpiPedidosConcluidos.textContent = 'Erro';
        }

        try {
            const { data: stockItems, error } = await window.supabase
                .from('itens_estoque')
                .select('quantidade_atual, nivel_minimo');

            if (error) throw error;

            const lowStockCount = stockItems.filter(item => {
                const current = parseFloat(item.quantidade_atual);
                const min = parseFloat(item.nivel_minimo);
                return current < min;
            }).length;

            kpiEstoqueBaixo.textContent = lowStockCount;
        } catch (error) {
            console.error('Error fetching Itens em Estoque Baixo:', error);
            kpiEstoqueBaixo.textContent = 'Erro';
        }
    }

    async function loadRecentOrders() {
        const tabelaPedidosRecentes = document.getElementById('tabela-pedidos-recentes');
        if (!tabelaPedidosRecentes) return;

        tabelaPedidosRecentes.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Carregando últimos pedidos...</td></tr>';

        try {
            const { data: orders, error } = await window.supabase
                .from('pedidos')
                .select(`
                    id,
                    numero_pedido,
                    data_pedido,
                    valor_total,
                    status,
                    clientes (nome)
                `)
                .order('data_pedido', { ascending: false })
                .limit(5);

            if (error) throw error;

            if (orders.length === 0) {
                tabelaPedidosRecentes.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Nenhum pedido recente encontrado.</td></tr>';
                return;
            }

            tabelaPedidosRecentes.innerHTML = '';
            orders.forEach(order => {
                const clientName = order.clientes ? order.clientes.nome : 'N/A';
                const orderDate = new Date(order.data_pedido).toLocaleDateString('pt-BR');
                const totalValue = `R$ ${parseFloat(order.valor_total || 0).toFixed(2).replace('.', ',')}`;
                const statusText = formatStatusText(order.status);
                const statusClass = `px-2 py-1 text-xs font-semibold rounded-full badge-${order.status}`;

                tabelaPedidosRecentes.innerHTML += `
                    <tr class="border-b border-gray-200 hover:bg-gray-50">
                        <td class="px-4 py-2 text-sm text-gray-900">${String(order.numero_pedido).padStart(5, '0')}</td>
                        <td class="px-4 py-2 text-sm text-gray-900">${clientName}</td>
                        <td class="px-4 py-2 text-sm text-gray-900">${totalValue}</td>
                        <td class="px-4 py-2 text-sm text-gray-900">
                            <span class="${statusClass}">${statusText}</span>
                        </td>
                    </tr>
                `;
            });

        } catch (error) {
            console.error('Error loading recent orders:', error);
            tabelaPedidosRecentes.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Erro ao carregar pedidos.</td></tr>`;
        }
    }

    function formatStatusText(status) {
        switch (status) {
            case 'em_aberto': return 'Em Aberto';
            case 'em_producao': return 'Em Produção';
            case 'concluido': return 'Concluído';
            case 'cancelado': return 'Cancelado';
            default: return status;
        }
    }

    async function loadRevenueChart() {
        const ctx = document.getElementById('graficoFaturamento');
        if (!ctx) return;

        try {
            const months = [];
            const revenueData = [];
            const today = new Date();

            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const monthName = d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
                months.push(monthName);

                const firstDayOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
                const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];

                const { data: monthlyOrders, error } = await window.supabase
                    .from('pedidos')
                    .select('valor_total')
                    .gte('data_pedido', firstDayOfMonth)
                    .lte('data_pedido', lastDayOfMonth)
                    .eq('status', 'concluido');

                if (error) throw error;
                const totalMonthRevenue = monthlyOrders.reduce((sum, order) => sum + parseFloat(order.valor_total || 0), 0);
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
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Valor (R$)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Mês'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `R$ ${context.parsed.y.toFixed(2).replace('.', ',')}`;
                                }
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Error loading revenue chart:', error);
            const chartContainer = ctx.parentElement;
            chartContainer.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar o gráfico de faturamento.</p>';
        }
    }
    const { data: { user } } = await window.supabase.auth.getUser();
    if (user) {
        welcomeMessage.textContent = `Bem-vindo de volta, ${user.email}!`;
    } else {
        welcomeMessage.textContent = `Bem-vindo de volta!`;
    }

    loadKPIs();
    loadRecentOrders();
    loadRevenueChart();
});
