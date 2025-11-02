
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChecklistItem, ChecklistGroup, QuestionItem, QuestionGroup, InterviewStatus, GenAIBlob, FirstCycleCode } from './types';
import { Logo, MicIcon, StopIcon, PlusIcon, TrashIcon, CheckCircleIcon, ChevronDownIcon, SaveIcon, DownloadIcon, PauseIcon, PlayIcon, SparklesIcon, CodeBracketIcon } from './components/icons';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';

// Audio Encoding/Decoding helpers
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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
    "Para começarmos, gostaria que você me contasse um pouco sobre a *jornada* da sua equipe nos últimos anos. Como era a dinâmica de trabalho de vocês antes da pandemia e como ela foi se transformando até chegar no modelo que vocês adotam hoje?"

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

7.  **[Pergunta Final (Opcional)]**
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
    <div className="w-24 h-5 bg-brand-dark border border-brand-light-gray/50 rounded-md overflow-hidden flex items-center px-1">
        <div 
            className="h-2 bg-green-500 rounded-sm transition-all duration-75"
            style={{ width: `${volume * 100}%` }}
        />
    </div>
);

const App = () => {
  const [checklist, setChecklist] = useState<ChecklistGroup[]>(() => parseMarkdownToGroupedChecklist(initialMarkdown));
  const [questions, setQuestions] = useState<QuestionGroup[]>(() => parseMarkdownToQuestions(initialQuestionsMarkdown));
  const [status, setStatus] = useState<InterviewStatus>('idle');
  const [activeTab, setActiveTab] = useState<'interview' | 'checklist' | 'questions' | 'codificacao'>('interview');
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [interviewIdentifier, setInterviewIdentifier] = useState<string>('');
  const [interviewStartTime, setInterviewStartTime] = useState<string>('');
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isCoding, setIsCoding] = useState<boolean>(false);
  const [firstCycleCodes, setFirstCycleCodes] = useState<FirstCycleCode[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [micVolume, setMicVolume] = useState(0);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsAppLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);
  
  // Checklist CRUD functions
  const handleAddGroup = () => setChecklist(prev => [...prev, { id: `group-${Date.now()}`, title: 'Novo Grupo', items: [] }]);
  const handleUpdateGroupTitle = (groupId: string, title: string) => setChecklist(prev => prev.map(g => g.id === groupId ? { ...g, title } : g));
  const handleDeleteGroup = (groupId: string) => setChecklist(prev => prev.filter(g => g.id !== groupId));
  const handleAddItemToGroup = (groupId: string) => setChecklist(prev => prev.map(g => g.id === groupId ? { ...g, items: [...g.items, { id: `item-${Date.now()}`, text: 'Novo item', checkedByAI: false, checkedByHuman: false, keywords: '' }] } : g));
  const handleUpdateItemText = (groupId: string, itemId: string, text: string) => setChecklist(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, text } : i) } : g));
  const handleUpdateItemKeywords = (groupId: string, itemId: string, keywords: string) => setChecklist(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, keywords } : i) } : g));
  const handleDeleteItem = (groupId: string, itemId: string) => setChecklist(prev => prev.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g));
  
  // Question CRUD functions
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

  const handleExportTranscription = (format: 'md' | 'txt') => {
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
  };

  const handleToggleHumanCheck = (groupId: string, itemId: string) => {
    setChecklist(prevGroups => prevGroups.map(group => group.id === groupId ? { ...group, items: group.items.map(item => item.id === itemId ? { ...item, checkedByHuman: !item.checkedByHuman } : item) } : group));
  };
  
  const handleToggleQuestionAsked = (groupId: string, itemId: string) => {
    // FIX: Changed g.items.map to group.items.map
    setQuestions(prevGroups => prevGroups.map(group => group.id === groupId ? { ...group, items: group.items.map(item => item.id === itemId ? { ...item, asked: !item.asked } : item) } : group));
  };

  const stopInterview = useCallback(async (newState: InterviewStatus = 'stopped') => {
    setStatus(newState);
    setMicVolume(0);

    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
    if (mediaStreamSourceRef.current) mediaStreamSourceRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') await audioContextRef.current.close();
    
    mediaStreamRef.current = null;
    scriptProcessorRef.current = null;
    mediaStreamSourceRef.current = null;
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

  const handlePauseResume = () => {
    if (status === 'recording') {
        setStatus('paused');
    } else if (status === 'paused') {
        setStatus('recording');
    }
  };

  const beginRecording = useCallback(async () => {
    setStatus('processing');
    const systemInstruction = `Você é um assistente de transcrição. Transcreva o áudio em português do Brasil com a maior precisão possível.`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: async () => {
            setStatus('recording');
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            scriptProcessorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              let sumSquares = 0.0;
              for (let i = 0; i < inputData.length; i++) {
                sumSquares += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sumSquares / inputData.length);
              setMicVolume(Math.min(1, rms * 7));

              if (status !== 'paused') {
                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                const pcmBlob: GenAIBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ media: pcmBlob }));
              }
            };
            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
                setTranscription(prev => prev + message.serverContent.inputTranscription.text);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error("Session error:", e);
            setError("Ocorreu um erro na conexão. Tente novamente.");
            stopInterview('error');
          },
          onclose: () => { if (status === 'recording' || status === 'paused') setStatus('stopped'); },
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
  }, [stopInterview, status]);

  const startInterview = useCallback(async () => {
    if (checklist.reduce((sum, g) => sum + g.items.length, 0) === 0) {
      setError("Sua checklist está vazia. Vá para a aba 'Checklist' para adicionar pontos.");
      return;
    }
    setError(null);
    setTranscription('');
    setInterviewStartTime(new Date().toLocaleString('pt-BR'));
    setStatus('countdown');
    setCountdown(3);
  }, [checklist]);

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


  const handleValidateChecklist = async () => {
    if (!transcription.trim() || isValidating) return;
    setIsValidating(true);
    setError(null);

    // Prompt Optimization: Create a more compact and context-rich representation of the checklist.
    const checklistString = checklist
      .map(group => {
        // Map each item to a compact string format.
        const itemsString = group.items
          .filter(item => !item.checkedByAI) // Only include items not yet checked by AI
          .map(item => {
            const keywordsInfo = item.keywords ? ` (Palavras-chave: ${item.keywords})` : '';
            return `  - ID: ${item.id} | Item: "${item.text}"${keywordsInfo}`;
          })
          .join('\n');

        // Only include the group if it has items to validate.
        if (itemsString) {
          return `Grupo: "${group.title}"\n${itemsString}`;
        }
        return null;
      })
      .filter(Boolean) // Remove any null entries for empty groups
      .join('\n\n');

    if (!checklistString) {
        setIsValidating(false);
        return;
    }
    
    // Pre-analysis: Filter out interviewer's questions from the transcript.
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

    // Prompt Optimization: A more structured prompt with clear, numbered instructions.
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
  };

  const handleGenerateFirstCycleCodes = async () => {
    if (!transcription.trim() || isCoding) return;
    setIsCoding(true);
    setFirstCycleCodes([]);
    setError(null);
    
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
   - "type": O tipo de codificação usada ("Descritivo", "Processo", ou "In Vivo").

---
TRANSCRIÇÃO PARA ANÁLISE:
${transcription}
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
        setFirstCycleCodes(result.codes);
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

  const toggleCollapse = (groupId: string) => setCollapsedGroups(p => ({ ...p, [groupId]: !p[groupId] }));
  
  useEffect(() => { return () => { if (status === 'recording' || status === 'paused') stopInterview() } }, [status, stopInterview]);

  const handleNewInterview = () => {
    stopInterview('idle');
    setChecklist(parseMarkdownToGroupedChecklist(initialMarkdown));
    setQuestions(parseMarkdownToQuestions(initialQuestionsMarkdown));
    setInterviewIdentifier('');
    setInterviewStartTime('');
    setTranscription('');
    setError(null);
  };

  const renderEditor = (type: 'checklist' | 'questions') => {
    const isChecklist = type === 'checklist';
    const title = isChecklist ? "Gerencie sua Checklist" : "Gerencie suas Perguntas";
    const description = isChecklist ? "Adicione, edite ou remova grupos e itens." : "Adicione, edite ou remova blocos e perguntas.";
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

    return (
      <div className="w-full max-w-4xl mx-auto h-full flex flex-col p-4">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <div><h2 className="text-2xl font-bold">{title}</h2><p className="text-gray-400">{description}</p></div>
          <div className="flex gap-2">
            <button onClick={() => handleSaveToMarkdown(type)} className="bg-brand-gray hover:bg-brand-light-gray text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"><SaveIcon className="w-5 h-5" />Salvar como Markdown</button>
            <button onClick={actions.addGroup} className="bg-brand-blue hover:bg-brand-light-blue text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"><PlusIcon className="w-5 h-5" />{addGroupText}</button>
          </div>
        </div>
        <div className="space-y-6 overflow-y-auto flex-grow pr-2">
          {data.map(group => (
            <div key={group.id} className="bg-brand-gray p-4 rounded-lg border border-brand-light-gray/20">
              <div className="flex items-center gap-2 mb-4">
                <input type="text" value={group.title} onChange={(e) => actions.updateGroupTitle(group.id, e.target.value)} className="flex-grow bg-transparent text-xl font-bold text-brand-light-blue border-b-2 border-brand-light-gray/50 focus:outline-none focus:border-brand-light-blue transition-colors" placeholder="Título"/>
                <button onClick={() => actions.deleteGroup(group.id)} className="text-gray-400 hover:text-red-500 transition-colors" aria-label={`Remover ${group.title}`}><TrashIcon className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3 pl-4">
                {(group.items as Array<ChecklistItem | QuestionItem>).map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className='flex-grow space-y-1'>
                      <input type="text" value={item.text} onChange={(e) => actions.updateItemText(group.id, item.id, e.target.value)} className="w-full bg-brand-dark rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-brand-light-blue transition-all" placeholder="Texto do item"/>
                      {isChecklist && (
                        <input type="text" value={(item as ChecklistItem).keywords} onChange={(e) => (actions as any).updateItemKeywords(group.id, item.id, e.target.value)} className="w-full bg-brand-dark/50 rounded-md p-2 text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-light-blue transition-all" placeholder="Palavras-chave (ex: custo, budget, ROI)"/>
                      )}
                    </div>
                    <button onClick={() => actions.deleteItem(group.id, item.id)} className="text-gray-500 hover:text-red-500 transition-colors" aria-label={`Remover ${item.text}`}><TrashIcon className="w-5 h-5" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => actions.addItem(group.id)} className="text-brand-light-blue hover:text-white mt-4 flex items-center gap-1 text-sm font-semibold"><PlusIcon className="w-4 h-4" />{addItemText}</button>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const renderCodificacaoTab = () => (
    <div className="w-full max-w-5xl mx-auto h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold">Codificação de Primeiro Ciclo</h2>
          <p className="text-gray-400">Analise a transcrição da entrevista para gerar códigos qualitativos iniciais.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={handleExportCodesToCSV} disabled={firstCycleCodes.length === 0} className="bg-brand-gray hover:bg-brand-light-gray text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <DownloadIcon className="w-5 h-5" /> Exportar CSV
          </button>
          <button onClick={handleGenerateFirstCycleCodes} disabled={!transcription.trim() || isCoding} className="bg-brand-blue hover:bg-brand-light-blue text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <CodeBracketIcon className={`w-5 h-5 ${isCoding ? 'animate-spin' : ''}`} />
            {isCoding ? 'Gerando...' : 'Gerar Códigos de 1º Ciclo'}
          </button>
        </div>
      </div>
      
      {error && <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

      <div className="overflow-y-auto flex-grow border border-brand-light-gray/20 rounded-lg bg-brand-gray">
        {firstCycleCodes.length > 0 ? (
          <table className="min-w-full divide-y divide-brand-light-gray/20">
            <thead className="bg-brand-light-gray/10 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-1/5">Tipo</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-1/4">Código</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-auto">Citação</th>
              </tr>
            </thead>
            <tbody className="bg-brand-gray divide-y divide-brand-light-gray/20">
              {firstCycleCodes.map((code, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${code.type === 'In Vivo' ? 'bg-purple-200 text-purple-800' : code.type === 'Processo' ? 'bg-blue-200 text-blue-800' : 'bg-yellow-200 text-yellow-800'}`}>{code.type}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{code.code}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{code.quote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <CodeBracketIcon className="w-16 h-16 mb-4" />
            <h3 className="text-xl font-semibold">Nenhum código gerado ainda.</h3>
            <p className="mt-1">
              {transcription.trim() 
                ? "Clique em 'Gerar Códigos de 1º Ciclo' para iniciar a análise da IA." 
                : "Realize uma entrevista na aba 'Entrevista' para ter uma transcrição para analisar."}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderInterviewTab = () => {
    if (isAppLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-3xl font-bold text-white animate-pulse">Preparando o ambiente...</h2>
          <p className="mt-2 text-lg text-gray-400">Seu assistente de IA está sendo inicializado.</p>
        </div>
      );
    }

    const isInterviewLive = status === 'recording' || status === 'paused';

    if (status === 'countdown') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="relative w-48 h-48 flex items-center justify-center">
                    <div className="absolute inset-0 bg-brand-gray rounded-full animate-ping opacity-75"></div>
                    <div className="absolute inset-0 border-4 border-brand-light-blue rounded-full"></div>
                    <span className="text-8xl font-bold text-white z-10">{countdown}</span>
                </div>
                <p className="mt-8 text-xl text-gray-400">Prepare-se para gravar...</p>
            </div>
        );
    }
    
    return (
      <div className="w-full flex flex-col h-full">
        {/* --- TOP CONTROL BAR --- */}
        <div className="flex items-center justify-between p-4 mb-4 bg-brand-gray rounded-lg border border-brand-light-gray/20 flex-shrink-0">
          <div className="flex-grow mr-4">
            <input
              id="interview-id"
              type="text"
              value={interviewIdentifier}
              onChange={(e) => setInterviewIdentifier(e.target.value)}
              placeholder="Identificador da Entrevista (Ex: João Silva - Vaga DEV-123)"
              className="w-full bg-brand-dark rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-brand-light-blue transition-all border border-brand-light-gray/20 text-sm"
              // FIX: Removed redundant `status === 'countdown'` check because the component returns early if status is 'countdown'.
              disabled={isInterviewLive || status === 'processing'}
            />
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            {(status === 'recording' || status === 'paused') && (
                <div className="flex items-center gap-2 text-sm text-gray-400 font-mono">
                    <div className={`transition-transform duration-300 ${status === 'recording' ? 'scale-110' : 'scale-100'}`}>
                         <MicIcon className={`w-5 h-5 transition-colors ${status === 'recording' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
                    </div>
                    <div className={`transition-transform duration-300 ${status === 'recording' ? 'scale-110' : 'scale-100'}`}>
                        <VolumeMeter volume={micVolume} />
                    </div>
                </div>
            )}
            <div className="flex items-center gap-2">
                {(status === 'idle' || status === 'stopped' || status === 'error') && (
                  <button onClick={startInterview} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
                    <MicIcon className="w-5 h-5" /> Iniciar Entrevista
                  </button>
                )}
                {isInterviewLive && (
                  <>
                    <button onClick={handlePauseResume} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
                      {status === 'recording' ? <><PauseIcon className="w-5 h-5" /> Pausar</> : <><PlayIcon className="w-5 h-5" /> Retomar</>}
                    </button>
                    <button onClick={() => stopInterview()} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
                      <StopIcon className="w-5 h-5" /> Finalizar
                    </button>
                  </>
                )}
                {(status === 'stopped' || status === 'error') && (
                  <button onClick={handleNewInterview} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    Nova Entrevista
                  </button>
                )}
            </div>
          </div>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-grow grid lg:grid-cols-3 gap-6 w-full overflow-hidden">
            {/* Questions Panel (Left) */}
            <div className="flex flex-col overflow-hidden bg-brand-gray rounded-lg">
               <h2 className="text-xl font-bold p-4 border-b border-brand-light-gray/20 flex-shrink-0">Roteiro / Perguntas</h2>
               <div className="space-y-4 overflow-y-auto flex-grow p-4">
                 {questions.map(group => (
                   <div key={group.id}>
                     <h3 className="font-bold text-brand-light-blue mb-2">{group.title}</h3>
                     <div className="space-y-2 pl-2">
                       {group.items.map(item => (
                         <button 
                           key={item.id} 
                           onClick={() => handleToggleQuestionAsked(group.id, item.id)} 
                           className={`w-full text-left flex items-start gap-3 p-2 rounded-lg transition-all ${item.asked ? 'bg-blue-800/20' : 'hover:bg-brand-light-gray/20'}`}
                           role="checkbox"
                           aria-checked={item.asked}
                         >
                           <div className="flex-shrink-0 pt-0.5">
                             {item.asked 
                               ? <CheckCircleIcon className="w-5 h-5 text-blue-400" /> 
                               : <div className="w-5 h-5 border-2 border-brand-light-gray rounded-full" />
                             }
                           </div>
                           <span className={`flex-grow text-sm ${item.asked ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                             {item.text}
                           </span>
                         </button>
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
    
            {/* Transcription Panel (Center) */}
            <div className="flex flex-col overflow-hidden bg-brand-gray rounded-lg">
              <div className="flex justify-between items-center p-4 border-b border-brand-light-gray/20 flex-shrink-0">
                <h2 className="text-xl font-bold">Transcrição ao Vivo</h2>
                <div className="flex gap-2">
                  <button onClick={() => handleExportTranscription('txt')} disabled={!transcription.trim()} className="text-xs bg-brand-dark hover:bg-brand-light-gray text-white font-bold py-1 px-2 rounded-md flex items-center gap-1 transition-colors disabled:bg-brand-light-gray/20 disabled:cursor-not-allowed" title="Exportar como TXT"><DownloadIcon className="w-4 h-4" /> TXT</button>
                  <button onClick={() => handleExportTranscription('md')} disabled={!transcription.trim()} className="text-xs bg-brand-dark hover:bg-brand-light-gray text-white font-bold py-1 px-2 rounded-md flex items-center gap-1 transition-colors disabled:bg-brand-light-gray/20 disabled:cursor-not-allowed" title="Exportar como Markdown"><DownloadIcon className="w-4 h-4" /> MD</button>
                </div>
              </div>
              <div className="overflow-y-auto flex-grow p-4">
                <div className="border-b border-brand-light-gray/20 pb-2 mb-3 text-sm">
                  {interviewIdentifier && <p className="font-bold text-white">{interviewIdentifier}</p>}
                  {interviewStartTime && <p className="text-gray-400">{interviewStartTime}</p>}
                </div>
                {status === 'recording' && <div className="flex items-center gap-2 text-red-400 mb-4 animate-pulse"><div className="w-3 h-3 bg-red-500 rounded-full"></div>Gravando...</div>}
                {status === 'paused' && <div className="flex items-center gap-2 text-yellow-400 mb-4"><PauseIcon className="w-4 h-4" /> Pausado</div>}
                {status === 'stopped' && <p className="text-yellow-400 mb-4">Gravação finalizada.</p>}
                {status === 'processing' && <p className="text-blue-400 mb-4 animate-pulse">Processando áudio...</p>}
                <p className="text-brand-text whitespace-pre-wrap">{transcription || "Aguardando o início da fala..."}</p>
                {error && <p className="text-red-500 mt-4">{error}</p>}
              </div>
            </div>
    
            {/* Checklist Panel (Right) */}
            <div className="flex flex-col overflow-hidden bg-brand-gray rounded-lg">
               <div className="flex justify-between items-center p-4 border-b border-brand-light-gray/20 flex-shrink-0">
                <h2 className="text-xl font-bold">Checklist</h2>
                <button
                  onClick={handleValidateChecklist}
                  disabled={(!isInterviewLive && status !== 'stopped') || isValidating || !transcription.trim()}
                  className="text-xs bg-brand-blue hover:bg-brand-light-blue text-white font-bold py-1 px-2 rounded-md flex items-center gap-1 transition-colors disabled:bg-brand-light-gray/20 disabled:cursor-not-allowed"
                  title="Usar IA para validar itens da checklist com base na transcrição"
                >
                  <SparklesIcon className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
                  {isValidating ? 'Validando...' : 'Validar Checklist'}
                </button>
              </div>
              <div className="space-y-3 overflow-y-auto pr-2 p-4 flex-grow">
                {checklist.map(group => (
                  <div key={group.id} className="bg-brand-dark rounded-lg">
                    <button onClick={() => toggleCollapse(group.id)} className="w-full flex items-center justify-between p-3 text-left" aria-expanded={!collapsedGroups[group.id]}>
                      <div className="flex items-center">
                        <h3 className="font-bold">{group.title}</h3>
                        <span className="ml-3 text-xs font-mono bg-brand-light-gray text-white rounded-full px-2 py-0.5">
                          {group.items.filter(i => i.checkedByAI || i.checkedByHuman).length}/{group.items.length}
                        </span>
                      </div>
                      <ChevronDownIcon className={`w-5 h-5 transition-transform transform ${collapsedGroups[group.id] ? '' : 'rotate-180'}`} />
                    </button>
                    {!collapsedGroups[group.id] && (
                      <div className="px-3 pb-3 space-y-2">
                        <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 font-bold mb-2">
                            <div className="col-span-8">Item</div>
                            <div className="col-span-2 text-center">AI</div>
                            <div className="col-span-2 text-center">Entrevistador</div>
                        </div>

                        {group.items.map(item => {
                          const isChecked = item.checkedByAI || item.checkedByHuman;
                          return (
                            <div key={item.id} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg transition-all ${isChecked ? 'bg-green-800/20' : 'bg-brand-dark/50 hover:bg-brand-light-gray/20'}`}>
                                <div className={`col-span-8 text-sm ${isChecked ? 'line-through text-gray-400' : 'text-brand-text'}`}>{item.text}</div>
                                <div className="col-span-2 flex justify-center">
                                    {item.checkedByAI ? <CheckCircleIcon className="w-5 h-5 text-blue-400" /> : <div className="w-5 h-5 border-2 border-brand-light-gray/30 rounded-full" />}
                                </div>
                                <button onClick={() => handleToggleHumanCheck(group.id, item.id)} className="col-span-2 flex justify-center cursor-pointer" role="checkbox" aria-checked={item.checkedByHuman}>
                                    {item.checkedByHuman ? <CheckCircleIcon className="w-5 h-5 text-green-400" /> : <div className="w-5 h-5 border-2 border-brand-light-gray rounded-full" />}
                                </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
    );
  };
  
  return (
    <div className="h-screen bg-brand-dark text-brand-text flex flex-col">
       <header className="w-full max-w-7xl mx-auto py-4 px-4 sm:px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
            <Logo className="w-16 h-16 flex-shrink-0" />
            <div className="text-xl">
                <span className="text-white">
                    <span className="font-bold">A</span>utomatic <span className="font-bold">I</span>ntelligent
                </span>
                <span className="text-brand-light-blue ml-2">
                    <span className="font-bold">A</span>ssistant for <span className="font-bold">I</span>nterviewer
                </span>
            </div>
        </div>
      </header>

      <div className="w-full max-w-7xl mx-auto mb-6 flex-shrink-0 px-4">
        <div className="flex border-b border-brand-light-gray justify-center">
          <button onClick={() => setActiveTab('interview')} className={`py-2 px-6 text-lg font-semibold transition-colors ${activeTab === 'interview' ? 'border-b-2 border-brand-light-blue text-white' : 'text-gray-400 hover:text-white'}`}>Entrevista</button>
          <button onClick={() => setActiveTab('checklist')} className={`py-2 px-6 text-lg font-semibold transition-colors ${activeTab === 'checklist' ? 'border-b-2 border-brand-light-blue text-white' : 'text-gray-400 hover:text-white'}`}>Checklist</button>
          <button onClick={() => setActiveTab('questions')} className={`py-2 px-6 text-lg font-semibold transition-colors ${activeTab === 'questions' ? 'border-b-2 border-brand-light-blue text-white' : 'text-gray-400 hover:text-white'}`}>Perguntas</button>
          <button onClick={() => setActiveTab('codificacao')} className={`py-2 px-6 text-lg font-semibold transition-colors ${activeTab === 'codificacao' ? 'border-b-2 border-brand-light-blue text-white' : 'text-gray-400 hover:text-white'}`}>Codificação</button>
        </div>
      </div>

      <main className="w-full max-w-7xl mx-auto flex-grow flex overflow-hidden pb-4 sm:pb-8 px-4">
        <div className="w-full h-full">
            {activeTab === 'checklist' ? renderEditor('checklist') : activeTab === 'questions' ? renderEditor('questions') : activeTab === 'codificacao' ? renderCodificacaoTab() : renderInterviewTab()}
        </div>
      </main>
    </div>
  );
};

export default App;
