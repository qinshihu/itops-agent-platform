declare module 'net-snmp' {
  // v1/v2c: community + options
  export function createSession(target: string, community: string, options: SessionOptions): Session;

  export const Session: {
    createV3(target: string, user: string, options: V3SessionOptions): Session;
  };

  export function createReceiver(address: string, port: number, callback: (error: Error | null, data?: TrapData) => void): Receiver;
  export function createAgent(): any;
  export function isVarbindError(varbind: Varbind): boolean;
  export function varbindError(varbind: Varbind): string;

  export const Version1: number;
  export const Version2c: number;
  export const Version3: number;

  // get() 接受 string OID 或 VarbindDef 对象，内部会做 { oid: item } 转换
  type GetOidArg = string | VarbindDef;
  export interface Session {
    get(varbinds: GetOidArg[], callback: (error: Error | null, varbinds: Varbind[]) => void): void;
    getNext(varbinds: VarbindDef[], callback: (error: Error | null, varbinds: Varbind[]) => void): void;
    walk(oid: string, maxRepetitions: number, feedCb: (varbinds: Varbind[]) => boolean, doneCb: (error: Error | null) => void): void;
    subtree(oid: string, maxRepetitions: number, feedCb: (varbinds: Varbind[]) => boolean, doneCb: (error: Error | null) => void): void;
    trap(trap: TrapData, callback: (error: Error | null) => void): void;
    close(): void;
    community?: string;
    port?: number;
    version?: number;
  }

  export interface SessionOptions {
    port?: number;
    timeout?: number;
    retries?: number;
    version?: number;
    transport?: string;
  }

  export interface V3SessionOptions {
    port?: number;
    timeout?: number;
    retries?: number;
    version?: number;
    transport?: string;
    authProtocol?: string;
    authKey?: string;
    privProtocol?: string;
    privKey?: string;
  }

  export interface Receiver {
    close(): void;
  }

  export interface VarbindDef {
    oid: string;
    type?: number;
    value?: any;
  }

  export interface Varbind {
    oid: string;
    type: number;
    value: any;
  }

  export interface TrapData {
    sourceAddress?: string;
    agentAddress?: string;
    enterprise?: string;
    genericType?: number;
    specificType?: number;
    varbinds?: Varbind[];
  }
}
