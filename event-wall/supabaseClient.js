// Supabase Configuration
// Important: Replace these with your actual Supabase project URL and anon key.
// Never expose the service_role key here.
const SUPABASE_URL = 'https://tfracdcjjhtlfizwhbct.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jbeiXniO_5_faqcs02w2Cg_eR7mdn4j';

// Initialize the Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
