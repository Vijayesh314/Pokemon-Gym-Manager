// Pokemon API-based battle system
class PokemonAPIBattleSystem {
    constructor() {
        this.cache = {
            pokemon: new Map(),
            moves: new Map(),
            types: new Map()
        };
    }

    // Fetch complete Pokemon data including moves and types
    async fetchPokemonData(pokemonId) {
        if (this.cache.pokemon.has(pokemonId)) {
            return this.cache.pokemon.get(pokemonId);
        }

        try {
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
            if (!response.ok) throw new Error('Pokemon not found');
            
            const pokemon = await response.json();
            
            // Get moves (filter to get reasonable moveset)
            const availableMoves = pokemon.moves
                .filter(moveData => {
                    // Filter by learn method (level up, machine, etc.)
                    return moveData.version_group_details.some(version => 
                        version.move_learn_method.name === 'level-up' || 
                        version.move_learn_method.name === 'machine'
                    );
                })
                .slice(0, 20) // Limit to prevent too many API calls
                .map(moveData => moveData.move);

            // Fetch move details for a subset of moves
            const movePromises = availableMoves
                .slice(0, 8) // Limit to 8 moves, will select 4 later
                .map(move => this.fetchMoveData(move.url.split('/').slice(-2, -1)[0]));
            
            const moves = await Promise.all(movePromises);
            const validMoves = moves.filter(move => move && move.power > 0); // Only attacking moves

            const pokemonData = {
                id: pokemon.id,
                name: pokemon.name,
                types: pokemon.types.map(t => t.type.name),
                stats: {
                    hp: pokemon.stats.find(s => s.stat.name === 'hp').base_stat,
                    attack: pokemon.stats.find(s => s.stat.name === 'attack').base_stat,
                    defense: pokemon.stats.find(s => s.stat.name === 'defense').base_stat,
                    speed: pokemon.stats.find(s => s.stat.name === 'speed').base_stat,
                    spAttack: pokemon.stats.find(s => s.stat.name === 'special-attack').base_stat,
                    spDefense: pokemon.stats.find(s => s.stat.name === 'special-defense').base_stat
                },
                moves: this.selectBestMoves(validMoves, pokemon.types.map(t => t.type.name), 4),
                sprite: pokemon.sprites.front_default,
                height: pokemon.height,
                weight: pokemon.weight
            };

            this.cache.pokemon.set(pokemonId, pokemonData);
            return pokemonData;
        } catch (error) {
            console.error(`Error fetching Pokemon ${pokemonId}:`, error);
            return null;
        }
    }

    // Fetch move data from API
    async fetchMoveData(moveId) {
        if (this.cache.moves.has(moveId)) {
            return this.cache.moves.get(moveId);
        }

        try {
            const response = await fetch(`https://pokeapi.co/api/v2/move/${moveId}`);
            if (!response.ok) throw new Error('Move not found');
            
            const move = await response.json();
            
            const moveData = {
                id: move.id,
                name: move.name,
                type: move.type.name,
                power: move.power,
                accuracy: move.accuracy,
                pp: move.pp,
                priority: move.priority,
                damageClass: move.damage_class.name, // physical, special, status
                description: move.flavor_text_entries.find(entry => entry.language.name === 'en')?.flavor_text || move.name
            };

            this.cache.moves.set(moveId, moveData);
            return moveData;
        } catch (error) {
            console.error(`Error fetching move ${moveId}:`, error);
            return null;
        }
    }

