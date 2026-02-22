/* eslint-disable @typescript-eslint/no-namespace */
export interface AdminAuthContext {
  userId: string;
  role: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AdminAuthContext;
    }
  }
}

export {};
