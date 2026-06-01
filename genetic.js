// OPERADORES E REPRODUÇÃO DO ALGORITMO GENÉTICO (genetic.js)

class GeneticAlgorithm {
    /**
     * Gera a próxima geração de carros a partir da geração anterior.
     * @param {Array<Car>} oldPopulation - População anterior.
     * @param {number} mutationRate - Taxa de mutação (0.0 a 1.0).
     * @param {string} crossoverMethod - 'uniform', 'single' ou 'average'.
     * @param {number} populationSize - Tamanho total da população a ser gerada.
     * @param {number} startX - Coordenada X de largada.
     * @param {number} startY - Coordenada Y de largada.
     * @returns {Array<Car>} A nova população de carros.
     */
    static generateNextGeneration(oldPopulation, mutationRate, crossoverMethod, populationSize, startX, startY) {
        const nextPopulation = [];
        
        // 1. Classifica a população anterior por Fitness (Decrescente)
        const rankedPopulation = [...oldPopulation].sort((a, b) => b.fitness - a.fitness);
        const bestCar = rankedPopulation[0];
        
        // 2. ELITISMO: Preserva os melhores indivíduos diretamente para a próxima geração sem alterações
        // Isso impede que percamos a melhor solução já encontrada.
        const eliteCount = Math.min(rankedPopulation.length, Math.max(1, Math.floor(populationSize * 0.05))); // 5% de elite (limitado à população existente)
        for (let i = 0; i < eliteCount; i++) {
            // Copia profunda da rede do melhor para não ter mutação acidental
            const eliteBrain = NeuralNetwork.clone(rankedPopulation[i].brain);
            const eliteCar = new Car(startX, startY, 15, 30, "AI", eliteBrain);
            nextPopulation.push(eliteCar);
        }
        
        // 3. REPRODUÇÃO: Cruzamento e mutação para preencher as vagas restantes da população
        const remainingCount = populationSize - eliteCount;
        for (let i = 0; i < remainingCount; i++) {
            // Seleção de pais via Torneio (muito mais seletivo e robusto que Roleta simples)
            const parentA = GeneticAlgorithm.selectParentTournament(rankedPopulation, 5);
            const parentB = GeneticAlgorithm.selectParentTournament(rankedPopulation, 5);
            
            // Crossover (Cruzamento)
            const childBrain = NeuralNetwork.crossover(parentA.brain, parentB.brain, crossoverMethod);
            
            // Mutação (com a taxa de mutação selecionada)
            NeuralNetwork.mutate(childBrain, mutationRate);
            
            // Cria o novo indivíduo
            const childCar = new Car(startX, startY, 15, 30, "AI", childBrain);
            nextPopulation.push(childCar);
        }
        
        return nextPopulation;
    }
    
    /**
     * Seleção por Torneio: Escolhe k indivíduos aleatórios e retorna o melhor entre eles.
     * @param {Array<Car>} population - População ranqueada.
     * @param {number} k - Tamanho do torneio.
     * @returns {Car} O indivíduo vencedor selecionado como pai.
     */
    static selectParentTournament(population, k = 5) {
        let best = null;
        for (let i = 0; i < k; i++) {
            const ind = population[Math.floor(Math.random() * population.length)];
            if (!best || ind.fitness > best.fitness) {
                best = ind;
            }
        }
        return best;
    }
}