    // Fetch type effectiveness data
    async fetchTypeEffectiveness(typeName) {
        if (this.cache.types.has(typeName)) {
            return this.cache.types.get(typeName);
        }

        try {
            const response = await fetch(`https://pokeapi.co/api/v2/type/${typeName}`);
            if (!response.ok) throw new Error('Type not found');
            
            const type = await response.json();
            
            const effectiveness = {
                doubleDamageTo: type.damage_relations.double_damage_to.map(t => t.name),
                halfDamageTo: type.damage_relations.half_damage_to.map(t => t.name),
                noDamageTo: type.damage_relations.no_damage_to.map(t => t.name),
                doubleDamageFrom: type.damage_relations.double_damage_from.map(t => t.name),
                halfDamageFrom: type.damage_relations.half_damage_from.map(t => t.name),
                noDamageFrom: type.damage_relations.no_damage_from.map(t => t.name)
            };

            this.cache.types.set(typeName, effectiveness);
            return effectiveness;
        } catch (error) {
            console.error(`Error fetching type ${typeName}:`, error);
            return null;
        }
    }

    // Select best moves for a Pokemon (prefer STAB moves and variety)
    selectBestMoves(moves, pokemonTypes, count = 4) {
        if (moves.length <= count) return moves;

        // Prioritize STAB moves (Same Type Attack Bonus)
        const stabMoves = moves.filter(move => pokemonTypes.includes(move.type));
        const nonStabMoves = moves.filter(move => !pokemonTypes.includes(move.type));

        // Sort by power
        stabMoves.sort((a, b) => (b.power || 0) - (a.power || 0));
        nonStabMoves.sort((a, b) => (b.power || 0) - (a.power || 0));

        // Select best combination
        const selectedMoves = [];
        
        // Add best STAB moves first
        selectedMoves.push(...stabMoves.slice(0, Math.min(2, count)));
        
        // Fill remaining slots with non-STAB moves
        const remaining = count - selectedMoves.length;
        selectedMoves.push(...nonStabMoves.slice(0, remaining));

        return selectedMoves.slice(0, count);
    }

    // Calculate type effectiveness multiplier
    async calculateTypeEffectiveness(attackingType, defendingTypes) {
        const typeData = await this.fetchTypeEffectiveness(attackingType);
        if (!typeData) return 1;

        let multiplier = 1;
        
        defendingTypes.forEach(defType => {
            if (typeData.doubleDamageTo.includes(defType)) {
                multiplier *= 2;
            } else if (typeData.halfDamageTo.includes(defType)) {
                multiplier *= 0.5;
            } else if (typeData.noDamageTo.includes(defType)) {
                multiplier *= 0;
            }
        });

        return multiplier;
    }

    // Enhanced damage calculation using real Pokemon formulas
    async calculateDamage(attacker, defender, move) {
        const level = attacker.level || 50;
        const power = move.power || 50;
        
        // Determine if move is physical or special
        const isPhysical = move.damageClass === 'physical';
        const attackStat = isPhysical ? attacker.stats.attack : attacker.stats.spAttack;
        const defenseStat = isPhysical ? defender.stats.defense : defender.stats.spDefense;
        
        // Base damage calculation (simplified Pokemon formula)
        let damage = Math.floor(((2 * level / 5 + 2) * power * attackStat / defenseStat) / 50 + 2);
        
        // Type effectiveness
        const effectiveness = await this.calculateTypeEffectiveness(move.type, defender.types);
        damage = Math.floor(damage * effectiveness);
        
        // STAB (Same Type Attack Bonus)
        if (attacker.types && attacker.types.includes(move.type)) {
            damage = Math.floor(damage * 1.5);
        }
        
        // Random factor (85-100%)
        const randomFactor = (Math.random() * 0.15 + 0.85);
        damage = Math.floor(damage * randomFactor);
        
        return {
            damage: Math.max(1, damage),
            effectiveness,
            isCritical: Math.random() < 0.0625 // 1/16 chance for critical hit
        };
    }

    // Get effectiveness message
    getEffectivenessMessage(multiplier) {
        if (multiplier > 1) return "It's super effective!";
        if (multiplier < 1 && multiplier > 0) return "It's not very effective...";
        if (multiplier === 0) return "It had no effect!";
        return "";
    }
}

// Initialize the API battle system
const pokemonAPI = new PokemonAPIBattleSystem();

