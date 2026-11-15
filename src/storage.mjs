// Each mode owns its key. Keep the exact bytes last read or written so an
// older tab cannot silently overwrite a newer position.
export function storageSlot(key) {
  let saved;

  function read() {
    saved = localStorage.getItem(key);
    return saved;
  }

  function watch(reportChange) {
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return;
      try {
        // Read current storage. A queued event may describe an earlier write.
        reportChange(localStorage.getItem(key) !== (saved ?? null));
      } catch {
        // The next action will retry the read before writing.
      }
    });
  }

  async function write(contents, {replace = false} = {}) {
    function compareAndWrite() {
      try {
        const current = localStorage.getItem(key);
        // Explicit setup can recover a slot that could not be read at all.
        // If we read the slot, even setup must respect a later tab's write.
        if (current !== (saved ?? null) && !(replace && saved === undefined)) return 'conflict';
        if (contents === null) return 'protected';
        localStorage.setItem(key, contents);
        saved = contents;
        return 'saved';
      } catch {
        return 'unavailable';
      }
    }

    // Serialize the check and write across tabs where Web Locks is available.
    if (navigator.locks) {
      try {
        return await navigator.locks.request(key, compareAndWrite);
      } catch (error) {
        if (error.name !== 'SecurityError' && error.name !== 'NotSupportedError') return 'unavailable';
      }
    }
    return compareAndWrite();
  }

  return {read, watch, write};
}

export function downloadJson(contents, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([contents], {type:'application/json'}));
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
