// Quick database connection test
// Run with: npx tsx src/test-db.ts

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('Testing Supabase connection...\n');

  // Test 1: Fetch sectors
  const { data: sectors, error: sectorsError } = await supabase
    .from('sectors')
    .select('*');

  if (sectorsError) {
    console.error('❌ Error fetching sectors:', sectorsError.message);
    return;
  }

  console.log('✅ Sectors loaded:', sectors?.length, 'sectors');
  console.log('   ', sectors?.map((s) => s.name).join(', '));

  // Test 2: Try to insert a test stock
  const { data: stock, error: stockError } = await supabase
    .from('stocks')
    .insert({
      ticker: 'TEST',
      name: 'Test Stock',
      currency: 'USD',
    })
    .select()
    .single();

  if (stockError) {
    console.error('❌ Error inserting stock:', stockError.message);
  } else {
    console.log('\n✅ Test stock created:', stock.ticker);

    // Clean up - delete test stock
    await supabase.from('stocks').delete().eq('id', stock.id);
    console.log('✅ Test stock deleted');
  }

  console.log('\n🎉 Database connection successful!');
}

testConnection();
