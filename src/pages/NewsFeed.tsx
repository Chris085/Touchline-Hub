import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  increment,
  getDocs,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Heart, 
  Send, 
  Trash2, 
  Plus, 
  X, 
  Image as ImageIcon,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  User,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ConfirmModal } from '../components/ConfirmModal';
import { triggerNotification } from '../lib/notifications';

interface NewsPost {
  id: string;
  teamId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
}

interface NewsComment {
  id: string;
  postId: string;
  teamId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export function NewsFeed() {
  const { profile, isSubscribed, isAdmin } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const isCoach = profile?.role === 'coach' || isAdmin;
  const [isCreating, setIsCreating] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});
  const [activeComments, setActiveComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, NewsComment[]>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!profile?.teamId) return;

    const q = query(
      collection(db, 'newsPosts'),
      where('teamId', '==', profile.teamId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsPost[];
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching posts:", error);
      setLoading(false);
    });

    // Fetch user likes
    const likesQuery = query(
      collection(db, 'newsLikes'),
      where('teamId', '==', profile.teamId),
      where('userId', '==', profile.uid)
    );

    const unsubscribeLikes = onSnapshot(likesQuery, (snapshot) => {
      const likes: Record<string, boolean> = {};
      snapshot.docs.forEach(doc => {
        likes[doc.data().postId] = true;
      });
      setUserLikes(likes);
    });

    return () => {
      unsubscribe();
      unsubscribeLikes();
    };
  }, [profile?.teamId, profile?.uid]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newPostContent.trim() || !isSubscribed) return;

    try {
      await addDoc(collection(db, 'newsPosts'), {
        teamId: profile.teamId,
        authorId: profile.uid,
        authorName: profile.displayName || 'Anonymous',
        authorRole: isAdmin ? 'admin' : (profile.role || 'parent'),
        content: newPostContent.trim(),
        imageUrl: newPostImage,
        createdAt: new Date().toISOString(),
        likesCount: 0,
        commentsCount: 0
      });

      // Trigger Notification
      await triggerNotification({
        teamId: profile.teamId,
        title: 'New Team News',
        body: `${profile.displayName} posted: ${newPostContent.slice(0, 50)}${newPostContent.length > 50 ? '...' : ''}`,
        data: { type: 'new_news' }
      });

      setNewPostContent('');
      setNewPostImage(null);
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating post:", error);
    }
  };

  const handleLike = async (postId: string) => {
    if (!profile || !isSubscribed) return;

    const isLiked = userLikes[postId];
    const likeId = `${profile.uid}_${postId}`;

    try {
      if (isLiked) {
        await deleteDoc(doc(db, 'newsLikes', likeId));
        await updateDoc(doc(db, 'newsPosts', postId), {
          likesCount: increment(-1)
        });
      } else {
        await setDoc(doc(db, 'newsLikes', likeId), {
          postId,
          userId: profile.uid,
          teamId: profile.teamId
        });
        await updateDoc(doc(db, 'newsPosts', postId), {
          likesCount: increment(1)
        });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const toggleComments = (postId: string) => {
    if (activeComments === postId) {
      setActiveComments(null);
    } else {
      setActiveComments(postId);
      fetchComments(postId);
    }
  };

  const fetchComments = (postId: string) => {
    if (!profile?.teamId) return;

    const q = query(
      collection(db, 'newsComments'),
      where('postId', '==', postId),
      where('teamId', '==', profile.teamId),
      orderBy('createdAt', 'asc')
    );

    onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsComment[];
      setComments(prev => ({ ...prev, [postId]: commentsData }));
    }, (error) => {
      console.error("Error fetching comments:", error);
    });
  };

  const handleAddComment = async (postId: string, content: string) => {
    if (!profile || !content.trim() || !isSubscribed) return;

    try {
      await addDoc(collection(db, 'newsComments'), {
        postId,
        teamId: profile.teamId,
        authorId: profile.uid,
        authorName: profile.displayName || 'Anonymous',
        content: content.trim(),
        createdAt: new Date().toISOString()
      });

      // Trigger Notification (to post author)
      const postDoc = await getDoc(doc(db, 'newsPosts', postId));
      const postData = postDoc.data();
      if (postData && postData.authorId !== profile.uid) {
        await triggerNotification({
          recipientIds: [postData.authorId],
          title: 'New Comment on your post',
          body: `${profile.displayName} commented: ${content.slice(0, 50)}`,
          data: { type: 'new_comment', postId }
        });
      }

      await updateDoc(doc(db, 'newsPosts', postId), {
        commentsCount: increment(1)
      });
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'newsPosts', postId));
      setConfirmDelete(null);
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const toggleExpand = (postId: string) => {
    setExpandedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        setNewPostImage(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white tracking-tight">Team Feed</h1>
        {isCoach && (
          <button
            onClick={() => {
              if (!isSubscribed) {
                window.location.href = '/upgrade';
                return;
              }
              setIsCreating(true);
            }}
            className={`flex items-center gap-2 ${isSubscribed ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20' : 'bg-slate-700 hover:bg-slate-600 shadow-none'} text-slate-950 px-4 py-2 rounded-lg font-bold transition-colors shadow-lg`}
          >
            {isSubscribed ? <Plus size={20} /> : <Zap size={16} />}
            <span>{isSubscribed ? 'Post News' : 'Upgrade to Post'}</span>
          </button>
        )}
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">New Post</h2>
                <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreatePost} className="p-4 space-y-4">
                <textarea
                  autoFocus
                  placeholder="What's the news?"
                  className="w-full bg-slate-800 border-none rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-green-500 min-h-[150px] resize-none"
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                />
                
                {newPostImage && (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700">
                    <img src={newPostImage} alt="Preview" className="w-full h-auto" />
                    <button
                      type="button"
                      onClick={() => setNewPostImage(null)}
                      className="absolute top-2 right-2 p-1 bg-slate-900/80 rounded-full text-white hover:bg-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-slate-400 hover:text-green-400 cursor-pointer transition-colors">
                    <ImageIcon size={20} />
                    <span className="text-sm font-medium">Add Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                  <button
                    type="submit"
                    disabled={!newPostContent.trim()}
                    className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:hover:bg-green-500 text-slate-950 px-6 py-2 rounded-lg font-bold transition-colors"
                  >
                    Post
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
            <MessageSquare size={48} className="mx-auto text-slate-700 mb-4" />
            <p className="text-slate-500">No news yet. Coaches can start the conversation!</p>
          </div>
        ) : (
          posts.map((post) => {
            const isExpanded = expandedPosts[post.id];
            
            return (
              <motion.article
                layout
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm"
              >
                <div 
                  className="p-4 flex items-start justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                  onClick={() => toggleExpand(post.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-green-400">
                      <User size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{post.authorName}</span>
                        <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {post.authorRole === 'admin' ? 'Admin' : post.authorRole}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(post.createdAt))} ago
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {profile?.uid === post.authorId && (
                      <button
                        onClick={() => setConfirmDelete(post.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpand(post.id)}
                      className="text-slate-400 hover:text-white transition-colors p-1"
                    >
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-4">
                        <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                        {post.imageUrl && (
                          <div className="rounded-xl overflow-hidden border border-slate-800">
                            <img src={post.imageUrl} alt="Post content" className="w-full h-auto" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>

                      <div className="px-4 py-3 border-t border-slate-800 flex items-center gap-6">
                        <button
                          onClick={() => handleLike(post.id)}
                          className={`flex items-center gap-2 transition-colors ${
                            userLikes[post.id] ? 'text-red-500' : 'text-slate-400 hover:text-red-400'
                          }`}
                        >
                          <Heart size={20} fill={userLikes[post.id] ? 'currentColor' : 'none'} />
                          <span className="text-sm font-bold">{post.likesCount || 0}</span>
                        </button>
                        <button
                          onClick={() => toggleComments(post.id)}
                          className={`flex items-center gap-2 transition-colors ${
                            activeComments === post.id ? 'text-green-400' : 'text-slate-400 hover:text-green-400'
                          }`}
                        >
                          <MessageSquare size={20} />
                          <span className="text-sm font-bold">{post.commentsCount || 0}</span>
                        </button>
                      </div>

                      <AnimatePresence>
                        {activeComments === post.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-slate-950/50 border-t border-slate-800"
                          >
                            <div className="p-4 space-y-4">
                              {comments[post.id]?.map((comment) => (
                                <div key={comment.id} className="flex gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                                    <User size={16} />
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-bold text-white">{comment.authorName}</span>
                                      <span className="text-[10px] text-slate-500">
                                        {formatDistanceToNow(new Date(comment.createdAt))} ago
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-300">{comment.content}</p>
                                  </div>
                                </div>
                              ))}
                              
                              <CommentInput onSend={(content) => handleAddComment(post.id, content)} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        onConfirm={() => confirmDelete && handleDeletePost(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function CommentInput({ onSend }: { onSend: (content: string) => void }) {
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSend(content);
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        placeholder="Write a comment..."
        className="flex-1 bg-slate-800 border-none rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-green-500"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button
        type="submit"
        disabled={!content.trim()}
        className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-slate-950 p-2 rounded-lg transition-colors"
      >
        <Send size={18} />
      </button>
    </form>
  );
}
