import {
  CHECKPOINTS,
  CITY_BOUNDS,
  CITY_ROADS,
  RACE_CIRCUIT,
} from '@synccity/shared/world';
import type { StateSnapshot } from '../network/NetworkClient.js';

export class Radar {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size = 112;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.width = this.size * 2;
    this.canvas.height = this.size * 2;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Radar 2D context unavailable');
    this.ctx = ctx;
    this.ctx.scale(2, 2);
  }

  private worldToRadar(wx: number, wz: number): { x: number; y: number } {
    const span = CITY_BOUNDS.maxX - CITY_BOUNDS.minX;
    const pad = 7;
    const drawSpan = this.size - pad * 2;
    const x = pad + ((wx - CITY_BOUNDS.minX) / span) * drawSpan;
    const y = pad + ((wz - CITY_BOUNDS.minZ) / span) * drawSpan;
    return { x, y };
  }

  public render(state: StateSnapshot, localPlayerId: string, pulseTime: number): void {
    const ctx = this.ctx;
    const s = this.size;

    ctx.clearRect(0, 0, s, s);

    // 1. Radar Background & Grid
    ctx.fillStyle = 'rgba(11, 7, 25, 0.88)';
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = 'rgba(139, 77, 219, 0.16)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      const pos = (s / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, s);
      ctx.moveTo(0, pos);
      ctx.lineTo(s, pos);
      ctx.stroke();
    }

    // 2. City Roads
    ctx.strokeStyle = 'rgba(85, 75, 125, 0.65)';
    for (const road of CITY_ROADS) {
      const p1 = this.worldToRadar(road.startX, road.startZ);
      const p2 = this.worldToRadar(road.endX, road.endZ);
      ctx.lineWidth = Math.max(2, (road.width / 400) * s);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // 3. Grand Prix Circuit Loop Line
    ctx.strokeStyle = 'rgba(115, 230, 245, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    RACE_CIRCUIT.forEach((gate, idx) => {
      const p = this.worldToRadar(gate.x, gate.z);
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Checkpoint Gates
    const isRacing = state.race?.status === 'racing';
    for (const gate of RACE_CIRCUIT) {
      const p = this.worldToRadar(gate.x, gate.z);
      if (gate.index === 0) {
        const pulse = 3.2 + Math.sin(pulseTime * 6) * 1.1;
        ctx.strokeStyle = '#38ef7d';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#38ef7d';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = isRacing ? '#ffd15c' : 'rgba(115, 230, 245, 0.55)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Co-op Delivery Beacons
    if (!isRacing) {
      const targetCp =
        state.delivery.phase === 'active' ? CHECKPOINTS.destination : CHECKPOINTS.pickup;
      const cpPos = this.worldToRadar(targetCp.x, targetCp.z);
      ctx.strokeStyle = state.delivery.phase === 'active' ? '#f26cda' : '#73e6f5';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cpPos.x, cpPos.y, 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 6. Vehicles
    for (const veh of Object.values(state.vehicles)) {
      const vp = this.worldToRadar(veh.x, veh.z);
      const isOccupied = veh.seats[0] !== '' || veh.seats[1] !== '';
      ctx.fillStyle = isOccupied ? '#f26cda' : 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(vp.x - 1.5, vp.y - 1.5, 3, 3);
    }

    // 7. Other Players
    for (const [id, player] of Object.entries(state.players)) {
      if (id === localPlayerId) continue;
      const pp = this.worldToRadar(player.x, player.z);
      ctx.fillStyle = '#f26cda';
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Local Player Directional Arrow
    const local = state.players[localPlayerId];
    if (local) {
      const lp = this.worldToRadar(local.x, local.z);
      let yaw = local.yaw;
      if (local.mode !== 'walking' && local.vehicleId && state.vehicles[local.vehicleId]) {
        yaw = state.vehicles[local.vehicleId].yaw;
      }

      ctx.save();
      ctx.translate(lp.x, lp.y);
      ctx.rotate(-yaw + Math.PI);

      ctx.fillStyle = '#73e6f5';
      ctx.strokeStyle = '#08121e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -4.8);
      ctx.lineTo(3.4, 3.8);
      ctx.lineTo(0, 1.8);
      ctx.lineTo(-3.4, 3.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
