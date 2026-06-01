// ORQUESTRADOR PRINCIPAL DO SIMULADOR (app.js)

// Elementos do DOM
const simCanvas = document.getElementById("simulationCanvas");
const netCanvas = document.getElementById("networkCanvas");
const chartCanvas = document.getElementById("fitnessChartCanvas");

const simCtx = simCanvas.getContext("2d");
const netCtx = netCanvas.getContext("2d");
const chartCtx = chartCanvas.getContext("2d");

// Controles UI
const btnPause = document.getElementById("btn-pause");
const btnRestart = document.getElementById("btn-restart");
const speedSlider = document.getElementById("speed-slider");
const speedVal = document.getElementById("speed-val");

const popSlider = document.getElementById("pop-slider");
const popVal = document.getElementById("pop-val");
const mutationSlider = document.getElementById("mutation-slider");
const mutationVal = document.getElementById("mutation-val");
const crossoverSelect = document.getElementById("crossover-select");

const trackBtns = document.querySelectorAll(".track-btn");
const btnDrawTrack = document.getElementById("btn-draw-track");
const btnClearCustom = document.getElementById("btn-clear-custom");

const btnSaveLocal = document.getElementById("btn-save-local");
const btnDownloadFile = document.getElementById("btn-download-file");
const fileInput = document.getElementById("file-input");
const brainItemsList = document.getElementById("brain-items-list");

const testModeToggle = document.getElementById("test-mode-toggle");
const toggleLabelText = document.getElementById("toggle-label-text");
const testControlsArea = document.getElementById("test-controls-area");
const btnRunTest = document.getElementById("btn-run-test");
const testStatusMsg = document.getElementById("test-status-msg");

const modeStatusDot = document.getElementById("mode-status-dot");
const modeStatusText = document.getElementById("mode-status-text");

// Elementos de Estatísticas
const elGen = document.getElementById("stat-generation");
const elAlive = document.getElementById("stat-alive");
const elBestFit = document.getElementById("stat-best-fitness");
const elMaxFit = document.getElementById("stat-all-time-fitness");

// Estado Global da Aplicação
let trackType = 0;
let track = new Track(trackType);
let cars = [];
let bestCar = null;
let allTimeBestBrain = null;
let allTimeBestFitness = 0;

let generation = 1;
let isPaused = false;
let simulationSpeed = 1;
let populationSize = 100;
let mutationRate = 0.05;
let crossoverMethod = "uniform";

let mode = "training"; // 'training' ou 'test'
let testCar = null;
let selectedSavedBrain = null;

let fitnessHistory = []; // { generation, bestFitness, avgFitness }
let customSpineNodes = [];
let isDrawingCustom = false;

// Estado de transição lenta entre gerações
let isTransitioning = false;
let transitionTimer = 0;
const transitionDuration = 45; // ~0.75 segundos de pausa a 60fps

