// Faux dossier en mémoire, qui imite l'accès aux fichiers de Chrome
// (FileSystemDirectoryHandle). Chargé uniquement par les pages de tests.
(() => {
  const state = { permission: 'granted', writes: [], clock: Date.now(), denyWrites: false };
  window.__mock = state;

  class FakeFileHandle {
    constructor(name) { this.name = name; this.kind = 'file'; this.file = new File([], name, { lastModified: ++state.clock }); }
    async getFile() { return this.file; }
    async createWritable() {
      if (state.denyWrites) throw new DOMException('Accès refusé', 'NotAllowedError');
      const parts = [];
      return {
        write: async d => { parts.push(d); },
        close: async () => { state.writes.push(this.name); this.file = new File(parts, this.name, { lastModified: ++state.clock }); },
      };
    }
  }

  class FakeDir {
    constructor(name) { this.name = name; this.kind = 'directory'; this.children = new Map(); }
    async getFileHandle(name, { create = false } = {}) {
      let e = this.children.get(name);
      if (!e) {
        if (!create) throw new DOMException('Introuvable', 'NotFoundError');
        e = new FakeFileHandle(name);
        this.children.set(name, e);
      }
      if (e.kind !== 'file') throw new DOMException('Pas un fichier', 'TypeMismatchError');
      return e;
    }
    async getDirectoryHandle(name, { create = false } = {}) {
      let e = this.children.get(name);
      if (!e) {
        if (!create) throw new DOMException('Introuvable', 'NotFoundError');
        e = new FakeDir(name);
        this.children.set(name, e);
      }
      return e;
    }
    async removeEntry(name) { this.children.delete(name); }
    async *entries() { for (const entry of this.children) yield entry; }
    async queryPermission() { return state.permission; }
    async requestPermission() { return state.permission; }
  }

  const root = new FakeDir('WebOrganizer');
  window.__woTestDir = root;

  // Aides pour les tests : chemins du type 'config.json' ou 'media/nom'.
  const locate = path => {
    const parts = path.split('/');
    let d = root;
    for (const p of parts.slice(0, -1)) { d = d.children.get(p); if (!d) return [null, parts.at(-1)]; }
    return [d, parts.at(-1)];
  };
  state.put = (path, data) => {
    const parts = path.split('/');
    let d = root;
    for (const p of parts.slice(0, -1)) {
      if (!d.children.has(p)) d.children.set(p, new FakeDir(p));
      d = d.children.get(p);
    }
    const fh = new FakeFileHandle(parts.at(-1));
    fh.file = new File([data], parts.at(-1), { lastModified: ++state.clock });
    d.children.set(parts.at(-1), fh);
  };
  state.has = path => { const [d, n] = locate(path); return !!d && d.children.get(n)?.kind === 'file'; };
  state.read = async path => { const [d, n] = locate(path); const f = d?.children.get(n); return f ? f.file.text() : null; };
  state.names = dirName => [...(root.children.get(dirName)?.children.keys() || [])];
})();
