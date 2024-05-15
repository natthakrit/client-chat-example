"use client";
import { useEffect, useRef, useState } from "react";
import axios from "axios"; // Add axios for making HTTP requests
import { HubConnection, HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { checkUserOnline, createMessage, decodeToken, fetchMsgHistory, getUnreadMessageCount, markMsgAsRead, startChat } from "../services/apiService";
import { ChatRoomdetails, FileAttachment, JWTDTO, MessageFileResponeDTO, ResponseMessageDTO, SectionMessage, UnreadMessageCountDTO } from "../models/messageDto";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

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
    const [totalRecords, setTotalRecords] = useState(0);
    const [isOnline, setIsOnline] = useState(false);

    const scrollDivRef = useRef(null);  // Create a ref for the div

    const pageSize = 20;

    const [selectedChatRoomData, setSelectedChatRoomData] = useState<ChatRoomdetails | null>(null);


    const router = useRouter();

    const searchParams = useSearchParams();

    // เลื่อนไปยังตำแหน่งล่างสุด
    const scrollToBottom = () => {
        setTimeout(() => {
            if (scrollDivRef.current) {
                scrollDivRef.current.scrollTop = scrollDivRef.current.scrollHeight;
            }
        }, 100); // ให้เวลาสำหรับ DOM ในการอัปเดต
    };

    // เลื่อนไปยังตำแหน่งกลางจอ
    const scrollToCenter = () => {
        // เลื่อนไปยังตำแหน่งกลางหลังจากโหลดข้อมูล
        setTimeout(() => {
            if (scrollDivRef.current) {
                const scrollHeight = scrollDivRef.current.scrollHeight;
                const height = scrollDivRef.current.clientHeight;
                scrollDivRef.current.scrollTop = (scrollHeight - height) / 2;
            }
        }, 100); // ค่า timeout สามารถปรับเปลี่ยนได้ตามความจำเป็น
    };


    // ฟังก์ชันการเล่นเสียง
    const playNotificationSound = () => {
        const audio = new Audio('/audios/mixkit-long-pop-2358.wav');
        audio.play();
    };


    useEffect(() => {
        // ดึงค่า id ของห้อง หากมีการรีเฟรชหน้าใหม่ เก็บไว้ใน state เพื่อเรียกใช้ดึงค่าพื้นฐานตามต้องการ
        const chatRoomId = searchParams.get('r');
        if (chatRoomId) {
            setRoomId(chatRoomId);
        }

        const token = localStorage.getItem('token') || '';
        const decoded = decodeToken(token);
        setUserItem(decoded);

        const initializeConnection = async () => {
            // สร้างการเชื่อมต่อใหม่ทุกครั้งเมื่อหน้าเพจถูกโหลด
            const connection = new HubConnectionBuilder()
                .withUrl(`${process.env.NEXT_PUBLIC_API_URL}/chatHub`, {
                    accessTokenFactory: () => token
                })
                .withAutomaticReconnect()
                .configureLogging(LogLevel.Information)
                .build();

            connection.onreconnecting(error => {
                console.warn(`Connection lost due to error "${error}". Reconnecting.`);
            });

            connection.onreconnected(connectionId => {
                console.log(`Connection reestablished. Connected with connectionId "${connectionId}".`);
            });

            try {
                await connection.start();
                console.log("Connected!");
                setConnection(connection);
            } catch (error) {
                console.error("Error while connecting to SignalR Hub:", error);
            }

            return connection;
        };

        initializeConnection(); // เริ่มต้นการเชื่อมต่อ

        // ฟังก์ชัน cleanup (ภายใน return () => { ... } ของ useEffect) จะถูกเรียกใช้เมื่อคอมโพเนนต์ถูก unmount หรือเมื่อมีการเปลี่ยนแปลงใน dependency array ของ useEffect (ในกรณีนี้คือ ไม่ได้กำหนด)
        // ที่จริงถ้าไม่มี dependency ไม่ต้องใส่ cleanup function ก็ได้ เพราะอย่างไร การรีเฟสหน้าใหม่ก็เป็นการ ตัดการเชื่อต่อ และ เชื่อต่อใหม่อยุ่ดี
        // แต่ก็ต้องมีไว้ เพราะ ช่วยให้มั่นใจว่าการเชื่อมต่อ SignalR ถูกยกเลิกอย่างถูกต้องเมื่อคอมโพเนนต์ถูก unmount ซช่วยลดโอกาสในการเกิดปัญหาการเชื่อมต่อซ้ำซ้อน
        // การหลีกเลี่ยงการรั่วของหน่วยความจำ เมื่อคอมโพเนนต์ถูก unmount โดยไม่มีการหยุดการเชื่อมต่อ
        return () => {
            if (connection) {
                connection.stop();
            }
        };
    }, []);

    useEffect(() => {
        //reset pagno เมื่อเปลี่ยนห้องแชท
        setPage(1);


        if (!connection) return;

        getUnreadMessageCount().then((data) => {
            setNewMsgCount(data || []);
        });

        if (roomId) {
            //ทุกครั้งที่เปลี่ยนห้องแชท



            //โหลดครังแรก SET เวลา ให้เป็นเวลาปัจจุบัน
            var initialDate = new Date();

            try {
                fetchMsgHistory(roomId, 1, pageSize, initialDate.toISOString()).then((res: any) => {
                    console.log('msg history load')
                    var sortMsg = res.records.sort((a: any, b: any) =>
                        new Date(a.sentTime).getTime() - new Date(b.sentTime).getTime());

                    setMessages(sortMsg);
                    // console.log(sortMsg);
                    setInitialQueryTime(new Date(res.initialQueryTime));
                    setTotalRecords(res.totalRecords);
                    
                    //เข้าร่วมห้องแชท เป็นการอ่านข้อความของห้องนี้
                    markMsgAsRead(roomId).then((msgUnread) => {
                        setNewMsgCount(msgUnread || []);
                        console.log(msgUnread);
                    });
                });

                scrollToBottom()
            } catch (err) {
                console.error("Error retrieving message history:", err);
            }
        }

        if (userItem?.role.toUpperCase() === 'INSTRUCTOR') {
            fetchInstructorSectionsMessage();
        }

        const handleReceiveMessage = (receivedRoomId: string, content: string, sender: string, senderName: string, senderImage: string, sentTime: string, messageFiles: MessageFileResponeDTO[]) => {

            console.log("call function receiveMesaage.")
            console.log("Received Msg  1. " + JSON.stringify(messageFiles));

            //Joine room
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

                // Assuming setMessages updates.
                setMessages(prevMessages => [...prevMessages, newMsg]);

                //ตั้งค่าการอ่านข้อความเลย หาก joine room อยู่แล้ว
                markMsgAsRead(roomId).then((data) => {
                    setNewMsgCount(data || []);
                    console.log(data);
                });
            }

            //ไม่ joine room
            else {
                //ทุกครั้งที่มีข้อความเข้า ขณะไม่ได้อยู่ให้ห้อง ให้เช็คข้อความที่มาใหม่ในห้องอื่นๆ มาแสดงว่ามีข้อความเข้าใหม่
                //หากเป็นนักเรียน filter ตาม id module_id ว่ามีข้อความเข้าใหม่หรือปล่าว
                getUnreadMessageCount().then((data) => {
                    setNewMsgCount(data || []);
                    console.log(data);
                });

                playNotificationSound(); // เล่นเสียงแจ้งเตือนเมื่อได้รับข้อความใหม่ ขณะที่ไม่ได้อยู่ในห้อง
            }

           

            //โหลดใหม่ทุกครั้งไม่สน joine หรือปล่าว
            if (userItem?.role.toUpperCase() === 'INSTRUCTOR') {
                fetchInstructorSectionsMessage();
            }
            
        };

        const handleUserStatusUpdate = (userId:string, status:boolean) => {
            console.log("User Status Updated:", userId, status);
            if (userId.toUpperCase() === selectedChatRoomData?.studentId.toUpperCase()) {
                setIsOnline(status);
            }
        };
    

        //// ลงทะเบียน event listeners
        connection.on("ReceiveMessage", handleReceiveMessage);
        connection.on("UserStatusUpdate",handleUserStatusUpdate);

        // ฟังก์ชัน cleanup (ภายใน return () => { ... } ของ useEffect) จะถูกเรียกใช้เมื่อคอมโพเนนต์ถูก unmount หรือเมื่อมีการเปลี่ยนแปลงใน dependency array ของ useEffect (ในกรณีนี้คือ connection, roomId)
        return () => {
            console.log('มีการเปลี่ยนห้องแชทจ้าาา !!!!!!!. ลบ event listener ด่วนๆจ้าาา')
            connection.off("ReceiveMessage", handleReceiveMessage);
            connection.off("UserStatusUpdate",handleUserStatusUpdate);
        };


    }, [connection, roomId]);  // Add dependencies here

    useEffect(() => {
        if (!roomId) return;
        console.log(initialQueryTime.toISOString());
        const loadMessages = async () => {
            setIsLoading(true);
            try {

                console.log(Math.ceil(totalRecords / pageSize));
                console.log(page);
                if (page > Math.ceil(totalRecords / pageSize))
                    return;

                //การโหลดหน้าเพิ่มแต่ล่ะครั้งตั้งส่งเวลาครั้งแรก เพื่อรักษาข้อความต่อเนื่อง
                fetchMsgHistory(roomId, page, pageSize, initialQueryTime.toISOString()).then((res: any) => {
                    //เก็บเวลาปัจจุบันไว้ใน state
                    setPage(res.pageNumber);
                    setInitialQueryTime(new Date(res.initialQueryTime));

                    var sortMsg = res.records.sort((a: any, b: any) =>
                        new Date(a.sentTime).getTime() - new Date(b.sentTime).getTime());

                    setMessages(prev => [...sortMsg, ...prev]);
                    setHasMore(res.totalRecords > messages.length + res.records.length);
                    setTotalRecords(res.totalRecords);
                });
            } catch (error) {
                console.error("Failed to fetch messages:", error);
            }
            setIsLoading(false);
            scrollToCenter();
        };

        // if (hasMore && !isLoading) {
        loadMessages();
        // }
    }, [page]);

    // Listen to scroll events and calculate when to fetch next page
    useEffect(() => {
        const handleScroll = () => {
            // Check if the scrollTop is 0 (scrolled to the top)
            if (scrollDivRef.current.scrollTop === 0) {
                setPage(prev => prev + 1);
            }
        };

        const div = scrollDivRef.current;
        div.addEventListener('scroll', handleScroll);  // Add event listener to the div

        // Cleanup function to remove event listener
        return () => div.removeEventListener('scroll', handleScroll);
    }, []);  // Empty dependency array to ensure this effect runs once


    const loadmore = async () => {
        setPage(prev => prev + 1);
    };

    // const handleReceiveMessageUser = (message:string) => {
    //     console.log(message);
    //     setMessageUser(message);
    //     setNewMessagesCount(prev => prev + 1);
    // };


    // ฟังก์ชันกรองข้อมูลตาม chatRoomId
    const filterByChatRoomId = (courses: SectionMessage[], chatRoomId: string): any => {
        for (const course of courses) {
            for (const module of course.modules) {
                const chatRoom = module.chatRooms.find(chatRoom => chatRoom.chatRoomId === chatRoomId);
                if (chatRoom) {
                    return {
                        courseCode: course.courseCode,
                        courseName: course.courseName,
                        courseImage: course.courseImage,
                        moduleName: module.moduleName,
                        chatRoomId: chatRoomId,
                        studentId: chatRoom.studentId,
                        studentName: chatRoom.studentName,
                        studentImage: chatRoom.studentImage
                    };
                }
            }
        }
        return null;
    };
    const fetchInstructorSectionsMessage = async () => {
        var termId = '070F33F2-51C6-4A3D-6622-08DC0FF4C7FB';
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/DirectMessage/${termId}?search=`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            var data = response.data.data;
            setInstructorSectionsMsgList(data);
            console.log(data);

            // var roomHeaderData = data.filter(x=>x.)
            const result = filterByChatRoomId(data, roomId);
            console.log("Chat Room Message filter:");
            console.log(result);

            setSelectedChatRoomData(result);

        } catch (err) {
            console.error("Error retrieving sectionList:", err);
        }
    };

    const sendMessage = async (content: string) => {

        //ตรวจสอบว่า connection ไม่หลุด ก่อนทำการใดๆ
        if (connection) {
            try {
                var attachments = [];
                if (content.trim() == '' && attachments.length < 1) {
                    alert('ไม่สามารถส่งค่าว่างได้!!!');
                    return;
                }
                // Attempt to save the message to the database via API first
                //createMessage(roomId, content, [{ 'fileId': "469550BA-1F3F-44BA-2FDB-08DC18A2AB6C", 'sortOrder': 1 }]).then(async (res: ResponseMessageDTO | null) => {
                createMessage(roomId, content, []).then(async (res: ResponseMessageDTO | null) => {
                    console.log("Sent Msg 1. " + JSON.stringify(res));
                    if (res) {
                        console.log("Sent Msg  2. " + JSON.stringify(res.messageFiles))


                        // Ensures that all necessary data is present
                        try {
                            // Only if the above succeeds, send the message through SignalR
                            await connection.invoke("SendMessage",
                                res.chatRoomId,
                                res.content,
                                res.senderId,
                                res.senderName,
                                res.senderImage,
                                res.sentTime,
                                res.messageFiles);
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
            console.log("No connection established.");
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

    const onOpenChatRoom = (chatRoomId: string, courseCode: string, courseName: string, courseImage: string, moduleName: string, studentId: string, studentName: string, studentImage: string) => {
        setRoomId(chatRoomId);

        const details: ChatRoomdetails = {
            courseCode,
            courseName,
            courseImage,
            moduleName,
            chatRoomId,
            studentId,
            studentName,
            studentImage
        };

        setSelectedChatRoomData(details);


        //ตรวจสอบสถานะ ออนไลน์ของคู่สนทนา ครั้งแรกที่ joine room
        var uuss = checkUserOnline(studentId).then((status: boolean) => {
            setIsOnline(status);
            console.log(status);
        });

        // ต่อ query string และเปลี่ยนหน้าเพจ
        // const queryString = new URLSearchParams({
        //     chatRoomId,
        //     courseCode,
        //     courseName,
        //     courseImage,
        //     moduleName,
        //     studentId,
        //     studentName,
        //     studentImage
        // }).toString();

        router.push(`/chat?r=${chatRoomId}`);
    }


    const stopConnection = () => {

        if (connection) {
            connection.stop();
        }
        router.push('/login');
    };

    return (
        <div className="p-2 text-xs">

            <button className=" bg-blue-500 text-white p-2 rounded" onClick={() => stopConnection()}> STOP CONNECTION</button>
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
                                                <div className=" hover:text-blue-700 shadow border p-2 rounded-md mb-1 bg-white"
                                                    onClick={(e) => onOpenChatRoom(room.chatRoomId,
                                                        sec.courseCode,
                                                        sec.courseName,
                                                        sec.courseImage,
                                                        module.moduleName,
                                                        room.studentId,
                                                        room.studentName,
                                                        room.studentImage)}
                                                    key={room.chatRoomId}>
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

                    {selectedChatRoomData && (
                        <div>
                            <h3>รายละเอียดห้องแชท คู่สนทนา:</h3>
                            <p>Course Code: {selectedChatRoomData.courseCode}</p>
                            <p>Course Name: {selectedChatRoomData.courseName}</p>
                            <p>Course Image: <img width={50} height={50} src={selectedChatRoomData.courseImage} alt="Course" /></p>
                            <p>Module Name: {selectedChatRoomData.moduleName}</p>
                            <p>Chat Room ID: {selectedChatRoomData.chatRoomId}</p>
                            <p>Student ID: {selectedChatRoomData.studentId}</p>
                            <p>Student Name: {selectedChatRoomData.studentName}</p>
                            <p>Student Img: {selectedChatRoomData.studentImage}</p>

                            <b>สถานะออนไลน์ {isOnline ? "online" : "offline"} </b>
                        </div>
                    )}

                    <br></br>
                    <button onClick={loadmore} className="bg-blue-500 text-white p-2 rounded">LOADD MORE</button>
                    <div ref={scrollDivRef} style={{ maxHeight: '500px', overflowY: 'auto' }}>

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
                                    <p className="text-xs text-blue-900">{msg.content}</p>
                                    <p className="text-xs">{new Date(msg.sentTime).toLocaleString()}</p>
                                    {msg.messageFiles?.map((img, index) => (
                                        <img key={index}
                                            src={getImageSrc(img.fileUrl)}
                                            width={100}
                                            height={100}
                                            alt="message img"
                                            className="rounded-md"
                                        />
                                    ))}


                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="d-flex justify-row sticky bottom-0 mt-2">
                        <input
                            className="border p-2 mr-2 rounded w-full"
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
