export function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function pulseEmissive(mesh, intensity = 1.2, duration = 900) {
    if (!mesh || !mesh.material || !('emissiveIntensity' in mesh.material)) return;
    const start = performance.now();
    const base = mesh.material.emissiveIntensity || 0;
    function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        mesh.material.emissiveIntensity = base + Math.sin(t * Math.PI) * intensity;
        if (t < 1) requestAnimationFrame(frame);
        else mesh.material.emissiveIntensity = base;
    }
    requestAnimationFrame(frame);
}

export function idleBreathing(group, elapsed) {
    if (!group) return;
    group.position.y = Math.sin(elapsed * 1.6) * 0.015;
}