// Redimensionamento do Canvas
function resizeCanvas() {
    simCanvas.width = 900;
    simCanvas.height = 550;
    netCanvas.width = netCanvas.parentElement.clientWidth;
    netCanvas.height = netCanvas.parentElement.clientHeight || 200;
    chartCanvas.width = chartCanvas.parentElement.clientWidth;
    chartCanvas.height = 70;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// --- INICIALIZAÇÃO DA POPULAÇÃO ---
function startSimulation() {
    cars = [];
    generation = 1;
    fitnessHistory = [];
    allTimeBestFitness = 0;
    
    // Obter ponto de largada e ângulo tangente
    const startData = getStartPoint();
    
    // Se tivermos um cérebro selecionado, podemos inicializar a primeira geração com clones dele + mutação
    const baseBrain = selectedSavedBrain || allTimeBestBrain;
    
    for (let i = 0; i < populationSize; i++) {
        let brain = null;
        if (baseBrain) {
            brain = NeuralNetwork.clone(baseBrain);
            if (i > 0) { // O primeiro é um clone exato, os outros sofrem mutação
                NeuralNetwork.mutate(brain, mutationRate);
            }
        }
        const car = new Car(startData.x, startData.y, 15, 30, "AI", brain);
        car.angle = startData.angle; // Alinha a direção na primeira largada!
        cars.push(car);
    }
    
    bestCar = cars[0];
    updateStatsHUD();
}

function getStartPoint() {
    if (track.spine.length < 2) {
        return { x: 100, y: 100, angle: 0 };
    }
    const p1 = track.spine[0];
    const p2 = track.spine[1];
    
    // Calcula o ângulo perfeito para largar apontado no sentido da pista
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const angle = Math.atan2(-dx, -dy);
    
    return { x: p1.x, y: p1.y, angle };
}

// --- LOOP EVOLUTIVO ---
function nextGeneration() {
    try {
        // 1. Salvar histórico de fitness
        const bestFitness = Math.max(...cars.map(c => c.fitness));
        const avgFitness = cars.reduce((sum, c) => sum + c.fitness, 0) / cars.length;
        
        fitnessHistory.push({
            generation: generation,
            bestFitness: bestFitness,
            avgFitness: avgFitness
        });
        
        // Atualiza melhor histórico geral
        const genBestCar = cars.reduce((best, c) => c.fitness > best.fitness ? c : best, cars[0]);
        if (genBestCar.fitness > allTimeBestFitness) {
            allTimeBestFitness = genBestCar.fitness;
            allTimeBestBrain = NeuralNetwork.clone(genBestCar.brain);
        }
        
        generation++;
        
        // 2. Reproduzir através do Algoritmo Genético
        const startData = getStartPoint();
        cars = GeneticAlgorithm.generateNextGeneration(
            cars,
            mutationRate,
            crossoverMethod,
            populationSize,
            startData.x,
            startData.y
        );
        
        // Posiciona todos na largada apontando na direção certa
        cars.forEach(car => {
            car.angle = startData.angle;
        });
        
        bestCar = cars[0];
        updateStatsHUD();
    } catch (error) {
        console.error("Erro crítico em nextGeneration, reiniciando simulação de segurança:", error);
        // Fallback robusto para evitar travamento da interface do usuário
        startSimulation();
    }
}

// --- RENDERIZAÇÃO E SIMULAÇÃO ---
function animate() {
    try {
        if (!isPaused) {
            const steps = mode === "training" ? simulationSpeed : 1;
            
            for (let s = 0; s < steps; s++) {
                if (mode === "training") {
                    // Se estiver no meio de uma transição lenta, não atualiza os carros
                    if (isTransitioning) {
                        transitionTimer--;
                        if (transitionTimer <= 0) {
                            isTransitioning = false;
                            nextGeneration();
                        }
                        break;
                    }
                    
                    // Modo Treino: Simula toda a população
                    cars.forEach(car => car.update(track.walls, track.checkpoints));
                    
                    // Acha o melhor carro ativo no momento (por maior fitness)
                    const aliveCars = cars.filter(c => !c.damaged);
                    if (aliveCars.length > 0) {
                        bestCar = aliveCars.reduce((best, c) => c.fitness > best.fitness ? c : best, aliveCars[0]);
                    } else {
                        bestCar = cars.reduce((best, c) => c.fitness > best.fitness ? c : best, cars[0]);
                    }
                    
                    // Se todos morreram, inicia a transição lenta de geração!
                    if (cars.every(car => car.damaged)) {
                        isTransitioning = true;
                        transitionTimer = transitionDuration;
                        break; // Sai do laço de steps para renderizar o estado de transição
                    }
                } else if (mode === "test" && testCar) {
                    // Modo de Teste Autônomo com um único cérebro
                    testCar.update(track.walls, track.checkpoints);
                    
                    if (testCar.damaged) {
                        testStatusMsg.textContent = `❌ Batida! Fitness Final: ${Math.round(testCar.fitness)}. Limite alcançado: Checkpoint ${testCar.checkpointsPassed}.`;
                        testStatusMsg.style.color = "var(--color-danger)";
                    } else if (testCar.lapsCompleted > 0) {
                        testStatusMsg.textContent = `🏆 Excelente! Completou a pista do início ao fim com sucesso!`;
                        testStatusMsg.style.color = "var(--color-green)";
                    } else {
                        testStatusMsg.textContent = `🚗 Pilotando... Checkpoints passados: ${testCar.checkpointsPassed}`;
                        testStatusMsg.style.color = "var(--color-orange)";
                    }
                }
            }
        }
        
        // --- DESENHAR PISTA E CARROS ---
        simCtx.clearRect(0, 0, simCanvas.width, simCanvas.height);
        
        if (isDrawingCustom) {
            // Modo Desenho: Mostra ajuda visual
            simCtx.fillStyle = "rgba(0, 220, 255, 0.05)";
            simCtx.fillRect(0, 0, simCanvas.width, simCanvas.height);
            
            simCtx.fillStyle = "var(--text-secondary)";
            simCtx.font = "14px 'Outfit', sans-serif";
            simCtx.fillText("Modo de Desenho: Clique na tela para traçar o meio da pista.", 50, 40);
            simCtx.fillText("Trace um loop fechado. Quando terminar, clique em 'Finalizar Pista'.", 50, 60);
            
            // Desenha os nós já desenhados
            customSpineNodes.forEach((node, i) => {
                simCtx.beginPath();
                simCtx.fillStyle = "var(--color-cyan)";
                simCtx.arc(node.x, node.y, 6, 0, Math.PI * 2);
                simCtx.fill();
                
                if (i > 0) {
                    simCtx.beginPath();
                    simCtx.strokeStyle = "rgba(0, 220, 255, 0.5)";
                    simCtx.lineWidth = 3;
                    simCtx.moveTo(customSpineNodes[i-1].x, customSpineNodes[i-1].y);
                    simCtx.lineTo(node.x, node.y);
                    simCtx.stroke();
                }
            });
        } else {
            // Desenha a pista asfalto + limites neon
            track.draw(simCtx, mode === "training" ? bestCar.nextCheckpointIndex : (testCar ? testCar.nextCheckpointIndex : -1));
            
            if (mode === "training") {
                // Desenha população de carros translúcidos
                cars.forEach(car => {
                    if (car !== bestCar) {
                        car.draw(simCtx, "rgba(255, 255, 255, 0.08)");
                    }
                });
                // Desenha o líder da geração em Neon Green e com os sensores ligados
                if (bestCar) {
                    bestCar.draw(simCtx, "rgba(0, 255, 100, 0.8)", true);
                }
                
                // Desenha o Overlay de transição lenta se estiver ativo
                if (isTransitioning) {
                    simCtx.fillStyle = "rgba(10, 12, 18, 0.82)";
                    simCtx.fillRect(0, 0, simCanvas.width, simCanvas.height);
                    
                    // Título principal
                    simCtx.font = "bold 24px 'Outfit', sans-serif";
                    simCtx.fillStyle = "hsl(190, 100%, 50%)"; // Neon Cyan
                    simCtx.textAlign = "center";
                    simCtx.fillText(`Geração ${generation} Concluída!`, simCanvas.width / 2, simCanvas.height / 2 - 25);
                    
                    // Subtítulo
                    simCtx.font = "14px 'Inter', sans-serif";
                    simCtx.fillStyle = "hsl(210, 12%, 75%)";
                    simCtx.fillText("Selecionando elites e gerando novos pilotos evolutivos...", simCanvas.width / 2, simCanvas.height / 2 + 5);
                    
                    // Barra de Progresso Neon
                    const barWidth = 220;
                    const barHeight = 4;
                    const progress = (transitionDuration - transitionTimer) / transitionDuration;
                    
                    // Fundo da barra
                    simCtx.fillStyle = "rgba(255, 255, 255, 0.08)";
                    simCtx.fillRect(simCanvas.width / 2 - barWidth / 2, simCanvas.height / 2 + 25, barWidth, barHeight);
                    
                    // Progresso preenchido
                    simCtx.fillStyle = "hsl(145, 100%, 50%)"; // Neon Green
                    simCtx.shadowColor = "hsl(145, 100%, 50%)";
                    simCtx.shadowBlur = 6;
                    simCtx.fillRect(simCanvas.width / 2 - barWidth / 2, simCanvas.height / 2 + 25, barWidth * progress, barHeight);
                    simCtx.shadowBlur = 0; // Desativa
                    
                    simCtx.textAlign = "left"; // Reseta alinhamento padrão
                }
            } else if (mode === "test" && testCar) {
                // Desenha o carro de teste em Neon Orange
                testCar.draw(simCtx, "rgba(255, 160, 0, 0.95)", true);
            }
        }
        
        // --- DESENHAR REDE NEURAL E PROGRESSO DO GA ---
        if (mode === "training" && bestCar) {
            Visualizer.drawNetwork(netCtx, bestCar.brain);
        } else if (mode === "test" && testCar) {
            Visualizer.drawNetwork(netCtx, testCar.brain);
        } else if (selectedSavedBrain) {
            Visualizer.drawNetwork(netCtx, selectedSavedBrain);
        }
        
        drawFitnessChart();
        updateLiveStats();
    } catch (error) {
        console.error("Erro capturado no loop de renderização (animacao prossegue):", error);
    }
    
    // requestAnimationFrame FICA FORA DO TRY-CATCH:
    // Garante que o loop de animação NUNCA quebra ou congela a tela!
    requestAnimationFrame(animate);
}

// --- DESENHO DO GRÁFICO DE EVOLUÇÃO ---
function drawFitnessChart() {
    chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    
    if (fitnessHistory.length === 0) {
        chartCtx.fillStyle = "rgba(255, 255, 255, 0.1)";
        chartCtx.font = "10px 'Inter', sans-serif";
        chartCtx.fillText("Nenhum histórico gerado ainda. Aguarde a primeira evolução...", 20, 40);
        return;
    }
    
    const w = chartCanvas.width;
    const h = chartCanvas.height;
    const padding = 15;
    
    const maxFit = Math.max(...fitnessHistory.map(d => d.bestFitness), 10);
    const count = fitnessHistory.length;
    
    // Grid horizontal
    chartCtx.beginPath();
    chartCtx.strokeStyle = "rgba(255,255,255,0.03)";
    chartCtx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
        const y = padding + (h - 2 * padding) * (i / 4);
        chartCtx.moveTo(padding, y);
        chartCtx.lineTo(w - padding, y);
    }
    chartCtx.stroke();
    
    // Desenha linhas
    const getCoords = (index, val) => {
        const x = padding + (w - 2 * padding) * (count === 1 ? 0.5 : index / (count - 1));
        const y = h - padding - (h - 2 * padding) * (val / maxFit);
        return { x, y };
    };
    
    // Desenha área sob a curva de fitness máximo (Gradiente)
    chartCtx.beginPath();
    let grad = chartCtx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(0, 220, 255, 0.15)");
    grad.addColorStop(1, "rgba(0, 220, 255, 0)");
    chartCtx.fillStyle = grad;
    
    let first = getCoords(0, fitnessHistory[0].bestFitness);
    chartCtx.moveTo(first.x, first.y);
    for (let i = 1; i < count; i++) {
        let pt = getCoords(i, fitnessHistory[i].bestFitness);
        chartCtx.lineTo(pt.x, pt.y);
    }
    chartCtx.lineTo(getCoords(count - 1, 0).x, h - padding);
    chartCtx.lineTo(getCoords(0, 0).x, h - padding);
    chartCtx.closePath();
    chartCtx.fill();
    
    // Desenha linha de melhor fitness (Cyan Neon)
    chartCtx.beginPath();
    chartCtx.strokeStyle = "hsl(190, 100%, 50%)";
    chartCtx.lineWidth = 2;
    chartCtx.moveTo(first.x, first.y);
    for (let i = 1; i < count; i++) {
        let pt = getCoords(i, fitnessHistory[i].bestFitness);
        chartCtx.lineTo(pt.x, pt.y);
    }
    chartCtx.stroke();
    
    // Desenha linha de fitness médio (Cinza)
    chartCtx.beginPath();
    chartCtx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    chartCtx.lineWidth = 1;
    chartCtx.setLineDash([3, 3]);
    let firstAvg = getCoords(0, fitnessHistory[0].avgFitness);
    chartCtx.moveTo(firstAvg.x, firstAvg.y);
    for (let i = 1; i < count; i++) {
        let pt = getCoords(i, fitnessHistory[i].avgFitness);
        chartCtx.lineTo(pt.x, pt.y);
    }
    chartCtx.stroke();
    chartCtx.setLineDash([]);
    
    // Desenha pontos para a última geração
    if (count > 0) {
        let lastPt = getCoords(count - 1, fitnessHistory[count - 1].bestFitness);
        chartCtx.beginPath();
        chartCtx.fillStyle = "hsl(145, 100%, 50%)";
        chartCtx.arc(lastPt.x, lastPt.y, 4, 0, Math.PI * 2);
        chartCtx.fill();
    }
}

