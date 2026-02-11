
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
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
  RotateCcw
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
  bico: string;
  valor: number;
  litros: number;
  ownerId: string;
}

interface FrentistaGroup {
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

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatNumber = (val: number) => 
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Data Inválida';
  return d.toLocaleDateString('pt-BR', { timeZone: BR_TIMEZONE }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: BR_TIMEZONE });
};

const getDateOnlyString = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-CA', { timeZone: BR_TIMEZONE });
  } catch {
    return "";
  }
};

/**
 * Parses a date string prioritizing the Brazilian format DD/MM/YYYY.
 * Prevents swapping day and month.
 */
const parseDateRobust = (dateStr: string): string => {
  if (!dateStr) return new Date().toISOString();
  
  const s = dateStr.trim();
  
  // Tenta o formato DD/MM/AAAA (com ou sem hora)
  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  
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

  // Tenta formato ISO ou similar YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
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
  const [expandedFrentista, setExpandedFrentista] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [filterStartDate, setFilterStartDate] = useState(''); 
  const [filterEndDate, setFilterEndDate] = useState('');     
  const [filterBico, setFilterBico] = useState('');
  const [filterFrentista, setFilterFrentista] = useState('');
  const [sortBy, setSortBy] = useState<'data' | 'bico' | 'valor'>('data');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const savedData = localStorage.getItem('abastecimentos_data');
    if (savedData) setData(JSON.parse(savedData));
    
    const savedUser = localStorage.getItem('abastecimentos_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      if (parsedUser && parsedUser.role === 'admin') {
        setCurrentUser(parsedUser);
      } else {
        localStorage.removeItem('abastecimentos_user');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('abastecimentos_data', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem('abastecimentos_user', JSON.stringify(currentUser));
  }, [currentUser]);

  const login = (user: AppUser) => setCurrentUser(user);
  const logout = () => {
    setCurrentUser(null);
    setExpandedFrentista(null);
    setFilterFrentista('');
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterBico('');
    setFilterFrentista('');
    setSortBy('data');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const hasActiveFilters = useMemo(() => {
    return filterStartDate !== '' || filterEndDate !== '' || filterBico !== '' || filterFrentista !== '';
  }, [filterStartDate, filterEndDate, filterBico, filterFrentista]);

  const parseCSV = (text: string): Refueling[] => {
    if (!currentUser) return [];
    
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    const headers = lines[0].toLowerCase().split(delimiter).map(h => h.trim().replace(/['"]/g, ''));
    const result: Refueling[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(delimiter).map(v => v.trim().replace(/['"]/g, ''));
        const row: any = {};
        headers.forEach((header, index) => { row[header] = values[index]; });

        const frentistaId = values.length >= 13 ? values[12] : (row.id_frentista || row.frentista || 'N/A');
        
        const dateRaw = row.data || row.data_hora || row.date || row.timestamp;
        const bicoRaw = row.bico || row.id_bico || 'B?';
        const valorRaw = row.valor || row.total || row.price;
        const litrosRaw = row.litros || row.volume || row.quantidade || row.liters;

        const newItem: Refueling = {
          id: Math.random().toString(36).substr(2, 9) + Date.now() + i,
          id_frentista: String(frentistaId),
          data: parseDateRobust(dateRaw),
          bico: String(bicoRaw),
          valor: parseFloat(String(valorRaw).replace(',', '.') || '0'),
          litros: parseFloat(String(litrosRaw).replace(',', '.') || '0'),
          ownerId: currentUser.id
        };

        if (!isNaN(newItem.valor) || !isNaN(newItem.litros)) {
          result.push(newItem);
        }
      } catch (err) {
        console.warn(`Erro ao processar linha ${i + 1}:`, err);
      }
    }
    return result;
  };

  const handleImport = () => {
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const newItems = parseCSV(text);
        if (newItems.length > 0) {
          setData(prev => [...prev, ...newItems]);
          setIsImportModalOpen(false);
          setSelectedFile(null);
          setCurrentPage(1);
        } else {
          alert("Não foi possível encontrar dados válidos no arquivo CSV.");
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  const bulkDelete = () => {
    if (confirmDeleteText.toLowerCase() === 'excluir') {
      setData([]);
      setIsDeleteModalOpen(false);
      setConfirmDeleteText('');
      setCurrentPage(1);
    }
  };

  const uniqueFrentistas = useMemo(() => {
    if (!currentUser) return [];
    return Array.from(new Set(data.map(item => item.id_frentista))).sort();
  }, [data, currentUser]);

  const filteredData = useMemo(() => {
    if (!currentUser) return [];
    let result = data;

    if (filterFrentista) result = result.filter(item => item.id_frentista === filterFrentista);
    if (filterStartDate || filterEndDate) {
      result = result.filter(item => {
        const itemDateStr = getDateOnlyString(item.data); 
        if (filterStartDate && itemDateStr < filterStartDate) return false;
        if (filterEndDate && itemDateStr > filterEndDate) return false;
        return true;
      });
    }
    if (filterBico) result = result.filter(item => item.bico.toLowerCase().includes(filterBico.toLowerCase()));

    return [...result].sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];
      if (sortBy === 'data') {
        valA = new Date(a.data).getTime();
        valB = new Date(b.data).getTime();
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, currentUser, filterStartDate, filterEndDate, filterBico, filterFrentista, sortBy, sortOrder]);

  const globalStats = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      totalLiters: acc.totalLiters + curr.litros,
      totalValue: acc.totalValue + curr.valor,
      totalCount: acc.totalCount + 1
    }), { totalLiters: 0, totalValue: 0, totalCount: 0 });
  }, [filteredData]);

  const groupedByFrentista = useMemo(() => {
    const groups: Record<string, FrentistaGroup> = {};
    filteredData.forEach(item => {
      if (!groups[item.id_frentista]) {
        groups[item.id_frentista] = { items: [], totalLiters: 0, totalValue: 0, count: 0 };
      }
      groups[item.id_frentista].items.push(item);
      groups[item.id_frentista].totalLiters += item.litros;
      groups[item.id_frentista].totalValue += item.valor;
      groups[item.id_frentista].count += 1;
    });
    return groups;
  }, [filteredData]);

  const frentistaEntries = (Object.entries(groupedByFrentista) as [string, FrentistaGroup][]);
  const totalPages = Math.ceil(frentistaEntries.length / itemsPerPage);
  const paginatedFrentistas = frentistaEntries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md border border-white">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-4 bg-indigo-600 rounded-2xl text-white mb-4 shadow-lg">
              <Fuel size={32} />
            </div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Posto Dashboard</h1>
            <p className="text-gray-500 mt-2">Área Administrativa</p>
          </div>
          <div className="space-y-4">
            {MOCK_USERS.map(user => (
              <button
                key={user.id}
                onClick={() => login(user)}
                className="w-full group flex items-center p-4 bg-gray-50 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all duration-300 border border-gray-100 hover:border-indigo-400 text-left"
              >
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
              <span className="font-black text-xl tracking-tight hidden sm:block">POSTO PRO</span>
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
            <p className="text-gray-500">Filtrado por Cartão de Frentista • Fuso: Brasil (Brasília)</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-indigo-100">
              <FileUp size={18} /> Importar Dados
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
              <p className="text-sm text-gray-500 font-medium">Valor Total</p>
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
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500">Frentista (Cartão)</label>
              <div className="relative">
                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select value={filterFrentista} onChange={(e) => { setFilterFrentista(e.target.value); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm appearance-none">
                  <option value="">Todos</option>
                  {uniqueFrentistas.map(fId => <option key={fId} value={fId}>{fId}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500">Início</label>
              <input type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setCurrentPage(1); }} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500">Fim</label>
              <input type="date" value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setCurrentPage(1); }} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500">Bico</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Ex: B1" value={filterBico} onChange={(e) => { setFilterBico(e.target.value); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500">Ordenar</label>
              <div className="flex gap-2">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm appearance-none">
                  <option value="data">Data</option>
                  <option value="bico">Bico</option>
                  <option value="valor">Valor</option>
                </select>
                <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-2 bg-gray-50 border border-gray-200 rounded-xl">
                  {sortOrder === 'asc' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {paginatedFrentistas.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">Nenhum dado encontrado</h3>
              <p className="text-gray-500 mt-1">Tente importar um arquivo CSV ou mudar os filtros.</p>
            </div>
          ) : (
            paginatedFrentistas.map(([frentistaId, group]) => (
              <div key={frentistaId} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div onClick={() => setExpandedFrentista(expandedFrentista === frentistaId ? null : frentistaId)} className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-black">{frentistaId.slice(-2)}</div>
                    <div>
                      <h3 className="text-lg font-black text-gray-800">Frentista: {frentistaId}</h3>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{group.count} registros</p>
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
                  <div className={`transition-transform duration-300 ${expandedFrentista === frentistaId ? 'rotate-180' : ''}`}><ChevronDown size={24} className="text-gray-400" /></div>
                </div>
                {expandedFrentista === frentistaId && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-6">
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                            <th className="px-6 py-4">Data/Hora (Brasília)</th>
                            <th className="px-6 py-4">Bico</th>
                            <th className="px-6 py-4">Litros</th>
                            <th className="px-6 py-4">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 text-sm">
                              <td className="px-6 py-4 flex items-center gap-2"><Calendar size={14} className="text-gray-400" />{formatDate(item.data)}</td>
                              <td className="px-6 py-4 font-bold text-indigo-600">{item.bico}</td>
                              <td className="px-6 py-4">{formatNumber(item.litros)} L</td>
                              <td className="px-6 py-4 font-black">{formatCurrency(item.valor)}</td>
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
          <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100">
             <p className="text-sm text-gray-700 hidden sm:block">Página <span className="font-bold">{currentPage}</span> de <span className="font-bold">{totalPages}</span></p>
             <div className="flex gap-2">
                <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="p-2 border rounded-xl disabled:opacity-50"><ChevronLeft size={20}/></button>
                <button disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)} className="p-2 border rounded-xl disabled:opacity-50"><ChevronRight size={20}/></button>
             </div>
          </div>
        )}
      </main>

      <Modal isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setSelectedFile(null); }} title="Importar Novos Dados">
        <div className="text-center">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full inline-flex mb-4"><UploadCloud size={40} /></div>
          <p className="text-gray-600 text-sm mb-6">Selecione o arquivo CSV. O sistema detectará o Frentista na Coluna 13 e tratará datas no formato brasileiro (DD/MM/AAAA).</p>
          <div className="mb-6">
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            {!selectedFile ? (
              <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-200 rounded-2xl hover:border-indigo-400 text-gray-500 font-bold"><Plus size={20} />Escolher Arquivo</button>
            ) : (
              <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <span className="text-sm font-bold truncate max-w-[200px]">{selectedFile.name}</span>
                <button onClick={() => setSelectedFile(null)}><X size={16} className="text-indigo-600" /></button>
              </div>
            )}
          </div>
          <button disabled={!selectedFile} onClick={handleImport} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">Confirmar Importação</button>
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Limpar Tudo">
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
            <AlertTriangle size={32} />
            <p className="text-sm font-medium">Isso removerá todos os dados do sistema. Esta ação é irreversível.</p>
          </div>
          <input type="text" placeholder="Digite EXCLUIR" value={confirmDeleteText} onChange={(e) => setConfirmDeleteText(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl uppercase font-bold" />
          <button disabled={confirmDeleteText.toLowerCase() !== 'excluir'} onClick={bulkDelete} className="w-full py-3 bg-red-600 text-white rounded-xl font-black disabled:opacity-50">EXCLUIR TUDO</button>
        </div>
      </Modal>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
