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
let aiTeam = [];
let battleState = {
    turn: 1,
    phase: 'player', // 'player' or 'ai'
    playerActivePokemon: 0,
    aiActivePokemon: 0,
    playerTeam: [],
    aiTeam: [],
    battleLog: []
};

function showMessage(text, type = 'info', persistent = false) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = ''; // Clear all classes first
    messageEl.classList.add(type); // Add the appropriate class
    messageEl.style.display = 'block';
    
    // Only auto-hide for success and info messages that aren't persistent
    if (!persistent && (type === 'success' || type === 'info')) {
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 3000);
    }
}

function hideMessage() {
    const messageEl = document.getElementById('message');
    messageEl.style.display = 'none';
}

function displayPokemonSelection(pokemonList, maxAllowed) {
    const selectionDiv = document.getElementById('pokemon-selection');
    currentPokemonList = pokemonList;
    
    // Clear loading state and build the UI
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
    
    // Add click handlers to all cards
    attachCardClickHandlers();
}

function createPokemonCard(pokemon) {
    // Extract ID from URL
    const match = pokemon.url.match(/\/pokemon\/(\d+)\//);
    const id = match ? match[1] : '0';
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    
    return `
        <div class="poke-card" data-pokemon-id="${id}" data-pokemon-name="${pokemon.name}">
            <img class="poke-sprite" src="${spriteUrl}" alt="${pokemon.name}" onerror="this.src='https://via.placeholder.com/96?text=No+Image'">
            <div class="poke-name">${pokemon.name}</div>
            <div class="poke-id">#${id.padStart(3, '0')}</div>
        </div>
    `;
}

function attachCardClickHandlers() {
    const cards = document.querySelectorAll('.poke-card');
    cards.forEach(card => {
        card.addEventListener('click', function() {
            togglePokemonSelection(this);
        });
    });
}

function togglePokemonSelection(card) {
    const pokemonId = card.dataset.pokemonId;
    const pokemonName = card.dataset.pokemonName;
    
    if (card.classList.contains('selected')) {
        // Deselect
        card.classList.remove('selected');
        selectedPokemon = selectedPokemon.filter(p => p.id !== pokemonId);
    } else {
        // Check if we can select more
        if (selectedPokemon.length >= maxPokemonAllowed) {
            showMessage(`You can only select up to ${maxPokemonAllowed} Pokémon!`, 'warning');
            return;
        }
        // Select
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
    document.querySelectorAll('.poke-card.selected').forEach(card => {
        card.classList.remove('selected');
    });
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
    
    // Display the team
    const teamDisplay = document.getElementById('team-display');
    teamDisplay.innerHTML = `
        <div class="team-display">
            <h3>Your Gym Team</h3>
            <div class="team-grid">
                ${selectedPokemon.map(p => `
                    <div class="team-pokemon">
                        <img src="${p.sprite}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/64?text=No+Image'">
                        <div class="name">${p.name}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Disable selection after confirming
    document.querySelectorAll('.poke-card').forEach(card => {
        card.style.pointerEvents = 'none';
        card.style.opacity = '0.6';
    });
    
    document.getElementById('confirm-team-btn').disabled = true;
    document.querySelector('.clear-selection').disabled = true;
    
    // Show AI challenge section
    document.getElementById('ai-challenge').style.display = 'block';
    setupAIChallenge();
}

// Get Pokemon up to maxGen and filter by type
async function getFilteredPokemon(maxGen, type) {
    try {
        // Get all Pokémon of the type
        const response = await fetch(`https://pokeapi.co/api/v2/type/${type.toLowerCase()}`);
        if (!response.ok) throw new Error('Failed to fetch type data');
        
        const data = await response.json();
        
        // Get Pokémon up to maxGen
        const maxId = genLimits[maxGen - 1];
        const filtered = data.pokemon
            .map(p => p.pokemon)
            .filter(p => {
                // Extract ID from URL
                const match = p.url.match(/\/pokemon\/(\d+)\//);
                const id = match ? parseInt(match[1], 10) : null;
                return id && id <= maxId;
            })
            .sort((a, b) => {
                // Sort by ID for better display
                const idA = parseInt(a.url.match(/\/pokemon\/(\d+)\//)[1]);
                const idB = parseInt(b.url.match(/\/pokemon\/(\d+)\//)[1]);
                return idA - idB;
            });
        
        console.log(`Filtered ${filtered.length} Pokémon of type ${type}`);
        return filtered;
    } catch (error) {
        console.error('Error in getFilteredPokemon:', error);
        return [];
    }
}

// AI Challenge System
function setupAIChallenge() {
    const difficultyBtns = document.querySelectorAll('.difficulty-btn');
    difficultyBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const difficulty = this.dataset.difficulty;
            generateAITeam(difficulty);
        });
    });
    
    document.getElementById('start-battle').addEventListener('click', initializeBattle);
    document.getElementById('new-battle').addEventListener('click', resetToAISelection);
}

async function generateAITeam(difficulty) {
    const difficultySettings = {
        easy: { teamSize: Math.min(selectedPokemon.length - 1, 3), levelRange: [20, 35] },
        normal: { teamSize: selectedPokemon.length, levelRange: [30, 50] },
        hard: { teamSize: selectedPokemon.length + 1, levelRange: [45, 65] }
    };
    
    const settings = difficultySettings[difficulty];
    showMessage(`Generating ${difficulty} AI team...`, 'info');
    
    try {
        // Get random Pokemon for AI (different types than player)
        const availableTypes = ['normal', 'fire', 'water', 'grass', 'electric', 'psychic', 'rock', 'fighting'];
        const aiType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        
        const aiPokemonPool = await getFilteredPokemon(4, aiType); // Use first 4 gens for variety
        if (aiPokemonPool.length === 0) {
            throw new Error('Could not generate AI team');
        }
        
        // Randomly select Pokemon for AI team
        aiTeam = [];
        const shuffled = [...aiPokemonPool].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < Math.min(settings.teamSize, shuffled.length); i++) {
            const pokemon = shuffled[i];
            const match = pokemon.url.match(/\/pokemon\/(\d+)\//);
            const id = match ? match[1] : '1';
            
            aiTeam.push({
                id: id,
                name: pokemon.name,
                sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
                hp: 100,
                maxHp: 100,
                level: Math.floor(Math.random() * (settings.levelRange[1] - settings.levelRange[0] + 1)) + settings.levelRange[0],
                fainted: false
            });
        }
        
        displayAITeam(difficulty);
        showMessage(`AI team generated! Difficulty: ${difficulty}`, 'success');
        
    } catch (error) {
        console.error('Error generating AI team:', error);
        showMessage('Error generating AI team. Please try again.', 'error');
    }
}

function displayAITeam(difficulty) {
    const aiTeamDisplay = document.getElementById('ai-team-display');
    const aiTeamGrid = document.getElementById('ai-team-grid');
    
    aiTeamGrid.innerHTML = aiTeam.map(pokemon => `
        <div class="team-pokemon">
            <img src="${pokemon.sprite}" alt="${pokemon.name}" onerror="this.src='https://via.placeholder.com/64?text=No+Image'">
            <div class="name">${pokemon.name}</div>
            <div style="font-size: 10px; color: #666;">Lv. ${pokemon.level}</div>
        </div>
    `).join('');
    
    aiTeamDisplay.style.display = 'block';
    
    // Hide difficulty buttons
    document.getElementById('ai-setup').style.display = 'none';
}

// Battle System
function initializeBattle() {
    // Initialize battle state
    battleState = {
        turn: 1,
        phase: 'player',
        playerActivePokemon: 0,
        aiActivePokemon: 0,
        playerTeam: selectedPokemon.map(p => ({
            ...p,
            hp: 100,
            maxHp: 100,
            level: 50,
            fainted: false
        })),
        aiTeam: [...aiTeam],
        battleLog: []
    };
    
    // Show battle arena
    document.getElementById('battle-arena').style.display = 'block';
    document.getElementById('ai-challenge').style.display = 'none';
    
    // Setup battle display
    updateBattleDisplay();
    addToBattleLog('Battle begins!');
    addToBattleLog(`${battleState.playerTeam[0].name} vs ${battleState.aiTeam[0].name}!`);
    
    // Setup battle controls
    setupBattleControls();
}

function setupBattleControls() {
    document.getElementById('attack-btn').addEventListener('click', () => playerAttack());
    document.getElementById('defend-btn').addEventListener('click', () => playerDefend());
    document.getElementById('switch-btn').addEventListener('click', () => showSwitchMenu());
}

function updateBattleDisplay() {
    // Update battle status
    document.getElementById('battle-turn').textContent = `Turn ${battleState.turn}`;
    document.getElementById('battle-phase').textContent = `${battleState.phase === 'player' ? 'Your' : 'AI'} Turn`;
    
    // Update player team display
    const playerDisplay = document.getElementById('player-pokemon-display');
    playerDisplay.innerHTML = battleState.playerTeam.map((pokemon, index) => `
        <div class="battle-pokemon ${index === battleState.playerActivePokemon ? 'active' : ''} ${pokemon.fainted ? 'fainted' : ''}">
            <img src="${pokemon.sprite}" alt="${pokemon.name}">
            <div class="name">${pokemon.name}</div>
            <div class="hp-bar">
                <div class="hp-fill" style="width: ${(pokemon.hp / pokemon.maxHp) * 100}%"></div>
            </div>
            <div style="font-size: 10px;">${pokemon.hp}/${pokemon.maxHp} HP</div>
        </div>
    `).join('');
    
    // Update AI team display
    const aiDisplay = document.getElementById('ai-pokemon-display');
    aiDisplay.innerHTML = battleState.aiTeam.map((pokemon, index) => `
        <div class="battle-pokemon ${index === battleState.aiActivePokemon ? 'active' : ''} ${pokemon.fainted ? 'fainted' : ''}">
            <img src="${pokemon.sprite}" alt="${pokemon.name}">
            <div class="name">${pokemon.name}</div>
            <div class="hp-bar">
                <div class="hp-fill" style="width: ${(pokemon.hp / pokemon.maxHp) * 100}%"></div>
            </div>
            <div style="font-size: 10px;">${pokemon.hp}/${pokemon.maxHp} HP</div>
        </div>
    `).join('');
    
    // Update button states
    const canAct = battleState.phase === 'player' && !battleState.playerTeam[battleState.playerActivePokemon].fainted;
    document.getElementById('attack-btn').disabled = !canAct;
    document.getElementById('defend-btn').disabled = !canAct;
    document.getElementById('switch-btn').disabled = !canAct || battleState.playerTeam.filter(p => !p.fainted).length <= 1;
}

function addToBattleLog(message) {
    battleState.battleLog.push(message);
    const log = document.getElementById('battle-log');
    log.innerHTML = battleState.battleLog.slice(-10).map(msg => `<div>${msg}</div>`).join('');
    log.scrollTop = log.scrollHeight;
}

function playerAttack() {
    const playerPokemon = battleState.playerTeam[battleState.playerActivePokemon];
    const aiPokemon = battleState.aiTeam[battleState.aiActivePokemon];
    
    const damage = Math.floor(Math.random() * 30) + 15;
    aiPokemon.hp = Math.max(0, aiPokemon.hp - damage);
    
    addToBattleLog(`${playerPokemon.name} attacks ${aiPokemon.name} for ${damage} damage!`);
    
    if (aiPokemon.hp === 0) {
        aiPokemon.fainted = true;
        addToBattleLog(`${aiPokemon.name} fainted!`);
        
        // Check if AI has other Pokemon
        const alivePokemon = battleState.aiTeam.findIndex(p => !p.fainted);
        if (alivePokemon !== -1) {
            battleState.aiActivePokemon = alivePokemon;
            addToBattleLog(`AI sends out ${battleState.aiTeam[alivePokemon].name}!`);
        }
    }
    
    if (checkBattleEnd()) return;
    
    battleState.phase = 'ai';
    updateBattleDisplay();
    
    setTimeout(() => aiTurn(), 1500);
}

function playerDefend() {
    const playerPokemon = battleState.playerTeam[battleState.playerActivePokemon];
    addToBattleLog(`${playerPokemon.name} takes a defensive stance!`);
    
    battleState.phase = 'ai';
    updateBattleDisplay();
    
    setTimeout(() => aiTurn(), 1500);
}

function showSwitchMenu() {
    const switchOptions = document.getElementById('switch-options');
    const availablePokemon = battleState.playerTeam
        .map((pokemon, index) => ({ pokemon, index }))
        .filter(({ pokemon, index }) => !pokemon.fainted && index !== battleState.playerActivePokemon);
    
    switchOptions.innerHTML = availablePokemon.map(({ pokemon, index }) => `
        <div class="switch-option" onclick="switchPokemon(${index})">
            ${pokemon.name} (${pokemon.hp}/${pokemon.maxHp} HP)
        </div>
    `).join('');
    
    switchOptions.style.display = switchOptions.style.display === 'none' ? 'block' : 'none';
}

function switchPokemon(index) {
    const oldPokemon = battleState.playerTeam[battleState.playerActivePokemon];
    const newPokemon = battleState.playerTeam[index];
    
    battleState.playerActivePokemon = index;
    addToBattleLog(`${oldPokemon.name} returns! Go ${newPokemon.name}!`);
    
    document.getElementById('switch-options').style.display = 'none';
    
    battleState.phase = 'ai';
    updateBattleDisplay();
    
    setTimeout(() => aiTurn(), 1500);
}

function aiTurn() {
    const aiPokemon = battleState.aiTeam[battleState.aiActivePokemon];
    const playerPokemon = battleState.playerTeam[battleState.playerActivePokemon];
    
    if (aiPokemon.fainted) {
        battleState.phase = 'player';
        battleState.turn++;
        updateBattleDisplay();
        return;
    }
    
    // Simple AI logic - mostly attack, sometimes defend
    const action = Math.random() > 0.2 ? 'attack' : 'defend';
    
    if (action === 'attack') {
        const damage = Math.floor(Math.random() * 25) + 10;
        playerPokemon.hp = Math.max(0, playerPokemon.hp - damage);
        
        addToBattleLog(`${aiPokemon.name} attacks ${playerPokemon.name} for ${damage} damage!`);
        
        if (playerPokemon.hp === 0) {
            playerPokemon.fainted = true;
            addToBattleLog(`${playerPokemon.name} fainted!`);
            
            // Auto-switch to next available Pokemon
            const alivePokemon = battleState.playerTeam.findIndex(p => !p.fainted);
            if (alivePokemon !== -1) {
                battleState.playerActivePokemon = alivePokemon;
                addToBattleLog(`Go ${battleState.playerTeam[alivePokemon].name}!`);
            }
        }
    } else {
        addToBattleLog(`${aiPokemon.name} takes a defensive stance!`);
    }
    
    if (checkBattleEnd()) return;
    
    battleState.phase = 'player';
    battleState.turn++;
    updateBattleDisplay();
}

function checkBattleEnd() {
    const playerAlive = battleState.playerTeam.some(p => !p.fainted);
    const aiAlive = battleState.aiTeam.some(p => !p.fainted);
    
    if (!playerAlive || !aiAlive) {
        const resultDiv = document.getElementById('battle-result');
        const titleEl = document.getElementById('result-title');
        const messageEl = document.getElementById('result-message');
        
        if (!aiAlive) {
            // Player wins
            titleEl.textContent = 'Victory!';
            messageEl.textContent = 'Congratulations! You defended your gym successfully!';
            resultDiv.className = 'battle-result victory';
        } else {
            // Player loses
            titleEl.textContent = 'Defeat!';
            messageEl.textContent = 'The challenger has defeated your gym! Better luck next time!';
            resultDiv.className = 'battle-result defeat';
        }
        
        resultDiv.style.display = 'block';
        
        // Disable battle controls
        document.getElementById('attack-btn').disabled = true;
        document.getElementById('defend-btn').disabled = true;
        document.getElementById('switch-btn').disabled = true;
        
        return true;
    }
    
    return false;
}

function resetToAISelection() {
    // Reset battle state
    battleState = {
        turn: 1,
        phase: 'player',
        playerActivePokemon: 0,
        aiActivePokemon: 0,
        playerTeam: [],
        aiTeam: [],
        battleLog: []
    };
    
    // Hide battle arena
    document.getElementById('battle-arena').style.display = 'none';
    
    // Show AI challenge section
    document.getElementById('ai-challenge').style.display = 'block';
    document.getElementById('ai-setup').style.display = 'block';
    document.getElementById('ai-team-display').style.display = 'none';
    document.getElementById('battle-result').style.display = 'none';
    
    // Clear AI team
    aiTeam = [];
}

// Setup confirm button event handler
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById("setup-confirm").onclick = async function() {
        const button = this;
        const regionInput = document.getElementById("region-select").value;
        const region = regionInput.toLowerCase();
        const type = document.getElementById("type-select").value;
        const gymNumber = parseInt(document.getElementById("gym-number-select").value, 10);
        
        // Reset previous selection
        selectedPokemon = [];
        hideMessage();
        
        // Disable button during loading
        button.disabled = true;
        button.textContent = 'Loading...';
        
        try {
            const maxGen = regionGenMap[region];
            if (!maxGen) {
                throw new Error(`Invalid region: ${region}`);
            }
            
            maxPokemonAllowed = gymPokemonLimit[gymNumber - 1];
            
            // Capitalize region name for display
            const regionDisplay = region.charAt(0).toUpperCase() + region.slice(1);
            showMessage(`Loading ${type} Pokémon from ${regionDisplay}...`, 'info', true);
            
            // Show the pokemon selection container with loading state
            const selectionDiv = document.getElementById('pokemon-selection');
            selectionDiv.style.display = 'block';
            selectionDiv.innerHTML = '<div class="loading">Loading Pokémon...</div>';
            
            // Get and filter Pokemon
            const pokemonList = await getFilteredPokemon(maxGen, type);
            
            if (pokemonList.length === 0) {
                showMessage(`No ${type} type Pokémon found in ${regionDisplay}!`, 'error', true);
                selectionDiv.style.display = 'none';
            } else {
                // Display selection UI
                displayPokemonSelection(pokemonList, maxPokemonAllowed);
                
                // Check if we're using mock data
                const isMockData = pokemonList.some(p => p.name === 'ditto' || p.name === 'eevee');
                if (isMockData) {
                    showMessage(`API unavailable - showing sample Pokémon. Choose up to ${maxPokemonAllowed}!`, 'warning');
                } else {
                    showMessage(`Found ${pokemonList.length} ${type} type Pokémon. Choose up to ${maxPokemonAllowed}!`, 'success');
                }
            }
        } catch (error) {
            console.error('Error loading Pokemon:', error);
            showMessage('Error loading Pokémon. Please try again.', 'error', true);
            document.getElementById('pokemon-selection').style.display = 'none';
        } finally {
            // Re-enable button
            button.disabled = false;
            button.textContent = 'Confirm Setup';
        }
    };
});
