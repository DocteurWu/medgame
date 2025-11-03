async function loadCases() {
    const response = await fetch('data/case-index.json');
    if (!response.ok) {
        throw new Error(`Erreur lors du chargement des cas: ${response.status}`);
    }
    return await response.json();
}
