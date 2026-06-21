/**
 * Script untuk test endpoint batch_id
 * 
 * Usage: node test-batch-id.js
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function testHistoryEndpoint() {
  console.log('\n=== Test GET /sterilisasi/history ===\n');
  
  try {
    const response = await fetch(`${BACKEND_URL}/sterilisasi/history`);
    const data = await response.json();
    
    if (data.status === 'success') {
      console.log(`✅ Success! Found ${data.data.length} history entries\n`);
      
      // Tampilkan 3 entry pertama dengan batch_id
      console.log('Sample data (first 3):');
      data.data.slice(0, 3).forEach((item, index) => {
        console.log(`\n${index + 1}. ID: ${item._id}`);
        console.log(`   Device: ${item.device}`);
        console.log(`   Batch ID: ${item.batch_id || '❌ NULL'}`);
        console.log(`   Suhu: ${item.suhu}°C`);
        console.log(`   Tekanan: ${item.tekanan} bar`);
        console.log(`   Created: ${item.createdAt}`);
      });
      
      // Cek berapa yang punya batch_id
      const withBatchId = data.data.filter(item => item.batch_id);
      const withoutBatchId = data.data.filter(item => !item.batch_id);
      
      console.log(`\n📊 Statistics:`);
      console.log(`   Total entries: ${data.data.length}`);
      console.log(`   With batch_id: ${withBatchId.length} ✅`);
      console.log(`   Without batch_id: ${withoutBatchId.length} ⚠️`);
      
      return withBatchId.length > 0 ? withBatchId[0].batch_id : null;
    } else {
      console.log('❌ Failed:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function testRunningBatchEndpoint(batchId) {
  if (!batchId) {
    console.log('\n⚠️ Skipping running/batch test - no batch_id available\n');
    return;
  }
  
  console.log(`\n=== Test GET /sterilisasi/running/batch/${batchId} ===\n`);
  
  try {
    const response = await fetch(`${BACKEND_URL}/sterilisasi/running/batch/${batchId}`);
    const data = await response.json();
    
    if (data.status === 'success') {
      console.log(`✅ Success! Found ${data.count} running data points\n`);
      
      if (data.data && data.data.length > 0) {
        console.log('Sample data (first 5):');
        data.data.slice(0, 5).forEach((item, index) => {
          console.log(`\n${index + 1}. Action: ${item.action}`);
          console.log(`   Suhu: ${item.suhu ?? 'null'}°C`);
          console.log(`   Tekanan: ${item.tekanan ?? 'null'} bar`);
          console.log(`   Timer: ${item.timer ?? 'null'}`);
          console.log(`   Created: ${item.createdAt}`);
        });
        
        // Statistik data
        const suhuData = data.data.map(item => item.suhu ?? 0);
        const tekananData = data.data.map(item => item.tekanan ?? 0);
        
        console.log(`\n📊 Data Statistics:`);
        console.log(`   Total points: ${data.data.length}`);
        console.log(`   Suhu range: ${Math.min(...suhuData)} - ${Math.max(...suhuData)}°C`);
        console.log(`   Tekanan range: ${Math.min(...tekananData)} - ${Math.max(...tekananData)} bar`);
        console.log(`   First timer: ${data.data[0].timer}`);
        console.log(`   Last timer: ${data.data[data.data.length - 1].timer}`);
      } else {
        console.log('⚠️ No data found for this batch_id');
      }
    } else {
      console.log('❌ Failed:', data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Main execution
(async () => {
  console.log('🧪 Testing batch_id endpoints...\n');
  console.log(`Backend URL: ${BACKEND_URL}\n`);
  
  const batchId = await testHistoryEndpoint();
  await testRunningBatchEndpoint(batchId);
  
  console.log('\n✅ Test complete!\n');
})();
