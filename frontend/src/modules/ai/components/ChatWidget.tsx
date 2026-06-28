import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Bot, User, Trash2, MessageSquare, Loader2, X, MinusCircle, AlertCircle } from 'lucide-react';
import api from '../../../lib/api';
import MarkdownOutput from '../../../shared/components/MarkdownOutput';
import { useToast } from '../../../contexts/ToastContext';
import { useTheme } from '../../../contexts/ThemeContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
}

interface Conversation {
  id: string;
  user_id?: string;
  messages: Message[];
  created_at?: Date | string;
  updated_at?: Date | string;
}

export default function ChatWidget() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const { data: suggestions, error: suggestionsError } = useQuery({
    queryKey: ['copilot-suggestions'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/copilot/suggestions');
        return res.data.data || [];
      } catch {
        return ['查看当前告警状态', '服务器状态怎么样', '最近执行了哪些任务'];
      }
    }
  });

  const { data: conversations, error: conversationsError } = useQuery({
    queryKey: ['copilot-conversations'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/copilot/conversations');
        return res.data.data || [];
      } catch {
        return [];
      }
    }
  });

  // 检查是否是需要修改密码的错误
  const isPasswordChangeRequired = (error: any) => {
    return error?.response?.status === 403;
  };

  const currentConversation = conversations?.find((c: Conversation) => c.id === currentConversationId);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId?: string, message: string }) => {
      const res = await api.post('/api/copilot/chat', {
        conversationId,
        message
      });
      return res.data;
    },
    onMutate: async ({ conversationId, message }) => {
      await queryClient.cancelQueries({ queryKey: ['copilot-conversations'] });
      const previousConversations = queryClient.getQueryData<Conversation[]>(['copilot-conversations']);

      queryClient.setQueryData<Conversation[]>(['copilot-conversations'], (old) => {
        return old?.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              messages: [
                ...c.messages,
                { role: 'user', content: message, timestamp: new Date().toISOString() },
              ],
            };
          }
          return c;
        });
      });

      return { previousConversations };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot-conversations'] });
      setInputValue('');
    },
    onError: (_err, _variables, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(['copilot-conversations'], context.previousConversations);
      }
      toast.error('发送消息失败，请重试');
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/copilot/conversations');
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setCurrentConversationId(data.data.id);
        queryClient.invalidateQueries({ queryKey: ['copilot-conversations'] });
      } else {
        toast.error(`创建对话失败: ${data.error}`);
      }
    },
    onError: () => {
      toast.error('创建对话出错');
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/copilot/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot-conversations'] });
      setCurrentConversationId(null);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages, sendMessageMutation.isPending]);

  const handleSend = async (msg?: string) => {
    const message = msg || inputValue;
    if (!message.trim()) return;

    if (!currentConversationId) {
      await createConversationMutation.mutateAsync().then((data) => {
        if (data?.success) {
          sendMessageMutation.mutate({ conversationId: data.data.id, message });
        }
      });
    } else {
      sendMessageMutation.mutate({ conversationId: currentConversationId, message });
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 flex items-center justify-center text-white hover:scale-[1.05] active:scale-[0.95] z-50"
      >
        <Bot className="w-7 h-7" />
      </button>
    );
  }

  const bgMain = 'bg-surface';
  const borderColor = 'border-border';
  const sidebarBg = 'bg-background';
  const sidebarBorder = 'border-border';
  const chatBg = 'bg-background';
  const textPrimary = 'text-text-primary';
  const textSecondary = 'text-text-secondary';
  const textMuted = 'text-text-tertiary';
  const inputBg = 'bg-surface';
  const inputBorder = 'border-border';
  const cardBg = 'bg-surface';
  const cardBorder = 'border-border';
  const hoverBg = 'hover:bg-background';
  const dividerBg = 'border-border';
  const msgBg = 'bg-surface';
  const msgBorder = 'border-border';
  const minimizedBg = 'bg-surface';
  const minimizedBorder = 'border-border';

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {!isMinimized && (
        <div className={`w-[420px] h-[600px] ${bgMain} rounded-2xl shadow-2xl border ${borderColor} flex flex-col mb-3 overflow-hidden animate-slide-up`}>
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-white" />
              <h3 className="font-semibold text-white">IT运维助手</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-all"
              >
                <MinusCircle className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className={`w-32 ${sidebarBg} border-r ${sidebarBorder} flex flex-col flex-shrink-0`}>
              <button
                onClick={() => {
                  createConversationMutation.mutate();
                }}
                className="m-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all font-medium"
                disabled={createConversationMutation.isPending}
              >
                {createConversationMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5" />
                )}
                {createConversationMutation.isPending ? '创建中...' : '新对话'}
              </button>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
                {conversations?.map((c: Conversation) => (
                  <div
                    key={c.id}
                    onClick={() => setCurrentConversationId(c.id)}
                    className={`p-2 rounded-lg cursor-pointer transition-all text-xs ${
                      c.id === currentConversationId
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                        : `${cardBg} ${textSecondary} ${hoverBg}`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">
                        {c.messages[0]?.content?.substring(0, 12) || '新对话'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversationMutation.mutate(c.id);
                        }}
                        className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`flex-1 flex flex-col ${chatBg}`}>
              {/* 密码修改提示 */}
              {(isPasswordChangeRequired(suggestionsError) || isPasswordChangeRequired(conversationsError)) && (
                <div className="p-4 m-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-300 font-medium text-sm">需要修改密码</p>
                      <p className="text-yellow-200/80 text-xs mt-1">
                        请先去设置页面修改初始密码，然后再使用IT运维助手
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {!currentConversationId ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <Bot className="w-12 h-12 text-blue-500 mb-4" />
                  <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>需要帮助？</h3>
                  <p className={`${textSecondary} text-sm mb-6`}>
                    选择或创建对话开始
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full">
                    {(suggestions || []).slice(0, 3).map((suggestion: string, index: number) => (
                      <button
                        key={`${suggestion}-${index}`}
                        onClick={() => {
                          handleSend(suggestion);
                        }}
                        className={`p-3 ${cardBg} ${hoverBg} border ${cardBorder} rounded-xl text-left text-sm ${textSecondary} hover:${textPrimary} transition-all`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                    {(currentConversation?.messages || []).map((msg: Message, index: number) => (
                      <div
                        key={`${msg.role}-${typeof msg.timestamp === 'object' ? msg.timestamp.getTime() : new Date(msg.timestamp).getTime()}-${index}`}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                      >
                        <div className="flex items-start gap-2 max-w-[85%]">
                          {msg.role === 'assistant' && (
                            <div className="w-7 h-7 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                              <Bot className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <div className={`p-3 rounded-xl ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                              : `${msgBg} ${textSecondary} border ${msgBorder}`
                          }`}>
                            {msg.role === 'assistant' && msg.content ? (
                              <MarkdownOutput content={msg.content} />
                            ) : (
                              <p className="text-sm">{msg.content}</p>
                            )}
                          </div>
                          {msg.role === 'user' && (
                            <div className="w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {sendMessageMutation.isPending && (
                      <div className="flex justify-start animate-fade-in">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          </div>
                          <div className={`p-3 ${msgBg} ${textSecondary} rounded-xl border ${msgBorder} flex items-center gap-2`}>
                            <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className={`p-3 border-t ${dividerBg} ${inputBg} flex-shrink-0`}>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="输入您的问题..."
                        className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl px-3 py-2.5 text-sm ${textPrimary} placeholder:${textMuted} focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all`}
                      />
                      <button
                        onClick={() => handleSend()}
                        disabled={!inputValue.trim()}
                        className="px-3 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white transition-all shadow-lg shadow-blue-500/20"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isMinimized && (
        <div className="flex gap-2">
          <button
            onClick={() => setIsMinimized(false)}
            className={`w-12 h-12 ${minimizedBg} ${hoverBg} rounded-full shadow-lg border ${minimizedBorder} flex items-center justify-center ${textPrimary} transition-all hover:scale-[1.05] active:scale-[0.95]`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="w-12 h-12 bg-red-600 hover:bg-red-500 rounded-full shadow-lg shadow-red-500/20 flex items-center justify-center text-white transition-all hover:scale-[1.05] active:scale-[0.95]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
