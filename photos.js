// Fotos tomadas en la experiencia AR: se guardan dentro de la app (IndexedDB,
// en el propio navegador del teléfono) y se ven en Galería → Fotos AR. Desde
// ahí cada foto se puede descargar/compartir o borrar.
// Si el navegador no tiene IndexedDB (p. ej. modo privado), las fotos de la
// sesión se guardan solo en memoria y se pierden al cerrar la app.

const ArPhotos = (() => {
  const DB_NAME = "basehub-fotos";
  const STORE = "fotos";
  let dbPromise = null;
  let memory = [];      // respaldo cuando no hay IndexedDB
  let useMemory = false;

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) { reject(new Error("sin IndexedDB")); return; }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }).catch((err) => { useMemory = true; throw err; });
    }
    return dbPromise;
  }

  function tx(mode, fn) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const result = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(result.result !== undefined ? result.result : result);
      t.onerror = () => reject(t.error);
    }));
  }

  // photo: { blob, teamId, teamName, name } → devuelve el id asignado.
  function add(photo) {
    const rec = { ...photo, date: Date.now() };
    return tx("readwrite", (s) => s.add(rec)).catch(() => {
      rec.id = memory.length ? memory[memory.length - 1].id + 1 : 1;
      memory.push(rec);
      return rec.id;
    });
  }

  // Todas las fotos, la más reciente primero.
  function list() {
    if (useMemory) return Promise.resolve(memory.slice().reverse());
    return tx("readonly", (s) => s.getAll())
      .then((all) => all.sort((a, b) => b.date - a.date))
      .catch(() => memory.slice().reverse());
  }

  function remove(id) {
    memory = memory.filter((p) => p.id !== id);
    if (useMemory) return Promise.resolve();
    return tx("readwrite", (s) => s.delete(id)).catch(() => {});
  }

  // En iPhone/iPad una descarga va a la app Archivos; con la hoja de
  // compartir se puede elegir "Guardar imagen" y queda en Fotos. En los
  // demás teléfonos se descarga directo.
  function exportPhoto(blob, name) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const file = new File([blob], name, { type: "image/jpeg" });
    if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "Base-Hub AR" })
        .then(() => toast("Foto guardada en el teléfono 📸"))
        .catch((err) => { if (err.name !== "AbortError") download(blob, name); });
      return;
    }
    download(blob, name);
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast("Foto descargada 📸");
  }

  return { add, list, remove, exportPhoto };
})();
