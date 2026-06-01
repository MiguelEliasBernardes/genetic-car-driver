// REDE NEURAL E OPERADORES GENÉTICOS (network.js)

class Level {
    constructor(inputCount, outputCount) {
        this.inputs = new Array(inputCount).fill(0);
        this.outputs = new Array(outputCount).fill(0);
        this.biases = new Array(outputCount).fill(0);
        
        this.weights = [];
        for (let i = 0; i < inputCount; i++) {
            this.weights[i] = new Array(outputCount).fill(0);
        }
        
        Level.randomize(this);
    }
    
    static randomize(level) {
        for (let i = 0; i < level.inputs.length; i++) {
            for (let j = 0; j < level.outputs.length; j++) {
                level.weights[i][j] = Math.random() * 2 - 1; // Entre -1 e 1
            }
        }
        for (let i = 0; i < level.outputs.length; i++) {
            level.biases[i] = Math.random() * 2 - 1; // Entre -1 e 1
        }
    }
    
    static feedForward(givenInputs, level) {
        for (let i = 0; i < level.inputs.length; i++) {
            level.inputs[i] = givenInputs[i];
        }
        
        for (let i = 0; i < level.outputs.length; i++) {
            let sum = 0;
            for (let j = 0; j < level.inputs.length; j++) {
                sum += level.inputs[j] * level.weights[j][i];
            }
            
            // Função de ativação Tanh: suaviza as saídas entre -1 e 1
            level.outputs[i] = Math.tanh(sum + level.biases[i]);
        }
        
        return level.outputs;
    }
}

class NeuralNetwork {
    constructor(neuronCounts) {
        this.neuronCounts = neuronCounts;
        this.levels = [];
        for (let i = 0; i < neuronCounts.length - 1; i++) {
            this.levels.push(new Level(neuronCounts[i], neuronCounts[i + 1]));
        }
    }
    
    getNeuronCounts() {
        return this.neuronCounts;
    }
    
    static feedForward(givenInputs, network) {
        let outputs = Level.feedForward(givenInputs, network.levels[0]);
        for (let i = 1; i < network.levels.length; i++) {
            outputs = Level.feedForward(outputs, network.levels[i]);
        }
        return outputs;
    }
    
    // Mutação: Altera levemente os pesos sinápticos e bias
    static mutate(network, amount = 0.05) {
        network.levels.forEach(level => {
            // Mutar Bias
            for (let i = 0; i < level.biases.length; i++) {
                if (Math.random() < amount) {
                    // Adiciona um pequeno ruído ou sorteia novo valor
                    const noise = (Math.random() * 2 - 1) * 0.3;
                    level.biases[i] = Math.max(-1, Math.min(1, level.biases[i] + noise));
                }
            }
            
            // Mutar Pesos
            for (let i = 0; i < level.weights.length; i++) {
                for (let j = 0; j < level.weights[i].length; j++) {
                    if (Math.random() < amount) {
                        const noise = (Math.random() * 2 - 1) * 0.3;
                        level.weights[i][j] = Math.max(-1, Math.min(1, level.weights[i][j] + noise));
                    }
                }
            }
        });
    }

    // Cruzamento Genético (Crossover)
    static crossover(networkA, networkB, method = 'uniform') {
        const child = new NeuralNetwork(networkA.neuronCounts);
        
        for (let l = 0; l < networkA.levels.length; l++) {
            const levelA = networkA.levels[l];
            const levelB = networkB.levels[l];
            const levelC = child.levels[l];
            
            // Crossover dos Biases
            for (let i = 0; i < levelC.biases.length; i++) {
                if (method === 'uniform') {
                    levelC.biases[i] = Math.random() < 0.5 ? levelA.biases[i] : levelB.biases[i];
                } else if (method === 'average') {
                    levelC.biases[i] = (levelA.biases[i] + levelB.biases[i]) / 2;
                } else { // 'single' - ponto único
                    levelC.biases[i] = i < levelC.biases.length / 2 ? levelA.biases[i] : levelB.biases[i];
                }
            }
            
            // Crossover dos Pesos
            for (let i = 0; i < levelC.weights.length; i++) {
                for (let j = 0; j < levelC.weights[i].length; j++) {
                    if (method === 'uniform') {
                        levelC.weights[i][j] = Math.random() < 0.5 ? levelA.weights[i][j] : levelB.weights[i][j];
                    } else if (method === 'average') {
                        levelC.weights[i][j] = (levelA.weights[i][j] + levelB.weights[i][j]) / 2;
                    } else { // 'single'
                        levelC.weights[i][j] = i < levelC.weights.length / 2 ? levelA.weights[i][j] : levelB.weights[i][j];
                    }
                }
            }
        }
        
        return child;
    }

    // Copia um cérebro existente criando uma cópia exata profunda (deep clone)
    static clone(network) {
        const cloned = new NeuralNetwork(network.neuronCounts);
        for (let l = 0; l < network.levels.length; l++) {
            const sourceLevel = network.levels[l];
            const destLevel = cloned.levels[l];
            
            // Copiar biases
            for (let i = 0; i < sourceLevel.biases.length; i++) {
                destLevel.biases[i] = sourceLevel.biases[i];
            }
            
            // Copiar pesos
            for (let i = 0; i < sourceLevel.weights.length; i++) {
                for (let j = 0; j < sourceLevel.weights[i].length; j++) {
                    destLevel.weights[i][j] = sourceLevel.weights[i][j];
                }
            }
        }
        return cloned;
    }

    // Serialização em JSON para salvamento
    serialize() {
        return JSON.stringify({
            neuronCounts: this.neuronCounts,
            levels: this.levels.map(level => ({
                biases: level.biases,
                weights: level.weights
            }))
        });
    }

    // Desserialização a partir do JSON salvo
    static deserialize(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.neuronCounts || !data.levels) return null;
            
            const network = new NeuralNetwork(data.neuronCounts);
            for (let l = 0; l < data.levels.length; l++) {
                if (!network.levels[l]) continue;
                network.levels[l].biases = [...data.levels[l].biases];
                network.levels[l].weights = data.levels[l].weights.map(row => [...row]);
            }
            return network;
        } catch (e) {
            console.error("Falha ao descriptografar rede neural:", e);
            return null;
        }
    }
}