// Enhanced functions using the API
async function initializePokemonWithAPI(pokemon) {
    showMessage('Loading Pokemon data from API...', 'info');
    
    const apiData = await pokemonAPI.fetchPokemonData(pokemon.id);
    if (!apiData) {
        // Fallback to basic data if API fails
        return {
            ...pokemon,
            types: ['normal'],
            stats: { hp: 100, attack: 100, defense: 100, speed: 100, spAttack: 100, spDefense: 100 },
            moves: [
                { name: 'Tackle', type: 'normal', power: 40, accuracy: 100 },
                { name: 'Quick Attack', type: 'normal', power: 40, accuracy: 100 },
                { name: 'Body Slam', type: 'normal', power: 85, accuracy: 100 },
                { name: 'Double-Edge', type: 'normal', power: 120, accuracy: 100 }
            ]
        };
    }
    
    return {
        ...pokemon,
        ...apiData,
        hp: pokemon.hp || 100,
        maxHp: pokemon.maxHp || 100,
        level: pokemon.level || 50,
        fainted: pokemon.fainted || false
    };
}

// Enhanced battle initialization with API data
async function initializeBattleWithAPI() {
    showMessage('Initializing battle with Pokemon API data...', 'info', true);
    
    try {
        // Initialize player team
        const playerTeamPromises = selectedPokemon.map(p => initializePokemonWithAPI({
            ...p,
            hp: 100,
            maxHp: 100,
            level: 50,
            fainted: false
        }));
        
        // Initialize AI team
        const aiTeamPromises = aiTeam.map(p => initializePokemonWithAPI(p));
        
        battleState = {
            turn: 1,
            phase: 'player',
            playerActivePokemon: 0,
            aiActivePokemon: 0,
            playerTeam: await Promise.all(playerTeamPromises),
            aiTeam: await Promise.all(aiTeamPromises),
            battleLog: []
        };
        
        // Show battle arena
        document.getElementById('battle-arena').style.display = 'block';
        document.getElementById('ai-challenge').style.display = 'none';
        
        updateBattleDisplay();
        addToBattleLog('Battle begins!');
        addToBattleLog(`${battleState.playerTeam[0].name} vs ${battleState.aiTeam[0].name}!`);
        
        setupAPIBattleControls();
        hideMessage();
        
    } catch (error) {
        console.error('Error initializing battle:', error);
        showMessage('Error loading Pokemon data. Using fallback data.', 'warning');
        // Fallback to basic battle system
        initializeBattle();
    }
}

// Enhanced player attack with API data
async function playerAttackWithAPI(moveIndex) {
    const playerPokemon = battleState.playerTeam[battleState.playerActivePokemon];
    const aiPokemon = battleState.aiTeam[battleState.aiActivePokemon];
    const selectedMove = playerPokemon.moves[moveIndex];
    
    // Accuracy check
    const accuracyRoll = Math.random() * 100;
    if (accuracyRoll > selectedMove.accuracy) {
        addToBattleLog(`${playerPokemon.name}'s ${selectedMove.name} missed!`);
        battleState.phase = 'ai';
        updateBattleDisplay();
        setTimeout(() => aiTurnWithAPI(), 1500);
        return;
    }
    
    // Calculate damage using API data
    const damageResult = await pokemonAPI.calculateDamage(playerPokemon, aiPokemon, selectedMove);
    let finalDamage = damageResult.damage;
    
    // Critical hit
    if (damageResult.isCritical) {
        finalDamage = Math.floor(finalDamage * 1.5);
        addToBattleLog("A critical hit!");
    }
    
    aiPokemon.hp = Math.max(0, aiPokemon.hp - finalDamage);
    
    addToBattleLog(`${playerPokemon.name} used ${selectedMove.name}!`);
    addToBattleLog(`${aiPokemon.name} takes ${finalDamage} damage!`);
    
    // Effectiveness message
    const effectMessage = pokemonAPI.getEffectivenessMessage(damageResult.effectiveness);
    if (effectMessage) {
        addToBattleLog(effectMessage);
    }
    
    if (aiPokemon.hp === 0) {
        aiPokemon.fainted = true;
        addToBattleLog(`${aiPokemon.name} fainted!`);
        
        const alivePokemon = battleState.aiTeam.findIndex(p => !p.fainted);
        if (alivePokemon !== -1) {
            battleState.aiActivePokemon = alivePokemon;
            addToBattleLog(`AI sends out ${battleState.aiTeam[alivePokemon].name}!`);
        }
    }
    
    if (checkBattleEnd()) return;
    
    battleState.phase = 'ai';
    updateBattleDisplay();
    setTimeout(() => aiTurnWithAPI(), 1500);
}