// --- ATUALIZAÇÕES DE TEXTOS E ESTADÍSTICAS (HUD) ---
function updateStatsHUD() {
    elGen.textContent = generation;
    elMaxFit.textContent = Math.round(allTimeBestFitness);
}

function updateLiveStats() {
    if (mode === "training") {
        const aliveCount = cars.filter(c => !c.damaged).length;
        elAlive.textContent = `${aliveCount} / ${populationSize}`;
        elBestFit.textContent = bestCar ? Math.round(bestCar.fitness) : 0;
    } else {
        elAlive.textContent = "1 / 1 (Teste)";
        elBestFit.textContent = testCar ? Math.round(testCar.fitness) : 0;
    }
}

// --- COMPONENTE VISUALIZADOR DA REDE NEURAL ---
class Visualizer {
    static drawNetwork(ctx, network) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        
        const neuronRadius = 11;
        const padding = 25;
        
        const levels = network.levels;
        const levelCount = levels.length;
        const layerCount = levelCount + 1;
        
        // Coordenadas X das camadas
        const layerX = [];
        for (let i = 0; i < layerCount; i++) {
            layerX.push(lerp(padding, width - padding, i / (layerCount - 1)));
        }
        
        // Coordenadas Y dos neurônios
        const getNeuronY = (neuronCount, neuronIndex) => {
            return lerp(padding, height - padding, neuronCount === 1 ? 0.5 : neuronIndex / (neuronCount - 1));
        };
        
