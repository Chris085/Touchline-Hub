import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  User, 
  Shield, 
  MessageSquare,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';

interface ChatMessage {
  id: string;
  teamId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: string;
}

export function TeamChat() {
  const { profile, loading: authLoading, isSubscribed } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    if (!profile?.teamId) return;

    const q = query(
      collection(db, 'chatMessages'),
      where('teamId', '==', profile.teamId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      
      // Reverse to show oldest at top
      setMessages(messagesData.reverse());
      setLoading(false);
      scrollToBottom();
    }, (error) => {
      console.error("Error fetching messages:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.teamId]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior
      });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setShowScrollButton(!isAtBottom);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newMessage.trim() || !isSubscribed) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'chatMessages'), {
        teamId: profile.teamId,
        senderId: profile.uid,
        senderName: profile.displayName || 'Anonymous',
        senderRole: profile.role,
        content: messageContent,
        createdAt: new Date().toISOString()
      });
      scrollToBottom();
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Trial Expired Overlay */}
      {!isSubscribed && (
        <div className="absolute inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-2xl max-w-sm space-y-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
              <Shield size={32} />
            </div>
            <h3 className="text-xl font-bold text-white">Trial Expired</h3>
            <p className="text-slate-400 text-sm">Your trial has ended. Please upgrade to a paid plan to continue sending messages and adding new content.</p>
            <button 
              onClick={() => window.location.href = '/upgrade'}
              className="w-full py-3 bg-green-500 hover:bg-green-400 text-slate-950 font-bold rounded-xl transition-all"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 border border-green-500/20">
            <MessageSquare size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Team Chat</h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">All members</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <MessageSquare size={48} className="text-slate-700" />
            <p className="text-slate-500 max-w-xs">No messages yet. Start the conversation with your team!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isMe = message.senderId === profile?.uid;
            const showHeader = index === 0 || messages[index - 1].senderId !== message.senderId;
            
            return (
              <div 
                key={message.id} 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${showHeader ? 'mt-2' : 'mt-1'}`}
              >
                {showHeader && (
                  <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-xs font-bold text-slate-400">{message.senderName}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-tighter px-1 rounded border ${
                      message.senderRole === 'coach' 
                        ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {message.senderRole}
                    </span>
                  </div>
                )}
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                  isMe 
                    ? 'bg-green-500 text-slate-950 font-medium rounded-tr-none' 
                    : 'bg-slate-800 text-slate-200 rounded-tl-none'
                }`}>
                  {message.content}
                </div>
                {showHeader && (
                  <span className="text-[10px] text-slate-600 mt-1 px-1">
                    {format(new Date(message.createdAt), 'HH:mm')}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Scroll to Bottom Button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white p-2 rounded-full shadow-lg border border-slate-700 hover:bg-slate-700 transition-colors z-10"
          >
            <ChevronDown size={20} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Message Input */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 bg-slate-800 border-none rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-green-500 transition-all"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:hover:bg-green-500 text-slate-950 p-3 rounded-xl font-bold transition-all shadow-lg shadow-green-500/20"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
