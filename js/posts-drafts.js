(() => {
  'use strict';
  let database;
  function openDatabase() {
    if (!database) {
      database = new Promise((resolve, reject) => {
        const request = indexedDB.open('portfolio-post-drafts', 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('drafts', { keyPath: 'metadata.id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(new Error('초안 저장소를 열 수 없습니다. 초안을 파일로 내려받아 주세요.'));
      });
    }
    return database;
  }
  async function transact(mode, action) {
    const connection = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = connection.transaction('drafts', mode);
      const request = action(transaction.objectStore('drafts'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () =>
        reject(
          new Error(
            '초안을 보관하지 못했습니다. 브라우저 저장 공간을 확인하거나 초안을 내려받아 주세요.',
          ),
        );
      transaction.onabort = transaction.onerror;
    });
  }
  window.PostsDrafts = {
    list: () => transact('readonly', (store) => store.getAll()),
    put: (draft) => transact('readwrite', (store) => store.put(draft)),
    remove: (id) => transact('readwrite', (store) => store.delete(id)),
  };
})();
