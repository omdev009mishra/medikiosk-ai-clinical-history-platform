import React, { useRef, useEffect } from 'react';
import { Bot, User, CheckCheck } from 'lucide-react';
import { MessageTurn } from '../types';

interface ChatHistoryProps {
  messages: MessageTurn[];
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex flex-col gap-3.5 my-3" id="chat-history-list">
      {messages.map((item) => {
        const isAssistant = item.role === 'assistant';

        return (
          <div
            key={item.id}
            className={`flex items-start gap-2.5 sm:gap-3 ${
              isAssistant ? 'justify-start' : 'justify-end'
            }`}
          >
            {isAssistant && (
              <div className="w-8 h-8 rounded-xl bg-[#F1F4EF] border border-[#E8E7E0] flex items-center justify-center text-[#5B7558] shrink-0 mt-0.5 shadow-2xs">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[80%] px-5 py-3.5 text-sm leading-relaxed ${
                isAssistant
                  ? 'bg-white rounded-2xl rounded-bl-none border border-[#E8E7E0] text-[#2D312E] shadow-2xs'
                  : 'bg-[#8BA888] rounded-2xl rounded-br-none text-white shadow-2xs font-medium'
              }`}
            >
              {isAssistant && item.questionNumber && (
                <div className="text-[10px] font-bold text-[#5B7558] uppercase tracking-widest mb-1">
                  Question {item.questionNumber}
                </div>
              )}
              <p className="whitespace-pre-wrap">{item.message}</p>
              <div
                className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${
                  isAssistant ? 'text-[#828C84]' : 'text-white/80'
                }`}
              >
                <span>{item.timestamp}</span>
                {!isAssistant && <CheckCheck className="w-3 h-3 text-white/90" />}
              </div>
            </div>

            {!isAssistant && (
              <div className="w-8 h-8 rounded-xl bg-[#8BA888] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
