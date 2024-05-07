// services/apiService.ts
import { HubConnection } from '@microsoft/signalr';
import axios from 'axios';
import { FileAttachment, ResponseMessageDTO, ResponeMessageHistory, ResponseRoomMember, UnreadMessageCountDTO } from '../models/messageDto';

interface ChatMessage {
    receiverUserName: string;
    message: string;
    senderUserName: string;
}

export const createMessage = async (roomId: string, content: string, attachments: Array<FileAttachment> | []): Promise<ResponseMessageDTO | null> => {
    if (content.trim()) {
        const token = localStorage.getItem('token');
        const url = `${process.env.NEXT_PUBLIC_API_URL}/client/v1/DirectMessage/send`;
        const data = JSON.stringify({
            'chatRoomId': roomId,
            'content': content,
            'attachments': attachments
        });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'  // Ensure you set Content-Type as application/json
                },
                body: data
            });

            const result = await response.json();
            console.log('Message sent successfully:', result.data);
            return result.data;
        } catch (error: any) {
            console.error('Error sending message:', error.message);  // Corrected to `error.message` for standard error object
            return null;
        }
    } else {
        return null;  // If content is empty after trim, return null
    }
};


export const startChat = async (moduleId: string): Promise<ResponseRoomMember | null> => {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/client/v1/DirectMessage/start-chat/${moduleId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        console.log('Connected rooms data:', result);

        if (result.data && result.data.chatRoomId && result.data.userPresences) {
            return {
                chatRoomId: result.data.chatRoomId,
                userPresences: result.data.userPresences
            } as ResponseRoomMember;
        }

        return null;
    } catch (error) {
        console.error('Error connecting to chat:', error);
        return null;
    }
};


export const fetchMsgHistory = async (chatRoomId: string, pageNumber: number, pageSize: number, initialQueryTime: string): Promise<ResponeMessageHistory | null> => {
    const token = localStorage.getItem('token');
    const url = `${process.env.NEXT_PUBLIC_API_URL}/client/v1/DirectMessage/history/${chatRoomId}?pageNumber=${pageNumber}&pageSize=${pageSize}&initialQueryTime=${initialQueryTime}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'  // Ensure to include Content-Type header
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();  // Assuming the server responds with JSON
        console.log('Fetch message history successfully:', result);
        return result.data;  // Adjust this if the data structure is different
    } catch (error: any) {
        console.error('Error fetching message history:', error);
        return null;
    }
};


export const getUnreadMessageCount = async (): Promise<UnreadMessageCountDTO[] | null> => {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/client/v1/DirectMessage/unread-count`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        console.log('Get unread message count successfully.:', response);
        return result.data;
    } catch (error) {
        console.error('Error get unread message count:', error);
        return null;
    }
};

export const markMsgAsRead = async (chatRoomId: string): Promise<UnreadMessageCountDTO[] | null> => {
    const token = localStorage.getItem('token');
    const url = `${process.env.NEXT_PUBLIC_API_URL}/client/v1/DirectMessage/mark-as-read/${chatRoomId}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        console.log('Mark message as read successfully.:', response);
        return result.data;
    } catch (error: any) {
        console.error('Error Mark message as read:', error);
        return null;
    }
};

export function decodeToken(token: string): any {
    try {
        const base64Url = token.split('.')[1]; // Get the payload part
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/'); // Convert Base64Url to Base64
        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Failed to decode token:", e);
        return null;
    }
};