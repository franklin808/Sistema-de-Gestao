async function checkAuth() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase client is not available. Make sure supabaseClient.js is loaded correctly.');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {

        const emailToNameMap = {
            'franklingaio@yahoo.com.br': 'Franklin',
            'contato@epletiquetas.com.br': 'EPL',
            'epl.pauloricardo@gmail.com': 'Paulo'
        };
        const userEmail = session.user.email;
        const displayName = emailToNameMap[userEmail] || userEmail;
        welcomeMessage.textContent = `Bem-vindo, ${displayName}!`;
    }
}
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (typeof supabase === 'undefined') {
                console.error('Supabase client is not available for logout.');
                alert('Erro crítico. Não foi possível comunicar com o serviço de autenticação.');
                return;
            }

            const { error } = await supabase.auth.signOut();

            if (!error) {
                window.location.href = '/admin/';
            } else {
                console.error('Logout error:', error);
                alert('Erro ao fazer logout. Tente novamente.');
            }
        });
    }
}
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupLogoutButton();
});