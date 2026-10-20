'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Copy, 
  Check, 
  Trash2, 
  Settings, 
  Loader2, 
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import PdronOrb from './PdronOrb';

export function PdronLogo({ 
  theme = 'dark', 
  size = 'md' 
}: { 
  theme?: 'dark' | 'light'; 
  size?: 'xs' | 'sm' | 'md' | 'lg' 
}) {
  const pdrColor = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl'
  }[size];

  return (
    <span className={`inline-flex items-baseline tracking-tight select-none font-sans ${sizeClasses}`}>
      <span className={`font-black tracking-wider ${pdrColor}`}>PDR</span>
      <span className="font-light italic text-emerald-400 ml-0.5 tracking-wide drop-shadow-[0_0_8px_rgba(52,211,153,0.55)]">
        ON
      </span>
    </span>
  );
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: 'ai' | 'knowledge_base';
  suggestions?: string[];
  timestamp: string;
}

const DEFAULT_GREETING: ChatMessage = {
  id: 'greeting',
  role: 'assistant',
  text: `👋 Merhabalar! Ben **PDRON**, MEB Rehberlik, Özel Eğitim, ŞÖK ve okul risk süreçlerindeki akıllı çalışma arkadaşınızım.\n\n` +
    `Size şu konularda 7/24 profesyonel destek sağlayabilirim:\n` +
    `• **ŞÖK Kararları:** Öğrenciler için MEB mevzuatına tam uyumlu, yapıcı ve doğrudan tutanağa yapıştırılabilecek kurul görüşleri hazırlamak.\n` +
    `• **36 Risk Faktörü:** Akran zorbalığı, parçalanmış aile, devamsızlık, disleksi, DEHB vb. konularda sınıfta izlenecek pedagojik adımlar ve veli iletişimi.\n` +
    `• **Resmi Süreçler & Sistem:** RAM yönlendirmesi, BEP birimi, E-Okul'dan PDF raporları indirme ve karekodlu öğretmen kartlarını yazdırma.`,
  suggestions: [
    'ŞÖK için örnek yapıcı görüşler ver',
    'Akran zorbalığına uğrayan öğrenciye yaklaşım',
    'E-Okul\'dan PDF raporlarını nasıl alırım?',
    'Karekodlu giriş sistemi nasıl çalışır?'
  ],
  timestamp: 'Şimdi'
};

