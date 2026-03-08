/**
 * MedGame Arena - Client Logic (Index Page)
 * Handles the floating bubble, fetching active events, and real-time updates.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Wait for Supabase to initialize
    setTimeout(initArenaClient, 500);
});

let activeArenaEvent = null;
let arenaTimerInterval = null;
let arenaChannel = null;

async function initArenaClient() {
    if (typeof supabase === 'undefined') return;

    await fetchActiveEvent();
    subscribeToArenaEvents();
}

async function fetchActiveEvent() {
    const { data: events, error } = await supabase
        .from('arena_events')
        .select('*')
        .neq('status', 'finished')
        .order('created_at', { ascending: false })
        .limit(1);

    if (!error && events && events.length > 0) {
        activeArenaEvent = events[0];
        updateBubbleUI();
    } else {
        activeArenaEvent = null;
        updateBubbleUI();
    }
}

function updateBubbleUI() {
    const bubble = document.getElementById('arena-bubble');
    const titleEl = document.getElementById('arena-bubble-title');
    const statusEl = document.getElementById('arena-bubble-status');

    if (!bubble || !titleEl || !statusEl) return;

    if (!activeArenaEvent) {
        bubble.classList.remove('visible', 'live');
        if (arenaTimerInterval) clearInterval(arenaTimerInterval);
        return;
    }

    bubble.classList.add('visible');
    titleEl.innerText = activeArenaEvent.title || "ÉVÉNEMENT ARENA";

    if (activeArenaEvent.status === 'waiting') {
        bubble.classList.remove('live');
        startCountdown();
    } else {
        // Event is Live
        if (arenaTimerInterval) clearInterval(arenaTimerInterval);
        bubble.classList.add('live');
        statusEl.innerHTML = `<i class="fas fa-satellite-dish"></i> EN DIRECT ! REJOINDRE`;
    }
}

function startCountdown() {
    if (arenaTimerInterval) clearInterval(arenaTimerInterval);

    const targetDate = new Date(activeArenaEvent.scheduled_at).getTime();

    const updateTime = () => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        const statusEl = document.getElementById('arena-bubble-status');
        if (!statusEl) return;

        if (distance < 0) {
            statusEl.innerHTML = "En attente du lancement...";
            clearInterval(arenaTimerInterval);
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        let timeStr = "";
        if (days > 0) timeStr += `J-${days} `;
        timeStr += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        statusEl.innerHTML = `<i class="fas fa-hourglass-start"></i> ${timeStr}`;
    };

    updateTime();
    arenaTimerInterval = setInterval(updateTime, 1000);
}

function subscribeToArenaEvents() {
    if (arenaChannel) supabase.removeChannel(arenaChannel);

    arenaChannel = supabase.channel('client_arena_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'arena_events' }, payload => {
            // New event created or updated
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                if (payload.new.status === 'finished') {
                    if (activeArenaEvent && activeArenaEvent.id === payload.new.id) {
                        activeArenaEvent = null;
                    }
                } else {
                    activeArenaEvent = payload.new;
                }
            } else if (payload.eventType === 'DELETE') {
                if (activeArenaEvent && activeArenaEvent.id === payload.old.id) {
                    activeArenaEvent = null;
                }
            }
            updateBubbleUI();
        })
        .subscribe();
}

async function joinArena(e) {
    if (e) e.preventDefault();
    if (!activeArenaEvent) return;

    // Must be logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert("Vous devez être connecté pour participer à l'événement Arena !");
        window.location.href = "login.html";
        return;
    }

    // Redirect to arena player interface
    window.location.href = `arena_play.html?id=${activeArenaEvent.id}`;
}
