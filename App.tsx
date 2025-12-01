
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChecklistItem, ChecklistGroup, QuestionItem, QuestionGroup, InterviewStatus, GenAIBlob, FirstCycleCode, SecondCycleCode, InterviewRecord } from './types';
import { Logo, MicIcon, StopIcon, PlusIcon, TrashIcon, CheckCircleIcon, ChevronDownIcon, SaveIcon, DownloadIcon, PauseIcon, PlayIcon, SparklesIcon, CodeBracketIcon, UploadIcon, RefreshIcon, ClipboardIcon, XIcon, HistoryIcon, DragHandleIcon, DocumentTextIcon } from './components/icons';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;

// FIX: Moved the AIStudio interface into the global scope to resolve a conflict where
// TypeScript considered two declarations of `AIStudio` as different types.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    webkitAudioContext: typeof AudioContext;
  }
}

// Audio Encoding/Decoding helpers
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const CHECKLIST_STORAGE_KEY = 'ai-ai-checklist-backup';
const QUESTIONS_STORAGE_KEY = 'ai-ai-questions-backup';
const INTERVIEW_HISTORY_STORAGE_KEY = 'ai-ai-interview-history';


const initialMarkdown = `# Checklist de Coleta - Entrevista de Mestrado

## Dados da Entrevista

* **Empresa (Unidade de Análise):**
* **Entrevistado (Cargo/Nível):**
* **Modalidade Atual da Equipe:**

---

## P1: Cultura Organizacional

* **P1.1 Política é formal (documentada)?**
* **P1.1 Definição da Política:**
* **P1.2 Comunicação da Política:**

---

## P2: Estilo de Liderança

* **P2.1 Foco principal do Gestor:**
* **P2.1 Preferência Pessoal do Gestor:**
* **P2.2 Gestor precisou adaptar liderança?**
* **P2.2 Empresa treinou líderes (gestão remota)?**

---

## P3: Percepção sobre Produtividade

* **P3.1 Medição formal de produtividade?**
* **P3.2 Percepção (Gestor) Produtividade Remota:**
* **P3.2 Dificuldade em *avaliar* à distância?**
* **P3.2 Produtividade foi justificativa p/ modalidade?**

---

## P4: Preferência do Colaborador

* **P4.1 Empresa fez pesquisa (enquete) de preferência?**
* **P4.2 Feedback dos colaboradores foi usado na política?**
* **P4.2 Percepção (Gestor) Satisfação da equipe c/ política:**

---

## P5: Rotatividade (Turnover)

* **P5.1 Modalidade (presencial) é motivo em desligamento?**
* **P5.2 Flexibilidade é usada para *reter* talentos?**
* **P5.2 Risco de turnover por causa da política?**

---

## P6: Atração de Talentos

* **P6.1 Remoto/Híbrido ajudou a contratar fora da cidade?**
* **P6.2 Candidatos já recusaram vaga pela modalidade?**
* **P6.2 Política atual é (na contratação):**
`;

const initialQuestionsMarkdown = `1.  **[Pergunta-Chave (Abertura)]**
    "Para começarmos, gostaria que você me contasse um pouco sobre a *jornada* da sua equipe nos últimos anos. Como era a dinâmica de trabalho de vocês antes da pandemia e como ela foi se transtransformando até chegar no modelo que vocês adotam hoje?"

2.  **[Pergunta-Chave (O Processo de Decisão)]**
    "Essa definição de um novo modelo nunca é simples. Gostaria de entender como a organização conduziu essa escolha. Quais foram as *grandes discussões* na liderança? Que fatores tiveram mais peso para se chegar nesse formato?"

    * **Pergunts Complementares (Se não for dito):**
        * "Esse modelo atual é uma política formal, documentada, ou é um arranjo mais flexível combinado com cada gestor?"
        * "E qual foi o *peso da opinião* dos colaboradores nessa decisão? Houve um momento formal de escuta, como pesquisas, ou essa percepção veio mais dos próprios gestores?"
        * "Depois de batido o martelo, como foi o processo de *comunicação* dessa política? Foi algo bem recebido, gerou ruídos?"

---

### Bloco 2: A Gestão no Dia a Dia (O Líder)

3.  **[Pergunta-Chave (Desafios da Liderança)]**
    "Trazendo a conversa agora para o seu *dia a dia* como gestor: O que mais mudou na sua *forma de liderar*? Quais são os seus maiores desafios hoje para manter a equipe coesa e engajada nesse modelo?"

    * **Perguntas Complementares (Se não for dito):**
        * "Você sente que seu estilo de gestão teve que se adaptar? A empresa deu algum suporte ou treinamento para os líderes gerenciarem equipes distribuídas?"
        * "Nesse modelo, como você equilibra a necessidade de *confiança* com a de *acompanhamento*? Você se pega gerenciando mais por entregas e metas ou ainda sente a necessidade de um controle mais próximo de processos ou horários?"

4.  **[Pergunta-Chave (Produtividade e Performance)]**
    "Um tema que sempre aparece é a *produtividade*. Como você e a empresa *avaliam* a performance da equipe nesse formato? O que é levado em conta para saber se o time está indo bem?"

    * **Perguntas Complementares (Se não for dito):**
        * "Essa avaliação é baseada em métricas formais (KPIs, OKRs, entregas) ou mais na sua *percepção* da consistência do time?"
        * "Você acha mais difícil *avaliar* o desempenho de quem está em teletrablaho em comparação com quem está no escritório?"
        * "A discussão sobre produtividade (seja o dado ou a percepção) foi um argumento central para *justificar* o modelo atual?"

---

### Bloco 3: O Impacto no Mercado (O Talento)

5.  **[Pergunta-Chave (Atração e Retenção)]**
    "Falando agora do mercado de TI, que é uma 'batalha' constante por talentos. Como você sente que a modalidade de trabalho de vocês tem influenciado a capacidade da empresa em *atrair* e *reter* profissionais?"

    * **Perguntas Complementares (Se não for dito):**
        * "Vocês já tiveram casos de candidatos que *recusaram* uma proposta por causa do modelo exigido? Ou, por outro lado, vocês conseguiram *ampliar* o leque e contratar gente de outras cidades?"
        * "E olhando para *dentro*, para os talentos que já estão com vocês. A flexibilidade (ou a falta dela) é usada ativamente como um argumento para *manter* as pessoas?"
        * "Já aconteceu de você perder um bom profissional que citou a modalidade de trabalho como um dos motivos da saída?"

---

### Bloco 4: Fechamento (A Visão Pessoal)

6.  **[Pergunta-Chave (Visão de Futuro)]**
    "Para fechar, depois de toda essa experiência... Se você tivesse 'carta branca' hoje para definir o modelo ideal para a *sua* equipe, o que você faria? O que, na sua visão pessoal, é o que realmente funciona no fim do dia?"

7.  **[Pergunta-Final (Opcional)]**
    "Há algum ponto importante sobre essa decisão, ou algum fator que eu não perguntei, e que você acha crucial para eu entender o cenário de vocês?"
`;

const parseMarkdownToGroupedChecklist = (markdown: string): ChecklistGroup[] => {
  const lines = markdown.split('\n');
  const groups: ChecklistGroup[] = [];
  let currentGroup: ChecklistGroup | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('## ')) {
      const title = trimmedLine.substring(3).trim();
      currentGroup = {
        id: `group-${Date.now()}-${groups.length}`,
        title: title,
        items: [],
      };
      groups.push(currentGroup);
    } else if (trimmedLine.startsWith('* ') && !trimmedLine.includes('( )') && !trimmedLine.toLowerCase().includes('notas p')) {
      let text = trimmedLine
        .substring(2)
        .replace(/\*\*/g, '')
        .replace(/:$/, '')
        .trim();
      
      if (text && !text.toLowerCase().startsWith('insights') && !text.toLowerCase().startsWith('percepção geral')) {
        if (!currentGroup) {
          currentGroup = {
            id: `group-default-${Date.now()}`,
            title: 'Itens Gerais',
            items: [],
          };
          groups.push(currentGroup);
        }
        
        currentGroup.items.push({
          id: `item-${Date.now()}-${currentGroup.items.length}`,
          text: text,
          checkedByAI: false,
          checkedByHuman: false,
          keywords: '',
          notes: '',
        });
      }
    }
  }
  return groups.filter(group => group.items.length > 0);
};

const parseMarkdownToQuestions = (markdown: string): QuestionGroup[] => {
    const lines = markdown.split('\n');
    const groups: QuestionGroup[] = [];
    let currentGroup: QuestionGroup | null = null;

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('### ')) {
            const title = trimmedLine.substring(4).trim();
            currentGroup = {
                id: `q-group-${Date.now()}-${groups.length}`,
                title: title,
                items: [],
            };
            groups.push(currentGroup);
        } else if (trimmedLine.match(/^(\d+\.|-|\*)\s/)) {
            const text = trimmedLine.replace(/^(\d+\.|-|\*)\s/, '').replace(/\*|"/g, '').trim();

            if (text) {
                if (!currentGroup) {
                    currentGroup = {
                        id: `q-group-default-${Date.now()}`,
                        title: 'Perguntas Iniciais',
                        items: [],
                    };
                    groups.push(currentGroup);
                }
                currentGroup.items.push({
                    id: `q-item-${Date.now()}-${currentGroup.items.length}`,
                    text: text,
                    asked: false,
                });
            }
        } else if (trimmedLine.length > 0 && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('---') && !trimmedLine.startsWith('**Objetivo')) {
             if (currentGroup && currentGroup.items.length > 0) {
                 const lastItem = currentGroup.items[currentGroup.items.length - 1];
                 lastItem.text += ` ${trimmedLine.replace(/"/g, '')}`;
             }
        }
    }
    return groups.filter(group => group.items.length > 0);
};

const VolumeMeter: React.FC<{ volume: number }> = ({ volume }) => (
    <div className="w-32 h-5 bg-brand-dark border border-brand-light-gray/50 rounded-md overflow-hidden flex items-center px-1">
        <div 
            className="h-2 bg-green-500 rounded-sm transition-all duration-75"
            style={{ width: `${volume * 100}%` }}
        />
    </div>
);

