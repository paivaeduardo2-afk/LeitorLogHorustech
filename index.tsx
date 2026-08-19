
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as XLSX from 'xlsx';
import { 
  LogOut, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Plus, 
  User, 
  Fuel, 
  Calendar, 
  DollarSign, 
  Droplet, 
  Search, 
  AlertTriangle, 
  FileUp, 
  X, 
  FileText, 
  UploadCloud, 
  Users, 
  RotateCcw, 
  Clock, 
  CheckSquare, 
  Square,
  CreditCard,
  UserPlus,
  Layers
} from 'lucide-react';

// --- Types ---

type UserRole = 'admin' | 'frentista';

interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  frentistaId?: string;
}

interface Refueling {
  id: string;
  id_frentista: string;
  data: string; // ISO string
  hora?: string; // Valor bruto da coluna 10
  bico: string;
  valor: number; // Valor Total
  litros: number;
  preco_unitario?: number;
  enc_inicial?: number;
  enc_final?: number;
  ownerId: string;
}

interface Employee {
  id_cartao: string;
  nome: string;
}

interface FrentistaGroup {
  displayName: string;
  cardIds: string[];
  items: Refueling[];
  totalLiters: number;
  totalValue: number;
  count: number;
}

// --- Constants ---

const MOCK_USERS: AppUser[] = [
  { id: '1', name: 'Administrador', role: 'admin' },
];

const BR_TIMEZONE = 'America/Sao_Paulo';

// --- Utilities ---

