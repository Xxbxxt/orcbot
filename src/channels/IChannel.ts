export interface IChannel {
    name: string;
    start(): Promise<void>;
    stop(): Promise<void>;
    // Returns `true` if the message was actually sent, or `false` if the channel
    // chose to defer delivery (e.g. user is active). Channels may also return
    // a string (message ID) for editing support, or nothing (void).
    sendMessage(to: string, message: string): Promise<string | boolean | void>;
    sendFile(to: string, filePath: string, caption?: string): Promise<void>;
    sendTypingIndicator(to: string): Promise<void>;
    /**
     * Update/Edit a previously sent message.
     * Returns the new message ID if successful.
     */
    updateMessage?(to: string, messageId: string, newMessage: string): Promise<string | void>;
    /**
     * React to a message with an emoji.
     * @param chatId - The chat/channel ID where the message lives
     * @param messageId - The ID of the message to react to
     * @param emoji - The emoji to react with (e.g. '👍', '❤️', '😂')
     */
    react?(chatId: string, messageId: string, emoji: string): Promise<{ method: 'reaction' | 'reply' } | void>;
}
