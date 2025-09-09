const regionGenMap = {
    "Kanto": 1,
    "Johto": 2,
    "Hoenn": 3,
    "Sinnoh": 4,
    "Unova": 5,
    "Kalos": 6,
    "Alola": 7,
    "Galar": 8,
    "Paldea": 9
};

const genLimits = [151, 251, 386, 493, 649, 721, 809, 905, 1025];
const gymPokemonLimit = [2,2,3,4,4,5,5,6];

document.getElementById("setup-confirm").onclick = async function() {
    const region = document.getElementById("region-select").value;
    const type = document.getElementById("type-select").value;
    const gymNumber = parseInt(document.getElementById("gym-number-select").value, 10);

    const maxGen = regionGenMap[region];
    const maxPokemon = gymPokemonLimit[gymNumber - 1];

    // Get and filter Pokemon
    const pokemonList = await getFilteredPokemon(maxGen, type);
    // Display selection UI
    displayPokemonSelection(pokemonList, maxPokemon);
};

// Get Pokemon up to maxGen and filter by type
async function getFilteredPokemon(maxGen, type) {
    const limit = genLimits[maxGen - 1];
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}`);
    const data = await response.json();

    const filtered = [];
    for (const p of data.results) {
        const details = await fetch(p.url).then(res => res.json());
        if (details.types.some(t => t.type.name === type)) {
            filtered.push(details);
        }
    }
    return filtered;
}

// Display Pokemon selection cards
function displayPokemonSelection(pokemonList, maxPokemon) {
    const container = document.getElementById("pokemon-selection");
    container.innerHTML = `<h2>Choose up to ${maxPokemon} Pokémon</h2><div id="poke-list" class="poke-list"></div>`;
    const list = document.getElementById("poke-list");
    let selected = [];

    pokemonList.forEach(pokemon => {
        const card = document.createElement("div");
        card.className = "poke-card";
        card.innerHTML = `
            <img src="${pokemon.sprites.front_default}" alt="${pokemon.name}" class="poke-sprite">
            <div class="poke-name">${pokemon.name}</div>
        `;
        card.onclick = () => {
            if (selected.includes(pokemon.name)) {
                selected = selected.filter(n => n !== pokemon.name);
                card.classList.remove("selected");
            } else if (selected.length < maxPokemon) {
                selected.push(pokemon.name);
                card.classList.add("selected");
            }
        };
        list.appendChild(card);
    });
}

// Get details of a single Pokemon
async function fetchPokemonDetails(name) {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
    const data = await response.json();
    return {
        name: data.name,
        types: data.types.map(t => t.type.name),
        stats: data.stats.map(s => ({ name: s.stat.name, value: s.base_stat })),
        sprite: data.sprites.front_default,
        moves: data.moves.map(m => m.move.name)
    };
}
