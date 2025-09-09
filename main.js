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
const gymPokemonLimit = [2,2,3,4,4,5,5,6];

let selectedPokemon = [];
let maxPokemonAllowed = 0;

function showMessage(text, type = 'info') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = type;
    messageEl.style.display = 'block';
    
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 3000);
    }
}

document.getElementById("setup-confirm").onclick = async function() {
    const button = this;
    const region = document.getElementById("region-select").value;
    const type = document.getElementById("type-select").value;
    const gymNumber = parseInt(document.getElementById("gym-number-select").value, 10);

    // Disable button during loading
    button.disabled = true;
    button.textContent = 'Loading...';

    try {
        const maxGen = regionGenMap[region];
        maxPokemonAllowed = gymPokemonLimit[gymNumber - 1];

        showMessage(`Loading ${type} Pokémon from ${region.charAt(0).toUpperCase() + region.slice(1)}...`, 'info');
        
        // Show the pokemon selection container
        document.getElementById('pokemon-selection').style.display = 'block';

        // Get and filter Pokemon
        const pokemonList = await getFilteredPokemon(maxGen, type);
        
        if (pokemonList.length === 0) {
            showMessage(`No ${type} type Pokémon found in ${region.charAt(0).toUpperCase() + region.slice(1)}!`, 'error');
            document.getElementById('pokemon-selection').style.display = 'none';
        } else {
            // Display selection UI
            displayPokemonSelection(pokemonList, maxPokemonAllowed);
            showMessage(`Found ${pokemonList.length} ${type} type Pokémon. Choose up to ${maxPokemonAllowed}!`, 'success');
        }
    } catch (error) {
        console.error('Error loading Pokemon:', error);
        showMessage('Error loading Pokémon. Please try again.', 'error');
        document.getElementById('pokemon-selection').style.display = 'none';
    } finally {
        // Re-enable button
        button.disabled = false;
        button.textContent = 'Confirm Setup';
    }
};

// Get Pokemon up to maxGen and filter by type
async function getFilteredPokemon(maxGen, type) {
    const limit = genLimits[maxGen - 1];
    
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch Pokemon list');
        
        const data = await response.json();
        const filtered = [];
        
        // Process Pokemon in smaller batches to avoid overwhelming the API
        const batchSize = 20;
        for (let i = 0; i < data.results.length; i += batchSize) {
            const batch = data.results.slice(i, i + batchSize);
            const batchPromises = batch.map(async (p) => {
                try {
                    const details = await fetch(p.url);
                    if (!details.ok) throw new Error(`Failed to fetch ${p.name}`);
                    const pokemon = await details.json();
                    
                    if (pokemon.types.some(t => t.type.name === type)) {
                        return pokemon;
                    }
                    return null;
                } catch (error) {
                    console.warn(`Error fetching ${p.name}:`, error);
                    return null;
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            filtered.push(...batchResults.filter(p => p !== null));
            
            // Small delay between batches to be nice to the API
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        return filtered;
    } catch (error) {
        console.error('Error in getFilteredPokemon:', error);
        return [];
    }
}