// --- FLOATING MENU COMPONENT ---
interface FloatingMenuProps {
    status: InterviewStatus;
    transcription: string;
    isValidating: boolean;
    isSummarizing: boolean;
    isCoding: boolean;
    audioBlobUrl: string | null;
    interviewerNotes: string;
    firstCycleCodes: FirstCycleCode[];
    handleSaveAudio: () => void;
    handleExportTranscription: (format: 'txt' | 'md') => void;
    handleExportNotes: () => void;
    handleValidateChecklist: () => void;
    handleGenerateSummary: () => void;
    handleExportForAtlasTi: () => void;
}

const FloatingMenu: React.FC<FloatingMenuProps> = (props) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const ActionButton: React.FC<{
        onClick: () => void;
        disabled: boolean;
        title: string;
        shortcut: string;
        children: React.ReactNode;
        className?: string;
    }> = ({ onClick, disabled, title, shortcut, children, className = '' }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            title={`${title} (${shortcut})`}
            className={`w-full flex items-center justify-between px-4 py-2 text-left text-sm rounded-md transition-colors ${
                disabled 
                ? 'bg-brand-dark/30 text-gray-500 cursor-not-allowed' 
                : 'bg-brand-dark/80 hover:bg-brand-light-gray text-white'
            } ${className}`}
        >
            <div className="flex items-center gap-3">
                {children}
                <span>{title}</span>
            </div>
            <span className="text-xs text-gray-400 font-mono">{shortcut}</span>
        </button>
    );

    return (
        <div ref={menuRef} className="fixed bottom-6 left-6 z-50">
            {isOpen && (
                <div className="absolute bottom-16 left-0 w-72 bg-brand-gray/90 backdrop-blur-sm border border-brand-light-gray/20 rounded-lg shadow-2xl p-3 flex flex-col gap-4 animate-fade-in-up">
                    <div>
                        <h4 className="text-xs font-bold uppercase text-gray-400 px-2 mb-2">Exportar</h4>
                         <div className="flex flex-col gap-1">
                            <ActionButton onClick={props.handleSaveAudio} disabled={!props.audioBlobUrl} title="Salvar Áudio (.mp4)" shortcut="Ctrl+A"><DownloadIcon className="w-5 h-5 text-blue-400" /></ActionButton>
                            <ActionButton onClick={props.handleExportNotes} disabled={!props.interviewerNotes.trim()} title="Salvar Anotações (.txt)" shortcut="Ctrl+S"><SaveIcon className="w-5 h-5" /></ActionButton>
                            <ActionButton onClick={() => props.handleExportTranscription('txt')} disabled={!props.transcription.trim()} title="Transcrição (.txt)" shortcut="Ctrl+T"><DownloadIcon className="w-5 h-5" /></ActionButton>
                            <ActionButton onClick={() => props.handleExportTranscription('md')} disabled={!props.transcription.trim()} title="Transcrição (.md)" shortcut="Ctrl+M"><DownloadIcon className="w-5 h-5" /></ActionButton>
                             <ActionButton onClick={props.handleExportForAtlasTi} disabled={!props.transcription.trim() && !props.interviewerNotes.trim()} title="Exportar para ATLAS.ti" shortcut="Ctrl+E">
                                 <DocumentTextIcon className="w-5 h-5 text-orange-400" />
                             </ActionButton>
                        </div>
                    </div>
                     <div>
                        <h4 className="text-xs font-bold uppercase text-gray-400 px-2 mb-2">Análise com IA</h4>
                         <div className="flex flex-col gap-1">
                            <ActionButton onClick={props.handleValidateChecklist} disabled={!props.transcription.trim() || props.isValidating} title="Validar Checklist" shortcut="Ctrl+V">
                                <div className="flex items-center gap-3">
                                  <SparklesIcon className={`w-5 h-5 text-purple-400 ${props.isValidating ? 'animate-spin' : ''}`} />
                                  <span>{props.isValidating ? 'Validando...' : 'Validar Checklist'}</span>
                                </div>
                            </ActionButton>
                            <ActionButton onClick={props.handleGenerateSummary} disabled={!props.transcription.trim() || props.isSummarizing} title={props.isSummarizing ? 'Gerando...' : 'Sumarizar Transcrição'} shortcut="Ctrl+G">
                                 <SparklesIcon className={`w-5 h-5 text-teal-400 ${props.isSummarizing ? 'animate-spin' : ''}`} />
                            </ActionButton>
                        </div>
                    </div>
                </div>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 bg-brand-blue hover:bg-brand-light-blue text-white rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 transition-all duration-200"
                aria-label="Abrir menu de ações"
            >
                {isOpen ? <XIcon className="w-7 h-7" /> : <PlusIcon className="w-7 h-7" />}
            </button>
        </div>
    );
};

const App = () => {
  const [checklist, setChecklist] = useState<ChecklistGroup[]>(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load checklist from localStorage", e);
    }
    return parseMarkdownToGroupedChecklist(initialMarkdown);
  });
  const [questions, setQuestions] = useState<QuestionGroup[]>(() => {
    try {
      const saved = localStorage.getItem(QUESTIONS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load questions from localStorage", e);
    }
    return parseMarkdownToQuestions(initialQuestionsMarkdown);
  });
  const [interviewHistory, setInterviewHistory] = useState<InterviewRecord[]>(() => {
    try {
      const saved = localStorage.getItem(INTERVIEW_HISTORY_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load interview history from localStorage", e);
    }
    return [];
  });

  const [status, setStatus] = useState<InterviewStatus>('idle');
  const [activeTab, setActiveTab] = useState<'interview' | 'checklist' | 'questions' | 'codificacao' | 'history'>('interview');
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [interviewIdentifier, setInterviewIdentifier] = useState<string>('');
  const [interviewStartTime, setInterviewStartTime] = useState<string>('');
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isCoding, setIsCoding] = useState<boolean>(false);
  const [firstCycleCodes, setFirstCycleCodes] = useState<FirstCycleCode[]>([]);
  const [secondCycleCodes, setSecondCycleCodes] = useState<SecondCycleCode[]>([]);
  const [isSecondCycleCoding, setIsSecondCycleCoding] = useState<boolean>(false);
  const [selectedTheme, setSelectedTheme] = useState<SecondCycleCode | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [micVolume, setMicVolume] = useState(0);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [interviewerNotes, setInterviewerNotes] = useState<string>('');
  const [selectedInterview, setSelectedInterview] = useState<InterviewRecord | null>(null);
  const [isApiKeySelected, setIsApiKeySelected] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);


  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourcesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const dragOverItemRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  const currentStateRef = useRef({
      status,
      transcription,
      interviewIdentifier,
      interviewStartTime,
      interviewerNotes,
      summary,
  });

  useEffect(() => {
      currentStateRef.current = {
          status,
          transcription,
          interviewIdentifier,
          interviewStartTime,
          interviewerNotes,
          summary,
      };
  });

  useEffect(() => {
    const checkApiKey = async () => {
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setIsApiKeySelected(hasKey);
        }
        setIsAppLoading(false);
    };

    const timer = setTimeout(checkApiKey, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
        localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklist));
    } catch (e) {
        console.error("Failed to save checklist to localStorage", e);
    }
  }, [checklist]);

  useEffect(() => {
    try {
        localStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(questions));
    } catch (e) {
        console.error("Failed to save questions to localStorage", e);
    }
  }, [questions]);

  useEffect(() => {
    try {
        localStorage.setItem(INTERVIEW_HISTORY_STORAGE_KEY, JSON.stringify(interviewHistory));
    } catch (e) {
        console.error("Failed to save interview history from localStorage", e);
    }
  }, [interviewHistory]);
  
  const handleAddGroup = () => setChecklist(prev => [...prev, { id: `group-${Date.now()}`, title: 'Novo Grupo', items: [] }]);
  const handleUpdateGroupTitle = (groupId: string, title: string) => setChecklist(prev => prev.map(g => g.id === groupId ? { ...g, title } : g));
  const handleDeleteGroup = (groupId: string) => setChecklist(prev => prev.filter(g => g.id !== groupId));
  const handleAddItemToGroup = (groupId: string) => setChecklist(prev => prev.map(g => g.id === groupId ? { ...g, items: [...g.items, { id: `item-${Date.now()}`, text: 'Novo item', checkedByAI: false, checkedByHuman: false, keywords: '', notes: '' }] } : g));
  const handleUpdateItemText = (groupId: string, itemId: string, text: string) => setChecklist(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, text } : i) } : g));
  const handleUpdateItemKeywords = (groupId: string, itemId: string, keywords: string) => setChecklist(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, keywords } : i) } : g));
  const handleUpdateItemNotes = (groupId: string, itemId: string, notes: string) => setChecklist(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, notes } : i) } : g));
  const handleDeleteItem = (groupId: string, itemId: string) => setChecklist(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g));
  
  const handleAddQuestionGroup = () => setQuestions(prev => [...prev, { id: `q-group-${Date.now()}`, title: 'Novo Bloco', items: [] }]);
  const handleUpdateQuestionGroupTitle = (groupId: string, title: string) => setQuestions(prev => prev.map(g => g.id === groupId ? { ...g, title } : g));
  const handleDeleteQuestionGroup = (groupId: string) => setQuestions(prev => prev.filter(g => g.id !== groupId));
  const handleAddQuestionToGroup = (groupId: string) => setQuestions(prev => prev.map(g => g.id === groupId ? { ...g, items: [...g.items, { id: `q-item-${Date.now()}`, text: 'Nova pergunta', asked: false }] } : g));
  const handleUpdateQuestionText = (groupId: string, itemId: string, text: string) => setQuestions(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, text } : i) } : g));
  const handleDeleteQuestion = (groupId: string, itemId: string) => setQuestions(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g));
  
  const handleSaveToMarkdown = (type: 'checklist' | 'questions') => {
    let markdownContent = '';
    let filename = '';

    if (type === 'checklist') {
      markdownContent = checklist.map(group => `## ${group.title}\n\n${group.items.map(item => `* ${item.text}`).join('\n')}`).join('\n\n---\n\n');
      filename = 'checklist-backup.md';
    } else {
      markdownContent = questions.map(group => `### ${group.title}\n\n${group.items.map(item => `* ${item.text}`).join('\n')}`).join('\n\n---\n\n');
      filename = 'perguntas-backup.md';
    }
    
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportTranscription = useCallback((format: 'md' | 'txt') => {
    if (!transcription.trim()) return;

    let content = '';
    const filenameIdentifier = (interviewIdentifier || 'entrevista').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `transcricao_${filenameIdentifier}.${format}`;
    const mimeType = format === 'md' ? 'text/markdown' : 'text/plain';

    if (format === 'md') {
      content = `# Transcrição: ${interviewIdentifier || 'Entrevista'}\n\n**Início:** ${interviewStartTime}\n\n---\n\n${transcription}`;
    } else {
      content = `Transcrição: ${interviewIdentifier || 'Entrevista'}\nInício: ${interviewStartTime}\n\n-----------------\n\n${transcription}`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [transcription, interviewIdentifier, interviewStartTime]);

  const handleExportForAtlasTi = useCallback(() => {
    if (!transcription.trim() && !interviewerNotes.trim() && firstCycleCodes.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }

    const filenameIdentifier = (interviewIdentifier || `entrevista_${new Date().toISOString()}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `atlas_ti_export_${filenameIdentifier}.txt`;

    let content = `// Entrevista para ATLAS.ti\n`;
    content += `// Identificador: ${interviewIdentifier || 'Não definido'}\n`;
    content += `// Início: ${interviewStartTime || 'Não definido'}\n`;
    content += `// Exportado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
    
    content += `==================================================\n`;
    content += `== ANOTAÇÕES DO ENTREVISTADOR\n`;
    content += `==================================================\n\n`;
    content += `${interviewerNotes.trim() || 'Nenhuma anotação registrada.'}\n\n`;
    
    content += `==================================================\n`;
    content += `== TRANSCRIÇÃO\n`;
    content += `==================================================\n\n`;
    content += `${transcription.trim() || 'Nenhuma transcrição disponível.'}\n\n`;

    if (firstCycleCodes.length > 0) {
        content += `==================================================\n`;
        content += `== CÓDIGOS DE PRIMEIRO CICLO (GERADOS PELA IA)\n`;
        content += `==================================================\n\n`;
        firstCycleCodes.forEach(code => {
            content += `Tipo: ${code.type}\n`;
            content += `Código: ${code.code}\n`;
            content += `Citação: "${code.quote}"\n`;
            content += `----------\n`;
        });
    }
    
    if (summary) {
        content += `==================================================\n`;
        content += `== SUMÁRIO (GERADO PELA IA)\n`;
        content += `==================================================\n\n`;
        const plainTextSummary = summary
            .replace(/###/g, '')
            .replace(/##/g, '')
            .replace(/#/g, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '-');
        content += `${plainTextSummary.trim()}\n\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [transcription, interviewerNotes, firstCycleCodes, interviewIdentifier, interviewStartTime, summary]);
    
  const handleExportNotes = useCallback(() => {
    if (!interviewerNotes.trim()) return;

    const filenameIdentifier = (interviewIdentifier || 'entrevista').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `anotacoes_${filenameIdentifier}.txt`;

    const blob = new Blob([interviewerNotes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [interviewerNotes, interviewIdentifier]);

  const handleSaveAudio = useCallback(() => {
    if (!audioBlobUrl) return;

    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = audioBlobUrl;
    const filenameIdentifier = (interviewIdentifier || `entrevista_${new Date().toISOString()}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `gravacao_${filenameIdentifier}.mp4`;
    a.click();
    document.body.removeChild(a);
  }, [audioBlobUrl, interviewIdentifier]);
  
  const handleLoadFromMarkdown = (type: 'checklist' | 'questions') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,text/markdown';
    input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                try {
                    setError(null);
                    if (type === 'checklist') {
                        setChecklist(parseMarkdownToGroupedChecklist(content));
                    } else {
                        setQuestions(parseMarkdownToQuestions(content));
                    }
                } catch (err) {
                    setError(`Falha ao processar o arquivo Markdown: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
                }
            }
        };
        reader.onerror = () => {
             setError('Não foi possível ler o arquivo selecionado.');
        };
        reader.readAsText(file);
    };
    input.click();
  };

  const handleToggleHumanCheck = (groupId: string, itemId: string) => {
    setChecklist(prevGroups => prevGroups.map(group => group.id === groupId ? { ...group, items: group.items.map(item => item.id === itemId ? { ...item, checkedByHuman: !item.checkedByHuman } : item) } : group));
  };
  
  const handleToggleQuestionAsked = (groupId: string, itemId: string) => {
    setQuestions(prevGroups => prevGroups.map(group => group.id === groupId ? { ...group, items: group.items.map(item => item.id === itemId ? { ...item, asked: !item.asked } : item) } : group));
  };

  const stopInterview = useCallback(async (newState: InterviewStatus = 'stopped') => {
    setStatus(newState);
    setMicVolume(0);

    const { transcription, interviewIdentifier, interviewStartTime, interviewerNotes, summary } = currentStateRef.current;

    if (newState === 'stopped' && transcription.trim()) {
        const newRecord: InterviewRecord = {
            id: Date.now().toString(),
            identifier: interviewIdentifier || `Entrevista de ${interviewStartTime}`,
            startTime: interviewStartTime,
            endTime: new Date().toLocaleString('pt-BR'),
            transcription: transcription,
            notes: interviewerNotes,
            summary: summary,
        };
        setInterviewHistory(prev => [newRecord, ...prev]);
    }

    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
    audioSourcesRef.current.forEach(source => source.disconnect());
    audioSourcesRef.current = [];
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') await audioContextRef.current.close();
    
    mediaStreamRef.current = null;
    scriptProcessorRef.current = null;
    audioContextRef.current = null;

    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session:", e);
      } finally {
        sessionPromiseRef.current = null;
      }
    }
  }, []);

  const handlePauseResume = useCallback(() => {
    if (status === 'recording') {
      setStatus('paused');
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.pause();
      }
    } else if (status === 'paused') {
      setStatus('recording');
      if (mediaRecorderRef.current?.state === 'paused') {
        mediaRecorderRef.current.resume();
      }
    }
  }, [status]);

  const beginRecording = useCallback(async () => {
    setStatus('processing');
    const systemInstruction = `Você é um assistente de transcrição. Transcreva o áudio em português do Brasil com a maior precisão possível.`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: async () => {
            try {
              audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
              const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

              setStatus('recording');
              
              mediaStreamRef.current = micStream;

              try {
                  const mimeTypes = ['audio/mp4', 'audio/webm'];
                  const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
                  const options = supportedMimeType ? { mimeType: supportedMimeType } : {};

                  mediaRecorderRef.current = new MediaRecorder(micStream, options);
                  recordedChunksRef.current = [];

                  mediaRecorderRef.current.ondataavailable = (event) => {
                      if (event.data.size > 0) {
                          recordedChunksRef.current.push(event.data);
                      }
                  };
                  mediaRecorderRef.current.onstop = () => {
                      if (recordedChunksRef.current.length === 0) {
                          return;
                      }
                      const blob = new Blob(recordedChunksRef.current, { type: supportedMimeType });
                      const url = URL.createObjectURL(blob);
                      setAudioBlobUrl(url);
                  };
                  mediaRecorderRef.current.start();
              } catch (e) {
                  console.error("MediaRecorder setup failed:", e);
              }

              scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
              
              const micSource = audioContextRef.current.createMediaStreamSource(micStream);
              micSource.connect(scriptProcessorRef.current);
              audioSourcesRef.current.push(micSource);
              
              scriptProcessorRef.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                
                let sumSquares = 0.0;
                for (let i = 0; i < inputData.length; i++) {
                  sumSquares += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sumSquares / inputData.length);
                setMicVolume(Math.min(1, rms * 7));

                if (currentStateRef.current.status === 'recording') {
                  const int16 = new Int16Array(inputData.length);
                  for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                  const pcmBlob: GenAIBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                  sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ media: pcmBlob }));
                }
              };
              scriptProcessorRef.current.connect(audioContextRef.current.destination);
            } catch (err) {
              console.error("Failed to get media streams", err);
              setError("Permissão para capturar áudio do microfone é necessária. A gravação foi cancelada.");
              stopInterview('error');
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
                setTranscription(prev => prev + message.serverContent.inputTranscription.text);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error("Session error:", e);
            if (e.message?.toLowerCase().includes('network')) {
                setError("Erro de conexão. Sua chave de API pode ser inválida. Por favor, selecione-a novamente e tente iniciar uma nova entrevista.");
                setIsApiKeySelected(false);
            } else {
                setError("Ocorreu um erro na conexão. Tente novamente.");
            }
            stopInterview('error');
          },
          onclose: () => { 
            if (currentStateRef.current.status === 'recording' || currentStateRef.current.status === 'paused') {
                setError("A conexão com a IA foi encerrada inesperadamente. A gravação foi finalizada e salva.");
                stopInterview('stopped');
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction,
        },
      });
      await sessionPromiseRef.current;
    } catch (e) {
      console.error(e);
      if (e instanceof Error) {
        setError(`Falha ao iniciar: ${e.message}`);
      } else {
        setError("Falha ao iniciar. Verifique as permissões do microfone e a chave de API.");
      }
      setStatus('error');
    }
  }, [stopInterview]);

  const startInterview = useCallback(async () => {
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        setIsApiKeySelected(false);
        setError("Por favor, selecione uma chave de API para iniciar a entrevista.");
        return;
    }
      
    if (checklist.reduce((sum, g) => sum + g.items.length, 0) === 0) {
      setError("Sua checklist está vazia. Vá para a aba 'Checklist' para adicionar pontos.");
      return;
    }
    setError(null);
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
      setAudioBlobUrl(null);
    }
    setTranscription('');
    setInterviewStartTime(new Date().toLocaleString('pt-BR'));
    setStatus('countdown');
    setCountdown(3);
  }, [checklist, audioBlobUrl]);

  useEffect(() => {
    if (status === 'countdown' && countdown !== null) {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => (c ? c - 1 : null)), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            beginRecording();
            setCountdown(null);
        }
    }
  }, [status, countdown, beginRecording]);

  const handleSelectApiKey = async () => {
    if (window.aistudio) {
        await window.aistudio.openSelectKey();
        setIsApiKeySelected(true);
    }
  };
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadAudio = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      if (audioBlobUrl) {
          URL.revokeObjectURL(audioBlobUrl);
          setAudioBlobUrl(null);
      }
      setTranscription('');
      setFirstCycleCodes([]);
      setSecondCycleCodes([]);
      setSummary(null);
      setInterviewerNotes('');
      const filename = file.name.replace(/\.[^/.]+$/, "");
      setInterviewIdentifier(filename);
      
      setUploadedFile(file);

      if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportPdfClick = () => {
    pdfFileInputRef.current?.click();
  };

  const handlePdfFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus('processing');
    setError(null);
    if (audioBlobUrl) {
        URL.revokeObjectURL(audioBlobUrl);
        setAudioBlobUrl(null);
    }
    setTranscription('');
    setFirstCycleCodes([]);
    setSecondCycleCodes([]);
    setSummary(null);
    setInterviewerNotes('');
    setUploadedFile(null);

    const filename = file.name.replace(/\.pdf$/i, "");
    const startTime = new Date().toLocaleString('pt-BR');
    setInterviewIdentifier(filename);
    setInterviewStartTime(startTime);
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const pageTexts = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
            pageTexts.push(pageText);
        }
        const importedTranscription = pageTexts.join('\n\n');
        
        setTranscription(importedTranscription);

        const newRecord: InterviewRecord = {
            id: Date.now().toString(),
            identifier: filename,
            startTime: startTime,
            endTime: new Date().toLocaleString('pt-BR'),
            transcription: importedTranscription,
            notes: '',
            summary: null,
        };
        setInterviewHistory(prev => [newRecord, ...prev]);
        setStatus('stopped');

    } catch (err) {
        console.error("Failed to process PDF file:", err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Falha ao processar o arquivo .pdf: ${message}`);
        setStatus('error');
    } finally {
        if (pdfFileInputRef.current) pdfFileInputRef.current.value = '';
    }
  };


  const handleTranscribeUploadedAudio = async () => {
    if (!uploadedFile) return;
    
    const startTime = new Date().toLocaleString('pt-BR');
    setInterviewStartTime(startTime);
    setStatus('processing');

    let transcribedText = '';

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: async () => {
                    try {
                        const arrayBuffer = await uploadedFile.arrayBuffer();
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);
                        
                        const targetSampleRate = 16000;
                        const offlineContext = new OfflineAudioContext(
                            originalBuffer.numberOfChannels,
                            Math.ceil(originalBuffer.duration * targetSampleRate),
                            targetSampleRate
                        );
                        const source = offlineContext.createBufferSource();
                        source.buffer = originalBuffer;
                        source.connect(offlineContext.destination);
                        source.start(0);
                        const resampledBuffer = await offlineContext.startRendering();
                        
                        const pcmData = resampledBuffer.getChannelData(0);
                        const chunkSize = 4096;
                        const session = await sessionPromiseRef.current;

                        for (let i = 0; i < pcmData.length; i += chunkSize) {
                            const chunk = pcmData.subarray(i, i + chunkSize);
                            const int16 = new Int16Array(chunk.length);
                            for (let j = 0; j < chunk.length; j++) int16[j] = chunk[j] * 32768;
                            
                            const pcmBlob: GenAIBlob = { 
                                data: encode(new Uint8Array(int16.buffer)), 
                                mimeType: 'audio/pcm;rate=16000' 
                            };
                            session.sendRealtimeInput({ media: pcmBlob });
                            await new Promise(resolve => setTimeout(resolve, 100)); 
                        }
                        session.close();

                    } catch (err) {
                        const message = err instanceof Error ? err.message : 'Unknown error';
                        setError(`Falha ao processar o áudio: ${message}`);
                        setStatus('error');
                        setUploadedFile(null);
                        if (sessionPromiseRef.current) {
                          const session = await sessionPromiseRef.current;
                          session.close();
                        }
                    }
                },
                onmessage: (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        const newText = message.serverContent.inputTranscription.text;
                        transcribedText += newText;
                        setTranscription(prev => prev + newText);
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error("Session error:", e);
                    if (e.message?.toLowerCase().includes('network')) {
                        setError("Erro de conexão. Sua chave de API pode ser inválida.");
                        setIsApiKeySelected(false);
                    } else {
                        setError("Ocorreu um erro na conexão com a IA.");
                    }
                    setStatus('error');
                    setUploadedFile(null);
                },
                onclose: () => {
                    if (currentStateRef.current.status !== 'error') {
                        const newRecord: InterviewRecord = {
                            id: Date.now().toString(),
                            identifier: uploadedFile.name.replace(/\.[^/.]+$/, ""),
                            startTime: startTime,
                            endTime: new Date().toLocaleString('pt-BR'),
                            transcription: transcribedText,
                            notes: '',
                            summary: null,
                        };
                        setInterviewHistory(prev => [newRecord, ...prev]);
                        setStatus('stopped');
                        setUploadedFile(null);
                    }
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                systemInstruction: 'Você é um assistente de transcrição. Transcreva o áudio em português do Brasil com a maior precisão possível.',
            },
        });
        await sessionPromiseRef.current;
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        setError(`Falha ao iniciar a transcrição do arquivo: ${message}`);
        setStatus('error');
        setUploadedFile(null);
    }
  };

  const handleValidateChecklist = useCallback(async () => {
    if (!transcription.trim() || isValidating) return;
    setIsValidating(true);
    setError(null);

    const checklistString = checklist
      .map(group => {
        const itemsString = group.items
          .filter(item => !item.checkedByAI)
          .map(item => {
            const keywordsInfo = item.keywords ? ` (Palavras-chave: ${item.keywords})` : '';
            return `  - ID: ${item.id} | Item: "${item.text}"${keywordsInfo}`;
          })
          .join('\n');

        if (itemsString) {
          return `Grupo: "${group.title}"\n${itemsString}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n\n');

    if (!checklistString) {
        setIsValidating(false);
        return;
    }
    
    const allQuestionTexts = questions.flatMap(g => g.items.map(i => i.text));
    
    function escapeRegExp(string: string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    let cleanedTranscription = ` ${transcription} `;
    allQuestionTexts.forEach(q => {
        const partialQuestion = q.substring(0, 50).trim();
        if (partialQuestion) {
           const escapedQuestion = escapeRegExp(partialQuestion);
           cleanedTranscription = cleanedTranscription.replace(new RegExp(escapedQuestion, 'gi'), ' [PERGUNTA DO ENTREVISTADOR] ');
        }
    });

    const prompt = `Você é um assistente de IA analisando a transcrição de uma entrevista. Sua tarefa é identificar quais itens de uma checklist foram abordados pelo entrevistado.

INSTRUÇÕES:
1. A checklist está organizada em GRUPOS temáticos (ex: "Cultura Organizacional"). Use o título do grupo como contexto principal para avaliar os itens dentro dele.
2. Analise a TRANSCRIÇÃO fornecida, que contém principalmente as respostas do entrevistado.
3. Para cada item, verifique se o tópico foi claramente discutido na transcrição.
4. Se um item tiver PALAVRAS-CHAVE, a discussão DEVE incluir pelo menos uma delas para que o item seja validado.
5. Retorne APENAS um objeto JSON com a chave "covered_ids", contendo um array com os IDs de todos os itens validados. Não adicione explicações ou texto adicional.

---
TRANSCRIÇÃO PARA ANÁLISE:
${cleanedTranscription}
---
CHECKLIST PARA AVALIAÇÃO:
${checklistString}
---

JSON de saída esperado: {"covered_ids": ["item-id-1", "item-id-2"]}`;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        covered_ids: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING
                            }
                        }
                    }
                }
            }
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        const coveredIds = result.covered_ids as string[];
        
        if (coveredIds && coveredIds.length > 0) {
            setChecklist(prevGroups => 
                prevGroups.map(group => ({
                    ...group,
                    items: group.items.map(item => 
                        coveredIds.includes(item.id) ? { ...item, checkedByAI: true } : item
                    )
                }))
            );
        }
    } catch (e) {
        console.error("Validation error:", e);
        if (e instanceof Error) {
            setError(`Falha na validação do checklist: ${e.message}`);
        } else {
            setError("Ocorreu um erro desconhecido durante a validação do checklist.");
        }
    } finally {
        setIsValidating(false);
    }
  }, [transcription, isValidating, checklist, questions]);

  const handleGenerateFirstCycleCodes = async () => {
    if (!transcription.trim() || isCoding) return;
    setIsCoding(true);
    setFirstCycleCodes([]);
    setSecondCycleCodes([]);
    setSelectedTheme(null);
    setError(null);

    const intervieweeTranscription = transcription
        .split('\n')
        .filter(line => 
            !line.trim().startsWith('Douglas Barbosa da Costa:') && 
            !line.trim().startsWith('Sheila dos Santos Reinehr:')
        )
        .join('\n');

    if (!intervieweeTranscription.trim()) {
        setError("Não foi encontrado texto do entrevistado na transcrição para análise.");
        setIsCoding(false);
        return;
    }
    
    const prompt = `Você é um pesquisador qualitativo especialista, treinado nas metodologias de Johnny Saldaña, autor do "The Coding Manual for Qualitative Researchers". Sua tarefa é analisar a transcrição de uma entrevista e aplicar a Codificação de Primeiro Ciclo para extrair os códigos iniciais.

INSTRUÇÕES:
1. Leia a transcrição e identifique trechos significativos (quotes).
2. Para cada trecho, gere um código conciso usando UMA das seguintes técnicas de Codificação de Primeiro Ciclo:
   - **Codificação Descritiva**: Resuma o tópico básico do trecho em uma palavra ou frase curta (geralmente um substantivo). Use o tipo "Descritivo".
   - **Codificação de Processo**: Use exclusivamente gerúndios ('-ando', '-endo', '-indo') para capturar ações e processos. Use o tipo "Processo".
   - **Codificação In Vivo**: Use as palavras ou frases exatas do participante que pareçam significativas. Use o tipo "In Vivo".
3. Sua resposta deve ser APENAS um objeto JSON com uma única chave "codes". O valor deve ser um array de objetos, onde cada objeto contém:
   - "quote": O trecho exato da transcrição.
   - "code": O código que você gerou.
   - "type": O tipo de codificação usada ("Descritivo", "Processo", ou "In Vivo".
   - Não crie mais do que 30 códigos.

---
TRANSCRIÇÃO PARA ANÁLISE:
${intervieweeTranscription}
---

Exemplo de formato JSON de saída:
{
  "codes": [
    {
      "quote": "Como era a dinâmica de trabalho de vocês antes da pandemia...",
      "code": "DINÂMICA DE TRABALHO",
      "type": "Descritivo"
    },
    {
      "quote": "...ela foi se transformando até chegar no modelo que vocês adotam hoje?",
      "code": "TRANSFORMANDO O MODELO",
      "type": "Processo"
    },
    {
      "quote": "Essa definição de um novo modelo nunca é simples.",
      "code": "NUNCA É SIMPLES",
      "type": "In Vivo"
    }
  ]
}`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              codes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    quote: { type: Type.STRING },
                    code: { type: Type.STRING },
                    type: { type: Type.STRING },
                  }
                }
              }
            }
          }
        }
      });
      const jsonText = response.text.trim();
      const result = JSON.parse(jsonText);
      if (result.codes) {
        const codesWithIds = result.codes.map((code: Omit<FirstCycleCode, 'id'>, index: number) => ({
            ...code,
            id: `fc-${Date.now()}-${index}`
        }));
        setFirstCycleCodes(codesWithIds);
      }
    } catch (e) {
      console.error("Coding generation error:", e);
      if (e instanceof Error) {
          setError(`Falha na geração de códigos: ${e.message}`);
      } else {
          setError("Ocorreu um erro desconhecido durante a geração de códigos.");
      }
    } finally {
      setIsCoding(false);
    }
  };
  
  const handleGenerateSecondCycleCodes = async () => {
    if (firstCycleCodes.length === 0 || isSecondCycleCoding) return;
    setIsSecondCycleCoding(true);
    setError(null);

    const codeList = firstCycleCodes.map(c => `"${c.code}"`).join('\n');
    
    const prompt = `Você é um pesquisador qualitativo experiente realizando uma análise temática. Sua tarefa é analisar uma lista de códigos de Primeiro Ciclo e agrupá-los em categorias temáticas de Segundo Ciclo.

INSTRUÇÕES:
1.  Analise a lista de códigos fornecida.
2.  Identifique padrões e conexões para criar temas abrangentes que agrupem códigos semelhantes. Crie entre 3 e 7 temas.
3.  O nome de cada tema (theme) deve ser conciso e representativo do grupo de códigos.
4.  Retorne APENAS um objeto JSON com uma chave "themes". O valor deve ser um array de objetos, onde cada objeto representa um tema e contém:
    *   "theme": O nome do tema que você criou.
    *   "codes": Um array de strings, contendo os códigos EXATOS da lista original que pertencem a este tema.

---
LISTA DE CÓDIGOS DE PRIMEIRO CICLO PARA ANÁLISE:
${codeList}
---

Exemplo de formato JSON de saída:
{
  "themes": [
    {
      "theme": "Adaptação ao Novo Modelo",
      "codes": ["TRANSFORMANDO O MODELO", "DESAFIOS DA LIDERANÇA"]
    },
    {
      "theme": "Percepção de Valor",
      "codes": ["NUNCA É SIMPLES", "PERCEPÇÃO DE PRODUTIVIDADE"]
    }
  ]
}`;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        themes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    theme: { type: Type.STRING },
                                    codes: { type: Type.ARRAY, items: { type: Type.STRING } },
                                },
                                required: ["theme", "codes"],
                            },
                        },
                    },
                },
            },
        });
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        if (result.themes) {
            const groupedCodes: SecondCycleCode[] = result.themes.map((theme: { theme: string; codes: string[] }) => ({
                theme: theme.theme,
                codes: theme.codes
                    .map(codeName => firstCycleCodes.find(fc => fc.code === codeName))
                    .filter((code): code is FirstCycleCode => code !== undefined)
            }));
            setSecondCycleCodes(groupedCodes);
            setSelectedTheme(groupedCodes[0] || null);
        }
    } catch (e) {
        console.error("Second cycle coding error:", e);
        const message = e instanceof Error ? e.message : "Ocorreu um erro desconhecido.";
        setError(`Falha ao gerar códigos de 2º ciclo: ${message}`);
    } finally {
        setIsSecondCycleCoding(false);
    }
};

  const handleExportCodesToCSV = () => {
    if (firstCycleCodes.length === 0) return;

    const headers = '"Tipo","Código","Citação"\n';
    const rows = firstCycleCodes.map(c => `"${c.type}","${c.code.replace(/"/g, '""')}","${c.quote.replace(/"/g, '""')}"`).join('\n');
    const csvContent = headers + rows;

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codigos_primeiro_ciclo.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

    const handleGenerateSummary = useCallback(async () => {
        if (!transcription.trim() || isSummarizing) return;
        setIsSummarizing(true);
        setError(null);
        setSummary(null);

        const checklistContext = checklist
            .map(g => `Grupo: ${g.title}\n${g.items.map(i => `- ${i.text}`).join('\n')}`)
            .join('\n\n');

        const questionsContext = questions
            .map(g => `Bloco: ${g.title}\n${g.items.map(i => `- ${i.text}`).join('\n')}`)
            .join('\n\n');

        const prompt = `
    Você é um assistente de pesquisa qualitativa. Sua tarefa é analisar a transcrição de uma entrevista e gerar um sumário executivo em português do Brasil.

    CONTEXTO FORNECIDO:
    1.  **Checklist de Coleta**: Itens que o entrevistador queria observar.
    2.  **Roteiro de Perguntas**: Perguntas que guiaram a entrevista.
    3.  **Transcrição da Entrevista**: O diálogo que de fato ocorreu.

    INSTRUÇÕES:
    1.  Leia toda a transcrição para entender os pontos principais.
    2.  Crie um sumário conciso e bem estruturado em formato **Markdown**.
    3.  No sumário, destaque como as respostas do entrevistado se conectam aos itens da checklist e às perguntas do roteiro.
    4.  Organize o sumário por temas ou pelos blocos de perguntas, o que fizer mais sentido.
    5.  Use uma linguagem clara e objetiva. O foco é extrair os insights mais relevantes da fala do entrevistado.
    6.  **Não** invente informações. Baseie-se estritamente na transcrição fornecida.

    ---
    CHECKLIST DE COLETA:
    ${checklistContext}
    ---
    ROTEIRO DE PERGUNTAS:
    ${questionsContext}
    ---
    TRANSCRIÇÃO DA ENTREVISTA:
    ${transcription}
    ---

    Agora, gere o sumário executivo da entrevista.
    `;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            const summaryText = response.text;
            setSummary(summaryText);
            setIsSummaryModalOpen(true);

        } catch (e) {
            console.error("Summary generation error:", e);
            const errorMessage = e instanceof Error ? e.message : "Ocorreu um erro desconhecido.";
            setError(`Falha ao gerar o sumário: ${errorMessage}`);
        } finally {
            setIsSummarizing(false);
        }
    }, [transcription, isSummarizing, checklist, questions]);

  const toggleCollapse = (groupId: string) => setCollapsedGroups(p => ({ ...p, [groupId]: !p[groupId] }));
  
  useEffect(() => {
    return () => {
      const { status } = currentStateRef.current;
      if (status === 'recording' || status === 'paused') {
        stopInterview();
      }
    };
  }, [stopInterview]);

  const handleNewInterview = useCallback(() => {
    stopInterview('idle');
    setChecklist(parseMarkdownToGroupedChecklist(initialMarkdown));
    setQuestions(parseMarkdownToQuestions(initialQuestionsMarkdown));
    setInterviewIdentifier('');
    setInterviewStartTime('');
    setTranscription('');
    setInterviewerNotes('');
    setError(null);
    setSummary(null);
    setFirstCycleCodes([]);
    setSecondCycleCodes([]);
    setSelectedTheme(null);
    setUploadedFile(null);
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
      setAudioBlobUrl(null);
    }
  }, [stopInterview, audioBlobUrl]);

  const handleDeleteInterview = (id: string) => {
    if (window.confirm("Tem certeza que deseja apagar esta entrevista do histórico? Esta ação não pode ser desfeita.")) {
      setInterviewHistory(prev => prev.filter(iv => iv.id !== id));
      if (selectedInterview?.id === id) {
        setSelectedInterview(null);
      }
    }
  };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, groupId: string, itemId: string) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ groupId, itemId }));
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            (e.target as HTMLElement).closest('.draggable-item')?.classList.add('opacity-50');
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        (e.target as HTMLElement).closest('.draggable-item')?.classList.remove('opacity-50');
        if (dragOverItemRef.current) {
            dragOverItemRef.current.classList.remove('border-t-2', 'border-b-2', 'border-brand-light-blue');
            dragOverItemRef.current = null;
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const target = e.currentTarget;
        if (dragOverItemRef.current && dragOverItemRef.current !== target) {
            dragOverItemRef.current.classList.remove('border-t-2', 'border-b-2', 'border-brand-light-blue');
        }
        dragOverItemRef.current = target;
        const rect = target.getBoundingClientRect();
        const isTopHalf = e.clientY < rect.top + rect.height / 2;
        target.classList.remove('border-t-2', 'border-b-2');
        target.classList.add(isTopHalf ? 'border-t-2' : 'border-b-2', 'border-brand-light-blue');
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('border-t-2', 'border-b-2', 'border-brand-light-blue');
    };

    const handleQuestionDrop = (e: React.DragEvent<HTMLDivElement>, targetGroupId: string, targetItemId: string | null) => {
        e.preventDefault();
        e.currentTarget.classList.remove('border-t-2', 'border-b-2', 'border-brand-light-blue', 'bg-brand-gray');
        
        try {
            const sourceData = JSON.parse(e.dataTransfer.getData('application/json'));
            const { groupId: sourceGroupId, itemId: sourceItemId } = sourceData;

            if (sourceGroupId === targetGroupId && sourceItemId === targetItemId) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const isTopHalf = targetItemId ? e.clientY < rect.top + rect.height / 2 : true;

            setQuestions(currentQuestions => {
                const newQuestions = JSON.parse(JSON.stringify(currentQuestions));
                const sourceGroup = newQuestions.find((g: QuestionGroup) => g.id === sourceGroupId);
                if (!sourceGroup) return currentQuestions;
                
                const sourceItemIndex = sourceGroup.items.findIndex((i: QuestionItem) => i.id === sourceItemId);
                if (sourceItemIndex === -1) return currentQuestions;

                const [draggedItem] = sourceGroup.items.splice(sourceItemIndex, 1);
                const targetGroup = newQuestions.find((g: QuestionGroup) => g.id === targetGroupId);
                if (!targetGroup) return currentQuestions;

                if (targetItemId) {
                    const targetItemIndex = targetGroup.items.findIndex((i: QuestionItem) => i.id === targetItemId);
                    if (targetItemIndex !== -1) {
                        const insertIndex = isTopHalf ? targetItemIndex : targetItemIndex + 1;
                        targetGroup.items.splice(insertIndex, 0, draggedItem);
                    } else {
                         targetGroup.items.push(draggedItem); // Fallback
                    }
                } else {
                    targetGroup.items.push(draggedItem); // Dropped on an empty group
                }

                return newQuestions;
            });
        } catch (err) {
            console.error("Drop failed:", err);
        }
    };

    const handleChecklistDrop = (e: React.DragEvent<HTMLDivElement>, targetGroupId: string, targetItemId: string | null) => {
        e.preventDefault();
        e.currentTarget.classList.remove('border-t-2', 'border-b-2', 'border-brand-light-blue', 'bg-brand-gray');
        
        try {
            const sourceData = JSON.parse(e.dataTransfer.getData('application/json'));
            const { groupId: sourceGroupId, itemId: sourceItemId } = sourceData;

            if (sourceGroupId === targetGroupId && sourceItemId === targetItemId) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const isTopHalf = targetItemId ? e.clientY < rect.top + rect.height / 2 : true;

            setChecklist(currentChecklist => {
                const newChecklist = JSON.parse(JSON.stringify(currentChecklist));
                const sourceGroup = newChecklist.find((g: ChecklistGroup) => g.id === sourceGroupId);
                if (!sourceGroup) return currentChecklist;
                
                const sourceItemIndex = sourceGroup.items.findIndex((i: ChecklistItem) => i.id === sourceItemId);
                if (sourceItemIndex === -1) return currentChecklist;

                const [draggedItem] = sourceGroup.items.splice(sourceItemIndex, 1);
                const targetGroup = newChecklist.find((g: ChecklistGroup) => g.id === targetGroupId);
                if (!targetGroup) return currentChecklist;

                if (targetItemId) {
                    const targetItemIndex = targetGroup.items.findIndex((i: ChecklistItem) => i.id === targetItemId);
                    if (targetItemIndex !== -1) {
                        const insertIndex = isTopHalf ? targetItemIndex : targetItemIndex + 1;
                        targetGroup.items.splice(insertIndex, 0, draggedItem);
                    } else {
                         targetGroup.items.push(draggedItem); // Fallback
                    }
                } else {
                    targetGroup.items.push(draggedItem); // Dropped on an empty group
                }

                return newChecklist;
            });
        } catch (err) {
            console.error("Drop failed:", err);
        }
    };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        let handled = true;
        switch (e.key.toLowerCase()) {
          case 'r':
            if (status === 'idle' || status === 'stopped' || status === 'error') startInterview();
            else if (status === 'recording' || status === 'paused') stopInterview();
            break;
          case 'p':
            if (status === 'recording' || status === 'paused') handlePauseResume();
            break;
          case 'n':
            if (status !== 'recording' && status !== 'paused') handleNewInterview();
            break;
          case 'a':
            if (audioBlobUrl) handleSaveAudio();
            break;
          case 's':
            if (interviewerNotes.trim()) handleExportNotes();
            break;
          case 't':
            if (transcription.trim()) handleExportTranscription('txt');
            break;
          case 'm':
            if (transcription.trim()) handleExportTranscription('md');
            break;
          case 'v':
            if (transcription.trim()) handleValidateChecklist();
            break;
          case 'g':
            if (transcription.trim()) handleGenerateSummary();
            break;
          case 'e':
            if (transcription.trim() || interviewerNotes.trim()) handleExportForAtlasTi();
            break;
          default:
            handled = false;
        }
        if (handled) e.preventDefault();
      }
    };
    if (activeTab === 'interview') {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, status, startInterview, stopInterview, handlePauseResume, handleNewInterview, audioBlobUrl, handleSaveAudio, interviewerNotes, handleExportNotes, transcription, handleExportTranscription, handleValidateChecklist, handleGenerateSummary, handleExportForAtlasTi]);

  const renderEditor = (type: 'checklist' | 'questions') => {
    const isChecklist = type === 'checklist';
    const title = isChecklist ? "Gerencie sua Checklist" : "Gerencie suas Perguntas";
    const description = "Arraste e solte os itens para reordená-los.";
    const data = isChecklist ? checklist : questions;
    const actions = isChecklist ? {
      addGroup: handleAddGroup,
      updateGroupTitle: handleUpdateGroupTitle,
      deleteGroup: handleDeleteGroup,
      addItem: handleAddItemToGroup,
      updateItemText: handleUpdateItemText,
      deleteItem: handleDeleteItem,
      updateItemKeywords: handleUpdateItemKeywords,
    } : {
      addGroup: handleAddQuestionGroup,
      updateGroupTitle: handleUpdateQuestionGroupTitle,
      deleteGroup: handleDeleteQuestionGroup,
      addItem: handleAddQuestionToGroup,
      updateItemText: handleUpdateQuestionText,
      deleteItem: handleDeleteQuestion,
    };
    const addGroupText = isChecklist ? "Novo Grupo" : "Novo Bloco";
    const addItemText = isChecklist ? "Adicionar Item" : "Adicionar Pergunta";
    const handleItemDrop = isChecklist ? handleChecklistDrop : handleQuestionDrop;

    return (
      <div className="w-full max-w-4xl mx-auto h-full flex flex-col p-4">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <div><h2 className="text-2xl font-bold">{title}</h2><p className="text-gray-400">{description}</p></div>
          <div className="flex gap-2">
            <button onClick={() => handleLoadFromMarkdown(type)} className="bg-brand-gray hover:bg-brand-light-gray text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors" title="Carregar de um arquivo Markdown"><UploadIcon className="w-5 h-5" />Carregar</button>
            <button onClick={() => handleSaveToMarkdown(type)} className="bg-brand-gray hover:bg-brand-light-gray text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors" title="Salvar como arquivo Markdown"><DownloadIcon className="w-5 h-5" />Salvar</button>
            <button onClick={actions.addGroup} className="bg-brand-blue hover:bg-brand-light-blue text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"><PlusIcon className="w-5 h-5" />{addGroupText}</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-grow pr-2 space-y-6">
          {(data as (ChecklistGroup[] | QuestionGroup[])).map((group: ChecklistGroup | QuestionGroup) => (
            <div key={group.id} className="bg-brand-gray/50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <input type="text" value={group.title} onChange={(e) => actions.updateGroupTitle(group.id, e.target.value)} className="text-xl font-semibold bg-transparent border-b-2 border-brand-light-gray/30 focus:border-brand-light-blue outline-none w-full mr-4" />
                <button onClick={() => actions.deleteGroup(group.id)} className="text-red-500 hover:text-red-400 transition-colors p-1"><TrashIcon className="w-5 h-5" /></button>
              </div>
              <div className="space-y-2">
                {group.items.map((item) => (
                    <div 
                        key={item.id} 
                        className="flex items-center gap-2 bg-brand-dark rounded-md transition-all draggable-item p-1"
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, group.id, item.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleItemDrop(e, group.id, item.id)}
                        onDragLeave={handleDragLeave}
                    >
                      <DragHandleIcon className="w-6 h-6 text-gray-500 cursor-move flex-shrink-0" />
                      <input type="text" value={item.text} onChange={(e) => actions.updateItemText(group.id, item.id, e.target.value)} className="bg-transparent focus:bg-brand-gray outline-none w-full p-2 rounded-md" placeholder={isChecklist ? 'Texto do item' : 'Texto da pergunta'} />
                      <button onClick={() => actions.deleteItem(group.id, item.id)} className="text-gray-500 hover:text-red-500 transition-colors p-1 flex-shrink-0"><TrashIcon className="w-5 h-5" /></button>
                    </div>
                ))}
                 {group.items.length === 0 && (
                    <div 
                        className="h-12 border-2 border-dashed border-brand-light-gray/50 rounded-md flex items-center justify-center text-gray-500 transition-colors"
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-brand-gray', 'border-brand-light-blue'); }}
                        onDragLeave={(e) => e.currentTarget.classList.remove('bg-brand-gray', 'border-brand-light-blue')}
                        onDrop={(e) => handleItemDrop(e, group.id, null)}
                    >
                        Arraste {isChecklist ? 'um item' : 'uma pergunta'} para este {isChecklist ? 'grupo' : 'bloco'}
                    </div>
                )}
              </div>
              <button onClick={() => actions.addItem(group.id)} className="mt-4 text-brand-light-blue hover:text-blue-400 font-semibold flex items-center gap-1 text-sm"><PlusIcon className="w-4 h-4" />{addItemText}</button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isAppLoading) {
    return (
      <div className="w-full h-screen flex flex-col justify-center items-center bg-brand-dark animate-fade-in">
          <Logo className="w-80 h-auto" />
          <div className="mt-6 text-xl text-brand-text">Assistant for Interviewer</div>
          <div className="mt-2 text-sm text-gray-400">Verificando acesso...</div>
          <div className="absolute bottom-4 text-xs text-gray-600">v1.2.1</div>
      </div>
    );
  }

  if (!isApiKeySelected) {
    return (
      <div className="w-full h-screen flex flex-col justify-center items-center bg-brand-dark text-center p-4">
        <Logo className="w-60 h-auto" />
        <h1 className="text-3xl font-bold mt-8 mb-4">Acesso à IA Requerido</h1>
        <p className="text-gray-400 mb-8 max-w-lg">
            Para habilitar a transcrição ao vivo e outras funcionalidades, esta aplicação precisa de acesso à API Gemini. Por favor, selecione uma chave de API do Google AI Studio para continuar.
        </p>
        <button
            onClick={handleSelectApiKey}
            className="bg-brand-blue hover:bg-brand-light-blue text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
        >
            Selecionar Chave de API
        </button>
        <p className="text-xs text-gray-500 mt-6">
            O uso da API pode incorrer em custos. Consulte a <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-light-blue">documentação de preços</a> para mais detalhes.
        </p>
      </div>
    );
  }

  const TabButton: React.FC<{ tabName: 'interview' | 'checklist' | 'questions' | 'codificacao' | 'history'; children: React.ReactNode; icon: React.ReactNode }> = ({ tabName, children, icon }) => (
    <button onClick={() => {
        setActiveTab(tabName);
        if (tabName !== 'history') setSelectedInterview(null);
    }} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === tabName ? 'bg-brand-blue text-white shadow-md' : 'text-gray-300 hover:bg-brand-gray hover:text-white'}`}>
      {icon}
      {children}
    </button>
  );

  return (
    <div className="w-full h-screen flex flex-col bg-brand-dark text-brand-text font-sans">
      <header className="flex-shrink-0 bg-brand-gray flex justify-between items-center p-3 border-b border-brand-light-gray/20">
        <Logo className="w-40 h-auto" />
        <nav className="flex items-center gap-2">
          <TabButton tabName="interview" icon={<MicIcon className="w-5 h-5" />} >Entrevista</TabButton>
          <TabButton tabName="history" icon={<HistoryIcon className="w-5 h-5" />}>Histórico</TabButton>
          <TabButton tabName="checklist" icon={<CheckCircleIcon className="w-5 h-5" />}>Checklist</TabButton>
          <TabButton tabName="questions" icon={<span className="font-bold text-lg">?</span>}>Perguntas</TabButton>
          <TabButton tabName="codificacao" icon={<CodeBracketIcon className="w-5 h-5" />}>Codificação</TabButton>
        </nav>
      </header>

      <main className="flex-grow flex overflow-hidden">
        {activeTab === 'checklist' && renderEditor('checklist')}
        {activeTab === 'questions' && renderEditor('questions')}
        
        {activeTab === 'codificacao' && (
          <div className="w-full mx-auto h-full flex flex-col p-4">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold">Codificação da Entrevista</h2>
                <p className="text-gray-400">Gere códigos, agrupe em temas e exporte sua análise.</p>
              </div>
              <div className="flex gap-2">
                  <button onClick={handleExportCodesToCSV} disabled={firstCycleCodes.length === 0} className="bg-brand-gray hover:bg-brand-light-gray text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><DownloadIcon className="w-5 h-5" />Exportar CSV</button>
                  <button onClick={handleGenerateFirstCycleCodes} disabled={!transcription.trim() || isCoding || isSecondCycleCoding} className="bg-brand-blue hover:bg-brand-light-blue text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <SparklesIcon className={`w-5 h-5 ${isCoding ? 'animate-spin' : ''}`} />
                      {isCoding ? 'Analisando...' : 'Gerar Códigos (1º Ciclo)'}
                  </button>
                   <button onClick={handleGenerateSecondCycleCodes} disabled={firstCycleCodes.length === 0 || isSecondCycleCoding || isCoding} className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <SparklesIcon className={`w-5 h-5 ${isSecondCycleCoding ? 'animate-spin' : ''}`} />
                      {isSecondCycleCoding ? 'Agrupando...' : 'Gerar Temas (2º Ciclo)'}
                  </button>
              </div>
            </div>
            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-md mb-4 animate-fade-in">{error}</div>}
            
            <div className="flex-grow overflow-hidden">
                {firstCycleCodes.length === 0 && !isCoding && (
                    <div className="text-center text-gray-500 mt-20">
                        {transcription.trim() ? 'Clique em "Gerar Códigos (1º Ciclo)" para iniciar a análise.' : 'Nenhuma transcrição disponível. Realize ou importe uma entrevista primeiro.'}
                    </div>
                )}
                {(isCoding || isSecondCycleCoding) && (
                     <div className="text-center text-gray-400 mt-20">
                        <p>{isCoding ? 'Analisando a transcrição...' : 'Agrupando códigos em temas...'}</p>
                        <p className="text-sm">Isso pode levar alguns instantes.</p>
                    </div>
                )}

                {firstCycleCodes.length > 0 && !isCoding && !isSecondCycleCoding && (
                    secondCycleCodes.length > 0 ? (
                        <div className="flex h-full gap-4">
                            {/* Themes Column */}
                            <div className="w-1/3 h-full flex flex-col bg-brand-gray/30 rounded-lg">
                                <h3 className="text-lg font-semibold p-3 border-b border-brand-light-gray/20 flex-shrink-0">Temas (2º Ciclo)</h3>
                                <div className="overflow-y-auto p-2">
                                    {secondCycleCodes.map(theme => (
                                        <button 
                                            key={theme.theme}
                                            onClick={() => setSelectedTheme(theme)}
                                            className={`w-full text-left p-3 rounded-md transition-colors text-sm ${selectedTheme?.theme === theme.theme ? 'bg-brand-blue text-white' : 'hover:bg-brand-light-gray/50'}`}
                                        >
                                            <span className="font-semibold">{theme.theme}</span>
                                            <span className="block text-xs opacity-70">{theme.codes.length} códigos</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Codes Column */}
                            <div className="w-2/3 h-full flex flex-col bg-brand-gray/30 rounded-lg">
                                <h3 className="text-lg font-semibold p-3 border-b border-brand-light-gray/20 flex-shrink-0">Códigos Agrupados</h3>
                                <div className="overflow-y-auto">
                                    {selectedTheme ? (
                                        <table className="w-full text-left table-fixed">
                                            <thead className="sticky top-0 bg-brand-gray">
                                                <tr>
                                                    <th className="p-2 w-[20%]">Tipo</th>
                                                    <th className="p-2 w-[30%]">Código</th>
                                                    <th className="p-2 w-[50%]">Citação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-brand-light-gray/20">
                                                {selectedTheme.codes.map(code => (
                                                    <tr key={code.id} className="hover:bg-brand-gray/50">
                                                        <td className="p-2 align-top"><span className={`px-2 py-1 rounded-full text-xs ${code.type === 'Descritivo' ? 'bg-blue-900 text-blue-300' : code.type === 'Processo' ? 'bg-green-900 text-green-300' : 'bg-purple-900 text-purple-300'}`}>{code.type}</span></td>
                                                        <td className="p-2 align-top font-semibold break-words">{code.code}</td>
                                                        <td className="p-2 align-top text-gray-400 italic break-words">"{code.quote}"</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-center text-gray-500 p-8">Selecione um tema para ver os códigos.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="overflow-y-auto h-full pr-2">
                            <table className="w-full text-left table-auto">
                                <thead className="sticky top-0 bg-brand-gray">
                                    <tr>
                                        <th className="p-2 w-1/5">Tipo</th>
                                        <th className="p-2 w-1/5">Código</th>
                                        <th className="p-2 w-3/5">Citação da Transcrição</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-light-gray/20">
                                    {firstCycleCodes.map(code => (
                                        <tr key={code.id} className="hover:bg-brand-gray/50">
                                            <td className="p-2 align-top"><span className={`px-2 py-1 rounded-full text-xs ${code.type === 'Descritivo' ? 'bg-blue-900 text-blue-300' : code.type === 'Processo' ? 'bg-green-900 text-green-300' : 'bg-purple-900 text-purple-300'}`}>{code.type}</span></td>
                                            <td className="p-2 align-top font-semibold">{code.code}</td>
                                            <td className="p-2 align-top text-gray-400 italic">"{code.quote}"</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
          </div>
        )}
        
        {activeTab === 'history' && (
          <div className="flex w-full h-full">
            <aside className="w-1/3 h-full overflow-y-auto bg-brand-gray/30 border-r border-brand-light-gray/20 p-4">
              <h2 className="text-xl font-bold mb-4">Histórico de Entrevistas</h2>
              {interviewHistory.length === 0 ? (
                <p className="text-gray-500">Nenhuma entrevista foi gravada ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {interviewHistory.map(iv => (
                    <li key={iv.id}>
                      <button onClick={() => setSelectedInterview(iv)} className={`w-full text-left p-3 rounded-lg transition-colors ${selectedInterview?.id === iv.id ? 'bg-brand-blue' : 'hover:bg-brand-light-gray/50'}`}>
                        <p className="font-semibold">{iv.identifier}</p>
                        <p className="text-sm text-gray-400">Início: {iv.startTime}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
            <section className="w-2/3 h-full overflow-y-auto p-6">
              {selectedInterview ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold">{selectedInterview.identifier}</h2>
                      <p className="text-gray-400">Gravada de {selectedInterview.startTime} até {selectedInterview.endTime}</p>
                    </div>
                    <button onClick={() => handleDeleteInterview(selectedInterview.id)} className="text-red-500 hover:text-red-400 transition-colors p-2 flex items-center gap-1 text-sm"><TrashIcon className="w-4 h-4"/> Apagar</button>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2 border-b border-brand-light-gray/20 pb-1">Transcrição</h3>
                    <div className="bg-brand-gray/30 p-4 rounded-lg max-h-96 overflow-y-auto text-gray-300 whitespace-pre-wrap">{selectedInterview.transcription}</div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2 border-b border-brand-light-gray/20 pb-1">Anotações do Entrevistador</h3>
                    <div className="bg-brand-gray/30 p-4 rounded-lg max-h-64 overflow-y-auto text-gray-300 whitespace-pre-wrap">{selectedInterview.notes || <span className="text-gray-500">Nenhuma anotação.</span>}</div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2 border-b border-brand-light-gray/20 pb-1">Sumário da IA</h3>
                    <div className="bg-brand-gray/30 p-4 rounded-lg max-h-96 overflow-y-auto text-gray-300">{selectedInterview.summary ? <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: selectedInterview.summary.replace(/\n/g, '<br/>') }}></div> : <span className="text-gray-500">Nenhum sumário gerado.</span>}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">Selecione uma entrevista do histórico para ver os detalhes.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'interview' && (
          <div className="w-full flex h-full">
            <div className="w-2/3 flex flex-col p-4 h-full">
              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                  <input type="text" value={interviewIdentifier} onChange={(e) => setInterviewIdentifier(e.target.value)} disabled={status === 'recording' || status === 'paused'} placeholder="Identificador da Entrevista (Ex: Empresa X, Cargo Y)" className="text-xl font-semibold bg-brand-gray/50 focus:bg-brand-gray outline-none w-full mr-4 p-2 rounded-lg" />
              </div>
              {error && <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-md mb-4 animate-fade-in">{error}</div>}
              {status === 'countdown' && (
                <div className="flex-grow flex items-center justify-center text-8xl font-bold animate-ping">{countdown}</div>
              )}
              {status !== 'countdown' && (
                <>
                  <div className="bg-brand-gray/50 rounded-lg p-4 mb-4 flex-grow relative overflow-hidden">
                      <h3 className="text-lg font-semibold mb-2 text-gray-300">Transcrição ao Vivo</h3>
                      <div className="absolute top-10 bottom-4 left-4 right-4 overflow-y-auto">
                        <p className="whitespace-pre-wrap text-brand-text">{transcription}</p>
                        {(status === 'recording' || status === 'processing') && <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse ml-2"></span>}
                      </div>
                  </div>
                   <div className="bg-brand-gray/50 rounded-lg p-4 h-1/3 flex-shrink-0 flex flex-col">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-300">Anotações do Entrevistador</h3>
                      </div>
                      <textarea
                          value={interviewerNotes}
                          onChange={(e) => setInterviewerNotes(e.target.value)}
                          placeholder="Digite suas anotações aqui..."
                          className="w-full h-full bg-brand-dark/50 p-2 rounded-md text-brand-text resize-none focus:outline-none focus:ring-2 focus:ring-brand-light-blue"
                      />
                   </div>
                </>
              )}
            </div>
            <div className="w-1/3 bg-brand-gray/30 h-full flex border-l border-brand-light-gray/20">
                <div className="w-1/2 h-full overflow-y-auto p-4 border-r border-brand-light-gray/20">
                    <h3 className="text-xl font-semibold mb-3">Checklist</h3>
                    <div className="space-y-3">
                        {checklist.map(group => (
                            <div key={group.id}>
                                <button onClick={() => toggleCollapse(group.id)} className="w-full flex justify-between items-center text-left font-semibold text-gray-300 mb-2">
                                    <span>{group.title}</span>
                                    <ChevronDownIcon className={`w-5 h-5 transition-transform ${collapsedGroups[group.id] ? 'rotate-180' : ''}`} />
                                </button>
                                {!collapsedGroups[group.id] && (
                                    <ul className="space-y-2 pl-2 border-l-2 border-brand-light-gray/30">
                                        {group.items.map(item => (
                                            <li key={item.id} className="flex items-start gap-2 text-sm">
                                                <button onClick={() => handleToggleHumanCheck(group.id, item.id)} className="mt-1 flex-shrink-0">
                                                    <CheckCircleIcon className={`w-5 h-5 transition-colors ${item.checkedByHuman ? 'text-green-500' : 'text-gray-600 hover:text-gray-400'}`} />
                                                </button>
                                                <div className="flex-grow">
                                                  <span className={`${item.checkedByAI || item.checkedByHuman ? 'line-through text-gray-500' : ''}`}>{item.text}</span>
                                                  {item.checkedByAI && !item.checkedByHuman && <span className="text-xs text-purple-400 ml-2">(IA)</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="w-1/2 h-full overflow-y-auto p-4">
                    <h3 className="text-xl font-semibold mb-3">Perguntas-Chave</h3>
                    <div className="space-y-3">
                        {questions.map(group => (
                             <div key={group.id}>
                                <button onClick={() => toggleCollapse(group.id)} className="w-full flex justify-between items-center text-left font-semibold text-gray-300 mb-2">
                                    <span>{group.title}</span>
                                    <ChevronDownIcon className={`w-5 h-5 transition-transform ${collapsedGroups[group.id] ? 'rotate-180' : ''}`} />
                                </button>
                                 {!collapsedGroups[group.id] && (
                                    <ul className="space-y-2 pl-2 border-l-2 border-brand-light-gray/30">
                                        {group.items.map(item => (
                                            <li key={item.id} className="flex items-start gap-2 text-sm">
                                               <button onClick={() => handleToggleQuestionAsked(group.id, item.id)} className="mt-1 flex-shrink-0">
                                                    <CheckCircleIcon className={`w-5 h-5 transition-colors ${item.asked ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`} />
                                                </button>
                                                <span className={`${item.asked ? 'line-through text-gray-500' : ''}`}>{item.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <FloatingMenu 
                status={status}
                transcription={transcription}
                isValidating={isValidating}
                isSummarizing={isSummarizing}
                isCoding={isCoding}
                audioBlobUrl={audioBlobUrl}
                interviewerNotes={interviewerNotes}
                firstCycleCodes={firstCycleCodes}
                handleSaveAudio={handleSaveAudio}
                handleExportNotes={handleExportNotes}
                handleExportTranscription={handleExportTranscription}
                handleValidateChecklist={handleValidateChecklist}
                handleGenerateSummary={handleGenerateSummary}
                handleExportForAtlasTi={handleExportForAtlasTi}
            />

          </div>
        )}
      </main>

      <footer className="flex-shrink-0 bg-brand-gray flex justify-between items-center px-4 py-2 border-t border-brand-light-gray/20">
        <div className="flex items-center gap-4">
            {(status === 'idle' || status === 'stopped' || status === 'error') ? (
              !uploadedFile ? (
                <>
                  <button onClick={startInterview} disabled={status === 'configuring'} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors" title="Iniciar Gravação (Ctrl+R)">
                    <MicIcon className="w-5 h-5" /> Iniciar
                  </button>
                  <button onClick={handleUploadClick} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors" title="Carregar Áudio para Transcrição">
                      <UploadIcon className="w-5 h-5" /> Carregar Áudio
                  </button>
                  <button onClick={handleImportPdfClick} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors" title="Importar Transcrição de .pdf">
                      <DocumentTextIcon className="w-5 h-5" /> Importar .pdf
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-4">
                  <button onClick={handleTranscribeUploadedAudio} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors" title="Iniciar Transcrição do Arquivo Carregado">
                    <SparklesIcon className="w-5 h-5" /> Transcrever Áudio
                  </button>
                  <div className="flex items-center gap-2 bg-brand-dark px-3 py-2 rounded-lg text-sm text-gray-300">
                    <span className="truncate max-w-[200px]" title={uploadedFile.name}>{uploadedFile.name}</span>
                    <button onClick={() => setUploadedFile(null)} className="text-gray-500 hover:text-white transition-colors" aria-label="Limpar áudio carregado">
                        <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            ) : null }
            {(status === 'recording' || status === 'paused') && (
              <>
                <button onClick={() => stopInterview()} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors" title="Parar Gravação (Ctrl+R)">
                  <StopIcon className="w-5 h-5" /> Parar
                </button>
                <button onClick={handlePauseResume} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors" title={status === 'recording' ? 'Pausar (Ctrl+P)' : 'Continuar (Ctrl+P)'}>
                   {status === 'recording' ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                   {status === 'recording' ? 'Pausar' : 'Continuar'}
                </button>
              </>
            )}
            <button onClick={handleNewInterview} disabled={status === 'recording' || status === 'paused' || status === 'processing'} className="bg-brand-light-gray hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Nova Entrevista (Ctrl+N)">
              <RefreshIcon className="w-5 h-5" /> Nova Entrevista
            </button>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Status:</span>
                <span className="font-semibold">{status}</span>
            </div>
            { (status === 'recording' || status === 'paused') && <VolumeMeter volume={micVolume} /> }
        </div>
      </footer>

      {isSummaryModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in" onClick={() => setIsSummaryModalOpen(false)}>
              <div className="bg-brand-gray rounded-lg shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-4 border-b border-brand-light-gray/20">
                      <h2 className="text-xl font-bold">Sumário da Entrevista (Gerado por IA)</h2>
                      <button onClick={() => setIsSummaryModalOpen(false)} className="text-gray-400 hover:text-white"><XIcon className="w-6 h-6"/></button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-grow">
                      {summary ? (
                          <div
                              className="prose prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br/>') }}
                          />
                      ) : <p>Nenhum sumário para exibir.</p>}
                  </div>
                  <div className="p-4 border-t border-brand-light-gray/20 flex justify-end gap-2">
                     <button onClick={() => {
                         navigator.clipboard.writeText(summary || '');
                     }} className="bg-brand-gray hover:bg-brand-light-gray text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
                        <ClipboardIcon className="w-5 h-5"/> Copiar Texto
                     </button>
                      <button onClick={() => setIsSummaryModalOpen(false)} className="bg-brand-blue hover:bg-brand-light-blue text-white font-bold py-2 px-4 rounded-lg">Fechar</button>
                  </div>
              </div>
          </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleUploadAudio} style={{ display: 'none' }} accept=".mp4,audio/mp4" />
      <input type="file" ref={pdfFileInputRef} onChange={handlePdfFileChange} style={{ display: 'none' }} accept=".pdf,application/pdf" />
    </div>
  );
};

export default App;