const formatCurrency = (val: number) => {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

const formatNumber = (val: number) => {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'Data Inválida';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Data Inválida';
  return d.toLocaleDateString('pt-BR', { timeZone: BR_TIMEZONE });
};

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = String(name).split(' ').filter(p => p.length > 0);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getDateOnlyString = (isoString: string): string => {
  try {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString('en-CA', { timeZone: BR_TIMEZONE });
  } catch {
    return "";
  }
};

const parseDateRobust = (dateStr: any): string => {
  if (!dateStr) return new Date().toISOString();
  const s = String(dateStr).trim();
  if (!s) return new Date().toISOString();
  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; 
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const ymdMatch = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const min = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const sec = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
};

const extractDateTime = (raw: any): { dateIso: string, horaStr: string } => {
  if (!raw) {
    return { dateIso: new Date().toISOString(), horaStr: '' };
  }

  const s = String(raw).trim();
  let horaStr = '';

  const timeMatch = s.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (timeMatch) {
    let t = timeMatch[1];
    const parts = t.split(':');
    if (parts[0].length === 1) {
      parts[0] = '0' + parts[0];
    }
    if (parts.length === 2) {
      parts.push('00');
    }
    horaStr = parts.join(':');
  }

  const dateIso = parseDateRobust(s);
  return { dateIso, horaStr };
};

// --- Components ---

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children?: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [data, setData] = useState<Refueling[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expandedFrentista, setExpandedFrentista] = useState<string | null>(null);
  const [expandedBico, setExpandedBico] = useState<string | null>(null);
  const [expandedEncerrante, setExpandedEncerrante] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'refueling' | 'comcept' | 'hiro' | 'employees'>('refueling');
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [filterStartDate, setFilterStartDate] = useState(''); 
  const [filterEndDate, setFilterEndDate] = useState('');     
  const [filterBico, setFilterBico] = useState('');
  
  // Agora armazena NOMES dos frentistas (displayName) para filtrar todos os cartões vinculados
  const [selectedFrentistas, setSelectedFrentistas] = useState<string[]>([]);
  const [tempSelectedFrentistas, setTempSelectedFrentistas] = useState<string[]>([]);
  const [isFrentistaFilterOpen, setIsFrentistaFilterOpen] = useState(false);
  const frentistaDropdownRef = useRef<HTMLDivElement>(null);

  const [sortBy, setSortBy] = useState<'data' | 'bico' | 'valor'>('data');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'frentistas' | 'bicos' | 'encerrantes' | 'vendas_preco'>('frentistas');

  useEffect(() => {
    try {
      const savedData = localStorage.getItem('abastecimentos_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed)) setData(parsed);
      }
    } catch (e) { console.error("Error loading abastecimentos_data", e); }

    try {
      const savedEmployees = localStorage.getItem('posto_employees');
      if (savedEmployees) {
        const parsed = JSON.parse(savedEmployees);
        if (Array.isArray(parsed)) setEmployees(parsed);
      }
    } catch (e) { console.error("Error loading posto_employees", e); }

    try {
      const savedUser = localStorage.getItem('abastecimentos_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && parsedUser.role === 'admin') setCurrentUser(parsedUser);
        else localStorage.removeItem('abastecimentos_user');
      }
    } catch (e) { console.error("Error loading abastecimentos_user", e); }

    const handleClickOutside = (event: MouseEvent) => {
      if (frentistaDropdownRef.current && !frentistaDropdownRef.current.contains(event.target as Node)) {
        setIsFrentistaFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('abastecimentos_data', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem('posto_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('abastecimentos_user', JSON.stringify(currentUser));
  }, [currentUser]);

  const login = (user: AppUser) => setCurrentUser(user);
  const logout = () => {
    setCurrentUser(null);
    setExpandedFrentista(null);
    setSelectedFrentistas([]);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterBico('');
    setSelectedFrentistas([]);
    setSortBy('data');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const hasActiveFilters = useMemo(() => {
    return filterStartDate !== '' || filterEndDate !== '' || filterBico !== '' || selectedFrentistas.length > 0;
  }, [filterStartDate, filterEndDate, filterBico, selectedFrentistas]);

  // Mapa de Cartão -> Nome
  const employeeMap = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach(e => {
      map[e.id_cartao] = e.nome;
    });
    return map;
  }, [employees]);

  // Mapa reverso: Nome -> Lista de Cartões
  const nameToCardsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    employees.forEach(e => {
      if (!map[e.nome]) map[e.nome] = [];
      if (!map[e.nome].includes(e.id_cartao)) map[e.nome].push(e.id_cartao);
    });
    return map;
  }, [employees]);

  const parseCSV = (text: string, type: 'refueling' | 'comcept' | 'hiro' | 'employees'): any[] => {
    if (!currentUser) return [];
    // Remove BOM if exists
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];
    
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const headers = lines[0].toLowerCase().split(delimiter).map(h => h.trim().replace(/['"]/g, ''));
    const result: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(delimiter).map(v => v.trim().replace(/['"]/g, ''));
        const row: any = {};
        headers.forEach((header, index) => { row[header] = values[index]; });

        if (type === 'refueling') {
          const frentistaId = values.length >= 13 ? values[12] : (row.id_frentista || row.frentista || 'N/A');
          const dateRaw = row.data || row.data_hora || row.date || row.timestamp;
          const bicoRaw = row.bico || row.id_bico || 'B?';
          
          // Extração baseada em índices (1-based para o usuário, 0-based para o código)
          // Coluna 7 (index 6): Preço Unitário (Preço de Venda)
          // Coluna 6 (index 5): Volume (Litros)
          // Coluna 5 (index 4): Valor Total (Total de Vendas)
          // Coluna 11 (index 10): Encerrante Inicial
          // Coluna 12 (index 11): Encerrante Final
          let precoUnitario = parseFloat(String(values[6] || row.preco_unitario || row.unit_price || row.preço || '0').replace(',', '.'));
          let volume = parseFloat(String(values[5] || row.litros || row.volume || row.quantidade || row.liters || '0').replace(',', '.'));
          let valorTotal = parseFloat(String(values[4] || row.valor || row.total || row.price || row.valor_total || '0').replace(',', '.'));
          let encInicial = parseFloat(String(values[10] || row.enc_inicial || row.initial_reading || '0').replace(',', '.'));
          let encFinal = parseFloat(String(values[11] || row.enc_final || row.final_reading || '0').replace(',', '.'));

          // Lógica solicitada: Se volume (coluna 6) estiver zerado, calcular: Enc. Final - Enc. Inicial
          if (volume === 0 && encFinal > 0 && encInicial > 0) {
            volume = encFinal - encInicial;
          }

          // Lógica solicitada: Se valor total (coluna 7) estiver zerado, calcular: Volume * Preço Unitário
          if (valorTotal === 0 && volume > 0 && precoUnitario > 0) {
            valorTotal = volume * precoUnitario;
          }
          
          // Caso o preço unitário esteja zerado mas tenhamos valor e volume, podemos inferir
          if (precoUnitario === 0 && volume > 0 && valorTotal > 0) {
            precoUnitario = valorTotal / volume;
          }

          // Caso o volume ainda seja 0 mas tenhamos valor e preço, podemos inferir
          if (volume === 0 && valorTotal > 0 && precoUnitario > 0) {
            volume = valorTotal / precoUnitario;
          }

          const horaRaw = values.length >= 10 ? values[9] : '';
          const newItem: Refueling = {
            id: Math.random().toString(36).substr(2, 9) + Date.now() + i,
            id_frentista: String(frentistaId).trim(),
            data: parseDateRobust(dateRaw),
            hora: horaRaw,
            bico: String(bicoRaw),
            valor: valorTotal,
            litros: volume,
            preco_unitario: precoUnitario,
            enc_inicial: encInicial,
            enc_final: encFinal,
            ownerId: currentUser.id
          };
          if (!isNaN(newItem.valor) || !isNaN(newItem.litros)) result.push(newItem);
        } else if (type === 'comcept') {
          // Formato Log Comcept
          // Coluna 2 (index 1): Valor Total (total)
          // Coluna 3 (index 2): Volume (volume)
          // Coluna 4 (index 3): Preço Unitário (price)
          // Coluna 6 (index 5): Data (date)
          // Coluna 7 (index 6): Hora (hour)
          // Coluna 9 (index 8): Encerrante Inicial (totals_volume_init)
          // Coluna 10 (index 9): Encerrante Final (totals_volume_final)
          // Coluna 13 (index 12): Card Frentista (card_attendant / attendant_name)
          // Coluna 15 (index 14): Bico (nozzle)
          let valorTotal = parseFloat(String(values[1] || row.total || row.valor || '0').replace(',', '.'));
          let volume = parseFloat(String(values[2] || row.volume || row.litros || '0').replace(',', '.'));
          let precoUnitario = parseFloat(String(values[3] || row.price || row.preco_unitario || '0').replace(',', '.'));
          let encInicial = parseFloat(String(values[8] || row.totals_volume_init || row.enc_inicial || '0').replace(',', '.'));
          let encFinal = parseFloat(String(values[9] || row.totals_volume_final || row.enc_final || '0').replace(',', '.'));

          const frentistaId = (row.attendant_name && String(row.attendant_name).trim() !== '') 
            ? String(row.attendant_name).trim() 
            : (values.length >= 13 ? values[12] : (row.card_attendant || row.id_frentista || 'N/A'));
          
          const bicoRaw = values.length >= 15 ? values[14] : (row.nozzle || row.bico || 'B?');
          const dateRaw = row.date || row.data || (values.length >= 6 ? values[5] : '');
          const horaRaw = row.hour || row.hora || (values.length >= 7 ? values[6] : '');

          if (volume === 0 && encFinal > 0 && encInicial > 0) {
            volume = encFinal - encInicial;
          }

          if (valorTotal === 0 && volume > 0 && precoUnitario > 0) {
            valorTotal = volume * precoUnitario;
          }

          if (precoUnitario === 0 && volume > 0 && valorTotal > 0) {
            precoUnitario = valorTotal / volume;
          }

          if (volume === 0 && valorTotal > 0 && precoUnitario > 0) {
            volume = valorTotal / precoUnitario;
          }

          const newItem: Refueling = {
            id: Math.random().toString(36).substr(2, 9) + Date.now() + i,
            id_frentista: String(frentistaId).trim(),
            data: parseDateRobust(dateRaw),
            hora: horaRaw,
            bico: String(bicoRaw),
            valor: valorTotal,
            litros: volume,
            preco_unitario: precoUnitario,
            enc_inicial: encInicial,
            enc_final: encFinal,
            ownerId: currentUser.id
          };
          if (!isNaN(newItem.valor) || !isNaN(newItem.litros)) result.push(newItem);
        } else if (type === 'hiro') {
          // Formato Log Hiro:
          // 1ª coluna (index 0): Número do Bico
          // 3ª coluna (index 2): Data e Hora (no mesmo campo, ex: "30/03/2026  03:54:00")
          // 4ª coluna (index 3): Preço de Venda
          // 5ª coluna (index 4): Litro Vendido (Volume)
          // 6ª coluna (index 5): Total do Abastecimento (Valor Total)
          // 7ª coluna (index 6): Encerrante Inicial
          // 8ª coluna (index 7): Encerrante Final
          // 10ª coluna (index 9): Cartão do Funcionário
          const bicoRaw = (values.length >= 1 && values[0] && String(values[0]).trim() !== '') 
            ? values[0] 
            : (row.nozzle || row.bico || row.nozzle_number || 'B?');

          let dateRaw = values.length >= 3 ? values[2] : (row.date || row.data || row['data/hora'] || row['data_hora'] || '');
          let precoUnitario = parseFloat(String(values[3] || row.price || row.preco || row.preco_unitario || '0').replace(',', '.'));
          let volume = parseFloat(String(values[4] || row.volume || row.litros || row.litro || '0').replace(',', '.'));
          let valorTotal = parseFloat(String(values[5] || row.total || row.valor || row.valor_total || '0').replace(',', '.'));
          let encInicial = parseFloat(String(values[6] || row.totals_volume_init || row.enc_inicial || '0').replace(',', '.'));
          let encFinal = parseFloat(String(values[7] || row.totals_volume_final || row.enc_final || '0').replace(',', '.'));

          const frentistaId = (values.length >= 10 && values[9] && String(values[9]).trim() !== '') 
            ? String(values[9]).trim() 
            : (row.card_attendant || row.id_frentista || row.cartao || row.card || 'N/A');

          const { dateIso, horaStr } = extractDateTime(dateRaw);
          let horaRaw = row.hour || row.hora || horaStr;

          if (volume === 0 && encFinal > 0 && encInicial > 0) {
            volume = encFinal - encInicial;
          }

          if (valorTotal === 0 && volume > 0 && precoUnitario > 0) {
            valorTotal = volume * precoUnitario;
          }

          if (precoUnitario === 0 && volume > 0 && valorTotal > 0) {
            precoUnitario = valorTotal / volume;
          }

          if (volume === 0 && valorTotal > 0 && precoUnitario > 0) {
            volume = valorTotal / precoUnitario;
          }

          const newItem: Refueling = {
            id: Math.random().toString(36).substr(2, 9) + Date.now() + i,
            id_frentista: String(frentistaId).trim(),
            data: dateIso,
            hora: horaRaw,
            bico: String(bicoRaw).trim(),
            valor: valorTotal,
            litros: volume,
            preco_unitario: precoUnitario,
            enc_inicial: encInicial,
            enc_final: encFinal,
            ownerId: currentUser.id
          };
          if (!isNaN(newItem.valor) || !isNaN(newItem.litros)) result.push(newItem);
        } else {
          const nome = values[0] || row.nome;
          let cartao1 = "";
          let cartao2 = "";
          let cartao3 = "";

          if (values.length === 4) {
            cartao1 = (values[1] || "").trim();
            cartao2 = (values[2] || "").trim();
            cartao3 = (values[3] || "").trim();
          } else {
            cartao1 = (values[2] || row.id_cartao_abast || "").trim();
            cartao2 = (values[3] || row.id_cartao_abast_2 || "").trim();
            cartao3 = (values[4] || row.id_cartao_abast_3 || "").trim();
          }
          
          const cards = [cartao1, cartao2, cartao3].filter(c => c.length > 0);
          
          if (nome && cards.length > 0) {
            cards.forEach(card => {
              result.push({ id_cartao: card, nome: String(nome).trim() });
            });
          }
        }
      } catch (err) { console.warn(`Erro ao processar linha ${i + 1}:`, err); }
    }
    return result;
  };

  const handleImport = () => {
    if (selectedFile) {
      const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let csvText = '';
          if (isExcel) {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            csvText = XLSX.utils.sheet_to_csv(worksheet, { FS: ';', dateNF: 'dd/mm/yyyy hh:mm:ss' });
          } else {
            csvText = e.target?.result as string;
          }

          const newItems = parseCSV(csvText, importType);
          if (newItems.length > 0) {
            if (importType === 'refueling' || importType === 'comcept' || importType === 'hiro') {
              setData(prev => [...prev, ...newItems]);
            } else {
              setEmployees(prev => {
                const merged = [...prev];
                newItems.forEach(item => {
                  const idx = merged.findIndex(e => e.id_cartao === item.id_cartao);
                  if (idx > -1) merged[idx] = item;
                  else merged.push(item);
                });
                return merged;
              });
            }
            setIsImportModalOpen(false);
            setSelectedFile(null);
            setCurrentPage(1);
          } else alert("Não foi possível encontrar dados válidos no arquivo.");
        } catch (err) {
          console.error("Erro ao importar arquivo:", err);
          alert("Erro ao ler o arquivo. Certifique-se de que é um arquivo CSV ou Excel válido.");
        }
      };

      if (isExcel) {
        reader.readAsArrayBuffer(selectedFile);
      } else {
        reader.readAsText(selectedFile);
      }
    }
  };

  const bulkDelete = () => {
    if (confirmDeleteText.toLowerCase() === 'excluir') {
      setData([]);
      setEmployees([]);
      setIsDeleteModalOpen(false);
      setConfirmDeleteText('');
      setCurrentPage(1);
    }
  };

  // Lista de Nomes Únicos (displayName) para o Filtro
  const filterOptions = useMemo(() => {
    if (!currentUser) return [];
    const namesSet = new Set<string>();
    data.forEach(item => {
      const name = employeeMap[item.id_frentista] || item.id_frentista;
      namesSet.add(name);
    });
    return Array.from(namesSet).sort();
  }, [data, employeeMap, currentUser]);

  const filteredData = useMemo(() => {
    if (!currentUser) return [];
    let result = data;
    
    // Filtragem baseada no Nome selecionado
    if (selectedFrentistas.length > 0) {
      result = result.filter(item => {
        const name = employeeMap[item.id_frentista] || item.id_frentista;
        return name && selectedFrentistas.includes(name);
      });
    }

    if (filterStartDate || filterEndDate) {
      result = result.filter(item => {
        const itemDateStr = getDateOnlyString(item.data); 
        if (filterStartDate && itemDateStr < filterStartDate) return false;
        if (filterEndDate && itemDateStr > filterEndDate) return false;
        return true;
      });
    }
    if (filterBico) {
      result = result.filter(item => item.bico && String(item.bico).trim().toLowerCase() === filterBico.trim().toLowerCase());
    }
    return [...result].sort((a, b) => {
      const bicoA = String(a.bico || '');
      const bicoB = String(b.bico || '');
      if (sortBy === 'bico') {
        return bicoA.localeCompare(bicoB, undefined, { numeric: true, sensitivity: 'base' }) * (sortOrder === 'asc' ? 1 : -1);
      }
      let valA: any = a[sortBy] ?? 0;
      let valB: any = b[sortBy] ?? 0;
      if (sortBy === 'data') {
        valA = a.data ? new Date(a.data).getTime() : 0;
        valB = b.data ? new Date(b.data).getTime() : 0;
        if (isNaN(valA)) valA = 0;
        if (isNaN(valB)) valB = 0;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, currentUser, filterStartDate, filterEndDate, filterBico, selectedFrentistas, sortBy, sortOrder, employeeMap]);

  const globalStats = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      totalLiters: acc.totalLiters + (curr.litros || 0),
      totalValue: acc.totalValue + (curr.valor || 0),
      totalCount: acc.totalCount + 1
    }), { totalLiters: 0, totalValue: 0, totalCount: 0 });
  }, [filteredData]);

  const groupedByEmployee = useMemo(() => {
    const groups: Record<string, FrentistaGroup> = {};
    
    filteredData.forEach(item => {
      const name = employeeMap[item.id_frentista] || item.id_frentista || 'Desconhecido';
      
      if (!groups[name]) {
        groups[name] = { 
          displayName: name,
          cardIds: [],
          items: [], 
          totalLiters: 0, 
          totalValue: 0, 
          count: 0 
        };
      }
      
      groups[name].items.push(item);
      groups[name].totalLiters += item.litros || 0;
      groups[name].totalValue += item.valor || 0;
      groups[name].count += 1;
      if (item.id_frentista && !groups[name].cardIds.includes(item.id_frentista)) {
        groups[name].cardIds.push(item.id_frentista);
      }
    });
    
    return groups;
  }, [filteredData, employeeMap]);

  const groupedByBico = useMemo(() => {
    const groups: Record<string, { bico: string; totalLiters: number; totalValue: number; count: number; items: Refueling[] }> = {};
    
    filteredData.forEach(item => {
      const bico = String(item.bico || 'B?');
      if (!groups[bico]) {
        groups[bico] = { bico, totalLiters: 0, totalValue: 0, count: 0, items: [] };
      }
      groups[bico].totalLiters += item.litros || 0;
      groups[bico].totalValue += item.valor || 0;
      groups[bico].count += 1;
      groups[bico].items.push(item);
    });
    
    Object.keys(groups).forEach(b => {
      groups[b].items.sort((x, y) => {
        const timeX = x.data ? new Date(x.data).getTime() : 0;
        const timeY = y.data ? new Date(y.data).getTime() : 0;
        return (isNaN(timeY) ? 0 : timeY) - (isNaN(timeX) ? 0 : timeX);
      });
    });
    
    return Object.values(groups).sort((a, b) => String(a.bico).localeCompare(String(b.bico), undefined, { numeric: true, sensitivity: 'base' }));
  }, [filteredData]);

  const readingsMismatch = useMemo(() => {
    const bicoGroups: Record<string, Refueling[]> = {};
    data.forEach(item => {
      const b = String(item.bico || 'B?');
      if (!bicoGroups[b]) bicoGroups[b] = [];
      bicoGroups[b].push(item);
    });

    const finalMismatchedIds = new Set<string>();
    const inicialMismatchedIds = new Set<string>();

    Object.keys(bicoGroups).forEach(b => {
      const items = bicoGroups[b];
      // Ordenar cronologicamente em ordem crescente (mais antigo pro mais novo)
      const sorted = [...items].sort((x, y) => {
        const timeX = x.data ? new Date(x.data).getTime() : 0;
        const timeY = y.data ? new Date(y.data).getTime() : 0;
        if (timeX !== timeY) return (isNaN(timeX) ? 0 : timeX) - (isNaN(timeY) ? 0 : timeY);
        const horaX = String(x.hora || '');
        const horaY = String(y.hora || '');
        return horaX.localeCompare(horaY);
      });

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        const valFinal = current.enc_final || 0;
        const valInicial = next.enc_inicial || 0;

        if (valFinal !== valInicial) {
          if (current.id) finalMismatchedIds.add(current.id);
          if (next.id) inicialMismatchedIds.add(next.id);
        }
      }
    });

    return {
      finalMismatchedIds,
      inicialMismatchedIds
    };
  }, [data]);

  const groupedByEncerrantes = useMemo(() => {
    const groups: Record<string, { 
      bico: string; 
      precoUnitario: number; 
      totalLiters: number; 
      totalValue: number; 
      items: Refueling[];
    }> = {};

    filteredData.forEach(item => {
      const preco = item.preco_unitario || 0;
      const bicoStr = String(item.bico || 'B?').trim();
      const key = `${bicoStr}_${preco.toFixed(4)}`;
      if (!groups[key]) {
        groups[key] = {
          bico: bicoStr,
          precoUnitario: preco,
          totalLiters: 0,
          totalValue: 0,
          items: []
        };
      }
      groups[key].totalLiters += item.litros || 0;
      groups[key].totalValue += item.valor || 0;
      groups[key].items.push(item);
    });

    return Object.values(groups).map(g => {
      const sorted = [...g.items].sort((x, y) => {
        const timeX = x.data ? new Date(x.data).getTime() : 0;
        const timeY = y.data ? new Date(y.data).getTime() : 0;
        if (timeX !== timeY) return (isNaN(timeX) ? 0 : timeX) - (isNaN(timeY) ? 0 : timeY);
        const horaX = String(x.hora || '');
        const horaY = String(y.hora || '');
        return horaX.localeCompare(horaY);
      });

      const firstItem = sorted[0];
      const lastItem = sorted[sorted.length - 1];

      return {
        key: `${g.bico}_${g.precoUnitario.toFixed(4)}`,
        bico: g.bico,
        precoUnitario: g.precoUnitario,
        totalLiters: g.totalLiters,
        totalValue: g.totalValue,
        encInicial: firstItem ? (firstItem.enc_inicial || 0) : 0,
        encFinal: lastItem ? (lastItem.enc_final || 0) : 0,
        count: g.items.length,
        items: sorted
      };
    }).sort((a, b) => {
      const bicoComp = String(a.bico).localeCompare(String(b.bico), undefined, { numeric: true, sensitivity: 'base' });
      if (bicoComp !== 0) return bicoComp;
      return a.precoUnitario - b.precoUnitario;
    });
  }, [filteredData]);

  const groupedByPrice = useMemo(() => {
    const groups: Record<number, { preco: number; totalLiters: number; totalValue: number; count: number }> = {};
    
    filteredData.forEach(item => {
      const preco = item.preco_unitario || 0;
      if (!groups[preco]) {
        groups[preco] = { preco, totalLiters: 0, totalValue: 0, count: 0 };
      }
      groups[preco].totalLiters += item.litros;
      groups[preco].totalValue += item.valor;
      groups[preco].count += 1;
    });

    return Object.values(groups).sort((a, b) => b.preco - a.preco);
  }, [filteredData]);

  const employeeEntries = (Object.entries(groupedByEmployee) as [string, FrentistaGroup][]);
  const totalPages = Math.ceil(employeeEntries.length / itemsPerPage);
  const paginatedEmployees = employeeEntries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openFrentistaFilter = () => {
    setTempSelectedFrentistas([...selectedFrentistas]);
    setIsFrentistaFilterOpen(true);
  };

  const toggleTempFrentista = (name: string) => {
    setTempSelectedFrentistas(prev => 
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
  };

  const toggleSelectAll = () => {
    if (tempSelectedFrentistas.length === filterOptions.length) {
      setTempSelectedFrentistas([]);
    } else {
      setTempSelectedFrentistas([...filterOptions]);
    }
  };

  const confirmFrentistaSelection = () => {
    setSelectedFrentistas([...tempSelectedFrentistas]);
    setIsFrentistaFilterOpen(false);
    setCurrentPage(1);
  };

  const cancelFrentistaSelection = () => {
    setIsFrentistaFilterOpen(false);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md border border-white">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-4 bg-indigo-600 rounded-2xl text-white mb-4 shadow-lg">
              <Fuel size={32} />
            </div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Leitor de log Horustech</h1>
            <p className="text-gray-500 mt-2">Área Administrativa</p>
          </div>
          <div className="space-y-4">
            {MOCK_USERS.map(user => (
              <button key={user.id} onClick={() => login(user)} className="w-full group flex items-center p-4 bg-gray-50 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all duration-300 border border-gray-100 hover:border-indigo-400 text-left">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 group-hover:text-indigo-400 mr-4 shadow-sm">
                  <User size={24} />
                </div>
                <div>
                  <div className="font-bold text-gray-800 group-hover:text-white">{user.name}</div>
                  <div className="text-xs text-gray-400 group-hover:text-indigo-200 uppercase tracking-wider font-semibold">Acesso Completo</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12 font-sans text-gray-900">
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <Fuel className="text-indigo-600" size={28} />
              <span className="font-black text-xl tracking-tight hidden sm:block">LEITOR DE LOG HORUSTECH</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-bold">{currentUser.name}</span>
                <span className="text-xs text-gray-500 uppercase">{currentUser.role}</span>
              </div>
              <div className="h-8 w-[1px] bg-gray-200 mx-2 hidden sm:block"></div>
              <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex items-center gap-2" title="Sair">
                <LogOut size={20} />
                <span className="text-sm font-bold sm:hidden">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dashboard de Vendas</h1>
            <p className="text-gray-500">Filtrado por Frentista • Fuso: Brasil (Brasília)</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => { setImportType('refueling'); setIsImportModalOpen(true); }} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:bg-yellow-200 focus:bg-yellow-200 ${
                isImportModalOpen && importType === 'refueling'
                  ? 'bg-yellow-200 text-yellow-950 border border-yellow-400 shadow-yellow-100'
                  : 'bg-indigo-600 hover:bg-yellow-200 hover:text-yellow-950 text-white shadow-indigo-100'
              }`}
            >
              <FileUp size={18} /> Log Horustech
            </button>
            <button 
              onClick={() => { setImportType('comcept'); setIsImportModalOpen(true); }} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:bg-yellow-200 focus:bg-yellow-200 ${
                isImportModalOpen && importType === 'comcept'
                  ? 'bg-yellow-200 text-yellow-950 border border-yellow-400 shadow-yellow-100'
                  : 'bg-indigo-600 hover:bg-yellow-200 hover:text-yellow-950 text-white shadow-indigo-100'
              }`}
            >
              <FileUp size={18} /> Log Concept
            </button>
            <button 
              onClick={() => { setImportType('hiro'); setIsImportModalOpen(true); }} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:bg-yellow-200 focus:bg-yellow-200 ${
                isImportModalOpen && importType === 'hiro'
                  ? 'bg-yellow-200 text-yellow-950 border border-yellow-400 shadow-yellow-100'
                  : 'bg-indigo-600 hover:bg-yellow-200 hover:text-yellow-950 text-white shadow-indigo-100'
              }`}
            >
              <FileUp size={18} /> Log Hiro
            </button>
            <button 
              onClick={() => { setImportType('employees'); setIsImportModalOpen(true); }} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm active:bg-yellow-200 focus:bg-yellow-200 ${
                isImportModalOpen && importType === 'employees'
                  ? 'bg-yellow-200 text-yellow-950 border border-yellow-400 shadow-yellow-100'
                  : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-yellow-200 hover:text-indigo-950'
              }`}
            >
              <UserPlus size={18} /> Importar Funcionários
            </button>
            <button onClick={() => setIsDeleteModalOpen(true)} className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-5 py-2.5 rounded-xl font-bold transition-all">
              <Trash2 size={18} /> Limpar Tudo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Droplet size={24} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Volume Total</p>
              <p className="text-2xl font-black">{formatNumber(globalStats.totalLiters)} L</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl"><DollarSign size={24} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Preço Total</p>
              <p className="text-2xl font-black">{formatCurrency(globalStats.totalValue)}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Fuel size={24} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Abastecimentos</p>
              <p className="text-2xl font-black">{globalStats.totalCount}</p>
            </div>
          </div>
        </div>

        {/* Seletor de Abas */}
        <div className="flex flex-wrap bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 mb-8 max-w-5xl gap-1">
          <button 
            onClick={() => setActiveTab('frentistas')} 
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm transition-all duration-300 min-w-[150px] ${
              activeTab === 'frentistas' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <Users size={16} />
            Abas por Frentista
          </button>
          <button 
            onClick={() => setActiveTab('bicos')} 
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm transition-all duration-300 min-w-[150px] ${
              activeTab === 'bicos' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <Fuel size={16} />
            Vendas por Bico
          </button>
          <button 
            onClick={() => setActiveTab('encerrantes')} 
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm transition-all duration-300 min-w-[250px] ${
              activeTab === 'encerrantes' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <Layers size={16} />
            Encerrantes por bico e preço de venda
          </button>
          <button 
            onClick={() => setActiveTab('vendas_preco')} 
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm transition-all duration-300 min-w-[150px] ${
              activeTab === 'vendas_preco' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <DollarSign size={16} />
            Vendas por Preço
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-gray-800 font-bold uppercase text-xs tracking-widest">
              <Filter size={14} className="text-indigo-600" /> Filtros Avançados
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                <RotateCcw size={14} /> Limpar Filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1.5 relative" ref={frentistaDropdownRef}>
              <label className="text-xs font-bold text-gray-500">Cartão do Frentista</label>
              <button 
                onClick={openFrentistaFilter}
                className="w-full flex items-center justify-between pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  <CreditCard size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="truncate">
                    {selectedFrentistas.length === 0 ? "Todos" : 
                     selectedFrentistas.length === filterOptions.length ? "Todos Selecionados" : 
                     `${selectedFrentistas.length} Selecionado(s)`}
                  </span>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isFrentistaFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {isFrentistaFilterOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    <div 
                      onClick={toggleSelectAll}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border-b border-gray-100 mb-1"
                    >
                      {tempSelectedFrentistas.length === filterOptions.length ? 
                        <CheckSquare size={18} className="text-indigo-600" /> : 
                        <Square size={18} className="text-gray-300" />
                      }
                      <span className="text-sm font-bold text-gray-700">(Selecionar Tudo)</span>
                    </div>

                    {filterOptions.map(name => (
                      <div 
                        key={name} 
                        onClick={() => toggleTempFrentista(name)}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                      >
                        {tempSelectedFrentistas.includes(name) ? 
                          <CheckSquare size={18} className="text-indigo-600" /> : 
                          <Square size={18} className="text-gray-300" />
                        }
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-xs font-bold text-gray-800 truncate">{name}</span>
                          {nameToCardsMap[name] && (
                            <span className="text-[9px] text-gray-400 truncate uppercase tracking-tighter">
                              {nameToCardsMap[name].length} cartão(ões)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                    <button onClick={confirmFrentistaSelection} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">OK</button>
                    <button onClick={cancelFrentistaSelection} className="flex-1 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500">Início</label>
              <input type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setCurrentPage(1); }} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none transition-all" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500">Fim</label>
              <input type="date" value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setCurrentPage(1); }} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none transition-all" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500">Bico</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Ex: B1" value={filterBico} onChange={(e) => { setFilterBico(e.target.value); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none transition-all" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500">Ordenar</label>
              <div className="flex gap-2">
                <select value={sortBy} onChange={(e) => {
                  const newSortBy = e.target.value as any;
                  setSortBy(newSortBy);
                  if (newSortBy === 'bico') {
                    setSortOrder('asc');
                  }
                  setCurrentPage(1);
                }} className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm appearance-none focus:border-indigo-500 outline-none">
                  <option value="data">Data</option>
                  <option value="bico">Bico</option>
                  <option value="valor">Preço</option>
                </select>
                <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-2 bg-gray-50 border border-gray-200 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                  {sortOrder === 'asc' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'frentistas' && (
          <>
            <div className="space-y-4 mb-8">
              {paginatedEmployees.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800">Nenhum dado encontrado</h3>
                  <p className="text-gray-500 mt-1">Tente importar abastecimentos ou funcionários.</p>
                </div>
              ) : (
                paginatedEmployees.map(([empName, group]) => (
                  <div key={empName} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group">
                    <div onClick={() => setExpandedFrentista(expandedFrentista === empName ? null : empName)} className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4 min-w-[250px]">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-black shadow-inner uppercase">
                          {getInitials(group.displayName)}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-gray-800 uppercase leading-tight">{group.displayName}</h3>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {group.cardIds.map(id => (
                              <span key={id} className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-tighter">
                                {id}
                              </span>
                            ))}
                          </div>
                          <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-1 opacity-70">{group.count} registros</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 flex-1 justify-end mr-4">
                        <div className="hidden sm:block">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Litros</p>
                          <p className="font-black text-gray-700">{formatNumber(group.totalLiters)} L</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Total</p>
                          <p className="font-black text-indigo-600 text-lg">{formatCurrency(group.totalValue)}</p>
                        </div>
                      </div>
                      <div className={`transition-transform duration-300 ${expandedFrentista === empName ? 'rotate-180' : ''}`}><ChevronDown size={24} className="text-gray-400" /></div>
                    </div>
                    {expandedFrentista === empName && (
                      <div className="border-t border-gray-100 bg-gray-50/50 p-6 animate-in slide-in-from-top-2 duration-200">
                        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                                <th className="px-6 py-4">data</th>
                                <th className="px-6 py-4 text-green-600">hora</th>
                                <th className="px-6 py-4">bico</th>
                                <th className="px-6 py-4">litros</th>
                                <th className="px-6 py-4">preço</th>
                                <th className="px-6 py-4">valor total</th>
                                <th className="px-6 py-4 text-gray-400">Enc. Inicial</th>
                                <th className="px-6 py-4 text-gray-400">Enc. Final</th>
                                <th className="px-6 py-4 text-gray-400">cartão</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {group.items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 text-sm transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <Calendar size={14} className="text-gray-400" />
                                      {formatDate(item.data)}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-green-600 font-medium">
                                      <Clock size={14} className="text-green-500" />
                                      {item.hora || "--:--"}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 font-bold text-indigo-600">{item.bico}</td>
                                  <td className="px-6 py-4">{formatNumber(item.litros)} L</td>
                                  <td className="px-6 py-4">{formatCurrency(item.preco_unitario || 0)}</td>
                                  <td className="px-6 py-4 font-black">{formatCurrency(item.valor)}</td>
                                  <td className={`px-6 py-4 ${readingsMismatch.inicialMismatchedIds.has(item.id) ? 'text-red-600 font-extrabold bg-red-50' : 'text-gray-500'}`}>{formatNumber(item.enc_inicial || 0)}</td>
                                  <td className={`px-6 py-4 ${readingsMismatch.finalMismatchedIds.has(item.id) ? 'text-red-600 font-extrabold bg-red-50' : 'text-gray-500'}`}>{formatNumber(item.enc_final || 0)}</td>
                                  <td className="px-6 py-4 text-gray-400">{item.id_frentista}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100 mb-8">
                 <p className="text-sm text-gray-700 hidden sm:block">Página <span className="font-bold">{currentPage}</span> de <span className="font-bold">{totalPages}</span></p>
                 <div className="flex gap-2">
                    <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="p-2 border rounded-xl disabled:opacity-50 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"><ChevronLeft size={20}/></button>
                    <button disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)} className="p-2 border rounded-xl disabled:opacity-50 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"><ChevronRight size={20}/></button>
                 </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'bicos' && (
          <div className="space-y-4 mb-8">
            {groupedByBico.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">Nenhum dado encontrado</h3>
                <p className="text-gray-500 mt-1">Tente importar abastecimentos ou funcionários.</p>
              </div>
            ) : (
              groupedByBico.map((bicoGroup) => {
                const litPct = Math.round((bicoGroup.totalLiters / (globalStats.totalLiters || 1)) * 100);
                const valPct = Math.round((bicoGroup.totalValue / (globalStats.totalValue || 1)) * 100);
                
                return (
                  <div key={bicoGroup.bico} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group">
                    <div onClick={() => setExpandedBico(expandedBico === bicoGroup.bico ? null : bicoGroup.bico)} className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4 min-w-[200px]">
                        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-md shadow-indigo-100 uppercase">
                          {bicoGroup.bico}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-gray-800 uppercase leading-tight">Bico {bicoGroup.bico}</h3>
                          <div className="flex gap-2 items-center mt-1">
                            <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded">
                              {bicoGroup.count} abastecimentos
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Spark progress bars in layout for high premium fidelity */}
                      <div className="flex flex-1 max-w-md gap-4 items-center pl-4 sm:pl-0">
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[11px] text-gray-500">
                            <span>Litros: <strong>{formatNumber(bicoGroup.totalLiters)} L</strong></span>
                            <span>{litPct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${litPct}%` }} />
                          </div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[11px] text-gray-500">
                            <span>Participação de Venda:</span>
                            <span>{valPct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full rounded-full" style={{ width: `${valPct}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-6 min-w-[200px]">
                        <div className="text-right">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Valor Total</p>
                          <p className="font-black text-indigo-600 text-2xl tracking-tight">
                            {formatCurrency(bicoGroup.totalValue)}
                          </p>
                        </div>
                        <div className={`transition-transform duration-300 ${expandedBico === bicoGroup.bico ? 'rotate-180' : ''}`}>
                          <ChevronDown size={24} className="text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {expandedBico === bicoGroup.bico && (
                      <div className="border-t border-gray-100 bg-gray-50/50 p-6 animate-in slide-in-from-top-2 duration-200">
                        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                                <th className="px-6 py-4">data</th>
                                <th className="px-6 py-4 text-green-600">hora</th>
                                <th className="px-6 py-4">Frentista</th>
                                <th className="px-6 py-4">litros</th>
                                <th className="px-6 py-4">preço</th>
                                <th className="px-6 py-4">valor total</th>
                                <th className="px-6 py-4 text-gray-400">Enc. Inicial</th>
                                <th className="px-6 py-4 text-gray-400">Enc. Final</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {bicoGroup.items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 text-sm transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <Calendar size={14} className="text-gray-400" />
                                      {formatDate(item.data)}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-green-600 font-medium">
                                      <Clock size={14} className="text-green-500" />
                                      {item.hora || "--:--"}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 font-bold text-gray-700 uppercase">
                                    {employeeMap[item.id_frentista] || item.id_frentista || "Desconhecido"}
                                  </td>
                                  <td className="px-6 py-4">{formatNumber(item.litros)} L</td>
                                  <td className="px-6 py-4">{formatCurrency(item.preco_unitario || 0)}</td>
                                  <td className="px-6 py-4 font-black">{formatCurrency(item.valor)}</td>
                                  <td className={`px-6 py-4 ${readingsMismatch.inicialMismatchedIds.has(item.id) ? 'text-red-600 font-extrabold bg-red-50' : 'text-gray-500'}`}>{formatNumber(item.enc_inicial || 0)}</td>
                                  <td className={`px-6 py-4 ${readingsMismatch.finalMismatchedIds.has(item.id) ? 'text-red-600 font-extrabold bg-red-50' : 'text-gray-500'}`}>{formatNumber(item.enc_final || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'encerrantes' && (
          <div className="space-y-4 mb-8">
            {groupedByEncerrantes.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">Nenhum dado encontrado</h3>
                <p className="text-gray-500 mt-1">Tente importar abastecimentos ou funcionários.</p>
              </div>
            ) : (
              groupedByEncerrantes.map((group) => {
                const isExpanded = expandedEncerrante === group.key;
                
                return (
                  <div key={group.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group">
                    <div 
                      onClick={() => setExpandedEncerrante(isExpanded ? null : group.key)} 
                      className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-[200px]">
                        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-md shadow-indigo-100 uppercase">
                          <Layers size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-gray-800 uppercase leading-tight">Bico {group.bico}</h3>
                            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-md">
                              {formatCurrency(group.precoUnitario)}
                            </span>
                          </div>
                          <div className="flex gap-2 items-center mt-1">
                            <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded">
                              {group.count} abastecimentos
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Informações dos Encerrantes */}
                      <div className="flex flex-1 max-w-md gap-6 items-center pl-4 sm:pl-0">
                        <div className="flex-1">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Enc. Inicial</p>
                          <p className={`font-extrabold text-sm ${readingsMismatch.inicialMismatchedIds.has(group.items[0]?.id) ? 'text-red-600' : 'text-gray-700'}`}>
                            {formatNumber(group.encInicial)} L
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Enc. Final</p>
                          <p className={`font-extrabold text-sm ${readingsMismatch.finalMismatchedIds.has(group.items[group.items.length - 1]?.id) ? 'text-red-600' : 'text-gray-700'}`}>
                            {formatNumber(group.encFinal)} L
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Volume</p>
                          <p className="font-extrabold text-blue-600 text-sm">
                            {formatNumber(group.totalLiters)} L
                          </p>
                        </div>
                      </div>

                      {/* Valor Total Destacado */}
                      <div className="flex items-center justify-end gap-6 min-w-[200px]">
                        <div className="text-right">
                          <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Valor Total</p>
                          <p className="font-black text-indigo-600 text-2xl tracking-tight">
                            {formatCurrency(group.totalValue)}
                          </p>
                        </div>
                        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown size={24} className="text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/50 p-6 animate-in slide-in-from-top-2 duration-200">
                        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                                <th className="px-6 py-4">data</th>
                                <th className="px-6 py-4 text-green-600">hora</th>
                                <th className="px-6 py-4">Frentista</th>
                                <th className="px-6 py-4">litros</th>
                                <th className="px-6 py-4">preço</th>
                                <th className="px-6 py-4">valor total</th>
                                <th className="px-6 py-4 text-gray-400">Enc. Inicial</th>
                                <th className="px-6 py-4 text-gray-400">Enc. Final</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {group.items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 text-sm transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <Calendar size={14} className="text-gray-400" />
                                      {formatDate(item.data)}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-green-600 font-medium">
                                      <Clock size={14} className="text-green-500" />
                                      {item.hora || "--:--"}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 font-bold text-gray-700 uppercase">
                                    {employeeMap[item.id_frentista] || item.id_frentista || "Desconhecido"}
                                  </td>
                                  <td className="px-6 py-4">{formatNumber(item.litros)} L</td>
                                  <td className="px-6 py-4">{formatCurrency(item.preco_unitario || 0)}</td>
                                  <td className="px-6 py-4 font-black">{formatCurrency(item.valor)}</td>
                                  <td className={`px-6 py-4 ${readingsMismatch.inicialMismatchedIds.has(item.id) ? 'text-red-600 font-extrabold bg-red-50' : 'text-gray-500'}`}>{formatNumber(item.enc_inicial || 0)}</td>
                                  <td className={`px-6 py-4 ${readingsMismatch.finalMismatchedIds.has(item.id) ? 'text-red-600 font-extrabold bg-red-50' : 'text-gray-500'}`}>{formatNumber(item.enc_final || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'vendas_preco' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                  <DollarSign size={20} className="text-indigo-600" />
                  Vendas por Preço de Venda
                </h3>
                <p className="text-xs text-gray-500 mt-1">Dados agrupados de acordo com os preços praticados nos bicos</p>
              </div>
              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
                {groupedByPrice.length} preço(s) diferente(s)
              </span>
            </div>
            
            {groupedByPrice.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-bold text-gray-800">Nenhum dado encontrado</h3>
                <p className="text-gray-500 mt-1">Tente importar abastecimentos ou funcionários.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-8 py-4">Preço Unitário</th>
                      <th className="px-8 py-4">Quantidade de Abastecimentos</th>
                      <th className="px-8 py-4">Litros Vendidos</th>
                      <th className="px-8 py-4 text-right">Valor Total Vendido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedByPrice.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 text-sm transition-colors">
                        <td className="px-8 py-4 font-black text-indigo-600">
                          {formatCurrency(item.preco)}
                        </td>
                        <td className="px-8 py-4 font-bold text-gray-650">
                          {item.count} abastecimento(s)
                        </td>
                        <td className="px-8 py-4 font-black text-gray-700">
                          {formatNumber(item.totalLiters)} L
                        </td>
                        <td className="px-8 py-4 font-black text-gray-900 text-right">
                          {formatCurrency(item.totalValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-50/40 border-t border-gray-200 font-black text-sm text-gray-900">
                      <td className="px-8 py-5 text-indigo-800 uppercase tracking-wider font-extrabold">TOTAL GERAL</td>
                      <td className="px-8 py-5 text-gray-800 font-extrabold">
                        {groupedByPrice.reduce((sum, item) => sum + item.count, 0)} abastecimento(s)
                      </td>
                      <td className="px-8 py-5 text-blue-650 font-extrabold">
                        {formatNumber(groupedByPrice.reduce((sum, item) => sum + item.totalLiters, 0))} L
                      </td>
                      <td className="px-8 py-5 text-indigo-900 text-right text-base font-extrabold">
                        {formatCurrency(groupedByPrice.reduce((sum, item) => sum + item.totalValue, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

      </main>

      <Modal isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setSelectedFile(null); }} title={importType === 'refueling' ? "Importar Log Horustech" : importType === 'comcept' ? "Importar Log Concept" : importType === 'hiro' ? "Importar Log Hiro" : "Importar Funcionários"}>
        <div className="text-center">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full inline-flex mb-4">
            {importType === 'employees' ? <Users size={40} /> : <UploadCloud size={40} />}
          </div>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            {importType === 'refueling' ? 
              "Selecione o arquivo CSV do Log Horustech." : 
             importType === 'comcept' ?
              "Selecione o arquivo CSV do Log Concept (Coluna 2: Valor, Coluna 3: Volume, Coluna 9: Enc. Inicial, Coluna 10: Enc. Final)." :
             importType === 'hiro' ?
              "Selecione o arquivo (CSV ou Excel) do Log Hiro (Coluna 1: Bico, Coluna 3: Data/Hora, Coluna 4: Preço, Coluna 5: Litros, Coluna 6: Total, Coluna 7: Enc. Inicial, Coluna 8: Enc. Final, Coluna 10: Cartão)." :
              "Importe a lista de funcionários. Coluna 1: Nome, Colunas 3, 4, 5: IDs dos Cartões."
            }
          </p>
          <div className="mb-6">
            <input type="file" accept=".csv, .xlsx, .xls" className="hidden" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            {!selectedFile ? (
              <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/30 text-gray-500 font-bold transition-all"><Plus size={20} />Escolher Arquivo (CSV / Excel)</button>
            ) : (
              <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <span className="text-sm font-bold truncate max-w-[200px]">{selectedFile.name}</span>
                <button onClick={() => setSelectedFile(null)} className="p-1 hover:bg-indigo-100 rounded-full transition-colors"><X size={16} className="text-indigo-600" /></button>
              </div>
            )}
          </div>
          <button disabled={!selectedFile} onClick={handleImport} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 disabled:opacity-50 hover:bg-indigo-700 transition-all">Confirmar Importação</button>
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Limpar Tudo">
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
            <div className="flex-shrink-0"><AlertTriangle size={32} /></div>
            <p className="text-sm font-medium">Isso removerá todos os dados (abastecimentos e frentistas). Esta ação é irreversível.</p>
          </div>
          <input type="text" placeholder="Digite EXCLUIR" value={confirmDeleteText} onChange={(e) => setConfirmDeleteText(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl uppercase font-bold focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" />
          <button disabled={confirmDeleteText.toLowerCase() !== 'excluir'} onClick={bulkDelete} className="w-full py-3 bg-red-600 text-white rounded-xl font-black disabled:opacity-50 hover:bg-red-700 shadow-lg shadow-red-100 transition-all">EXCLUIR TUDO</button>
        </div>
      </Modal>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
