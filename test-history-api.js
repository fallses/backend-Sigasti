/**
 * Quick test untuk endpoint history
 * Usage: node test-history-api.js
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function testHistoryAPI() {
  console.log('🧪 Testing GET /sterilisasi/history\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);
  
  try {
    const response = await fetch(`${BACKEND_URL}/sterilisasi/history`);
    const result = await response.json();
    
    if (result.status === 'success' && result.data) {
      console.log(`✅ Success! Found ${result.data.length} entries\n`);
      
      // Tampilkan 5 entry pertama
      console.log('═══════════════════════════════════════════════════════\n');
      result.data.slice(0, 5).forEach((item, index) => {
        console.log(`${index + 1}. Entry ID: ${item._id}`);
        console.log(`   Device: ${item.device}`);
        console.log(`   Batch ID: ${item.batch_id ? '✅ ' + item.batch_id : '❌ NULL'}`);
        console.log(`   Suhu: ${item.suhu}°C`);
        console.log(`   Tekanan: ${item.tekanan} bar`);
        console.log(`   Waktu: ${item.waktu}`);
        console.log(`   Created: ${new Date(item.createdAt).toLocaleString()}`);
        console.log('');
      });
      console.log('═══════════════════════════════════════════════════════\n');
      
      // Statistik
      const withBatchId = result.data.filter(item => item.batch_id);
      const withoutBatchId = result.data.filter(item => !item.batch_id);
      
      console.log('📊 Statistics:');
      console.log(`   Total entries: ${result.data.length}`);
      console.log(`   With batch_id: ${withBatchId.length} ✅`);
      console.log(`   Without batch_id: ${withoutBatchId.length} ⚠️`);
      console.log('');
      
      // Test endpoint batch untuk yang ada batch_id
      if (withBatchId.length > 0) {
        const testBatchId = withBatchId[0].batch_id;
        console.log(`\n🔍 Testing /sterilisasi/running/batch/${testBatchId}\n`);
        
        const batchResponse = await fetch(`${BACKEND_URL}/sterilisasi/running/batch/${testBatchId}`);
        const batchResult = await batchResponse.json();
        
        if (batchResult.status === 'success') {
          console.log(`✅ Found ${batchResult.count} running data points`);
          
          if (batchResult.data && batchResult.data.length > 0) {
            console.log('\nSample data (first 3):');
            batchResult.data.slice(0, 3).forEach((item, index) => {
              console.log(`\n${index + 1}. Timer: ${item.timer}`);
              console.log(`   Suhu: ${item.suhu ?? 'null'}°C`);
              console.log(`   Tekanan: ${item.tekanan ?? 'null'} bar`);
            });
            
            // Data untuk grafik
            const suhuData = batchResult.data.map(d => d.suhu ?? 0);
            const tekananData = batchResult.data.map(d => d.tekanan ?? 0);
            
            console.log(`\n📊 Grafik Data:`);
            console.log(`   Suhu points: ${suhuData.length}`);
            console.log(`   Suhu range: ${Math.min(...suhuData)} - ${Math.max(...suhuData)}°C`);
            console.log(`   Tekanan points: ${tekananData.length}`);
            console.log(`   Tekanan range: ${Math.min(...tekananData)} - ${Math.max(...tekananData)} bar`);
          }
        } else {
          console.log('❌ Failed to get running data:', batchResult);
        }
      } else {
        console.log('⚠️ No entries with batch_id found for testing');
      }
      
    } else {
      console.log('❌ API returned error:', result);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run
testHistoryAPI();
