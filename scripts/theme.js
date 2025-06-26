// /scripts/theme.js
document.addEventListener('DOMContentLoaded', () => {
    // Seleciona todos os botões que têm o atributo 'data-theme'
    const themeButtons = document.querySelectorAll('[data-theme]');
    const body = document.body;

    /**
     * Aplica o tema ao body, atualiza o botão ativo e salva no localStorage.
     * @param {string} theme - O nome do tema a ser aplicado (ex: 'light', 'gray', 'dark').
     */
    const applyTheme = (theme) => {
        // Remove a classe de tema anterior e adiciona a nova.
        // O nome da classe no body será 'theme-light', 'theme-gray', etc.
        body.className = `theme-${theme}`;
        
        // Salva o tema escolhido no localStorage para persistir a escolha.
        localStorage.setItem('selectedTheme', theme);

        // Atualiza a aparência do botão ativo.
        themeButtons.forEach(btn => {
            if (btn.dataset.theme === theme) {
                btn.classList.add('active', 'border-2', 'border-purple-500');
            } else {
                btn.classList.remove('active', 'border-2', 'border-purple-500');
            }
        });
    };

    // Adiciona um evento de clique a cada botão de tema.
    themeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const theme = e.currentTarget.dataset.theme;
            if (theme) {
                applyTheme(theme);
            }
        });
    });

    // Ao carregar a página, verifica se há um tema salvo no localStorage.
    // Se não houver, usa 'light' como padrão.
    const savedTheme = localStorage.getItem('selectedTheme') || 'light';
    applyTheme(savedTheme);
});
