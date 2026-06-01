// PISTAS E GEOMETRIA DE COLISÃO (track.js)

class Track {
    constructor(type = 0, customSpine = null) {
        this.type = type;
        this.width = 900;
        this.height = 550;
        this.roadWidth = 60; // Largura padrão da pista
        
        this.spine = [];
        this.walls = [];
        this.checkpoints = [];
        this.innerPoints = [];
        this.outerPoints = [];
        
        if (customSpine && customSpine.length > 2) {
            this.spine = customSpine;
            this.roadWidth = 45; // Mais estreito para pistas customizadas
            this.buildTrack(true); // Loop fechado por padrão para customizado
        } else {
            this.loadPredefinedTrack(type);
        }
    }
    
    loadPredefinedTrack(type) {
        this.spine = [];
        const w = this.width;
        const h = this.height;
        
        switch (type) {
            case 0: // PISTA 1: OVAL (FÁCIL)
                this.roadWidth = 65;
                const points = 16;
                const cx = w / 2;
                const cy = h / 2 + 10;
                const rx = w * 0.38;
                const ry = h * 0.34;
                for (let i = 0; i < points; i++) {
                    const angle = (i / points) * Math.PI * 2;
                    // Distorce levemente para não ser um círculo perfeito
                    const x = cx + Math.cos(angle) * rx;
                    const y = cy + Math.sin(angle) * ry;
                    this.spine.push({ x, y });
                }
                this.buildTrack(true);
                break;
                
            case 1: // PISTA 2: S-CURVA / LOOP DUPLO (MÉDIO)
                this.roadWidth = 50;
                // Define um trajeto em formato de 8 esticado horizontalmente ou curvas em S
                const sPoints = [
                    { x: 150, y: 150 },
                    { x: 300, y: 100 },
                    { x: 500, y: 150 },
                    { x: 650, y: 300 },
                    { x: 800, y: 400 },
                    { x: 750, y: 480 },
                    { x: 600, y: 450 },
                    { x: 450, y: 250 },
                    { x: 300, y: 350 },
                    { x: 120, y: 420 },
                    { x: 80,  y: 300 }
                ];
                this.spine = sPoints;
                this.buildTrack(true);
                break;
                
            case 2: // PISTA 3: GRAMPOS E RETAS SHARP (DIFÍCIL)
                this.roadWidth = 40;
                // Pista complexa, estreita e com curvas fechadas
                const hardPoints = [
                    { x: 100, y: 100 },
                    { x: 400, y: 80 },
                    { x: 400, y: 220 },
                    { x: 250, y: 220 },
                    { x: 250, y: 340 },
                    { x: 550, y: 340 },
                    { x: 550, y: 100 },
                    { x: 800, y: 100 },
                    { x: 820, y: 480 },
                    { x: 480, y: 480 },
                    { x: 480, y: 410 },
                    { x: 100, y: 410 }
                ];
                this.spine = hardPoints;
                this.buildTrack(true);
                break;
        }
    }
    
    buildTrack(closed = true) {
        this.walls = [];
        this.checkpoints = [];
        this.innerPoints = [];
        this.outerPoints = [];
        
        const count = this.spine.length;
        if (count < 2) return;
        
        // Calcula as normais para cada nó da espinha dorsal do circuito
        for (let i = 0; i < count; i++) {
            const curr = this.spine[i];
            const next = this.spine[(i + 1) % count];
            const prev = this.spine[(i - 1 + count) % count];
            
            let dx, dy;
            if (closed) {
                const d1 = { x: curr.x - prev.x, y: curr.y - prev.y };
                const d2 = { x: next.x - curr.x, y: next.y - curr.y };
                const len1 = Math.hypot(d1.x, d1.y) || 1;
                const len2 = Math.hypot(d2.x, d2.y) || 1;
                dx = d1.x / len1 + d2.x / len2;
                dy = d1.y / len1 + d2.y / len2;
            } else {
                if (i === 0) {
                    dx = next.x - curr.x;
                    dy = next.y - curr.y;
                } else if (i === count - 1) {
                    dx = curr.x - prev.x;
                    dy = curr.y - prev.y;
                } else {
                    const d1 = { x: curr.x - prev.x, y: curr.y - prev.y };
                    const d2 = { x: next.x - curr.x, y: next.y - curr.y };
                    const len1 = Math.hypot(d1.x, d1.y) || 1;
                    const len2 = Math.hypot(d2.x, d2.y) || 1;
                    dx = d1.x / len1 + d2.x / len2;
                    dy = d1.y / len1 + d2.y / len2;
                }
            }
            
            // Tangente normalizada
            const len = Math.hypot(dx, dy) || 1;
            const tx = dx / len;
            const ty = dy / len;
            
            // Vetor Normal (Perpendicular à pista)
            const nx = -ty;
            const ny = tx;
            
            // Pontos das paredes externas e internas
            const outer = { x: curr.x + nx * this.roadWidth, y: curr.y + ny * this.roadWidth };
            const inner = { x: curr.x - nx * this.roadWidth, y: curr.y - ny * this.roadWidth };
            
            this.outerPoints.push(outer);
            this.innerPoints.push(inner);
        }
        
        // Criar os segmentos de paredes
        const end = closed ? count : count - 1;
        for (let i = 0; i < end; i++) {
            const nextIdx = (i + 1) % count;
            
            // Parede Externa (Lateral Direita)
            this.walls.push({
                x1: this.outerPoints[i].x,
                y1: this.outerPoints[i].y,
                x2: this.outerPoints[nextIdx].x,
                y2: this.outerPoints[nextIdx].y
            });
            
            // Parede Interna (Lateral Esquerda)
            this.walls.push({
                x1: this.innerPoints[i].x,
                y1: this.innerPoints[i].y,
                x2: this.innerPoints[nextIdx].x,
                y2: this.innerPoints[nextIdx].y
            });
        }
        
        // Se a pista não for fechada, fecha as extremidades
        if (!closed) {
            this.walls.push({
                x1: this.innerPoints[0].x,
                y1: this.innerPoints[0].y,
                x2: this.outerPoints[0].x,
                y2: this.outerPoints[0].y
            });
            this.walls.push({
                x1: this.innerPoints[count - 1].x,
                y1: this.innerPoints[count - 1].y,
                x2: this.outerPoints[count - 1].x,
                y2: this.outerPoints[count - 1].y
            });
        }
        
        // Criar Checkpoints transversais (de parede a parede)
        for (let i = 0; i < count; i++) {
            this.checkpoints.push({
                index: i,
                x1: this.innerPoints[i].x,
                y1: this.innerPoints[i].y,
                x2: this.outerPoints[i].x,
                y2: this.outerPoints[i].y,
                center: { x: this.spine[i].x, y: this.spine[i].y }
            });
        }
    }
    
