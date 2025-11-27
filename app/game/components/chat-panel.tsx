'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ImagePlus, Send, X, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: ChatMessage['content']) => Promise<void>;
  role: 'master' | 'player' | 'group';
  onClose: () => void;
}

export function ChatPanel({ messages, onSendMessage, role, onClose }: ChatPanelProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendText = async () => {
    if (text.trim() && !isSending) {
      setIsSending(true);
      try {
        await onSendMessage({ type: 'text', value: text.trim() });
        setText('');
      } catch (error) {
        toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile inviare il messaggio.' });
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          setIsSending(true);
          try {
            await onSendMessage({ type: 'image', value: result });
          } catch (error) {
             toast({ variant: 'destructive', title: 'Errore', description: 'Impossibile inviare l\'immagine.' });
          } finally {
            setIsSending(false);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getSenderClass = (messageRole: ChatMessage['sender']['role']) => {
    switch (messageRole) {
      case 'master':
        return 'text-red-400';
      case 'player':
        return 'text-blue-400';
      case 'group':
        return 'text-green-400';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="absolute bottom-4 right-4 z-50 w-80 h-[28rem] flex flex-col shadow-2xl animate-in slide-in-from-bottom-5">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <CardTitle className="text-lg">Chat di Gruppo</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={cn('font-bold text-sm', getSenderClass(msg.sender.role))}>
                    {msg.sender.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {msg.content.type === 'text' ? (
                  <p className="text-sm text-foreground/90">{msg.content.value}</p>
                ) : (
                  <div className="mt-1 rounded-md overflow-hidden max-w-48">
                    <Image src={msg.content.value} alt="Immagine inviata" width={200} height={200} className="object-cover" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-2 border-t">
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => imageInputRef.current?.click()}
            disabled={isSending}
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
          <Input
            type="file"
            ref={imageInputRef}
            onChange={handleImageUpload}
            className="hidden"
            accept="image/*"
            disabled={isSending}
          />
          <Input
            placeholder="Scrivi un messaggio..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            disabled={isSending}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSendText} disabled={isSending || !text.trim()}>
            {isSending ? <Loader className="animate-spin" /> : <Send />}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
