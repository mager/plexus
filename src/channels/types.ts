export type IncomingMessage = {
  channel: string;
  conversationId: string;
  userId: string;
  userName?: string;
  text: string;
  reply: (text: string) => Promise<void>;
  typing?: () => Promise<void>;
};

export type Channel = {
  name: string;
  start: (handler: (msg: IncomingMessage) => Promise<void>) => Promise<void>;
  stop?: () => Promise<void>;
};