// Enhanced AI turn with API data
async function aiTurnWithAPI() {
    const aiPokemon = battleState.aiTeam[battleState.aiActivePokemon];
    const playerPokemon = battleState.playerTeam[battleState.playerActivePokemon];
    
    if (aiPokemon.fainted) {
        battleState.phase = 'player';
        battleState.turn++;
        updateBattleDisplay();
        return;
    }
    
    // AI move selection - prefer effective moves
    let bestMove = aiPokemon.moves[0];
    let bestEffectiveness = 0;
    
    for (const move of aiPokemon.moves) {
        const effectiveness = await pokemonAPI.calculateTypeEffectiveness(move.type, playerPokemon.types);
        if (effectiveness > bestEffectiveness) {
            bestEffectiveness = effectiveness;
            bestMove = move;
        }
    }
    
    // Accuracy check
    const accuracyRoll = Math.random() * 100;
    if (accuracyRoll > bestMove.accuracy) {
        addToBattleLog(`${aiPokemon.name}'s ${bestMove.name} missed!`);
        battleState.phase = 'player';
        battleState.turn++;
        updateBattleDisplay();
        return;
    }
    
    // Calculate damage
    const damageResult = await pokemonAPI.calculateDamage(aiPokemon, playerPokemon, bestMove);
    let finalDamage = damageResult.damage;
    
    if (damageResult.isCritical) {
        finalDamage = Math.floor(finalDamage * 1.5);
        addToBattleLog("A critical hit!");
    }
    
    playerPokemon.hp = Math.max(0, playerPokemon.hp - finalDamage);
    
    addToBattleLog(`${aiPokemon.name} used ${bestMove.name}!`);
    addToBattleLog(`${playerPokemon.name} takes ${finalDamage} damage!`);
    
    const effectMessage = pokemonAPI.getEffectivenessMessage(damageResult.effectiveness);
    if (effectMessage) {
        addToBattleLog(effectMessage);
    }
    
    if (playerPokemon.hp === 0) {
        playerPokemon.fainted = true;
        addToBattleLog(`${playerPokemon.name} fainted!`);
        
        const alivePokemon = battleState.playerTeam.findIndex(p => !p.fainted);
        if (alivePokemon !== -1) {
            battleState.playerActivePokemon = alivePokemon;
            addToBattleLog(`Go ${battleState.playerTeam[alivePokemon].name}!`);
        }
    }
    
    if (checkBattleEnd()) return;
    
    battleState.phase = 'player';
    battleState.turn++;
    updateBattleDisplay();
}

// Setup battle controls for API system
function setupAPIBattleControls() {
    const controlsDiv = document.querySelector('.battle-controls');
    controlsDiv.innerHTML = `
        <div id="move-buttons" class="move-selection">
            <!-- Move buttons will be generated dynamically -->
        </div>
        <button id="defend-btn" class="battle-action">Defend</button>
        <button id="switch-btn" class="battle-action">Switch Pokemon</button>
        <div id="switch-options" class="switch-menu" style="display: none;"></div>
    `;
    
    document.getElementById('defend-btn').addEventListener('click', () => playerDefend());
    document.getElementById('switch-btn').addEventListener('click', () => showSwitchMenu());
    
    updateAPIMoveButtons();
}