        // 1. Desenha as Conexões (Sinapses / Pesos)
        for (let l = 0; l < levelCount; l++) {
            const level = levels[l];
            const leftCount = level.inputs.length;
            const rightCount = level.outputs.length;
            
            const leftX = layerX[l];
            const rightX = layerX[l + 1];
            
            for (let i = 0; i < leftCount; i++) {
                for (let j = 0; j < rightCount; j++) {
                    const weight = level.weights[i][j];
                    const val = level.inputs[i] * weight;
                    
                    ctx.beginPath();
                    ctx.moveTo(leftX, getNeuronY(leftCount, i));
                    ctx.lineTo(rightX, getNeuronY(rightCount, j));
                    
                    // Cor baseada no peso: Ciano para positivo, Rosa para negativo
                    const opacity = Math.abs(weight) * 0.45;
                    ctx.strokeStyle = weight > 0 
                        ? `hsla(190, 100%, 50%, ${opacity})`
                        : `hsla(330, 100%, 60%, ${opacity})`;
                    
                    // Espessura baseada na magnitude do peso
                    ctx.lineWidth = Math.abs(weight) * 2.5;
                    ctx.stroke();
                    
                    // Anima pulso se o sinal passar ativo
                    if (Math.abs(val) > 0.1) {
                        ctx.beginPath();
                        ctx.fillStyle = weight > 0 ? "rgba(0, 220, 255, 0.4)" : "rgba(255, 0, 80, 0.4)";
                        // Desenha um pequeno ponto pulsando
                        const pulseT = (Date.now() / 1500) % 1;
                        const pulseX = lerp(leftX, rightX, pulseT);
                        const pulseY = lerp(getNeuronY(leftCount, i), getNeuronY(rightCount, j), pulseT);
                        ctx.arc(pulseX, pulseY, 1.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
        
        // 2. Desenha os Neurônios (Camadas)
        for (let l = 0; l <= levelCount; l++) {
            const neuronCount = l === 0 ? levels[0].inputs.length : levels[l - 1].outputs.length;
            const x = layerX[l];
            
            for (let i = 0; i < neuronCount; i++) {
                const y = getNeuronY(neuronCount, i);
                let activation = 0;
                
                if (l === 0) {
                    activation = levels[0].inputs[i]; // Entradas normais
                } else {
                    activation = levels[l - 1].outputs[i]; // Saídas do nível anterior
                }
                
                // Círculo base do neurônio
                ctx.beginPath();
                ctx.arc(x, y, neuronRadius, 0, Math.PI * 2);
                ctx.fillStyle = "hsl(225, 20%, 11%)";
                ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
                ctx.lineWidth = 1.5;
                ctx.fill();
                ctx.stroke();
                
                // Brilho de ativação (amarelo/verde neon se positivo, rosa se negativo)
                if (Math.abs(activation) > 0.05) {
                    ctx.beginPath();
                    ctx.arc(x, y, neuronRadius - 1.5, 0, Math.PI * 2);
                    const color = activation > 0 ? "rgba(0, 255, 100, " : "rgba(255, 0, 80, ";
                    ctx.fillStyle = `${color}${Math.abs(activation) * 0.75})`;
                    ctx.fill();
                }
                
                // Texto com os nomes simplificados nas pontas
                if (l === 0) {
                    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                    ctx.font = "8px 'Outfit', sans-serif";
                    const names = ["S_Esq90", "S_Esq45", "S_Frente", "S_Dir45", "S_Dir90", "Veloc"];
                    ctx.fillText(names[i] || `In${i}`, x - 38, y + 3);
                } else if (l === levelCount) {
                    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
                    ctx.font = "8px 'Outfit', sans-serif";
                    const names = ["Direção", "Acelera"];
                    ctx.fillText(names[i] || `Out${i}`, x + 15, y + 3);
                }
            }
        }
    }
}

// --- INTERFACES DO USUÁRIO E EVENT LISTENERS ---

// Pausar/Despausar
btnPause.addEventListener("click", () => {
    isPaused = !isPaused;
    btnPause.textContent = isPaused ? "Retomar" : "Pausar";
    btnPause.className = isPaused ? "btn btn-primary" : "btn btn-secondary";
});

// Reiniciar Geração
btnRestart.addEventListener("click", () => {
    startSimulation();
});

// Slider de Velocidade
speedSlider.addEventListener("input", (e) => {
    simulationSpeed = parseInt(e.target.value);
    speedVal.textContent = `${simulationSpeed}x`;
});

// Slider de População
popSlider.addEventListener("input", (e) => {
    populationSize = parseInt(e.target.value);
    popVal.textContent = populationSize;
});

// Slider de Mutação
mutationSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    mutationRate = val / 100;
    mutationVal.textContent = `${val}%`;
});

// Select de Crossover
crossoverSelect.addEventListener("change", (e) => {
    crossoverMethod = e.target.value;
});

// Seleção de Pistas Predefinidas
trackBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
        const btnElem = e.currentTarget;
        trackBtns.forEach(b => b.classList.remove("active"));
        btnElem.classList.add("active");
        
        trackType = parseInt(btnElem.dataset.track);
        isDrawingCustom = false;
        btnDrawTrack.textContent = "✏️ Desenhar Parede";
        btnClearCustom.classList.add("hidden");
        
        track = new Track(trackType);
        
        if (mode === "training") {
            startSimulation();
        } else {
            resetTestCar();
        }
    });
});

