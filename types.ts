export type UserRole = 'admin' | 'frentista';
export type ImportType = 'refueling' | 'comcept' | 'hiro' | 'employees';

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  frentistaId?: string;
}

export interface Refueling {
  id: string;
  id_frentista: string;
  data: string;
  hora?: string;
  bico: string;
  valor: number;
  litros: number;
  preco_unitario?: number;
  enc_inicial?: number;
  enc_final?: number;
  ownerId: string;
  linhaPlanilha?: number;
  registro?: string;
  origemVolumeVazio?: boolean;
  origemTotalVazio?: boolean;
  origemPrecoVazio?: boolean;
  rawVolumeOriginal?: number;
  rawTotalOriginal?: number;
  rawPrecoOriginal?: number;
}

export interface RefuelingIssue {
  type: 'enc_igual' | 'enc_menor' | 'vol_vazio' | 'tot_vazio' | 'prc_vazio' | 'vol_zero' | 'tot_zero';
  label: string;
  description: string;
  badgeClass: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface InconsistentRecord {
  item: Refueling;
  issues: RefuelingIssue[];
  hasEncerranteIgual: boolean;
  hasEncerranteMenor: boolean;
  hasVolumeVazio: boolean;
  hasTotalVazio: boolean;
  hasPrecoVazio: boolean;
  encDelta: number;
}

export interface Employee {
  id_cartao: string;
  nome: string;
}

export interface FrentistaGroup {
  displayName: string;
  cardIds: string[];
  items: Refueling[];
  totalLiters: number;
  totalValue: number;
  count: number;
}

export interface ImportStats {
  sourceRows: number;
  acceptedRows: number;
}

export interface Notice {
  type: 'success' | 'error' | 'warning';
  message: string;
}
