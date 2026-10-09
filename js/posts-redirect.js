(() => {
  'use strict';
  const id = new URLSearchParams(location.search).get('id');
  location.replace(id && /^\d+$/.test(id) ? '../posts/view.html?id=legacy-' + id : '../posts/');
})();