// MODO DE DESENHO DE PISTAS
btnDrawTrack.addEventListener("click", () => {
    if (!isDrawingCustom) {
        isDrawingCustom = true;
        customSpineNodes = [];
        btnDrawTrack.textContent = "💾 Finalizar Pista";
        btnClearCustom.classList.remove("hidden");
        // Pausa simulador durante desenho
        isPaused = true;
        btnPause.textContent = "Retomar";
    } else {
        if (customSpineNodes.length < 3) {
            alert("Desenhe ao menos 3 pontos clicando no circuito para criar a pista!");
            return;
        }
        isDrawingCustom = false;
        btnDrawTrack.textContent = "✏️ Desenhar Parede";
        
        // Cria a pista customizada baseada nos nós traçados
        track = new Track(-1, customSpineNodes);
        isPaused = false;
        btnPause.textContent = "Pausar";
        
        if (mode === "training") {
            startSimulation();
        } else {
            resetTestCar();
        }
    }
});

btnClearCustom.addEventListener("click", () => {
    customSpineNodes = [];
    simCtx.clearRect(0, 0, simCanvas.width, simCanvas.height);
});

// Captura cliques no Canvas para desenhar a espinha dorsal
simCanvas.addEventListener("mousedown", (e) => {
    if (!isDrawingCustom) return;
    
    // Coordenada do clique relativa ao canvas
    const rect = simCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    customSpineNodes.push({ x, y });
});