// Update move buttons with API data
function updateAPIMoveButtons() {
    const activePokemon = battleState.playerTeam[battleState.playerActivePokemon];
    const moveButtonsDiv = document.getElementById('move-buttons');
    
    if (!activePokemon || !activePokemon.moves) return;
    
    moveButtonsDiv.innerHTML = activePokemon.moves.map((move, index) => `
        <button class="move-btn ${move.type}" onclick="playerAttackWithAPI(${index})" 
                ${battleState.phase !== 'player' ? 'disabled' : ''}>
            <div class="move-name">${move.name.charAt(0).toUpperCase() + move.name.slice(1).replace('-', ' ')}</div>
            <div class="move-details">
                <span class="move-type">${move.type.toUpperCase()}</span>
                <span class="move-power">PWR: ${move.power || '--'}</span>
                <span class="move-accuracy">ACC: ${move.accuracy}%</span>
            </div>
        </button>
    `).join('');
}

// Update the battle display to show Pokemon types
function updateBattleDisplayWithTypes() {
    // Update battle status
    document.getElementById('battle-turn').textContent = `Turn ${battleState.turn}`;
    document.getElementById('battle-phase').textContent = `${battleState.phase === 'player' ? 'Your' : 'AI'} Turn`;
    
    // Update player team display
    const playerDisplay = document.getElementById('player-pokemon-display');
    playerDisplay.innerHTML = battleState.playerTeam.map((pokemon, index) => `
        <div class="battle-pokemon ${index === battleState.playerActivePokemon ? 'active' : ''} ${pokemon.fainted ? 'fainted' : ''}">
            <img src="${pokemon.sprite}" alt="${pokemon.name}">
            <div class="pokemon-info">
                <div class="name">${pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}</div>
                <div class="pokemon-types">
                    ${pokemon.types ? pokemon.types.map(type => `<span class="type-badge ${type}">${type}</span>`).join('') : ''}
                </div>
                <div class="hp-bar">
                    <div class="hp-fill" style="width: ${(pokemon.hp / pokemon.maxHp) * 100}%"></div>
                </div>
                <div style="font-size: 10px;">${pokemon.hp}/${pokemon.maxHp} HP</div>
            </div>
        </div>
    `).join('');
    
    // Update AI team display
    const aiDisplay = document.getElementById('ai-pokemon-display');
    aiDisplay.innerHTML = battleState.aiTeam.map((pokemon, index) => `
        <div class="battle-pokemon ${index === battleState.aiActivePokemon ? 'active' : ''} ${pokemon.fainted ? 'fainted' : ''}">
            <img src="${pokemon.sprite}" alt="${pokemon.name}">
            <div class="pokemon-info">
                <div class="name">${pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}</div>
                <div class="pokemon-types">
                    ${pokemon.types ? pokemon.types.map(type => `<span class="type-badge ${type}">${type}</span>`).join('') : ''}
                </div>
                <div class="hp-bar">
                    <div class="hp-fill" style="width: ${(pokemon.hp / pokemon.maxHp) * 100}%"></div>
                </div>
                <div style="font-size: 10px;">${pokemon.hp}/${pokemon.maxHp} HP</div>
            </div>
        </div>
    `).join('');
    
    // Update button states and move buttons
    const canAct = battleState.phase === 'player' && !battleState.playerTeam[battleState.playerActivePokemon].fainted;
    document.getElementById('defend-btn').disabled = !canAct;
    document.getElementById('switch-btn').disabled = !canAct || battleState.playerTeam.filter(p => !p.fainted).length <= 1;
    
    updateAPIMoveButtons();
}

// Replace the original updateBattleDisplay function
const originalUpdateBattleDisplay = updateBattleDisplay;
updateBattleDisplay = updateBattleDisplayWithTypes;
