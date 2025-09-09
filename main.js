// Get a list of Pokemon 
async function fetchPokemonList(limit = 1025) {
    const container = document.getElementById("pokemon-selection");
    container.innerHTML = "<h2>Choose a Pokemon</h2><div id='poke-list' class='poke-list'></div>";
    
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}`);
    const data = await response.json();
    const list = document.getElementById("poke-list");

    for (const pokemon of data.results) {
        const pokeDetails = await fetch(pokemon.url).then(res => res.json());
        const card = document.createElement("div");
        card.className = "poke-card";
        card.innerHTML = `
            <img src="${pokeDetails.sprites.front_default}" alt="${pokemon.name}" class="poke-sprite">
            <div class="poke-name">${pokemon.name}</div>
        `;
        card.onclick = () => alert(`You selected ${pokemon.name}!`);
        list.appendChild(card);
    }
}

// Get details for a specific Pokemon by name
async function fetchPokemonDetails(name) {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
    const data = await response.json();
    return {
        name: data.name,
        types: data.types.map(t => t.type.name),
        stats: data.stats.map(s => ({ name: s.stat.name, value: s.base_stat})),
        sprite: data.sprites.front_default,
        moves: data.moves.map(m => m.move.name)
    };
}

// Display Pokemon details in the UI
window.onload = () => {
    fetchPokemonList(1025);
}
