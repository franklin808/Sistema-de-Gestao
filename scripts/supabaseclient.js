const SUPABASE_URL = 'https://jlhzbpbazlvxobqfmhci.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsaHpicGJhemx2eG9icWZtaGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNjAyMTgsImV4cCI6MjA2MjczNjIxOH0.kNjhJHtPZRw0-TBaFLe8pXlnDEHEgJuqzH3OdiZrrRk';
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);