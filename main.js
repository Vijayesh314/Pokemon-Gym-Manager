// Fixed region mapping with proper capitalization
const regionGenMap = {
    "kanto": 1,
    "johto": 2,
    "hoenn": 3,
    "sinnoh": 4,
    "unova": 5,
    "kalos": 6,
    "alola": 7,
    "galar": 8,
    "paldea": 9
};

const genLimits = [151, 251, 386, 493, 649, 721, 809, 905, 1025];
const gymPokemonLimit = [2, 2, 3, 4, 4, 5, 5, 6];

let selectedPokemon = [];
let maxPokemonAllowed = 0;
let currentPokemonList = [];

function showMessage(text, type = 'info', persistent = false) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = '';
    messageEl.classList.add(type);
    messageEl.style.display = 'block';
    
    if (!persistent && (type === 'success' || type === 'info')) {
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 3000);
    }
}

function hideMessage() {
    document.getElementById('message').style.display = 'none';
}

function displayPokemonSelection(pokemonList, maxAllowed) {
    const selectionDiv = document.getElementById('pokemon-selection');
    currentPokemonList = pokemonList;
    
    selectionDiv.innerHTML = `
        <div class="selection-header">
            <div class="selection-info">
                Select up to ${maxAllowed} Pokémon for your gym team
            </div>
            <div class="selection-counter" id="selection-counter">
                Selected: 0 / ${maxAllowed}
            </div>
        </div>
        <div class="poke-list" id="poke-list">
            ${pokemonList.map(pokemon => createPokemonCard(pokemon)).join('')}
        </div>
        <div class="selection-controls">
            <button class="clear-selection" onclick="clearSelection()">Clear Selection</button>
            <button class="confirm-team" id="confirm-team-btn" onclick="confirmTeam()" disabled>
                Confirm Team
            </button>
        </div>
        <div id="team-display"></div>
    `;
    
    attachCardClickHandlers();
}

function createPokemonCard(pokemon) {
    const match = pokemon.url.match(/\/pokemon\/(\d+)\//);
    const id = match ? match[1] : '0';
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    
    return `
        <div class="poke-card" data-pokemon-id="${id}" data-pokemon-name="${pokemon.name}">
            <img class="poke-sprite" src="${spriteUrl}" alt="${pokemon.name}" 
                 onerror="this.src='https://via.placeholder.com/96?text=No+Image'">
            <div class="poke-name">${pokemon.name}</div>
            <div class="poke-id">#${id.padStart(3, '0')}</div>
        </div>
    `;
}

function attachCardClickHandlers() {
    document.querySelectorAll('.poke-card').forEach(card => {
        card.addEventListener('click', () => togglePokemonSelection(card));
    });
}

function togglePokemonSelection(card) {
    const pokemonId = card.dataset.pokemonId;
    const pokemonName = card.dataset.pokemonName;
    
    if (card.classList.contains('selected')) {
        card.classList.remove('selected');
        selectedPokemon = selectedPokemon.filter(p => p.id !== pokemonId);
    } else {
        if (selectedPokemon.length >= maxPokemonAllowed) {
            showMessage(`You can only select up to ${maxPokemonAllowed} Pokémon!`, 'warning');
            return;
        }
        card.classList.add('selected');
        selectedPokemon.push({
            id: pokemonId,
            name: pokemonName,
            sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`
        });
    }
    
    updateSelectionCounter();
    updateConfirmButton();
}

function updateSelectionCounter() {
    const counter = document.getElementById('selection-counter');
    if (counter) {
        counter.textContent = `Selected: ${selectedPokemon.length} / ${maxPokemonAllowed}`;
    }
}

function updateConfirmButton() {
    const confirmBtn = document.getElementById('confirm-team-btn');
    if (confirmBtn) {
        confirmBtn.disabled = selectedPokemon.length === 0;
    }
}

function clearSelection() {
    selectedPokemon = [];
    document.querySelectorAll('.poke-card.selected').forEach(card => card.classList.remove('selected'));
    updateSelectionCounter();
    updateConfirmButton();
    showMessage('Selection cleared', 'info');
}

function confirmTeam() {
    if (selectedPokemon.length === 0) {
        showMessage('Please select at least one Pokémon!', 'error');
        return;
    }
    
    showMessage(`Team confirmed with ${selectedPokemon.length} Pokémon!`, 'success');
    
    const teamDisplay = document.getElementById('team-display');
    teamDisplay.innerHTML = `
        <div class="team-display">
            <h3>Your Gym Team</h3>
            <div class="team-grid">
                ${selectedPokemon.map(p => `
                    <div class="team-pokemon">
                        <img src="${p.sprite}" alt="${p.name}" 
                             onerror="this.src='https://via.placeholder.com/64?text=No+Image'">
                        <div class="name">${p.name}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.querySelectorAll('.poke-card').forEach(card => {
        card.style.pointerEvents = 'none';
        card.style.opacity = '0.6';
    });
    
    document.getElementById('confirm-team-btn').disabled = true;
    document.querySelector('.clear-selection').disabled = true;
}

async function getFilteredPokemon(maxGen, type) {
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/type/${type.toLowerCase()}`);
        if (!response.ok) throw new Error('Failed to fetch type data');
        
        const data = await response.json();
        const maxId = genLimits[maxGen - 1];
        
        return data.pokemon
            .map(p => p.pokemon)
            .filter(p => {
                const match = p.url.match(/\/pokemon\/(\d+)\//);
