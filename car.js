// SIMULAÇÃO DO CARRO E SENSORES (car.js)

class Car {
    constructor(x, y, width, height, controlType = "AI", brain = null) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.width = width;
        this.height = height;
        
        // Física de Movimento
        this.speed = 0;
        this.acceleration = 0.2;
        this.maxSpeed = 3.5;
        this.friction = 0.05;
        this.angle = 0;
        
        // Controle e Cérebro
        this.controlType = controlType;
        this.brain = brain;
        if (this.controlType === "AI") {
            if (!this.brain) {
                // Entrada: 5 sensores + 1 velocidade = 6 neurônios
                // Oculta: 6 neurônios
                // Saída: 2 neurônios (Direção [-1, 1], Velocidade [-1, 1])
                this.brain = new NeuralNetwork([6, 6, 2]);
            }
        }
        
        // Sensores
        this.sensorCount = 5;
        this.sensorLength = 160;
        this.sensorAngleSpread = Math.PI / 2.5; // Espalhamento angular (~72 graus)
        this.sensors = [];
        this.readings = new Array(this.sensorCount).fill(null);
        
        // Estados de Colisão e GA
        this.damaged = false;
        this.polygon = this.createPolygon();
        
        // Fitness e Progresso
        this.checkpointsPassed = 0;
        this.nextCheckpointIndex = 0;
        this.fitness = 0;
        this.timeSinceLastCheckpoint = 0; // Previne carros parados ou girando
        this.maxTimeStagnant = 240; // ~4 segundos a 60fps antes de morrer por inatividade
        this.lapsCompleted = 0;
    }
    
    // Atualiza o estado físico do carro a cada frame
    update(trackWalls, checkpoints, speedMultiplier = 1) {
        if (!this.damaged) {
            this.prevX = this.x;
            this.prevY = this.y;
            
            // 1. Atualizar Sensores Primeiro (para alimentar a rede neural com entradas válidas)
            this.updateSensors(trackWalls);
            
            // 2. Obter comandos de controle (Teclas ou Rede Neural)
            const controls = this.getControls(checkpoints);
            
            // 3. Aplicar Física de Movimento
            this.applyPhysics(controls);
            
            // 4. Atualizar Polígono de Colisão
            this.polygon = this.createPolygon();
            
            // 5. Checar Colisão com as Paredes
            this.damaged = this.checkCollision(trackWalls);
            
            // 6. Atualizar Progresso de Checkpoints e Fitness
            this.updateProgress(checkpoints);
        }
    }
    
    // Determina a direção e velocidade com base no tipo de controle
    getControls(checkpoints) {
        const controls = { forward: 0, steering: 0 };
        
        if (this.controlType === "AI") {
            // Atualiza leituras dos sensores
            const sensorInputs = this.readings.map(r => r ? 1 - r.offset : 0); // 1 perto, 0 longe
            
            // Velocidade normalizada como entrada extra (0 a 1)
            const speedInput = this.speed / this.maxSpeed;
            
            // Monta o vetor de entrada
            const inputs = [...sensorInputs, speedInput];
            
            // Alimenta a Rede Neural
            const outputs = NeuralNetwork.feedForward(inputs, this.brain);
            
            // Mapeia saídas analógicas (-1 a 1)
            controls.steering = outputs[0]; // Saída 1: Direção (Negativo = Direita, Positivo = Esquerda)
            controls.forward = outputs[1];  // Saída 2: Aceleração/Frenagem
        }
        
        return controls;
    }
    
    applyPhysics(controls) {
        // Aceleração
        if (controls.forward > 0.1) {
            this.speed += this.acceleration * controls.forward;
        } else if (controls.forward < -0.1) {
            this.speed += this.acceleration * controls.forward * 0.5; // Ré mais lenta
        }
        
        // Limita velocidade máxima
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;
        
        // Atrito
        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < this.friction) this.speed = 0;
        
        // Direção: O carro só vira se estiver se movendo
        if (this.speed !== 0) {
            const flip = this.speed > 0 ? 1 : -1;
            // Direção analógica suavizada baseada no controle
            this.angle += 0.04 * controls.steering * flip * (Math.abs(this.speed) / this.maxSpeed + 0.3);
        }
        
        // Atualiza posição baseada no ângulo
        this.x -= Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
    }
    
    // Cria um polígono com os 4 cantos rotacionados do carro para colisão precisa
    createPolygon() {
        const points = [];
        const rad = Math.hypot(this.width, this.height) / 2;
        const alpha = Math.atan2(this.width, this.height);
        
        // Superior Direito
        points.push({
            x: this.x - Math.sin(this.angle - alpha) * rad,
            y: this.y - Math.cos(this.angle - alpha) * rad
        });
        // Superior Esquerdo
        points.push({
            x: this.x - Math.sin(this.angle + alpha) * rad,
            y: this.y - Math.cos(this.angle + alpha) * rad
        });
        // Inferior Esquerdo
        points.push({
            x: this.x - Math.sin(this.angle - alpha + Math.PI) * rad,
            y: this.y - Math.cos(this.angle - alpha + Math.PI) * rad
        });
        // Inferior Direito
        points.push({
            x: this.x - Math.sin(this.angle + alpha + Math.PI) * rad,
            y: this.y - Math.cos(this.angle + alpha + Math.PI) * rad
        });
        
        return points;
    }
    
    // Verifica colisão entre o polígono do carro e as paredes da pista
    checkCollision(trackWalls) {
        for (let i = 0; i < this.polygon.length; i++) {
            const p1 = this.polygon[i];
            const p2 = this.polygon[(i + 1) % this.polygon.length];
            
            for (let j = 0; j < trackWalls.length; j++) {
                const wall = trackWalls[j];
                const touch = getIntersection(
                    p1, p2,
                    { x: wall.x1, y: wall.y1 },
                    { x: wall.x2, y: wall.y2 }
                );
                if (touch) return true; // Colidiu!
            }
        }
        return false;
    }
    
    // Atualiza a posição dos raios de sensores e calcula intersecção com paredes
    updateSensors(trackWalls) {
        this.sensors = [];
        this.readings = [];
        
        for (let i = 0; i < this.sensorCount; i++) {
            // Calcula o ângulo absoluto de cada raio do leque
            const sensorAngle = lerp(
                this.sensorAngleSpread / 2,
                -this.sensorAngleSpread / 2,
                this.sensorCount === 1 ? 0.5 : i / (this.sensorCount - 1)
            ) + this.angle;
            
            const start = { x: this.x, y: this.y };
            const end = {
                x: this.x - Math.sin(sensorAngle) * this.sensorLength,
                y: this.y - Math.cos(sensorAngle) * this.sensorLength
            };
            
            this.sensors.push([start, end]);
            
            // Encontra a colisão mais próxima para este raio
            let closestTouch = null;
            for (let j = 0; j < trackWalls.length; j++) {
                const wall = trackWalls[j];
                const touch = getIntersection(
                    start, end,
                    { x: wall.x1, y: wall.y1 },
                    { x: wall.x2, y: wall.y2 }
                );
                
                if (touch) {
                    if (!closestTouch || touch.offset < closestTouch.offset) {
                        closestTouch = touch;
                    }
                }
            }
            this.readings.push(closestTouch);
        }
    }
    
    // Incrementa progresso de checkpoints e calcula o score/fitness do carro
    updateProgress(checkpoints) {
        this.timeSinceLastCheckpoint++;
        
        const totalCp = checkpoints.length;
        const targetCp = checkpoints[this.nextCheckpointIndex];
        
        // Verifica se a trajetória de movimento do carro cruzou o checkpoint alvo
        const movementStart = { x: this.prevX, y: this.prevY };
        const movementEnd = { x: this.x, y: this.y };
        
        const crossed = getIntersection(
            movementStart, movementEnd,
            { x: targetCp.x1, y: targetCp.y1 },
            { x: targetCp.x2, y: targetCp.y2 }
        );
        
        if (crossed) {
            this.checkpointsPassed++;
            this.nextCheckpointIndex = (this.nextCheckpointIndex + 1) % totalCp;
            this.timeSinceLastCheckpoint = 0; // Reseta inatividade
            
            if (this.nextCheckpointIndex === 0) {
                this.lapsCompleted++;
            }
        }
        
        // Calcula o bônus contínuo de distância para suavizar o fitness
        // Quanto mais perto do próximo checkpoint, maior o bônus
        const prevCpIndex = (this.nextCheckpointIndex - 1 + totalCp) % totalCp;
        const prevCp = checkpoints[prevCpIndex];
        
        const totalDistanceBetweenCheckpoints = distance(prevCp.center, targetCp.center) || 1;
        const distanceToTarget = distance({ x: this.x, y: this.y }, targetCp.center);
        
        // Bônus contínuo entre 0 e 1 dependendo da aproximação
        const continuousBonus = Math.max(0, 1 - (distanceToTarget / totalDistanceBetweenCheckpoints));
        
        // FÓRMULA DE FITNESS
        // Prioriza checkpoints passados. Adiciona o bônus contínuo. Penaliza inatividade.
        this.fitness = (this.checkpointsPassed * 100) + (continuousBonus * 100);
        
        // Matar o carro por inatividade/estagnação (ex: travado contra parede ou andando em círculos)
        if (this.timeSinceLastCheckpoint > this.maxTimeStagnant) {
            this.damaged = true;
            this.fitness = Math.max(1, this.fitness - 50); // Penalização por estagnação
        }
    }
    
    // Desenha o carro no Canvas
    draw(ctx, color = "rgba(255, 255, 255, 0.2)", drawSensors = false) {
        // 1. Desenhar Sensores (apenas para o melhor carro ou se habilitado)
        if (drawSensors && !this.damaged) {
            for (let i = 0; i < this.sensorCount; i++) {
                let end = this.sensors[i][1];
                if (this.readings[i]) {
                    end = this.readings[i]; // Corta o raio na colisão
                }
                
                // Raio livre (Verde Transparente)
                ctx.beginPath();
                ctx.strokeStyle = "rgba(0, 255, 100, 0.4)";
                ctx.lineWidth = 1.5;
                ctx.moveTo(this.sensors[i][0].x, this.sensors[i][0].y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
                
                // Ponto de colisão (Vermelho Neon)
                if (this.readings[i]) {
                    ctx.beginPath();
                    ctx.fillStyle = "hsl(330, 100%, 60%)";
                    ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Raio bloqueado (Vermelho suave)
                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(255, 0, 80, 0.3)";
                    ctx.moveTo(end.x, end.y);
                    ctx.lineTo(this.sensors[i][1].x, this.sensors[i][1].y);
                    ctx.stroke();
                }
            }
        }
        
        // 2. Desenhar o Polígono do Carro
        ctx.beginPath();
        if (this.damaged) {
            ctx.fillStyle = "rgba(255, 0, 80, 0.35)"; // Carro destruído
            ctx.strokeStyle = "hsl(0, 100%, 50%)";
            ctx.lineWidth = 1;
        } else {
            ctx.fillStyle = color;
            ctx.strokeStyle = color.includes("145") ? "rgba(255,255,255,0.6)" : "rgba(255, 255, 255, 0.2)";
            ctx.lineWidth = color.includes("145") ? 2 : 1;
        }
        
        ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
        for (let i = 1; i < this.polygon.length; i++) {
            ctx.lineTo(this.polygon[i].x, this.polygon[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}
