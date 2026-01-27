// pages/Messages.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    addDoc,
    serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase/firebase';
import { FaSearch, FaPaperPlane, FaTrash, FaEnvelopeOpen, FaSpinner, FaPlus } from 'react-icons/fa';
import '../styles/messages.css';
import MessageModal from '../components/dashboard/MessageModal';

const Messages = () => {
    const [messages, setMessages] = useState([]);
    const [selectedSender, setSelectedSender] = useState(null);
    const [conversation, setConversation] = useState([]);
    const [replyText, setReplyText] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadingConversation, setLoadingConversation] = useState(false);
    const [sendingReply, setSendingReply] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uniqueSenders, setUniqueSenders] = useState([]);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    // State for Sidebar Lists
    const [incomingMsgsList, setIncomingMsgsList] = useState([]);
    const [outgoingMsgsList, setOutgoingMsgsList] = useState([]);

    // 1. Listeners for Sidebar (Global Inbox/Outbox)
    useEffect(() => {
        const qIncoming = query(
            collection(db, 'messages'),
            where('recipientId', '==', 'admin'),
            where('recipientType', '==', 'admin'),
            orderBy('createdAt', 'desc')
        );

        const qOutgoing = query(
            collection(db, 'messages'),
            where('senderId', '==', 'admin'),
            orderBy('createdAt', 'desc')
        );

        const unsubIncoming = onSnapshot(qIncoming, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setIncomingMsgsList(msgs);
        });

        const unsubOutgoing = onSnapshot(qOutgoing, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOutgoingMsgsList(msgs);
        });

        return () => {
            unsubIncoming();
            unsubOutgoing();
        };
    }, []);

    // 1b. Merge Sidebar Lists when state updates
    useEffect(() => {
        const mergeAndGroup = () => {
            const all = [...incomingMsgsList, ...outgoingMsgsList];
            // Sort by createdAt desc for the list preview
            all.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
                return dateB - dateA;
            });

            // Group messages by conversation partner
            const groups = {};

            all.forEach(msg => {
                let otherId, otherName;

                if (msg.senderId === 'admin') {
                    otherId = msg.recipientId;
                    otherName = msg.recipientName || 'Unknown User';
                } else {
                    otherId = msg.senderId;
                    otherName = msg.sender || 'Unknown User';
                }

                // Skip if no ID
                if (!otherId) return;

                if (!groups[otherId]) {
                    groups[otherId] = {
                        senderId: otherId, // acts as conversation ID
                        senderName: otherName,
                        lastMessage: msg,
                        unreadCount: 0,
                        messages: []
                    };
                }

                groups[otherId].messages.push(msg);

                // Update unread count (only for incoming)
                if (!msg.read && msg.recipientId === 'admin') {
                    groups[otherId].unreadCount++;
                }

                // Keep track of latest message
                const currentLastDate = groups[otherId].lastMessage.createdAt?.toDate
                    ? groups[otherId].lastMessage.createdAt.toDate()
                    : new Date(0);
                const msgDate = msg.createdAt?.toDate
                    ? msg.createdAt.toDate()
                    : new Date(0);

                if (msgDate > currentLastDate) {
                    groups[otherId].lastMessage = msg;
                }
            });

            const conversationList = Object.values(groups);
            conversationList.sort((a, b) => {
                const dateA = a.lastMessage.createdAt?.toDate ? a.lastMessage.createdAt.toDate() : new Date(0);
                const dateB = b.lastMessage.createdAt?.toDate ? b.lastMessage.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });

            setMessages(all);
            setUniqueSenders(conversationList);
            setLoading(false);
        };

        mergeAndGroup();
    }, [incomingMsgsList, outgoingMsgsList]);

    // 2. SINGLE REAL-TIME LISTENER FOR CONVERSATION (FIXED VERSION)
    useEffect(() => {
        // Reset conversation state immediately
        setConversation([]);
        setLoadingConversation(true);

        if (!selectedSender) {
            setLoadingConversation(false);
            return;
        }

        console.log("Setting up REAL-TIME conversation listener for:", selectedSender.senderId);
        
        const relatedUserId = selectedSender.senderId;

        // Create a single query that gets ALL messages between admin and this user
        const conversationQuery = query(
            collection(db, 'messages'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(conversationQuery, (snapshot) => {
            console.log("🔥 Conversation listener triggered, total docs:", snapshot.docs.length);
            
            const allMessages = [];
            
            snapshot.docs.forEach(doc => {
                const messageData = doc.data();
                
                // Filter messages to only show conversation between admin and this user
                const isFromUserToAdmin = messageData.senderId === relatedUserId && 
                                          messageData.recipientId === 'admin';
                const isFromAdminToUser = messageData.senderId === 'admin' && 
                                          messageData.recipientId === relatedUserId;
                
                if (isFromUserToAdmin || isFromAdminToUser) {
                    console.log("📨 Adding message to conversation:", {
                        id: doc.id,
                        senderId: messageData.senderId,
                        message: messageData.message?.substring(0, 50),
                        timestamp: messageData.createdAt
                    });
                    
                    allMessages.push({
                        id: doc.id,
                        ...messageData,
                        direction: messageData.senderId === 'admin' ? 'outgoing' : 'incoming'
                    });

                    // Mark incoming messages as read
                    if (isFromUserToAdmin && !messageData.read) {
                        console.log("📖 Marking message as read:", doc.id);
                        updateDoc(doc.ref, { read: true }).catch(console.error);
                    }
                }
            });

            // Sort by timestamp
            allMessages.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return dateA - dateB;
            });

            console.log("✅ Final conversation messages:", allMessages.length);
            setConversation(allMessages);
            setLoadingConversation(false);
            
            // Scroll to bottom
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }, (error) => {
            console.error("❌ Error in conversation listener:", error);
            setLoadingConversation(false);
        });

        // Cleanup function
        return () => {
            console.log("🧹 Cleaning up conversation listener");
            unsubscribe();
        };
    }, [selectedSender]);

    // Remove the old 2b useEffect entirely since we don't need it anymore
    // (The single listener above handles everything)

    // Auto-scroll to bottom when conversation updates
    useEffect(() => {
        scrollToBottom();
    }, [conversation]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSelectConversation = (sender) => {
        console.log("Selecting conversation with:", sender.senderName);
        setSelectedSender(sender);

        // Update unread count for this sender
        setUniqueSenders(prev => prev.map(s =>
            s.senderId === sender.senderId
                ? { ...s, unreadCount: 0 }
                : s
        ));
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedSender) {
            alert("Please enter a message and select a conversation");
            return;
        }

        console.log("Sending reply to:", selectedSender.senderName);
        setSendingReply(true);

        // OPTIMISTIC UPDATE: Create temporary message for immediate UI display
        const tempMessageId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempMessageId,
            recipientId: selectedSender.senderId,
            recipientName: selectedSender.senderName,
            recipientType: 'tenant',
            recipientEmail: '',
            subject: selectedSender.lastMessage.subject ? `Re: ${selectedSender.lastMessage.subject}` : 'Reply',
            message: replyText.trim(),
            sender: 'Admin',
            senderId: 'admin',
            status: 'sending', // Temporary status
            createdAt: new Date(), // Use client timestamp for immediate display
            read: false,
            direction: 'outgoing', // Explicitly set direction for optimistic update
            isOptimistic: true // Flag to identify optimistic messages
        };

        // Add to conversation immediately for instant UI update
        setConversation(prev => [...prev, optimisticMessage]);
        
        // Save the message text before clearing
        const messageToSend = replyText;
        
        // Clear reply text immediately
        setReplyText("");

        try {
            const newMessage = {
                recipientId: selectedSender.senderId,
                recipientName: selectedSender.senderName,
                recipientType: 'tenant',
                recipientEmail: '',
                subject: selectedSender.lastMessage.subject ? `Re: ${selectedSender.lastMessage.subject}` : 'Reply',
                message: messageToSend.trim(),
                sender: 'Admin',
                senderId: 'admin',
                status: 'sent',
                createdAt: serverTimestamp(),
                read: false
            };

            console.log("Saving message to Firestore:", newMessage);

            // Save to global messages collection
            const docRef = await addDoc(collection(db, 'messages'), newMessage);
            console.log("Message saved with ID:", docRef.id);

            // When Firestore save succeeds, replace optimistic message with real one
            setConversation(prev => prev.map(msg => 
                msg.id === tempMessageId 
                    ? {
                        ...msg,
                        id: docRef.id,
                        status: 'sent',
                        isOptimistic: false,
                        createdAt: newMessage.createdAt // Keep server timestamp
                    }
                    : msg
            ));

            // Also save to recipient's subcollection (optional)
            try {
                await addDoc(
                    collection(db, 'users', selectedSender.senderId, 'messages'),
                    {
                        ...newMessage,
                        messageId: docRef.id,
                        receivedAt: serverTimestamp()
                    }
                );
                console.log("Message saved to user's subcollection");
            } catch (subcollectionError) {
                console.warn("Could not save to user subcollection:", subcollectionError);
            }

            console.log("Message sent successfully.");

            // Focus textarea for next message
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                }
            }, 100);

        } catch (error) {
            console.error("Error sending reply:", error);
            
            // Mark optimistic message as failed
            setConversation(prev => prev.map(msg => 
                msg.id === tempMessageId 
                    ? { ...msg, status: 'failed', error: error.message }
                    : msg
            ));
            
            // Restore the message text for retry
            setReplyText(messageToSend);
            
            alert(`Failed to send reply: ${error.message}`);
        } finally {
            setSendingReply(false);
        }
    };

    const handleDeleteMessage = async (msgId) => {
        if (window.confirm("Are you sure you want to delete this message?")) {
            alert("Delete functionality will be implemented in the next update.");
        }
    };

    const filteredSenders = uniqueSenders.filter(sender =>
        sender.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sender.lastMessage.message || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sender.lastMessage.subject || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Format date helper
    const formatDate = (timestamp) => {
        if (!timestamp) return 'Recently';
        if (timestamp.toDate) {
            const date = timestamp.toDate();
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        return 'Recently';
    };

    // Format time for chat bubbles
    const formatChatTime = (timestamp) => {
        if (!timestamp) return '';
        
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            return '';
        }
        
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="messages-container">
            <div className="messages-header">
                <h1>Messages</h1>
                <button
                    className="new-message-btn"
                    onClick={() => setIsModalOpen(true)}
                    type="button"
                >
                    <FaPlus /> New Message
                </button>
            </div>

            <MessageModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

            <div className="messages-content">
                {/* CONVERSATIONS LIST SIDEBAR */}
                <div className="messages-list">
                    <div className="list-header">
                        <div className="search-box">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                    <div className="messages-scroll">
                        {loading ? (
                            <div className="loading-state">
                                <FaSpinner className="spin" /> Loading conversations...
                            </div>
                        ) : filteredSenders.length === 0 ? (
                            <div className="empty-state">
                                <FaEnvelopeOpen />
                                <p>No conversations found</p>
                            </div>
                        ) : (
                            filteredSenders.map((sender) => (
                                <div
                                    key={sender.senderId}
                                    className={`message-item ${selectedSender?.senderId === sender.senderId ? 'active' : ''
                                        } ${sender.unreadCount > 0 ? 'unread' : ''}`}
                                    onClick={() => handleSelectConversation(sender)}
                                >
                                    <div className="message-item-header">
                                        <span className="sender-name">{sender.senderName}</span>
                                        <span className="message-date">
                                            {formatDate(sender.lastMessage.createdAt)}
                                        </span>
                                    </div>
                                    <div className="message-subject">
                                        {sender.lastMessage.subject || 'No Subject'}
                                    </div>
                                    <div className="message-preview">
                                        {sender.lastMessage.message ?
                                            (sender.lastMessage.message.substring(0, 60) +
                                                (sender.lastMessage.message.length > 60 ? '...' : ''))
                                            : 'No message content'
                                        }
                                    </div>
                                    {sender.unreadCount > 0 && (
                                        <div className="unread-badge">{sender.unreadCount}</div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* CHAT DETAIL PANEL */}
                <div className="message-detail">
                    {selectedSender ? (
                        <>
                            <div className="detail-header">
                                <div className="detail-info">
                                    <h2>{selectedSender.senderName}</h2>
                                    <div className="detail-meta">
                                        <span className="subject">{selectedSender.lastMessage.subject || 'No Subject'}</span>
                                        <span className="message-date">
                                            {selectedSender.lastMessage.createdAt?.toDate
                                                ? selectedSender.lastMessage.createdAt.toDate().toLocaleString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })
                                                : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="detail-actions">
                                    <button
                                        className="action-btn delete-btn"
                                        onClick={() => handleDeleteMessage(selectedSender.lastMessage.id)}
                                        title="Delete conversation"
                                        type="button"
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>

                            <div className="chat-content">
                                {loadingConversation ? (
                                    <div className="loading-spinner">
                                        <FaSpinner className="spin" /> Loading chat history...
                                    </div>
                                ) : conversation.length === 0 ? (
                                    <div className="empty-chat">
                                        <p>No messages yet. Start the conversation!</p>
                                    </div>
                                ) : (
                                    <div className="chat-messages">
                                        {conversation.map((msg, index) => {
                                            const isAdmin = msg.senderId === 'admin';
                                            const isOptimistic = msg.isOptimistic;
                                            const isSending = msg.status === 'sending';
                                            const isFailed = msg.status === 'failed';
                                            const messageTime = msg.createdAt;

                                            return (
                                                <div
                                                    key={msg.id || index}
                                                    className={`chat-bubble ${isAdmin ? 'admin-bubble' : 'user-bubble'} 
                                                        ${isOptimistic ? 'optimistic-bubble' : ''}
                                                        ${isSending ? 'sending-bubble' : ''}
                                                        ${isFailed ? 'failed-bubble' : ''}`}
                                                >
                                                    <div className="bubble-content">
                                                        {msg.message}
                                                        {isSending && (
                                                            <span className="sending-indicator">
                                                                <FaSpinner className="spin-small" />
                                                            </span>
                                                        )}
                                                        {isFailed && (
                                                            <span className="failed-indicator">Failed to send</span>
                                                        )}
                                                    </div>
                                                    <div className="bubble-meta">
                                                        <span className="sender">
                                                            {isAdmin ? 'You' : msg.sender || 'User'}
                                                            {isOptimistic && ' (Sending...)'}
                                                        </span>
                                                        <span className="time">
                                                            {formatChatTime(messageTime)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            <div className="reply-section">
                                <div className="reply-input-wrapper">
                                    <textarea
                                        ref={textareaRef}
                                        className="reply-input"
                                        placeholder="Type your reply here..."
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        rows="3"
                                        disabled={sendingReply}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey && !sendingReply) {
                                                e.preventDefault();
                                                handleSendReply();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="reply-actions">
                                    <button
                                        className="send-reply-btn"
                                        onClick={handleSendReply}
                                        disabled={sendingReply || !replyText.trim()}
                                        type="button"
                                    >
                                        {sendingReply ? (
                                            <>
                                                <FaSpinner className="spin" /> Sending...
                                            </>
                                        ) : (
                                            <>
                                                <FaPaperPlane /> Send
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="empty-selection">
                            <FaEnvelopeOpen className="empty-icon" />
                            <h3>Select a conversation to start chatting</h3>
                            <p>Choose a user from the list to view and reply to messages</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Messages;