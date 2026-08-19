
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { parseImportText } from './importer';
import { loadPersistedValue, persistValue } from './storage';
import type {
  AppUser,
  Employee,
  FrentistaGroup,
  ImportStats,
  ImportType,
  InconsistentRecord,
  Notice,
  Refueling,
  RefuelingIssue
} from './types';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getDateOnlyString,
  getInitials,
  getRefuelingFingerprint,
  normalizePersistedRefuelings,
  parseNumericValue,
  sumRefuelingTotals
} from './utils';
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
  Layers,
  ShieldAlert,
  AlertCircle,
  Info,
  CheckCircle2
} from 'lucide-react';

// --- Constants ---

const MOCK_USERS: AppUser[] = [
  { id: '1', name: 'Administrador', role: 'admin' },
];

// --- Components ---

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children?: React.ReactNode }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 id="modal-title" className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors" aria-label="Fechar janela">
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
  const [importType, setImportType] = useState<ImportType>('refueling');
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastImportStatsRef = useRef<ImportStats>({ sourceRows: 0, acceptedRows: 0 });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
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
  const [activeTab, setActiveTab] = useState<'frentistas' | 'bicos' | 'encerrantes' | 'vendas_preco' | 'inconsistencias'>('frentistas');

  // Estados para a Aba de Inconsistências / Auditoria da Planilha
  const [inconsistencyFilter, setInconsistencyFilter] = useState<'all' | 'enc_igual' | 'vol_vazio' | 'tot_vazio' | 'prc_vazio' | 'enc_menor'>('all');
  const [inconsistencySearch, setInconsistencySearch] = useState('');
  const [expandedInconsistencyId, setExpandedInconsistencyId] = useState<string | null>(null);
  const [inconsistencyPage, setInconsistencyPage] = useState(1);
  const inconsistenciesPerPage = 15;

  useEffect(() => {
    let isCancelled = false;

    const hydrateApplication = async () => {
      try {
        const [dataResult, employeesResult] = await Promise.allSettled([
          loadPersistedValue<Refueling[]>('refuelings', 'abastecimentos_data'),
          loadPersistedValue<Employee[]>('employees', 'posto_employees')
        ]);
        if (isCancelled) return;

        if (dataResult.status === 'fulfilled') {
          setData(normalizePersistedRefuelings(dataResult.value));
        } else {
          console.error('Error loading refuelings', dataResult.reason);
          setNotice({ type: 'warning', message: 'Os abastecimentos salvos anteriormente não puderam ser carregados.' });
        }

        if (employeesResult.status === 'fulfilled' && Array.isArray(employeesResult.value)) {
          setEmployees(employeesResult.value);
        } else if (employeesResult.status === 'rejected') {
          console.error('Error loading employees', employeesResult.reason);
          setNotice({ type: 'warning', message: 'A lista de funcionários salva anteriormente não pôde ser carregada.' });
        }

        const savedUser = localStorage.getItem('abastecimentos_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser) as AppUser;
          if (parsedUser?.role === 'admin') setCurrentUser(parsedUser);
          else localStorage.removeItem('abastecimentos_user');
        }
      } catch (error) {
        console.error('Error hydrating application data', error);
        if (!isCancelled) {
          setNotice({ type: 'warning', message: 'Os dados salvos anteriormente não puderam ser carregados.' });
        }
      } finally {
        if (!isCancelled) setIsHydrated(true);
      }
    };

    void hydrateApplication();

    const handleClickOutside = (event: MouseEvent) => {
      if (frentistaDropdownRef.current && !frentistaDropdownRef.current.contains(event.target as Node)) {
        setIsFrentistaFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      isCancelled = true;
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    void persistValue('refuelings', 'abastecimentos_data', data).catch(error => {
      console.error('Error saving refuelings', error);
      setNotice({ type: 'error', message: 'O navegador não conseguiu salvar os abastecimentos. Exporte ou limpe dados antigos.' });
    });
  }, [data, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    void persistValue('employees', 'posto_employees', employees).catch(error => {
      console.error('Error saving employees', error);
      setNotice({ type: 'error', message: 'Não foi possível salvar a lista de funcionários neste navegador.' });
    });
  }, [employees, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (currentUser) localStorage.setItem('abastecimentos_user', JSON.stringify(currentUser));
    else localStorage.removeItem('abastecimentos_user');
  }, [currentUser, isHydrated]);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

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

  const handleImport = () => {
    if (selectedFile && currentUser) {
      const normalizedFileName = selectedFile.name.toLowerCase();
      const isExcel = normalizedFileName.endsWith('.xlsx') || normalizedFileName.endsWith('.xls');
      const hasSupportedExtension = isExcel || normalizedFileName.endsWith('.csv');
      if (!hasSupportedExtension) {
        setNotice({ type: 'error', message: 'Formato não suportado. Selecione um arquivo CSV, XLSX ou XLS.' });
        return;
      }
      if (selectedFile.size > 25 * 1024 * 1024) {
        setNotice({ type: 'error', message: 'O arquivo ultrapassa o limite de 25 MB. Divida-o em arquivos menores.' });
        return;
      }

      setIsImporting(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          let csvText = '';
          if (isExcel) {
            const { read: readWorkbook, utils: xlsxUtils } = await import('xlsx');
            const workbookData = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = readWorkbook(workbookData, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) throw new Error('A planilha não possui abas.');
            const worksheet = workbook.Sheets[firstSheetName];
            csvText = xlsxUtils.sheet_to_csv(worksheet, { FS: ';', dateNF: 'dd/mm/yyyy hh:mm:ss' });
          } else {
            csvText = e.target?.result as string;
          }

          const { items: newItems, stats } = parseImportText(csvText, importType, currentUser.id);
          lastImportStatsRef.current = stats;
          if (newItems.length > 0) {
            if (importType === 'refueling' || importType === 'comcept' || importType === 'hiro') {
              const existingFingerprints = new Set(data.map(getRefuelingFingerprint));
              const importedFingerprints = new Set<string>();
              const uniqueItems = (newItems as Refueling[]).filter(item => {
                const fingerprint = getRefuelingFingerprint(item);
                if (existingFingerprints.has(fingerprint) || importedFingerprints.has(fingerprint)) return false;
                importedFingerprints.add(fingerprint);
                return true;
              });
              setData(prev => [...prev, ...uniqueItems]);
              const duplicateCount = newItems.length - uniqueItems.length;
              const skippedCount = lastImportStatsRef.current.sourceRows - lastImportStatsRef.current.acceptedRows;
              setNotice({
                type: uniqueItems.length > 0 ? 'success' : 'warning',
                message: `${uniqueItems.length} abastecimento(s) importado(s)${duplicateCount > 0 ? `, ${duplicateCount} duplicado(s) ignorado(s)` : ''}${skippedCount > 0 ? ` e ${skippedCount} linha(s) inválida(s) ignorada(s)` : ''}.`
              });
            } else {
              setEmployees(prev => {
                const merged = [...prev];
                (newItems as Employee[]).forEach(item => {
                  const idx = merged.findIndex(e => e.id_cartao === item.id_cartao);
                  if (idx > -1) merged[idx] = item;
                  else merged.push(item);
                });
                return merged;
              });
              const skippedCount = lastImportStatsRef.current.sourceRows - lastImportStatsRef.current.acceptedRows;
              setNotice({
                type: 'success',
                message: `Lista de funcionários atualizada${skippedCount > 0 ? `; ${skippedCount} linha(s) inválida(s) foram ignoradas` : ''}.`
              });
            }
            setIsImportModalOpen(false);
            setSelectedFile(null);
            setCurrentPage(1);
          } else {
            setNotice({ type: 'error', message: 'Nenhum registro válido foi encontrado. Confira o formato e as colunas do arquivo.' });
          }
        } catch (err) {
          console.error("Erro ao importar arquivo:", err);
          setNotice({ type: 'error', message: 'Não foi possível ler o arquivo. Verifique se ele é um CSV ou Excel válido.' });
        } finally {
          setIsImporting(false);
        }
      };

      reader.onerror = () => {
        setIsImporting(false);
        setNotice({ type: 'error', message: 'O navegador não conseguiu abrir o arquivo selecionado.' });
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
      const preco = parseNumericValue(item.preco_unitario);
      if (!groups[preco]) {
        groups[preco] = { preco, totalLiters: 0, totalValue: 0, count: 0 };
      }
      const litros = parseNumericValue(item.litros);
      const valor = parseNumericValue(item.valor);
      groups[preco].totalLiters += litros;
      groups[preco].totalValue += valor;
      groups[preco].count += 1;
    });

    return Object.values(groups).sort((a, b) => b.preco - a.preco);
  }, [filteredData]);

  // --- Registros com Inconsistências / Alertas da Planilha ---
  const inconsistentRecords = useMemo<InconsistentRecord[]>(() => {
    return data.map((item, idx) => {
      const issues: RefuelingIssue[] = [];
      const encIni = parseNumericValue(item.enc_inicial);
      const encFin = parseNumericValue(item.enc_final);
      const encDelta = encFin - encIni;
      
      // 1. Encerrante Inicial é exatamente igual ao Encerrante Final (Delta = 0)
      const hasEncerranteIgual = encIni > 0 && encFin > 0 && Math.abs(encFin - encIni) < 0.0001;
      if (hasEncerranteIgual) {
        issues.push({
          type: 'enc_igual',
          label: 'Enc. Inicial = Enc. Final',
          description: `Encerrante Inicial e Final possuem a mesma leitura (${formatNumber(encIni)} L). Delta de volume = 0,00 L.`,
          badgeClass: 'bg-red-100 text-red-800 border-red-200',
          severity: 'critical'
        });
      }

      // 2. Encerrante Final menor que o Inicial
      const hasEncerranteMenor = encIni > 0 && encFin > 0 && encFin < encIni;
      if (hasEncerranteMenor) {
        issues.push({
          type: 'enc_menor',
          label: 'Enc. Final < Inicial',
          description: `Encerrante Final (${formatNumber(encFin)} L) é menor que o Inicial (${formatNumber(encIni)} L). Leitura regressiva.`,
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
          severity: 'critical'
        });
      }

      // 3. Volume vazio ou zerado na planilha de origem
      const hasVolumeVazio = item.origemVolumeVazio === true || (item.rawVolumeOriginal !== undefined && item.rawVolumeOriginal <= 0);
      if (hasVolumeVazio) {
        issues.push({
          type: 'vol_vazio',
          label: 'Volume Vazio na Planilha',
          description: `Volume original veio zerado/vazio na planilha. Calculado pelo sistema via Encerrantes: +${formatNumber(item.litros)} L.`,
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
          severity: 'warning'
        });
      }

      // 4. Total vazio ou zerado na planilha de origem
      const hasTotalVazio = item.origemTotalVazio === true || (item.rawTotalOriginal !== undefined && item.rawTotalOriginal <= 0);
      if (hasTotalVazio) {
        issues.push({
          type: 'tot_vazio',
          label: 'Total Vazio na Planilha',
          description: `Valor total original veio zerado/vazio na planilha. Calculado pelo sistema: ${formatCurrency(item.valor)}.`,
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
          severity: 'warning'
        });
      }

      // 5. Preço unitário vazio ou zerado na planilha de origem
      const hasPrecoVazio = item.origemPrecoVazio === true || parseNumericValue(item.preco_unitario) <= 0;
      if (hasPrecoVazio) {
        issues.push({
          type: 'prc_vazio',
          label: 'Preço Zerado / Ausente',
          description: `Preço unitário não informado ou zerado na planilha de origem.`,
          badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
          severity: 'warning'
        });
      }

      // 6. Volume final permaneceu zerado
      if (parseNumericValue(item.litros) <= 0 && !hasEncerranteIgual) {
        issues.push({
          type: 'vol_zero',
          label: 'Volume Final Zerado',
          description: `Volume final permaneceu 0 litros mesmo após cálculo.`,
          badgeClass: 'bg-red-100 text-red-800 border-red-200',
          severity: 'critical'
        });
      }

      return {
        item: {
          ...item,
          linhaPlanilha: item.linhaPlanilha || (idx + 2)
        },
        issues,
        hasEncerranteIgual,
        hasEncerranteMenor,
        hasVolumeVazio,
        hasTotalVazio,
        hasPrecoVazio,
        encDelta: Math.round(encDelta * 10000) / 10000
      };
    }).filter(rec => rec.issues.length > 0);
  }, [data]);

  const inconsistencyStats = useMemo(() => {
    let countEncIgual = 0;
    let countEncMenor = 0;
    let countVolVazio = 0;
    let countTotVazio = 0;
    let countPrcVazio = 0;

    inconsistentRecords.forEach(rec => {
      if (rec.hasEncerranteIgual) countEncIgual++;
      if (rec.hasEncerranteMenor) countEncMenor++;
      if (rec.hasVolumeVazio) countVolVazio++;
      if (rec.hasTotalVazio) countTotVazio++;
      if (rec.hasPrecoVazio) countPrcVazio++;
    });

    return {
      total: inconsistentRecords.length,
      countEncIgual,
      countEncMenor,
      countVolVazio,
      countTotVazio,
      countPrcVazio
    };
  }, [inconsistentRecords]);

  const filteredInconsistentRecords = useMemo(() => {
    return inconsistentRecords.filter(rec => {
      // Sub-filtro
      if (inconsistencyFilter === 'enc_igual' && !rec.hasEncerranteIgual) return false;
      if (inconsistencyFilter === 'enc_menor' && !rec.hasEncerranteMenor) return false;
      if (inconsistencyFilter === 'vol_vazio' && !rec.hasVolumeVazio) return false;
      if (inconsistencyFilter === 'tot_vazio' && !rec.hasTotalVazio) return false;
      if (inconsistencyFilter === 'prc_vazio' && !rec.hasPrecoVazio) return false;

      // Busca de texto
      if (inconsistencySearch.trim()) {
        const q = inconsistencySearch.toLowerCase().trim();
        const linhaStr = `linha ${rec.item.linhaPlanilha || ''}`.toLowerCase();
        const linhaNum = String(rec.item.linhaPlanilha || '');
        const regStr = String(rec.item.registro || '').toLowerCase();
        const bicoStr = `bico ${rec.item.bico}`.toLowerCase();
        const bicoNum = String(rec.item.bico || '').toLowerCase();
        const frentistaName = String(employeeMap[rec.item.id_frentista] || rec.item.id_frentista || '').toLowerCase();
        const dataStr = formatDate(rec.item.data).toLowerCase();
        const horaStr = String(rec.item.hora || '').toLowerCase();

        return linhaStr.includes(q) ||
          linhaNum.includes(q) ||
          regStr.includes(q) ||
          bicoStr.includes(q) ||
          bicoNum.includes(q) ||
          frentistaName.includes(q) ||
          dataStr.includes(q) ||
          horaStr.includes(q);
      }
      return true;
    });
  }, [inconsistentRecords, inconsistencyFilter, inconsistencySearch, employeeMap]);

  const filteredInconsistencyTotals = useMemo(
    () => sumRefuelingTotals(filteredInconsistentRecords.map(record => record.item)),
    [filteredInconsistentRecords]
  );

  const totalInconsistencyPages = Math.ceil(filteredInconsistentRecords.length / inconsistenciesPerPage);
  const paginatedInconsistencies = filteredInconsistentRecords.slice(
    (inconsistencyPage - 1) * inconsistenciesPerPage,
    inconsistencyPage * inconsistenciesPerPage
  );

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

  if (!isHydrated) {
    return (
      <div className="loading-shell min-h-screen flex items-center justify-center p-6" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-4 text-indigo-700">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" aria-hidden="true" />
          <p className="text-sm font-bold">Carregando dados do painel…</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="login-shell min-h-screen flex items-center justify-center p-6">
        <div className="login-card bg-white rounded-3xl shadow-xl p-8 w-full max-w-md border border-white">
          <div className="text-center mb-8">
            <div className="login-brand-mark inline-flex items-center justify-center p-4 bg-indigo-600 rounded-2xl text-white mb-4 shadow-lg">
              <Fuel size={32} />
            </div>
            <p className="login-eyebrow mb-2">Controle operacional</p>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Leitor de log Horustech</h1>
            <p className="text-gray-500 mt-2">Importação e auditoria de abastecimentos</p>
          </div>
          <div className="space-y-4">
            {MOCK_USERS.map(user => (
              <button key={user.id} onClick={() => login(user)} className="login-entry w-full group flex items-center p-4 bg-gray-50 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all duration-300 border border-gray-100 hover:border-indigo-400 text-left">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 group-hover:text-indigo-400 mr-4 shadow-sm">
                  <User size={24} />
                </div>
                <div>
                  <div className="font-bold text-gray-800 group-hover:text-white">{user.name}</div>
                  <div className="text-xs text-gray-400 group-hover:text-indigo-200 uppercase tracking-wider font-semibold">Abrir painel local</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen pb-12 font-sans text-gray-900">
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-20 z-[60] flex max-w-md items-start gap-3 rounded-2xl border p-4 shadow-xl ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : notice.type === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="flex-1 text-sm font-semibold leading-relaxed">{notice.message}</p>
          <button onClick={() => setNotice(null)} className="rounded-lg p-1 opacity-60 hover:bg-black/5 hover:opacity-100" aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      )}
      <nav className="app-topbar sticky top-0 z-40 border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <span className="brand-mark"><Fuel className="text-white" size={22} /></span>
              <span className="brand-copy font-black text-lg tracking-tight">
                LEITOR DE LOG HORUSTECH
                <small>Operações & auditoria</small>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-bold">{currentUser.name}</span>
                <span className="user-role text-xs text-gray-500 uppercase">{currentUser.role}</span>
              </div>
              <div className="user-divider h-8 w-[1px] bg-gray-200 mx-2 hidden sm:block"></div>
              <button onClick={logout} className="logout-button p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex items-center gap-2" title="Sair">
                <LogOut size={20} />
                <span className="text-sm font-bold sm:hidden">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="app-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="dashboard-hero flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <p className="hero-eyebrow mb-2">Visão operacional</p>
            <h1 className="hero-title text-3xl font-black text-gray-900 tracking-tight">Painel de Abastecimentos</h1>
            <p className="hero-subtitle text-gray-500">Análise por frentista • Fuso: Brasil (Brasília)</p>
          </div>
          <div className="hero-actions flex flex-wrap gap-3">
            <button onClick={() => { setImportType('refueling'); setIsImportModalOpen(true); }} className="primary-action flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-indigo-100">
              <FileUp size={18} /> Log Horustech
            </button>
            <button onClick={() => { setImportType('comcept'); setIsImportModalOpen(true); }} className="primary-action flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-indigo-100">
              <FileUp size={18} /> Log Concept
            </button>
            <button onClick={() => { setImportType('hiro'); setIsImportModalOpen(true); }} className="primary-action flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-indigo-100">
              <FileUp size={18} /> Log Hiro
            </button>
            <button onClick={() => { setImportType('employees'); setIsImportModalOpen(true); }} className="secondary-action flex items-center gap-2 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm">
              <UserPlus size={18} /> Importar Funcionários
            </button>
            <button onClick={() => setIsDeleteModalOpen(true)} className="danger-action flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-5 py-2.5 rounded-xl font-bold transition-all">
              <Trash2 size={18} /> Limpar Tudo
            </button>
          </div>
        </div>

        <div className="metrics-grid grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="metric-card metric-volume bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Droplet size={24} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Volume Total</p>
              <p className="text-2xl font-black">{formatNumber(globalStats.totalLiters)} L</p>
            </div>
          </div>
          <div className="metric-card metric-revenue bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl"><DollarSign size={24} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Preço Total</p>
              <p className="text-2xl font-black">{formatCurrency(globalStats.totalValue)}</p>
            </div>
          </div>
          <div className="metric-card metric-count bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Fuel size={24} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Abastecimentos</p>
              <p className="text-2xl font-black">{globalStats.totalCount}</p>
            </div>
          </div>
        </div>

        {/* Seletor de Abas */}
        <div className="section-tabs flex flex-wrap bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 mb-8 max-w-5xl gap-1">
          <button 
            onClick={() => setActiveTab('frentistas')} 
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm transition-all duration-300 min-w-[150px] ${
              activeTab === 'frentistas' 
                ? 'tab-active bg-indigo-600 text-white shadow-md shadow-indigo-100'
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
                ? 'tab-active bg-indigo-600 text-white shadow-md shadow-indigo-100'
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
                ? 'tab-active bg-indigo-600 text-white shadow-md shadow-indigo-100'
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
                ? 'tab-active bg-indigo-600 text-white shadow-md shadow-indigo-100'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <DollarSign size={16} />
            Vendas por Preço
          </button>
          <button 
            onClick={() => {
              setActiveTab('inconsistencias');
              setInconsistencyPage(1);
            }} 
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm transition-all duration-300 min-w-[220px] ${
              activeTab === 'inconsistencias' 
                ? 'tab-active audit-tab-active bg-amber-600 text-white shadow-md shadow-amber-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-amber-50/50'
            }`}
          >
            <AlertTriangle size={16} className={inconsistentRecords.length > 0 && activeTab !== 'inconsistencias' ? 'text-amber-500' : ''} />
            <span>Auditoria da Planilha</span>
            {inconsistentRecords.length > 0 && (
              <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'inconsistencias' 
                  ? 'bg-white text-amber-700' 
                  : 'bg-red-500 text-white shadow-sm'
              }`}>
                {inconsistentRecords.length}
              </span>
            )}
          </button>
        </div>

        <div className="content-panel bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
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

        {activeTab === 'inconsistencias' && (
          <div className="space-y-6 mb-8">
            {/* Header com Descrição */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                    <ShieldAlert size={26} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                      Auditoria e Inconsistências da Planilha
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Rastreabilidade linha por linha de volumes/preços ausentes na planilha de origem e abastecimentos com encerrante inicial igual ao final.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
                  inconsistentRecords.length > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'
                }`}>
                  {inconsistentRecords.length} registro(s) com alerta
                </span>
              </div>
            </div>

            {/* 4 Cards de Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total com Alertas</p>
                  <p className="text-2xl font-black text-gray-900">{inconsistencyStats.total}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Enc. Inicial = Final</p>
                  <p className="text-2xl font-black text-red-600">{inconsistencyStats.countEncIgual}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Droplet size={22} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Volume Vazio (Auto)</p>
                  <p className="text-2xl font-black text-blue-600">{inconsistencyStats.countVolVazio}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                  <DollarSign size={22} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Preço Ausente</p>
                  <p className="text-2xl font-black text-orange-600">{inconsistencyStats.countPrcVazio}</p>
                </div>
              </div>
            </div>

            {/* Painel de Controle de Filtros e Busca */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                {/* Pílulas de Subfiltro */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setInconsistencyFilter('all'); setInconsistencyPage(1); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      inconsistencyFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Todos os Problemas ({inconsistencyStats.total})
                  </button>
                  <button
                    onClick={() => { setInconsistencyFilter('enc_igual'); setInconsistencyPage(1); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      inconsistencyFilter === 'enc_igual'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-100'
                    }`}
                  >
                    🛑 Enc. Inicial = Final ({inconsistencyStats.countEncIgual})
                  </button>
                  <button
                    onClick={() => { setInconsistencyFilter('vol_vazio'); setInconsistencyPage(1); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      inconsistencyFilter === 'vol_vazio'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-100'
                    }`}
                  >
                    ⚠️ Volume Vazio na Planilha ({inconsistencyStats.countVolVazio})
                  </button>
                  <button
                    onClick={() => { setInconsistencyFilter('tot_vazio'); setInconsistencyPage(1); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      inconsistencyFilter === 'tot_vazio'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100'
                    }`}
                  >
                    ⚠️ Total Vazio na Planilha ({inconsistencyStats.countTotVazio})
                  </button>
                  <button
                    onClick={() => { setInconsistencyFilter('prc_vazio'); setInconsistencyPage(1); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      inconsistencyFilter === 'prc_vazio'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-100'
                    }`}
                  >
                    ⚠️ Preço Zerado ({inconsistencyStats.countPrcVazio})
                  </button>
                  {inconsistencyStats.countEncMenor > 0 && (
                    <button
                      onClick={() => { setInconsistencyFilter('enc_menor'); setInconsistencyPage(1); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        inconsistencyFilter === 'enc_menor'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-100'
                      }`}
                    >
                      🛑 Enc. Regressivo ({inconsistencyStats.countEncMenor})
                    </button>
                  )}
                </div>

                {/* Campo de Busca */}
                <div className="relative w-full lg:w-80">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar linha, reg., bico, frentista..."
                    value={inconsistencySearch}
                    onChange={(e) => {
                      setInconsistencySearch(e.target.value);
                      setInconsistencyPage(1);
                    }}
                    className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                  />
                  {inconsistencySearch && (
                    <button
                      onClick={() => { setInconsistencySearch(''); setInconsistencyPage(1); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                <span>
                  Exibindo <strong>{filteredInconsistentRecords.length}</strong> registro(s) encontrado(s)
                </span>
                {filteredInconsistentRecords.length > 0 && (
                  <span>
                    Página <strong>{inconsistencyPage}</strong> de <strong>{totalInconsistencyPages || 1}</strong>
                  </span>
                )}
              </div>

              {filteredInconsistentRecords.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Droplet size={18} />
                      <span className="text-xs font-black uppercase tracking-wider">Volume dos registros filtrados</span>
                    </div>
                    <strong className="whitespace-nowrap text-lg font-black text-blue-700">
                      {formatNumber(filteredInconsistencyTotals.volume)} L
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-indigo-700">
                      <DollarSign size={18} />
                      <span className="text-xs font-black uppercase tracking-wider">Total dos registros filtrados</span>
                    </div>
                    <strong className="whitespace-nowrap text-lg font-black text-indigo-900">
                      {formatCurrency(filteredInconsistencyTotals.total)}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* Tabela de Inconsistências */}
            {filteredInconsistentRecords.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-green-100">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-lg font-black text-gray-800">
                  {inconsistentRecords.length === 0 
                    ? "Nenhuma inconsistência encontrada na planilha!" 
                    : "Nenhum registro encontrado para este filtro de busca."}
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  {inconsistentRecords.length === 0
                    ? "Todos os abastecimentos possuem volume, valor total e leituras de encerrante consistentes e preenchidos."
                    : "Tente alterar os termos da busca ou selecionar outro filtro de inconsistência acima."}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                        <th className="px-5 py-4">Linha Planilha</th>
                        <th className="px-5 py-4">Data / Hora</th>
                        <th className="px-5 py-4">Bico</th>
                        <th className="px-5 py-4">Frentista</th>
                        <th className="px-5 py-4">Problemas Detectados</th>
                        <th className="px-5 py-4">Enc. Inicial</th>
                        <th className="px-5 py-4">Enc. Final</th>
                        <th className="px-5 py-4">Volume</th>
                        <th className="px-5 py-4">Preço</th>
                        <th className="px-5 py-4">Total</th>
                        <th className="px-5 py-4 text-center">Diagnóstico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedInconsistencies.map((rec) => {
                        const isExpanded = expandedInconsistencyId === rec.item.id;
                        const frentistaNome = employeeMap[rec.item.id_frentista] || rec.item.id_frentista || "Desconhecido";

                        return (
                          <React.Fragment key={rec.item.id}>
                            <tr className={`hover:bg-amber-50/30 text-sm transition-colors ${isExpanded ? 'bg-amber-50/40' : ''}`}>
                              {/* Coluna Linha Planilha */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1 items-start">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 font-black rounded-lg text-xs">
                                    <FileText size={12} className="text-indigo-600" />
                                    Linha #{rec.item.linhaPlanilha}
                                  </span>
                                  {rec.item.registro && (
                                    <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                      Reg. {rec.item.registro}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Data / Hora */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                                  <Calendar size={13} className="text-gray-400" />
                                  <span>{formatDate(rec.item.data)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold mt-0.5">
                                  <Clock size={12} className="text-green-500" />
                                  <span>{rec.item.hora || "--:--"}</span>
                                </div>
                              </td>

                              {/* Bico */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-800 font-black rounded-lg text-xs">
                                  <Fuel size={12} className="text-indigo-600" />
                                  Bico {rec.item.bico}
                                </span>
                              </td>

                              {/* Frentista */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <p className="font-bold text-gray-800 uppercase text-xs truncate max-w-[140px]" title={frentistaNome}>
                                  {frentistaNome}
                                </p>
                                <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[140px]">
                                  {rec.item.id_frentista}
                                </p>
                              </td>

                              {/* Badges de Problemas */}
                              <td className="px-5 py-4">
                                <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                                  {rec.issues.map((issue, idx) => (
                                    <span
                                      key={idx}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${issue.badgeClass}`}
                                    >
                                      {issue.severity === 'critical' ? '🛑' : '⚠️'}
                                      {issue.label}
                                    </span>
                                  ))}
                                </div>
                              </td>

                              {/* Enc. Inicial */}
                              <td className="px-5 py-4 whitespace-nowrap font-mono text-xs">
                                <span className={`font-bold ${rec.hasEncerranteIgual ? 'text-red-600 font-black bg-red-50 px-1.5 py-0.5 rounded border border-red-200' : 'text-gray-700'}`}>
                                  {formatNumber(rec.item.enc_inicial || 0)} L
                                </span>
                              </td>

                              {/* Enc. Final */}
                              <td className="px-5 py-4 whitespace-nowrap font-mono text-xs">
                                <span className={`font-bold ${rec.hasEncerranteIgual ? 'text-red-600 font-black bg-red-50 px-1.5 py-0.5 rounded border border-red-200' : rec.hasEncerranteMenor ? 'text-rose-600 font-black' : 'text-gray-700'}`}>
                                  {formatNumber(rec.item.enc_final || 0)} L
                                </span>
                              </td>

                              {/* Volume (Litros) */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <p className={`font-black ${rec.hasEncerranteIgual || rec.item.litros <= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                  {formatNumber(rec.item.litros)} L
                                </p>
                                {rec.hasVolumeVazio && (
                                  <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 font-bold px-1.5 py-0.2 rounded block mt-0.5">
                                    Recalculado: Enc. Final - Inicial
                                  </span>
                                )}
                              </td>

                              {/* Preço Unitário */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <span className={`font-bold ${rec.hasPrecoVazio ? 'text-orange-600' : 'text-gray-700'}`}>
                                  {formatCurrency(rec.item.preco_unitario || 0)}
                                </span>
                              </td>

                              {/* Valor Total */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <p className="font-black text-gray-900">
                                  {formatCurrency(rec.item.valor)}
                                </p>
                                {rec.hasTotalVazio && (
                                  <span className="text-[10px] text-blue-800 bg-blue-50 border border-blue-200 font-bold px-1.5 py-0.2 rounded block mt-0.5">
                                    Recalculado: Vol × Preço
                                  </span>
                                )}
                              </td>

                              {/* Botão Diagnóstico */}
                              <td className="px-5 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => setExpandedInconsistencyId(isExpanded ? null : rec.item.id)}
                                  className={`p-2 rounded-xl transition-all ${
                                    isExpanded 
                                      ? 'bg-amber-600 text-white shadow-md' 
                                      : 'bg-gray-100 hover:bg-amber-100 text-gray-600 hover:text-amber-800'
                                  }`}
                                  title="Ver diagnóstico da linha"
                                >
                                  <Info size={16} />
                                </button>
                              </td>
                            </tr>

                            {/* Acordeão de Diagnóstico Detalhado */}
                            {isExpanded && (
                              <tr className="bg-amber-50/60 border-y border-amber-200">
                                <td colSpan={11} className="p-6">
                                  <div className="bg-white rounded-xl p-5 border border-amber-200 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                      <div className="flex items-center gap-2">
                                        <ShieldAlert size={20} className="text-amber-600" />
                                        <h4 className="font-black text-gray-900 text-sm">
                                          Diagnóstico Detalhado da Linha #{rec.item.linhaPlanilha} da Planilha
                                        </h4>
                                        {rec.item.registro && (
                                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">
                                            Registro: {rec.item.registro}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => setExpandedInconsistencyId(null)}
                                        className="text-gray-400 hover:text-gray-600 p-1"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>

                                    {/* Lista de Inconsistências com Explicações */}
                                    <div className="space-y-2">
                                      <p className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                        Problemas e Ações Aplicadas:
                                      </p>
                                      {rec.issues.map((issue, idx) => (
                                        <div
                                          key={idx}
                                          className={`p-3 rounded-xl border text-xs leading-relaxed ${
                                            issue.severity === 'critical'
                                              ? 'bg-red-50 border-red-200 text-red-900'
                                              : 'bg-amber-50 border-amber-200 text-amber-900'
                                          }`}
                                        >
                                          <strong className="font-black">{issue.label}:</strong> {issue.description}
                                        </div>
                                      ))}
                                    </div>

                                    {/* Comparativo Planilha Original vs Sistema */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                                          📄 Valores Lidos da Planilha Original
                                        </p>
                                        <ul className="text-xs space-y-1.5 text-gray-700">
                                          <li><strong>Volume:</strong> {rec.item.rawVolumeOriginal !== undefined && rec.item.rawVolumeOriginal > 0 ? `${formatNumber(rec.item.rawVolumeOriginal)} L` : '<Vazio ou Zerado / R$ ->'}</li>
                                          <li><strong>Total:</strong> {rec.item.rawTotalOriginal !== undefined && rec.item.rawTotalOriginal > 0 ? formatCurrency(rec.item.rawTotalOriginal) : '<Vazio ou Zerado / R$ ->'}</li>
                                          <li><strong>Preço:</strong> {rec.item.rawPrecoOriginal !== undefined && rec.item.rawPrecoOriginal > 0 ? formatCurrency(rec.item.rawPrecoOriginal) : '<Não informado>'}</li>
                                          <li><strong>Enc. Inicial:</strong> {formatNumber(rec.item.enc_inicial || 0)} L</li>
                                          <li><strong>Enc. Final:</strong> {formatNumber(rec.item.enc_final || 0)} L</li>
                                        </ul>
                                      </div>

                                      <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                        <p className="text-xs font-black text-indigo-900 uppercase tracking-wider mb-2">
                                          ⚡ Valores Processados / Corrigidos pelo Sistema
                                        </p>
                                        <ul className="text-xs space-y-1.5 text-indigo-950">
                                          <li>
                                            <strong>Volume Final:</strong> {formatNumber(rec.item.litros)} L
                                            {rec.hasVolumeVazio && <span className="text-green-700 font-bold ml-1"> (Calculado: Enc. Final - Inicial)</span>}
                                          </li>
                                          <li>
                                            <strong>Total Final:</strong> {formatCurrency(rec.item.valor)}
                                            {rec.hasTotalVazio && <span className="text-green-700 font-bold ml-1"> (Calculado: Volume × Preço)</span>}
                                          </li>
                                          <li><strong>Preço Unitário:</strong> {formatCurrency(rec.item.preco_unitario || 0)}</li>
                                          <li>
                                            <strong>Delta de Encerrantes:</strong> {rec.encDelta >= 0 ? `+${formatNumber(rec.encDelta)} L` : `${formatNumber(rec.encDelta)} L`}
                                            {rec.hasEncerranteIgual && <span className="text-red-700 font-black ml-1"> (ALERTA: Delta = 0,00 L)</span>}
                                          </li>
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-indigo-100 bg-indigo-50/70 text-sm">
                        <td colSpan={7} className="px-5 py-4 text-right font-black uppercase tracking-wider text-indigo-900">
                          Somatório dos {filteredInconsistentRecords.length} registros filtrados
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-black text-blue-700">
                          {formatNumber(filteredInconsistencyTotals.volume)} L
                        </td>
                        <td className="px-5 py-4" />
                        <td className="px-5 py-4 whitespace-nowrap font-black text-indigo-900">
                          {formatCurrency(filteredInconsistencyTotals.total)}
                        </td>
                        <td className="px-5 py-4" />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Paginação */}
                {totalInconsistencyPages > 1 && (
                  <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-medium">
                      Mostrando {((inconsistencyPage - 1) * inconsistenciesPerPage) + 1} a {Math.min(inconsistencyPage * inconsistenciesPerPage, filteredInconsistentRecords.length)} de {filteredInconsistentRecords.length} registros
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInconsistencyPage(p => Math.max(1, p - 1))}
                        disabled={inconsistencyPage === 1}
                        className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold flex items-center gap-1"
                      >
                        <ChevronLeft size={16} /> Anterior
                      </button>
                      <span className="text-xs font-bold text-gray-700 px-3 py-1 bg-gray-100 rounded-lg">
                        {inconsistencyPage} / {totalInconsistencyPages}
                      </span>
                      <button
                        onClick={() => setInconsistencyPage(p => Math.min(totalInconsistencyPages, p + 1))}
                        disabled={inconsistencyPage === totalInconsistencyPages}
                        className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold flex items-center gap-1"
                      >
                        Próximo <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
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
          <button disabled={!selectedFile || isImporting} onClick={handleImport} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 disabled:opacity-50 hover:bg-indigo-700 transition-all">
            {isImporting ? 'Processando arquivo…' : 'Confirmar Importação'}
          </button>
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

    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