// --- PERSISTÊNCIA E SALVAMENTO DE MODELOS ---

// Carrega os Cérebros Salvos na Lista Visual
function updateSavedBrainsUI() {
    brainItemsList.innerHTML = "";
    
    // Preenche com cérebros do localStorage
    let loadedAny = false;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith("brain_")) {
            loadedAny = true;
            const name = key.replace("brain_", "");
            const brainData = localStorage.getItem(key);
            
            // Criar linha de cérebro na interface
            const item = document.createElement("div");
            item.className = "brain-item";
            if (selectedSavedBrain && key === `brain_${selectedSavedBrain.name}`) {
                item.classList.add("selected");
            }
            
            item.innerHTML = `
                <span class="brain-name" title="${name}">${name}</span>
                <div class="brain-actions">
                    <button class="btn-load-item" title="Selecionar para Teste">🎯</button>
                    <button class="btn-delete-item" title="Deletar">🗑️</button>
                </div>
            `;
            
            // Eventos das ações
            item.querySelector(".btn-load-item").addEventListener("click", () => {
                const network = NeuralNetwork.deserialize(brainData);
                if (network) {
                    selectedSavedBrain = network;
                    selectedSavedBrain.name = name;
                    
                    document.querySelectorAll(".brain-item").forEach(el => el.classList.remove("selected"));
                    item.classList.add("selected");
                    
                    testStatusMsg.textContent = `🎯 Cérebro "${name}" selecionado! Ative o Modo de Teste abaixo para pilotar.`;
                    testStatusMsg.style.color = "var(--color-green)";
                    
                    if (mode === "test") {
                        resetTestCar();
                    }
                }
            });
            
            item.querySelector(".btn-delete-item").addEventListener("click", () => {
                if (confirm(`Excluir o cérebro "${name}" do navegador?`)) {
                    localStorage.removeItem(key);
                    updateSavedBrainsUI();
                    if (selectedSavedBrain && name === selectedSavedBrain.name) {
                        selectedSavedBrain = null;
                        testStatusMsg.textContent = "Selecione um cérebro salvo acima para testar.";
                        testStatusMsg.style.color = "var(--color-orange)";
                    }
                }
            });
            
            brainItemsList.appendChild(item);
        }
    }
    
    if (!loadedAny) {
        brainItemsList.innerHTML = `<div class="section-desc text-center py-2" style="font-style: italic;">Nenhum cérebro salvo. Treine os carros e salve no navegador!</div>`;
    }
}

