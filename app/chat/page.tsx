"use client";
import { useEffect, useState } from "react";
import axios from "axios"; // Add axios for making HTTP requests
import { HubConnection, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { createMessage, decodeToken, fetchMsgHistory, getUnreadMessageCount, markMsgAsRead, startChat } from "../services/apiService";
import { FileAttachment, JWTDTO, MessageFileResponeDTO, ResponseMessageDTO, SectionMessage, UnreadMessageCountDTO } from "../models/messageDto";
import Image from "next/image";

const moduleTypeVideoList = [
    "4A37B38B-B085-4A1C-E337-08DC5940C853",
    "E099EFE7-1D36-483A-A20F-08DC5949B168",
    "492E2948-9100-4ED1-C57B-08DC61DD3B3A"
];

const Chat = () => {
    const [messageUser, setMessageUser] = useState('');
    const [messages, setMessages] = useState<ResponseMessageDTO[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [connection, setConnection] = useState<HubConnection | null>(null);
    const [roomId, setRoomId] = useState('');
    const [newMessagesCount, setNewMessagesCount] = useState(0);
    const [instructorSectionsMsgList, setInstructorSectionsMsgList] = useState<SectionMessage[]>([]);
    const [userItem, setUserItem] = useState<JWTDTO | null>(null);
    const [newMsgCount, setNewMsgCount] = useState<UnreadMessageCountDTO[]>([]);

    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [initialQueryTime, setInitialQueryTime] = useState(new Date());



    useEffect(() => {
        const token = localStorage.getItem('token') || '';
        const decoded = decodeToken(token);
        setUserItem(decoded);

        const initializeConnection = async () => {
            const connection = new HubConnectionBuilder()
                .withUrl(`${process.env.NEXT_PUBLIC_API_URL}/chatHub`, {
                    accessTokenFactory: () => token
                })
                .withAutomaticReconnect()
                .configureLogging(LogLevel.Information)
                .build();

            try {
                await connection.start();
                console.log("Connected!");
                setConnection(connection);
            } catch (error) {
                console.error("Error while connecting to SignalR Hub:", error);
            }

            return connection;
        };

        initializeConnection().then(connection => {
            return () => {
                connection?.stop();
            };
        });
    }, []);

    useEffect(() => {
        if (!connection) return;

        getUnreadMessageCount().then((data) => {
            setNewMsgCount(data || []);
        });

        if (roomId) {
            //ทุกครั้งที่เปลี่ยนห้องแชท
            //โหลดครังแรก SET เวลา ให้เป็นเวลาปัจจุบัน
            var initialDate = new Date();

            try {
                fetchMsgHistory(roomId, 1, 3, initialDate.toISOString()).then((res: any) => {
                    setMessages(res.records);
                    setInitialQueryTime(new Date(res.initialQueryTime));

                    markMsgAsRead(roomId).then((msgUnread) => {
                        setNewMsgCount(msgUnread || []);
                        console.log(msgUnread);
                    });
                });
            } catch (err) {
                console.error("Error retrieving message history:", err);
            }
        }

        if (userItem?.role.toUpperCase() === 'INSTRUCTOR') {
            fetchInstructorSectionsMessage();
        }

        const handleReceiveMessage = (receivedRoomId: string, content: string, sender: string, senderName: string, senderImage: string, sentTime: string, messageFiles: MessageFileResponeDTO[]) => {
            
            if (receivedRoomId.toUpperCase() === roomId.toUpperCase()) {
                
                const newMsg = {
                    chatRoomId: receivedRoomId,
                    senderId: sender,
                    senderName: senderName,
                    senderImage: senderImage,
                    content: content,
                    sentTime: new Date(sentTime),
                    messageFiles: messageFiles
                };

                console.log(newMessage);
                
                // Assuming setMessages updates state within a React component
                setMessages(prevMessages => [...prevMessages, newMsg]);

                //ตั้งค่าการอ่านข้อความเลย
                markMsgAsRead(roomId).then((data) => {
                    setNewMsgCount(data || []);
                    console.log(data);
                });

                //โหลดใหม่ทุกครั้งที่ข้อความเข้าห้อง
                if (userItem?.role.toUpperCase() === 'INSTRUCTOR') {
                    fetchInstructorSectionsMessage();
                }
            }
            else {
                //ทุกครั้งที่มีข้อความเข้า
                getUnreadMessageCount().then((data) => {
                    setNewMsgCount(data || []);
                    console.log(data);
                });

                if (userItem?.role.toUpperCase() === 'INSTRUCTOR') {
                    fetchInstructorSectionsMessage();
                }
            }
        };

        connection.on("ReceiveMessage", handleReceiveMessage);
        return () => {
            connection.off("ReceiveMessage", handleReceiveMessage);
        };
    }, [connection, roomId, userItem?.role]);  // Add dependencies here

    useEffect(() => {
        if (!roomId) return;
        console.log(initialQueryTime.toISOString());
        const loadMessages = async () => {
            setIsLoading(true);
            try {
                //การโหลดหน้าเพิ่มแต่ล่ะครั้งตั้งส่งเวลาครั้งแรก เพื่อรักษาข้อความต่อเนื่อง
                fetchMsgHistory(roomId, page, 3, initialQueryTime.toISOString()).then((res: any) => {
                    //เก็บเวลาปัจจุบันไว้ใน state
                    setInitialQueryTime(new Date(res.initialQueryTime));
                    setMessages(prev => [...prev, ...res.records]);
                    setHasMore(res.totalRecords > messages.length + res.records.length);
                });
            } catch (error) {
                console.error("Failed to fetch messages:", error);
            }
            setIsLoading(false);
        };

        // if (hasMore && !isLoading) {
        loadMessages();
        // }
    }, [page]);

    // Listen to scroll events and calculate when to fetch next page
    // useEffect(() => {
    //     const handleScroll = () => {
    //         if (document.documentElement.scrollTop === 0) {
    //             setPage(prev => prev + 1);
    //         }
    //     };

    //     window.addEventListener('scroll', handleScroll);
    //     return () => window.removeEventListener('scroll', handleScroll);
    // }, []);


    const loadmore = async () => {
        setPage(prev => prev + 1);
    };

    // const handleReceiveMessageUser = (message:string) => {
    //     console.log(message);
    //     setMessageUser(message);
    //     setNewMessagesCount(prev => prev + 1);
    // };

    const fetchInstructorSectionsMessage = async () => {
        var termId = '070F33F2-51C6-4A3D-6622-08DC0FF4C7FB';
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/DirectMessage/${termId}?search=`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            var data = response.data.data;
            setInstructorSectionsMsgList(data);
        } catch (err) {
            console.error("Error retrieving sectionList:", err);
        }
    };

    const sendMessage = async (content: string) => {

        //ตรวจสอบว่า connection ไม่หลุด ก่อนทำการใดๆ
        if (connection && content.trim()) {
            try {
                // Attempt to save the message to the database via API first
                createMessage(roomId, content, []).then(async (res: ResponseMessageDTO | null) => {
                    console.log(res);
                    if (res && res.chatRoomId && res.senderId && res.content && res.sentTime && res.messageFiles) {
                        // Ensures that all necessary data is present
                        try {
                            // Only if the above succeeds, send the message through SignalR
                            await connection.invoke("SendMessage", res.chatRoomId, res.content, res.senderId, res.senderName, res.senderImage, res.sentTime, res.messageFiles);
                            console.log("SignalR message sent successfully.");
                        } catch (error) {
                            console.error("Failed to send message through SignalR:", error);
                        }
                    } else {
                        console.error("Invalid response data received, cannot send message through SignalR.");
                    }
                }).catch(error => {
                    console.error("Error creating message:", error);
                });

                setNewMessage("");

            } catch (error) {
                console.error("Failed to send or save message:", error);
            }
        } else {
            console.log("No connection established or content is empty.");
        }
    };


    const isMyMessage = (messageSender: string) => {
        if (messageSender.toUpperCase() == userItem?.sub.toUpperCase())
            return true;
        else
            return false;
    };

    const startToChat = async (moduleId: string) => {

        //ตรวจสอบว่า connection ไม่หลุด ก่อนทำการใดๆ
        if (connection) {
            // Since startChat is an async function, use await to handle the returned promise
            const data = await startChat(moduleId);
            if (data) {
                console.log(data);

                console.log(data.chatRoomId);
                setRoomId(data.chatRoomId);

                data.userPresences.forEach((userPresence) => {
                    if (userPresence.userId.toUpperCase() == userItem?.sub.toUpperCase()) {
                        connection.invoke('JoinRoom', data.chatRoomId);
                    }
                    else {
                        connection.invoke('AddUserOnlineJoinRoom', userPresence.connectionId, data.chatRoomId);
                    }
                });
            } else {
                console.log("No chat room ID returned or connection error.");
            }
        } else {
            console.error("Connection not established.");
        }
    };

    const getImageSrc = (imagePath: string) => {
        if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
            return imagePath; // Return the same path if it's an absolute URL
        } else {
            return `/${imagePath}`; // Add a leading slash if it's a relative path
        }
    };

    return (
        <div className="p-2 text-xs">
            <div>
                {newMessagesCount > 0 && <p>You have {newMessagesCount} new messages!</p>}
                <h1>Notifications : {messageUser}</h1>
            </div>

            <div className=" grid grid-cols-2 gap-3">
                <div>
                    {userItem?.role.toUpperCase() == 'STUDENT' && (
                        moduleTypeVideoList?.map((moduleId, index) => (

                            <button
                                className="py-2.5 px-5 me-2 mb-2 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700"
                                key={index}
                                onClick={() => startToChat(moduleId)}
                            >
                                MODULE ID : {moduleId}
                                {
                                    newMsgCount.filter(x => x.moduleId.toUpperCase() === moduleId.toUpperCase())
                                        .map(count => ` (${count.unreadCount} new messages)`)
                                }
                            </button>
                        ))
                    )}

                    {instructorSectionsMsgList?.map((sec, index) => (
                        <div key={sec.sectionId}>
                            [ {`${sec.courseCode} ${sec.courseName}`} ]
                            <div className=" ms-10" >
                                {sec.modules.map((module) => (
                                    <div key={module.moduleId}>
                                        {module.moduleName}
                                        <div className=" ms-10 ">
                                            {module.chatRooms.map((room) => (
                                                <div className=" hover:text-blue-700 shadow border p-2 rounded-md mb-1 bg-white" onClick={(e) => setRoomId(room.chatRoomId)} key={room.chatRoomId}>
                                                    <p>ROOM ID : {room.chatRoomId}</p>
                                                    <p>MODULE ID : {module.moduleId}</p>
                                                    <p><b>{room.studentName}</b> {room.lastMessageSentTime}</p>
                                                    <p>{room.lastMessage}</p>
                                                    <b>
                                                        {
                                                            newMsgCount.filter(x => x.chatRoomId.toUpperCase() === room.chatRoomId.toUpperCase())
                                                                .map(count => ` (${count.unreadCount} new messages)`)
                                                        }
                                                    </b>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                    }
                </div>

                <div>

                    {roomId ? (
                        <div>คุณเข้าร่วมห้องแชทหมายเลข {roomId} แล้ว</div>
                    ) : (
                        <div>กรุณาเลือกห้องแชท</div>
                    )}


                    <div>

                        <button onClick={loadmore}>LOADD MORE</button>
                        {/* <input
                    type="text"
                    placeholder="Enter Room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="border p-2 mr-2 rounded"
                /> */}
                        {/* {messages.sort((a, b) =>
                            new Date(b.sentTime).getTime() - new Date(a.sentTime).getTime()
                        ) */}
                        {isLoading && <p>Loading more messages...</p>}
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex items-center p-2 my-2 rounded ${isMyMessage(msg.senderId) ? "bg-[#06C755]" : "bg-gray-200"}`}>
                                <div className="flex-none w-8 h-8"> {/* Adjust width and height as needed */}
                                    <img
                                        src={getImageSrc(msg.senderImage)}
                                        width={50}
                                        height={50}
                                        alt="User Avatar" // Replace with a meaningful alt text specific to your application
                                        className="rounded-full" // Assuming you want rounded images
                                    />
                                </div>
                                <div className="ml-2 flex-grow"> {/* Text content with left margin */}
                                    <p className="text-sm font-medium">{msg.senderName}</p> {/* Add styling for text size and weight */}
                                    <p className="text-xs">{msg.content}</p>
                                    <p className="text-xs">{new Date(msg.sentTime).toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="d-flex justify-row sticky bottom-0 mt-2">
                        <input
                            type="text"
                            className="border p-2 mr-2 rounded w-[300px]"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    sendMessage(newMessage);
                                    e.preventDefault();
                                }
                            }}
                        />
                        <button onClick={() => sendMessage(newMessage)} className="bg-blue-500 text-white p-2 rounded">
                            Send Message
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Chat;
