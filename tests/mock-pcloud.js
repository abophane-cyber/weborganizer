// Faux serveur pCloud en mémoire, pour tester la synchronisation sans compte réel.
// Chargé uniquement par tests/sync-test.html (jamais par l'application).
(() => {
  const state = { nextId: 100, folders: { 0: { name: '', parent: null } }, files: {}, calls: [] };
  window.__mock = state;
  localStorage.setItem('wo.pcloud.auth', JSON.stringify({ token: 'TEST', host: 'eapi.pcloud.com' }));

  const meta = id => {
    const f = state.files[id];
    return { fileid: Number(id), name: f.name, isfolder: false, hash: f.hash, size: f.data.size, parentfolderid: f.parent, modified: f.modified };
  };
  const ok = obj => new Response(JSON.stringify({ result: 0, ...obj }), { headers: { 'content-type': 'application/json' } });
  const findFolder = (parent, name) => Object.entries(state.folders).find(([, f]) => f.parent === parent && f.name === name)?.[0];
  const findFile = (parent, name) => Object.entries(state.files).find(([, f]) => f.parent === parent && f.name === name)?.[0];
  function putFile(parent, name, blob) {
    let id = findFile(parent, name);
    if (!id) id = String(state.nextId++);
    state.files[id] = { name, parent, data: blob, hash: Math.floor(Math.random() * 1e12), modified: new Date().toUTCString() };
    return id;
  }
  state.putFile = putFile;
  state.findFile = findFile;
  state.findFolder = findFolder;
  state.authFail = false;
  // Pour imiter le vrai pCloud : lien direct bloqué (CORS) / gettextfile en erreur / fileops en panne.
  state.blockContent = false;
  state.textfileError = false;
  state.fileopsFail = false;
  state.fileopsAuthError = false; // file_open répond « Log in required » (1000)
  state.fds = {};
  state.nextFd = 1;
  state.ways = [];

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url || String(input));
    if (url.hostname === 'mock.content') {
      if (state.blockContent) throw new TypeError('Failed to fetch');
      state.ways.push('link');
      const f = state.files[url.pathname.split('/')[2]];
      return f ? new Response(f.data) : new Response('nope', { status: 404 });
    }
    if (!/^e?api\.pcloud\.com$/.test(url.hostname)) return realFetch(input, init);
    const p = Object.fromEntries(url.searchParams);
    const method = url.pathname.slice(1);
    state.calls.push(method);
    if (state.authFail) return new Response(JSON.stringify({ result: 2094, error: 'Invalid access_token' }));
    switch (method) {
      case 'userinfo': return ok({ email: 'test@example.com' });
      case 'createfolderifnotexists': {
        let parent, name;
        if (p.path) { parent = '0'; name = p.path.replace(/^\//, ''); } else { parent = String(p.folderid); name = p.name; }
        let id = findFolder(parent, name);
        if (!id) { id = String(state.nextId++); state.folders[id] = { name, parent }; }
        return ok({ created: true, metadata: { folderid: Number(id), name, isfolder: true } });
      }
      case 'listfolder': {
        const contents = Object.keys(state.files).filter(id => state.files[id].parent === String(p.folderid)).map(meta);
        return ok({ metadata: { folderid: Number(p.folderid), contents } });
      }
      case 'getfilelink': return ok({ hosts: ['mock.content'], path: `/f/${p.fileid}/file` });
      case 'gettextfile':
        if (state.textfileError) return new Response(JSON.stringify({ result: 2003, error: 'Access denied.' }), { headers: { 'content-type': 'application/json' } });
        state.ways.push('text');
        return new Response(state.files[p.fileid].data);
      case 'file_open': {
        if (state.fileopsAuthError) return new Response(JSON.stringify({ result: 1000, error: 'Log in required.' }), { headers: { 'content-type': 'application/json' } });
        if (state.fileopsFail) return new Response(JSON.stringify({ result: 2003, error: 'Access denied.' }), { headers: { 'content-type': 'application/json' } });
        const fd = state.nextFd++; state.fds[fd] = p.fileid; return ok({ fd, fileid: Number(p.fileid) });
      }
      case 'file_size': return ok({ size: state.files[state.fds[p.fd]].data.size, offset: 0 });
      case 'file_pread': {
        const f = state.files[state.fds[p.fd]];
        if (!f) return new Response(JSON.stringify({ result: 1007, error: 'Invalid or closed file descriptor.' }), { headers: { 'content-type': 'application/json' } });
        state.ways.push('fileops');
        const start = Number(p.offset), end = start + Number(p.count);
        return new Response(f.data.slice(start, end), { headers: { 'content-type': 'application/octet-stream' } });
      }
      case 'file_close': delete state.fds[p.fd]; return ok({});
      case 'copyfile': {
        const src = state.files[p.fileid];
        const id = putFile(String(p.tofolderid), p.toname, src.data);
        return ok({ metadata: meta(id) });
      }
      case 'deletefile': delete state.files[p.fileid]; return ok({ metadata: { isdeleted: true } });
      default: return new Response(JSON.stringify({ result: 2000, error: 'unknown ' + method }));
    }
  };

  class FakeXHR {
    constructor() { this.upload = {}; this.status = 0; this.response = null; }
    open(m, url) { this.url = new URL(url); }
    send(form) {
      const p = Object.fromEntries(this.url.searchParams);
      state.calls.push('uploadfile');
      const file = form.get('file');
      setTimeout(() => {
        this.upload.onprogress?.({ lengthComputable: true, loaded: file.size / 2, total: file.size });
        if (state.authFail) { this.status = 200; this.response = { result: 2094, error: 'Invalid' }; return this.onload(); }
        const id = putFile(String(p.folderid), p.filename, file);
        this.status = 200;
        this.response = { result: 0, fileids: [Number(id)], metadata: [meta(id)] };
        this.onload();
      }, 20);
    }
  }
  window.XMLHttpRequest = FakeXHR;
})();