// Salvar no Navegador
btnSaveLocal.addEventListener("click", () => {
    if (!bestCar || !bestCar.brain) {
        alert("Nenhum modelo treinado para salvar ainda!");
        return;
    }
    
    const name = prompt("Dê um nome para este cérebro treinado:", `Piloto_Gen_${generation}_Fit_${Math.round(bestCar.fitness)}`);
    if (!name) return;
    
    const serialized = bestCar.brain.serialize();
    localStorage.setItem(`brain_${name}`, serialized);
    
    updateSavedBrainsUI();
    alert(`Cérebro "${name}" salvo localmente com sucesso!`);
});

// Baixar arquivo JSON
btnDownloadFile.addEventListener("click", () => {
    const brainToSave = mode === "test" && testCar ? testCar.brain : (bestCar ? bestCar.brain : null);
    if (!brainToSave) {
        alert("Nenhum cérebro ativo para baixar!");
        return;
    }
    
    const serialized = brainToSave.serialize();
    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `cerebro_autonomo_fit_${Math.round(bestCar.fitness)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Carregar arquivo JSON
fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        const network = NeuralNetwork.deserialize(evt.target.result);
        if (network) {
            const name = file.name.replace(".json", "");
            localStorage.setItem(`brain_${name}`, evt.target.result);
            updateSavedBrainsUI();
            alert(`Cérebro "${name}" importado com sucesso!`);
        } else {
            alert("Arquivo JSON inválido ou corrompido!");
        }
    };
    reader.readAsText(file);
});

// --- MODO DE TESTE AUTÔNOMO ---

// Alternar Modo de Teste
testModeToggle.addEventListener("change", (e) => {
    const active = e.target.checked;
    if (active) {
        mode = "test";
        toggleLabelText.textContent = "Modo de Teste ATIVO";
        modeStatusDot.className = "pulse-dot active test-mode";
        modeStatusText.textContent = "Modo de Validação Ativo";
        testControlsArea.classList.remove("hidden");
        
        if (selectedSavedBrain) {
            testStatusMsg.textContent = `🎯 Cérebro "${selectedSavedBrain.name}" pronto para rodar.`;
            testStatusMsg.style.color = "var(--color-green)";
        } else {
            testStatusMsg.textContent = `⚠️ Atenção: Nenhum cérebro carregado. Usando melhor cérebro provisório.`;
            testStatusMsg.style.color = "var(--color-orange)";
        }
        
        resetTestCar();
    } else {
        mode = "training";
        toggleLabelText.textContent = "Ativar Modo de Teste";
        modeStatusDot.className = "pulse-dot active";
        modeStatusText.textContent = "Modo de Treinamento Ativo";
        testControlsArea.classList.add("hidden");
        
        startSimulation();
    }
});

function resetTestCar() {
    const startData = getStartPoint();
    
    // Pega o cérebro selecionado na UI, senão pega o melhor histórico, senão inicializa um novo
    let brainToTest = selectedSavedBrain || allTimeBestBrain;
    if (!brainToTest && cars.length > 0) {
        const sorted = [...cars].sort((a,b)=>b.fitness - a.fitness);
        brainToTest = sorted[0].brain;
    }
    
    if (!brainToTest) {
        // Fallback: inicializa cérebro aleatório se nunca treinou e não carregou nada
        brainToTest = new NeuralNetwork([6, 6, 2]);
    }
    
    testCar = new Car(startData.x, startData.y, 15, 30, "AI", NeuralNetwork.clone(brainToTest));
    testCar.angle = startData.angle;
    testStatusMsg.textContent = "Clique em Iniciar Corrida para validar o motorista.";
    testStatusMsg.style.color = "var(--text-secondary)";
}

btnRunTest.addEventListener("click", () => {
    resetTestCar();
    isPaused = false;
    btnPause.textContent = "Pausar";
    btnPause.className = "btn btn-secondary";
    testStatusMsg.textContent = "🚗 Carro pilotando na pista...";
    testStatusMsg.style.color = "var(--color-green)";
});

// Adiciona listener global para redefinir simulação rápida com 'R'
window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") {
        if (mode === "training") {
            startSimulation();
        } else {
            resetTestCar();
        }
    }
});

// --- EXECUÇÃO INICIAL ---

// Cria alguns cérebros pré-treinados falsos / mockados se for a primeira visita para o usuário não começar do zero!
function populatePretrainedBrainsIfEmpty() {
    if (localStorage.length === 0 || !Object.keys(localStorage).some(k => k.startsWith("brain_"))) {
        // Criar cérebros estruturados com pesos padrão simulados
        const mockBrain1 = new NeuralNetwork([6, 6, 2]);
        // Adiciona um comportamento básico (dirigir em frente e desviar de obstáculos)
        // Ajustamos os pesos de forma simplificada para que ele tenha alguma inteligência
        // Sensor da frente (índice 2) inibe aceleração e faz virar se muito perto
        mockBrain1.levels[0].weights[2][0] = 0.8;  // Sensor central influencia direção
        mockBrain1.levels[0].weights[2][1] = -0.5; // Sensor central reduz velocidade
        mockBrain1.levels[0].weights[0][0] = -0.6; // Sensor esquerda vira direita
        mockBrain1.levels[0].weights[4][0] = 0.6;  // Sensor direita vira esquerda
        mockBrain1.levels[0].biases[1] = 0.3;      // Bias para sempre andar pra frente
        
        localStorage.setItem("brain_Piloto_Basico_Pista1", mockBrain1.serialize());
    }
}

populatePretrainedBrainsIfEmpty();
updateSavedBrainsUI();
startSimulation();
animate();
