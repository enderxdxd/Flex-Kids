// Script de teste para verificar IndexedDB
// Cole este código no console do navegador (F12) para testar

export async function testIndexedDB() {
  console.log('🧪 Testing IndexedDB...');
  
  try {
    // 1. Verificar se IndexedDB existe
    if (!window.indexedDB) {
      console.error('❌ IndexedDB not supported');
      return;
    }
    console.log('✅ IndexedDB is supported');

    // 2. Abrir banco de dados
    const dbName = 'flex-kids-db';
    const request = indexedDB.open(dbName);
    
    request.onsuccess = (event: any) => {
      const db = event.target.result;
      console.log('✅ Database opened:', db.name, 'Version:', db.version);
      
      // 3. Listar object stores
      const storeNames = Array.from(db.objectStoreNames);
      console.log('📦 Object Stores:', storeNames);
      
      // 4. Verificar dados em cada store
      storeNames.forEach((storeName: string) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const countRequest = store.count();
        
        countRequest.onsuccess = () => {
          console.log(`  📊 ${storeName}: ${countRequest.result} items`);
          
          // Mostrar alguns itens
          if (countRequest.result > 0) {
            const getAllRequest = store.getAll();
            getAllRequest.onsuccess = () => {
              console.log(`    📄 Sample data:`, getAllRequest.result.slice(0, 3));
            };
          }
        };
      });
      
      db.close();
    };
    
    request.onerror = () => {
      console.error('❌ Error opening database:', request.error);
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Para testar, cole no console:
// testIndexedDB()
