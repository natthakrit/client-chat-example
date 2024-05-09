export interface JWTDTO {
    sub: string
    role: string
    unique_name: string
    entity_id: string
    nbf: number
    exp: number
    iat: number
    iss: string
    aud: string
}

export interface SectionMessage {
    sectionId: string
    courseId: string
    courseCode: string
    courseName: string
    courseImage: string
    modules: Module[]
}

export interface Module {
    moduleId: string
    moduleName: string
    chatRooms: ChatRoom[]
}

export interface ChatRoom {
    chatRoomId: string
    studentName: string
    studentImage: string
    lastMessage: string
    lastMessageSentTime: string
    foundMessageCount: number
}

export interface ResponseRoomMember {
    chatRoomId: string
    userPresences: UserPresent[]
}

export interface UserPresent {
    userId: string
    connectionId: string
    isOnline: string
    lastOnline: string
}

export interface UnreadMessageCountDTO {
    chatRoomId: string
    moduleId: string
    unreadCount: number
}

export interface ResponeMessageHistory {
    totalRecords: string
    records: ResponseMessageDTO[]
    pageNumber: number
    pageSize: number
    initialQueryTime: Date
}

export interface SendMessageDTO {
    chatRoomId: string
    content: string
    attachments: FileAttachment[]
}

export interface FileAttachment {
    fileId: string
    sortOrder: number
}

export interface ResponseMessageDTO {
    chatRoomId: string
    senderId: string
    senderName: string
    senderImage: string
    content: string
    sentTime: Date
    messageFiles: MessageFileResponeDTO[]
};

export interface MessageFileResponeDTO {
    fileName: string
    url: string
    sortOrder: number
}
