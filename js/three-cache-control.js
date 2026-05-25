const THREE_CACHE_KEYS = [
    'use3D',
    'forceRender3D',
    'forceRender2D',
    'medgame_3d_cache',
    'medgame_immersive_cache',
    'medgame3d',
    'three_scene_state',
    'immersiveMode',
    'immersive_mode'
];

function deleteCookie(name) {
    const encodedName = encodeURIComponent(name);
    document.cookie = `${encodedName}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${encodedName}=; Max-Age=0; path=/game.html; SameSite=Lax`;
    document.cookie = `${encodedName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function disableImmersivePersistence() {
    THREE_CACHE_KEYS.forEach((key) => {
        deleteCookie(key);
        try { localStorage.removeItem(key); } catch {}
        try { sessionStorage.removeItem(key); } catch {}
    });

    try {
        document.cookie
            .split(';')
            .map((cookie) => cookie.split('=')[0].trim())
            .filter((name) => /three|3d|immers|webgl|scene/i.test(name))
            .forEach(deleteCookie);
    } catch {}

    if ('caches' in window) {
        caches.keys()
            .then((names) => names
                .filter((name) => /three|3d|immersive|medgame/i.test(name))
                .forEach((name) => caches.delete(name)))
            .catch(() => {});
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
            .then((registrations) => registrations.forEach((registration) => registration.unregister()))
            .catch(() => {});
    }
}

function preventImmersiveStorageWrites(storage) {
    if (!storage || storage.__medgame3dNoStore) return;
    const originalSetItem = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
        if (/three|3d|immers|webgl|scene/i.test(String(key))) return;
        originalSetItem(key, value);
    };
    Object.defineProperty(storage, '__medgame3dNoStore', { value: true });
}

try { preventImmersiveStorageWrites(localStorage); } catch {}
try { preventImmersiveStorageWrites(sessionStorage); } catch {}

document.querySelectorAll('script[type="module"][src*="three-"], link[href*="immersive.css"]').forEach((node) => {
    node.setAttribute('data-cache-policy', 'no-store');
});

disableImmersivePersistence();
