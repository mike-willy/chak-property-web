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

    // State for Conversation Detail
    const [chatIncoming, setChatIncoming] = useState([]);
    const [chatOutgoing, setChatOutgoing] = useState([]);

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

    // 2. Listeners for Conversation Detail
    useEffect(() => {
        // CLEANUP: Reset conversation state immediately when switching users
        setChatIncoming([]);
        setChatOutgoing([]);
        setConversation([]);

        if (!selectedSender) {
            return;
        }

        console.log("Setting up conversation listener for:", selectedSender.senderId);
        setLoadingConversation(true);

        const relatedUserId = selectedSender.senderId;

        const q1 = query(
            collection(db, 'messages'),
            where('senderId', '==', relatedUserId),
            where('recipientId', '==', 'admin'),
            where('recipientType', '==', 'admin'),
            orderBy('createdAt', 'asc')
        );

        const q2 = query(
            collection(db, 'messages'),
            where('senderId', '==', 'admin'),
            where('recipientId', '==', relatedUserId),
            orderBy('createdAt', 'asc')
        );

        const unsub1 = onSnapshot(q1, (snapshot) => {
            const incomingMsgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                direction: 'incoming'
            }));

            // Mark as read
            snapshot.docs.forEach(doc => {
                if (!doc.data().read && doc.data().recipientId === 'admin') {
                    updateDoc(doc.ref, { read: true }).catch(console.error);
                }
            });

            setChatIncoming(incomingMsgs);
        });

        const unsub2 = onSnapshot(q2, (snapshot) => {
            const outgoingMsgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                direction: 'outgoing'
            }));
            setChatOutgoing(outgoingMsgs);
        });

        // Set loading false once listeners attach
        setLoadingConversation(false);

        return () => {
            unsub1();
            unsub2();
        };
    }, [selectedSender]);

    // 2b. Merge Conversation Lists
    useEffect(() => {
        if (!selectedSender) return;

        const allChats = [...chatIncoming, ...chatOutgoing].sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
            return dateA - dateB;
        });

        setConversation(allChats);

        // Scroll on update
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

    }, [chatIncoming, chatOutgoing, selectedSender]);

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

        try {
            const newMessage = {
                recipientId: selectedSender.senderId,
                recipientName: selectedSender.senderName,
                recipientType: 'tenant',
                recipientEmail: '',
                subject: selectedSender.lastMessage.subject ? `Re: ${selectedSender.lastMessage.subject}` : 'Reply',
                message: replyText.trim(),
                sender: 'Admin',
                senderId: 'admin',
                status: 'sent',
                createdAt: serverTimestamp(),
                read: false,
                originalMessageId: selectedSender.lastMessage.id
            };

            console.log("Saving message to Firestore:", newMessage);

            // Save to global messages collection
            const docRef = await addDoc(collection(db, 'messages'), newMessage);
            console.log("Message saved with ID:", docRef.id);

            // Also save to recipient's subcollection
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

            // Clear reply text
            setReplyText("");

            console.log("Message sent successfully. Waiting for listener update...");

            // Focus textarea for next message
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                }
            }, 100);

        } catch (error) {
            console.error("Error sending reply:", error);
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
                                            const messageTime = msg.createdAt?.toDate
                                                ? msg.createdAt.toDate()
                                                : new Date();

                                            return (
                                                <div
                                                    key={msg.id || index}
                                                    className={`chat-bubble ${isAdmin ? 'admin-bubble' : 'user-bubble'}`}
                                                >
                                                    <div className="bubble-content">
                                                        {msg.message}
                                                    </div>
                                                    <div className="bubble-meta">
                                                        <span className="sender">
                                                            {isAdmin ? 'You' : msg.sender || 'User'}
                                                        </span>
                                                        <span className="time">
                                                            {messageTime.toLocaleTimeString([], {
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
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