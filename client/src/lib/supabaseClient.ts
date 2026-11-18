import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nipsnpttesinenogregd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ukXEYcsr9sxFIbJxCexJUQ_sFKi8oqO';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export async function syncLedgerToSupabase(userId: string, ledgerState: any) {
  try {
    const { data, error } = await supabase
      .from('user_ledgers')
      .upsert({
        user_id: userId,
        data: ledgerState,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.warn('[Ledgerwise Supabase] Cloud sync skipped/offline:', err.message);
    return { success: false, error: err.message };
  }
}