export default function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_GREETING]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // İsteğe bağlı kişisel Gemini API Anahtarı
  const [showSettings, setShowSettings] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tarayıcı hafızasından önceki sohbeti ve varsa özel API anahtarını yükle
  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('custom_gemini_api_key');
      if (storedKey) {
        setCustomApiKey(storedKey);
        setHasStoredKey(true);
      }

      const storedChat = localStorage.getItem('assistant_chat_history');
      if (storedChat) {
        const parsed = JSON.parse(storedChat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.warn('Asistan geçmişi okunamadı:', e);
    }
  }, []);

  // Mesaj listesi güncellendikçe aşağı kaydır ve kaydet
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const saveChatHistory = (msgs: ChatMessage[]) => {
    setMessages(msgs);
    try {
      localStorage.setItem('assistant_chat_history', JSON.stringify(msgs.slice(-20)));
    } catch (e) {
      console.warn('Geçmiş kaydedilemedi:', e);
    }
  };

  const handleSaveApiKey = () => {
    try {
      if (customApiKey.trim()) {
        localStorage.setItem('custom_gemini_api_key', customApiKey.trim());
        setHasStoredKey(true);
        toast.success('Gemini API anahtarı kaydedildi. PDRON en gelişmiş yapay zeka moduyla yanıt verecektir!');
      } else {
        localStorage.removeItem('custom_gemini_api_key');
        setHasStoredKey(false);
        toast.success('API anahtarı temizlendi. PDRON yerel MEB bilgi bankasıyla çalışacaktır.');
      }
      setShowSettings(false);
    } catch (e) {
      toast.error('Anahtar kaydedilemedi.');
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('PDRON sohbet geçmişini sıfırlamak istediğinize emin misiniz?')) {
      const reset = [{ ...DEFAULT_GREETING, id: 'greeting-' + Date.now() }];
      saveChatHistory(reset);
      toast.success('Sohbet geçmişi temizlendi.');
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Metin panoya kopyalandı! Doğrudan ŞÖK veya not alanına yapıştırabilirsiniz.');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMsg];
    saveChatHistory(newHistory);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: newHistory.slice(-6).map(m => ({ role: m.role, text: m.text })),
          customApiKey: customApiKey.trim() || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const assistantMsg: ChatMessage = {
          id: 'assistant-' + Date.now(),
          role: 'assistant',
          text: data.reply,
          source: data.source || 'ai',
          suggestions: data.suggestions || [],
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        };
        saveChatHistory([...newHistory, assistantMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: 'err-' + Date.now(),
          role: 'assistant',
          text: data.error || 'Üzgünüm, yanıt oluşturulurken bir aksaklık oldu. Lütfen tekrar deneyiniz.',
          source: 'knowledge_base',
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        };
        saveChatHistory([...newHistory, errorMsg]);
      }
    } catch (err: any) {
      const fallbackMsg: ChatMessage = {
        id: 'fallback-' + Date.now(),
        role: 'assistant',
        text: 'Bağlantı sağlanamadı. PDRON yerel MEB bilgi bankasını kullanarak yardımcı olmaya devam edecektir.',
        source: 'knowledge_base',
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      };
      saveChatHistory([...newHistory, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Basit Markdown formatlayıcı (kalınlık, madde imleri, satır sonları)
  const renderFormattedText = (raw: string) => {
    return raw.split('\n').map((line, idx) => {
      // Madde imi kontrolü
      const isBullet = line.trim().startsWith('• ') || line.trim().startsWith('- ') || line.trim().startsWith('* ');
      let textLine = isBullet ? line.trim().substring(2) : line;

      // Kalın metinleri ( **metin** ) ayrıştır
      const parts = textLine.split(/(\*\*[^*]+\*\*)/g);
      const renderedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={idx} className="flex items-start gap-1.5 my-0.5 ml-1">
            <span className="text-emerald-500 font-bold">•</span>
            <span>{renderedParts}</span>
          </div>
        );
      }

      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }

      return <p key={idx} className="my-0.5 leading-relaxed">{renderedParts}</p>;
    });
  };

  return (
    <>
      {/* 1. Yüzen Açma Butonu (Floating Action Button - PDRON Holografik Orb & Tipografi) */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 150);
          }}
          className="fixed bottom-5 right-5 z-40 bg-slate-950/90 hover:bg-slate-900 text-white pl-2.5 pr-4 py-2 rounded-full shadow-[0_8px_30px_rgba(2,132,199,0.3)] hover:shadow-[0_10px_35px_rgba(16,185,129,0.4)] transition-all duration-300 flex items-center gap-2.5 group transform hover:-translate-y-0.5 border border-slate-700/80 backdrop-blur-md select-none"
          title="PDRON Akıllı Rehberlik & ŞÖK Asistanını Aç"
        >
          {/* Holografik Orb (Nefes Alma Animasyonlu) */}
          <PdronOrb size="sm" state="idle" glow={true} />

          {/* Logo & Başlık */}
          <div className="flex items-baseline gap-1.5">
            <PdronLogo theme="dark" size="sm" />
            <span className="hidden sm:inline font-medium text-[11px] text-slate-300">
              Asistan
            </span>
          </div>

          {/* Aktiflik Noktası (Neon Yeşili) */}
          <span className="relative flex h-2 w-2 ml-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </button>
      )}

      {/* 2. PDRON Penceresi (Drawer / Modal) */}
      {isOpen && (
        <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-50 w-[calc(100vw-24px)] sm:w-[425px] h-[590px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-800/20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header - Koyu Lacivert / Çelik Mavisi (Güven Mavisi) */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-3.5 text-white flex items-center justify-between border-b border-emerald-500/20 shadow-md">
            <div className="flex items-center gap-2.5">
              {/* Dinamik Holografik Orb (Yüklenirken Döner & Renk Değiştirir) */}
              <PdronOrb size="md" state={isLoading ? 'thinking' : 'idle'} glow={true} />
              
              <div>
                <div className="flex items-center gap-2">
                  <PdronLogo theme="dark" size="md" />
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold px-2 py-0.2 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {hasStoredKey ? 'Gemini 2.5' : 'Aktif'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  Akıllı MEB Rehberlik, Özel Eğitim & ŞÖK Asistanı
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showSettings ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
                title="Yapay Zeka API Ayarları"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearHistory}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Sohbeti Sıfırla"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Pencereyi Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* İsteğe Bağlı Gemini API Ayar Çubuğu */}
          {showSettings && (
            <div className="bg-slate-900 border-b border-slate-800 p-3 text-xs space-y-2 text-slate-200 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Google Gemini AI Anahtarı (İsteğe Bağlı)
                </span>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                PDRON varsayılan olarak dahili MEB bilgi bankasıyla sınırsız çalışır. Kendi Google AI Studio anahtarınızı girerek sınırsız yapay zeka derinliği açabilirsiniz.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="AIzaSy... (Boş bırakılırsa yerel mod)"
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono bg-slate-950 text-white"
                />
                <button
                  onClick={handleSaveApiKey}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors"
                >
                  Kaydet
                </button>
              </div>
            </div>
          )}

          {/* Mesaj Akışı */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-50/70 text-xs">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl p-3 shadow-xs ${
                      isUser
                        ? 'bg-slate-900 text-white rounded-br-none border border-slate-800'
                        : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-none'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <PdronOrb size="xs" state="idle" glow={false} />
                          <PdronLogo theme="light" size="xs" />
                          <span className="text-[10px] text-slate-400 font-medium">
                            • {m.source === 'ai' ? 'Gemini AI' : 'MEB Bilgi Bankası'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText(m.id, m.text)}
                          className="text-[10px] text-slate-400 hover:text-emerald-700 flex items-center gap-0.5 transition-colors p-0.5 rounded"
                          title="Cevabı Kopyala"
                        >
                          {copiedId === m.id ? (
                            <><Check className="w-3 h-3 text-emerald-600" /> Kopyalandı</>
                          ) : (
                            <><Copy className="w-3 h-3" /> Kopyala</>
                          )}
                        </button>
                      </div>
                    )}

                    <div className="text-xs break-words">
                      {renderFormattedText(m.text)}
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 px-1">
                    {m.timestamp}
                  </span>

                  {/* Öneri Butonları (Pills) */}
                  {!isUser && m.suggestions && m.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 max-w-[95%]">
                      {m.suggestions.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => sendMessage(sug)}
                          disabled={isLoading}
                          className="text-[11px] bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 px-2.5 py-1 rounded-full font-medium transition-all text-left shadow-2xs disabled:opacity-50"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Düşünüyor / Loading Modu (Holografik Orb Dönüş Animasyonu) */}
            {isLoading && (
              <div className="flex items-center gap-3 text-slate-700 text-xs p-3 bg-white rounded-2xl border border-slate-200 shadow-sm w-fit animate-in fade-in duration-150">
                <PdronOrb size="sm" state="thinking" glow={true} />
                <div>
                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                    PDR<span className="font-light italic text-emerald-600">ON</span> düşünüyor...
                  </p>
                  <p className="text-[10px] text-slate-400">MEB mevzuatı ve pedagojik kaynaklar taranıyor</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Hızlı Kısayol Başlıkları */}
          <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
            <button
              onClick={() => sendMessage('ŞÖK için örnek yapıcı görüşler ver')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 rounded-lg whitespace-nowrap font-medium transition-colors border border-transparent hover:border-emerald-200"
            >
              🎯 ŞÖK Görüşü
            </button>
            <button
              onClick={() => sendMessage('Akran zorbalığı durumunda ne yapılmalı?')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-cyan-50 text-slate-800 hover:text-cyan-700 rounded-lg whitespace-nowrap font-medium transition-colors border border-transparent hover:border-cyan-200"
            >
              🛡️ Zorbalık
            </button>
            <button
              onClick={() => sendMessage('E-Okul\'dan PDF raporlarını nasıl alırım?')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 rounded-lg whitespace-nowrap font-medium transition-colors border border-transparent hover:border-indigo-200"
            >
              📄 E-Okul PDF
            </button>
            <button
              onClick={() => sendMessage('Karekodlu giriş kartları nasıl yazdırılır?')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-amber-50 text-slate-800 hover:text-amber-700 rounded-lg whitespace-nowrap font-medium transition-colors border border-transparent hover:border-amber-200"
            >
              🖨️ Karekod
            </button>
          </div>

          {/* Mesaj Yazma Alanı */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="PDRON'a bir soru sorun veya ŞÖK görüşü isteyin..."
              disabled={isLoading}
              className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/70 placeholder:text-slate-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-emerald-400 disabled:text-slate-400 rounded-xl transition-all flex-shrink-0 shadow-sm border border-slate-800 disabled:border-transparent"
              title="Gönder"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      )}
    </>
  );
}