    // Desenha a pista de corrida com visual premium de asfalto
    draw(ctx, bestCarCheckpoint = -1) {
        if (this.spine.length < 2) return;
        
        // 1. Desenha o asfalto preenchido
        ctx.beginPath();
        ctx.fillStyle = "rgba(22, 25, 35, 0.95)";
        
        // Pista fechada preenche o contorno externo e subtrai o interno
        ctx.moveTo(this.outerPoints[0].x, this.outerPoints[0].y);
        for (let i = 1; i < this.outerPoints.length; i++) {
            ctx.lineTo(this.outerPoints[i].x, this.outerPoints[i].y);
        }
        ctx.closePath();
        ctx.fill();
        
        // Desenha a grama / centro vazio como recorte
        ctx.beginPath();
        ctx.fillStyle = "hsl(225, 20%, 6%)"; // Cor de fundo do canvas
        ctx.moveTo(this.innerPoints[0].x, this.innerPoints[0].y);
        for (let i = 1; i < this.innerPoints.length; i++) {
            ctx.lineTo(this.innerPoints[i].x, this.innerPoints[i].y);
        }
        ctx.closePath();
        ctx.fill();
        
        // 2. Desenha a faixa pontilhada central (Spine)
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 18]);
        ctx.moveTo(this.spine[0].x, this.spine[0].y);
        for (let i = 1; i < this.spine.length; i++) {
            ctx.lineTo(this.spine[i].x, this.spine[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]); // Reseta

        // 3. Desenha as faixas laterais (Paredes) - Neon Cyan Glow
        ctx.lineWidth = 3;
        ctx.strokeStyle = "hsl(190, 100%, 50%)";
        ctx.shadowColor = "hsl(190, 100%, 50%)";
        ctx.shadowBlur = 4;
        
        // Parede externa
        ctx.beginPath();
        ctx.moveTo(this.outerPoints[0].x, this.outerPoints[0].y);
        for (let i = 1; i < this.outerPoints.length; i++) {
            ctx.lineTo(this.outerPoints[i].x, this.outerPoints[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Parede interna
        ctx.beginPath();
        ctx.moveTo(this.innerPoints[0].x, this.innerPoints[0].y);
        for (let i = 1; i < this.innerPoints.length; i++) {
            ctx.lineTo(this.innerPoints[i].x, this.innerPoints[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        ctx.shadowBlur = 0; // Desativa glow para o restante

        // 4. Desenha a linha de partida (Checkpoint 0)
        const startLine = this.checkpoints[0];
        if (startLine) {
            ctx.beginPath();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 4;
            ctx.setLineDash([4, 4]); // Quadriculado clássico
            ctx.moveTo(startLine.x1, startLine.y1);
            ctx.lineTo(startLine.x2, startLine.y2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Texto "LARGADA"
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.font = "8px 'Outfit', sans-serif";
            ctx.fillText("PARTIDA / CHEGADA", startLine.center.x - 40, startLine.center.y - 12);
        }

        // 5. Opcional: Desenha os checkpoints translúcidos para debug visual
        this.checkpoints.forEach(cp => {
            ctx.beginPath();
            if (cp.index === bestCarCheckpoint) {
                ctx.strokeStyle = "rgba(0, 255, 100, 0.35)"; // Melhor carro está aqui
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
                ctx.lineWidth = 1;
            }
            ctx.moveTo(cp.x1, cp.y1);
            ctx.lineTo(cp.x2, cp.y2);
            ctx.stroke();
        });
    }
}

// FUNÇÕES MATEMÁTICAS UTILITÁRIAS DE INTERSECÇÃO

// Interpolação linear simples
function lerp(A, B, t) {
    return A + (B - A) * t;
}

// Verifica se dois segmentos de reta (AB e CD) se cruzam e retorna as coordenadas + offset da colisão
function getIntersection(A, B, C, D) {
    const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
    const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
    const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);
    
    if (bottom !== 0) {
        const t = tTop / bottom;
        const u = uTop / bottom;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: lerp(A.x, B.x, t),
                y: lerp(A.y, B.y, t),
                offset: t
            };
        }
    }
    return null;
}

// Calcula a distância euclidiana entre dois pontos
function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}
